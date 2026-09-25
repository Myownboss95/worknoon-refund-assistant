import { ErrorResponseSchema, RefundRequestDetailSchema } from '@worknoon/contracts';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MockRefundAnalyzer } from '../../src/ai/mock-refund-analyzer.js';
import {
  AnalyzerError,
  REFUND_ANALYZER,
  type AnalyzerResult,
  type ComposeInput,
  type RefundAnalyzer,
} from '../../src/ai/refund-analyzer.js';
import { ReplyRenderer } from '../../src/common/reply-renderer.js';
import { AppConfig } from '../../src/config/app-config.js';
import { contracts } from '../support/contracts.js';
import {
  ADMIN_TOKEN,
  API,
  createTestApp,
  itemIdsFor,
  resetDemo,
  sendMessage,
  verify,
  type Http,
  type TestApp,
} from './support/test-app.js';

const ADA = { email: 'ada.okafor@example.com', orderNumber: 'WN-1001', sku: 'KIT-BLND-600' };
const DAMAGED = 'My blender arrived with a cracked jug.';

async function startAda(http: Http): Promise<{ conversationId: string; itemIds: string[] }> {
  const verified = await verify(http, ADA.email, ADA.orderNumber);
  return { conversationId: verified.conversation.id, itemIds: itemIdsFor(verified, [ADA.sku]) };
}

function expectError(
  body: unknown,
  code: string,
): { field: string; message: string }[] | undefined {
  const { error } = ErrorResponseSchema.parse(body);
  expect(error.code).toBe(code);
  return error.details;
}

describe('POST /conversations/:id/messages (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await resetDemo(t.http);
  });

  it('returns 404 for an unknown or non-UUID conversation, before validating the body', async () => {
    for (const id of ['2f0a7c43-8b43-4c1e-9d38-2f6d1c2b8f11', 'nope']) {
      const response = await t.http.post(`${API}/conversations/${id}/messages`).send({});
      expect(response.status).toBe(404);
      expectError(response.body, 'NOT_FOUND');
    }
  });

  it('returns 409 CONVERSATION_CLOSED once a decision has been made', async () => {
    const { conversationId, itemIds } = await startAda(t.http);
    await sendMessage(t.http, conversationId, DAMAGED, itemIds);
    const response = await t.http
      .post(`${API}/conversations/${conversationId}/messages`)
      .send({ text: 'Hello again', itemIds });
    expect(response.status).toBe(409);
    expectError(response.body, 'CONVERSATION_CLOSED');
  });

  it("rejects an item from another customer's order with 422 on itemIds", async () => {
    const { conversationId } = await startAda(t.http);
    const ben = await verify(t.http, 'ben.carter@example.com', 'WN-1002');
    const response = await t.http
      .post(`${API}/conversations/${conversationId}/messages`)
      .send({ text: DAMAGED, itemIds: itemIdsFor(ben, ['SHO-TRL-09']) });
    expect(response.status).toBe(422);
    expect(expectError(response.body, 'VALIDATION_FAILED')).toEqual([
      { field: 'itemIds', message: "Every item must belong to this conversation's order." },
    ]);
    const messages = await t.prisma.message.count({ where: { conversationId, role: 'customer' } });
    expect(messages).toBe(0);
  });

  type BodyFor = (itemIds: string[]) => Record<string, unknown>;
  const cases: [string, BodyFor, string[]][] = [
    ['missing fields', () => ({}), ['text', 'itemIds']],
    ['empty text', (ids) => ({ text: '', itemIds: ids }), ['text']],
    ['control characters only', (ids) => ({ text: ' \u0000\u0007 \n ', itemIds: ids }), ['text']],
    ['text over 1000 characters', (ids) => ({ text: 'a'.repeat(1001), itemIds: ids }), ['text']],
    ['no items', () => ({ text: DAMAGED, itemIds: [] }), ['itemIds']],
    ['a non-UUID item id', () => ({ text: DAMAGED, itemIds: ['abc'] }), ['itemIds']],
    ['duplicate item ids', (ids) => ({ text: DAMAGED, itemIds: [...ids, ...ids] }), ['itemIds']],
    [
      'more than 20 items',
      () => ({ text: DAMAGED, itemIds: Array.from({ length: 21 }, () => crypto.randomUUID()) }),
      ['itemIds'],
    ],
  ];

  it.each(cases)('rejects %s with 422', async (_case, bodyFor, fields) => {
    const { conversationId, itemIds } = await startAda(t.http);
    const response = await t.http
      .post(`${API}/conversations/${conversationId}/messages`)
      .send(bodyFor(itemIds));
    expect(response.status).toBe(422);
    expect(expectError(response.body, 'VALIDATION_FAILED')?.map((detail) => detail.field)).toEqual(
      fields,
    );
  });

  it('accepts 1000 characters after stripping control characters and trimming', async () => {
    const { conversationId, itemIds } = await startAda(t.http);
    const text = `  ${'cracked '.repeat(125).trim()}\u0000  `;
    const response = await sendMessage(t.http, conversationId, text, itemIds);
    expect(response.messages[0]?.content).toBe('cracked '.repeat(125).trim());
  });

  it('keeps the item refund state: an approved item is denied on a second attempt (R05)', async () => {
    const first = await startAda(t.http);
    await sendMessage(t.http, first.conversationId, DAMAGED, first.itemIds);
    const second = await startAda(t.http);
    const response = await sendMessage(t.http, second.conversationId, DAMAGED, second.itemIds);
    expect(response.decision).toMatchObject({ status: 'denied', decisiveRuleIds: ['R05'] });
  });
});

/** Mock analyzer whose compose step can be replaced or paused per test. */
class ScriptedAnalyzer implements RefundAnalyzer {
  readonly provider = 'mock' as const;
  readonly model = 'mock';
  compose: (input: ComposeInput) => Promise<AnalyzerResult<string>>;
  private readonly inner = new MockRefundAnalyzer(
    contracts.mockFixtures,
    new ReplyRenderer(contracts.templates, contracts.policy),
  );
  readonly extract = this.inner.extract.bind(this.inner);

  constructor() {
    this.compose = (input) => this.inner.compose(input);
  }

  reset(): void {
    this.compose = (input) => this.inner.compose(input);
  }

  composeWithTemplate(input: ComposeInput): Promise<AnalyzerResult<string>> {
    return this.inner.compose(input);
  }
}

describe('pipeline fallbacks and races (e2e, scripted analyzer)', () => {
  const analyzer = new ScriptedAnalyzer();
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp((builder) =>
      builder.overrideProvider(REFUND_ANALYZER).useValue(analyzer),
    );
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await resetDemo(t.http);
  });

  afterEach(() => {
    analyzer.reset();
  });

  async function detailFor(refundRequestId: string) {
    const response = await t.http
      .get(`${API}/admin/refund-requests/${refundRequestId}`)
      .set('X-Admin-Token', ADMIN_TOKEN)
      .expect(200);
    return RefundRequestDetailSchema.parse(response.body);
  }

  it('uses the template when the composed reply fails the reply guard', async () => {
    analyzer.compose = async () => ({
      value: 'Great news, your refund of $5,000.00 is approved (rule R08).',
      usage: { inputTokens: 1, outputTokens: 1 },
    });
    const { conversationId, itemIds } = await startAda(t.http);
    const response = await sendMessage(t.http, conversationId, DAMAGED, itemIds);
    expect(response.decision?.status).toBe('approved');
    expect(response.reply.content).toContain('your refund of $89.00 has been approved');
    const detail = await detailFor(response.decision?.refundRequestId ?? '');
    expect(detail.flags).toEqual(['REPLY_GUARD_FALLBACK']);
    expect(detail.trace.replyGuard).toEqual({
      passed: false,
      violations: ['LEAKS_INTERNALS', 'WRONG_AMOUNT'],
      usedTemplate: true,
    });
  });

  it('uses the template and flags COMPOSE_UNAVAILABLE when compose fails twice', async () => {
    analyzer.compose = async () => {
      throw new AnalyzerError('provider_error');
    };
    const { conversationId, itemIds } = await startAda(t.http);
    const response = await sendMessage(t.http, conversationId, DAMAGED, itemIds);
    expect(response.decision?.status).toBe('approved');
    expect(response.reply.content).toContain('your refund of $89.00 has been approved');
    const detail = await detailFor(response.decision?.refundRequestId ?? '');
    expect(detail.flags).toEqual(['COMPOSE_UNAVAILABLE']);
    expect(detail.trace.ai.calls.filter((call) => call.step === 'compose')).toEqual([
      expect.objectContaining({ attempt: 1, ok: false, error: 'provider_error' }),
      expect.objectContaining({ attempt: 2, ok: false, error: 'provider_error' }),
    ]);
  });

  it('returns 409 REFUND_ALREADY_EXISTS when another request claims the item mid-pipeline', async () => {
    const slow = await startAda(t.http);
    const fast = await startAda(t.http);

    const gate = Promise.withResolvers<void>();
    const reachedCompose = Promise.withResolvers<void>();
    analyzer.compose = async (input) => {
      analyzer.compose = (next) => analyzer.composeWithTemplate(next);
      reachedCompose.resolve();
      await gate.promise;
      return analyzer.composeWithTemplate(input);
    };

    const slowResponse = t.http
      .post(`${API}/conversations/${slow.conversationId}/messages`)
      .send({ text: DAMAGED, itemIds: slow.itemIds })
      .then((response) => response);
    await reachedCompose.promise;
    const fastResponse = await sendMessage(t.http, fast.conversationId, DAMAGED, fast.itemIds);
    expect(fastResponse.decision?.status).toBe('approved');
    gate.resolve();

    const conflict = await slowResponse;
    expect(conflict.status).toBe(409);
    expectError(conflict.body, 'REFUND_ALREADY_EXISTS');
    const requests = await t.prisma.refundRequest.count({
      where: { conversationId: slow.conversationId },
    });
    expect(requests).toBe(0);
  });
});

class StrictLimitsConfig extends AppConfig {
  override readonly rateLimitVerifyPerMinute = 2;
  override readonly rateLimitMessagesPerMinute = 1;
}

describe('rate limiting (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp((builder) =>
      builder.overrideProvider(AppConfig).useClass(StrictLimitsConfig),
    );
  });

  afterAll(async () => {
    await t.close();
  });

  it('returns 429 RATE_LIMITED after the per-minute verify limit', async () => {
    const attempt = () =>
      t.http
        .post(`${API}/customers/verify`)
        .send({ email: 'nobody@example.com', orderNumber: 'WN-0000' });
    expect((await attempt()).status).toBe(404);
    expect((await attempt()).status).toBe(404);
    const limited = await attempt();
    expect(limited.status).toBe(429);
    expectError(limited.body, 'RATE_LIMITED');
    // Other endpoints are not limited by the verify budget.
    await t.http.get(`${API}/health`).expect(200);
  });
});
