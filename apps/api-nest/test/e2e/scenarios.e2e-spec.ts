import {
  ConversationDetailSchema,
  RefundRequestDetailSchema,
  type Decision,
  type RefundRequestDetail,
} from '@worknoon/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Scenario } from '../../src/config/contracts.schema.js';
import { contracts, redTeam } from '../support/contracts.js';
import {
  ADMIN_TOKEN,
  API,
  createTestApp,
  itemIdsFor,
  resetDemo,
  sendMessage,
  verify,
  type TestApp,
} from './support/test-app.js';

interface ScenarioRun {
  readonly decision: Decision;
  readonly clarifications: number;
  readonly detail: RefundRequestDetail;
  readonly conversationId: string;
}

async function runConversation(
  t: TestApp,
  email: string,
  orderNumber: string,
  skus: readonly string[],
  messages: readonly string[],
): Promise<ScenarioRun> {
  const verified = await verify(t.http, email, orderNumber);
  const itemIds = itemIdsFor(verified, skus);
  let clarifications = 0;
  let decision: Decision | null = null;
  for (const text of messages) {
    expect(decision, 'no message may follow a decision').toBeNull();
    const response = await sendMessage(t.http, verified.conversation.id, text, itemIds);
    expect(response.messages).toEqual([
      expect.objectContaining({ role: 'customer', content: text, itemIds }),
      response.reply,
    ]);
    expect(response.conversation.status).toBe(response.decision === null ? 'open' : 'closed');
    if (response.decision === null) clarifications += 1;
    decision = response.decision;
  }
  if (decision === null) throw new Error('The conversation ended without a decision');
  const detail = await t.http
    .get(`${API}/admin/refund-requests/${decision.refundRequestId}`)
    .set('X-Admin-Token', ADMIN_TOKEN)
    .expect(200);
  return {
    decision,
    clarifications,
    detail: RefundRequestDetailSchema.parse(detail.body),
    conversationId: verified.conversation.id,
  };
}

const runScenario = (t: TestApp, scenario: Scenario): Promise<ScenarioRun> =>
  runConversation(t, scenario.email, scenario.orderNumber, scenario.skus, scenario.messages);

describe('seed scenarios (e2e)', () => {
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

  it.each(
    contracts.scenarios.scenarios.map(
      (scenario) => [scenario.id, scenario.title, scenario] as const,
    ),
  )('scenario %i: %s', async (_id, _title, scenario) => {
    const { decision, clarifications, detail, conversationId } = await runScenario(t, scenario);
    const { expected } = scenario;

    expect(decision).toMatchObject({
      status: expected.status,
      decidedBy: 'policy',
      amountCents: expected.amountCents,
      currency: 'USD',
      decisiveRuleIds: expected.decisiveRuleIds,
    });
    expect(clarifications).toBe(expected.clarifications);
    expect(detail.flags).toEqual(expected.flags);
    expect(detail.trace.flags).toEqual(expected.flags);
    expect(detail.trace.clarificationTurns).toBe(expected.clarifications);
    expect(detail.trace.rules.map((rule) => rule.ruleId)).toHaveLength(10);
    expect(detail.trace.facts.amountCents).toBe(expected.amountCents);
    expect(detail.trace.ai.calls.map((call) => [call.step, call.ok])).toEqual([
      ['extract', true],
      ['compose', true],
    ]);
    expect(detail.trace.replyGuard).toEqual({ passed: true, violations: [], usedTemplate: false });
    expect(detail.items.reduce((sum, item) => sum + item.amountCents, 0)).toBe(
      expected.amountCents,
    );

    // The customer view agrees, and the items now carry the refund state.
    const conversation = ConversationDetailSchema.parse(
      (await t.http.get(`${API}/conversations/${conversationId}`).expect(200)).body,
    );
    expect(conversation.conversation.status).toBe('closed');
    expect(conversation.decision).toEqual(decision);
    const selected = conversation.order.items.filter((item) => scenario.skus.includes(item.sku));
    const claimedBefore = new Set(
      contracts.scenarios.customers
        .flatMap((customer) => customer.refundHistory ?? [])
        .filter((history) => history.status === 'approved')
        .map((history) => history.sku),
    );
    const expectedState = { approved: 'approved', escalated: 'pending', denied: null }[
      expected.status
    ];
    expect(selected.map((item) => item.refundStatus)).toEqual(
      selected.map((item) => (claimedBefore.has(item.sku) ? 'approved' : expectedState)),
    );
  });

  it('scenario 15 (Olivia) asks once, then approves after the clarification', async () => {
    const olivia = contracts.scenarios.scenarios.find(
      (scenario) => scenario.customerKey === 'olivia',
    );
    if (olivia === undefined) throw new Error('Olivia scenario missing');
    const verified = await verify(t.http, olivia.email, olivia.orderNumber);
    const itemIds = itemIdsFor(verified, olivia.skus);

    const first = await sendMessage(
      t.http,
      verified.conversation.id,
      olivia.messages[0] ?? '',
      itemIds,
    );
    expect(first.decision).toBeNull();
    expect(first.conversation).toMatchObject({ status: 'open', clarificationTurns: 1 });
    expect(first.reply.content).toBe(
      'Thanks, Olivia. To help with your Merino Sweater (Navy), could you tell me a bit more about what went wrong? For example, did it arrive damaged, is it faulty, is it the wrong item, or have you changed your mind?',
    );

    const second = await sendMessage(
      t.http,
      verified.conversation.id,
      olivia.messages[1] ?? '',
      itemIds,
    );
    expect(second.decision).toMatchObject({
      status: 'approved',
      decisiveRuleIds: ['R08'],
      amountCents: 9500,
    });
    expect(second.conversation).toMatchObject({ status: 'closed', clarificationTurns: 1 });
    expect(second.reply.content).toContain('your refund of $95.00 has been approved');

    const events = await t.prisma.auditEvent.findMany({
      where: { conversationId: verified.conversation.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(events.map((event) => event.type)).toEqual([
      'conversation.started',
      'conversation.clarification_requested',
      'refund.decided',
    ]);
  });

  it('stops asking after the clarification limit and escalates', async () => {
    const run = await runConversation(
      t,
      'olivia.chen@example.com',
      'WN-1015',
      ['APP-SWTR-NVY'],
      ["I'm not happy with it.", 'I am just disappointed.'],
    );
    expect(run.clarifications).toBe(1);
    expect(run.decision).toMatchObject({ status: 'escalated', decisiveRuleIds: ['R07', 'R10'] });
    expect(run.detail.flags).toEqual(['CLARIFICATION_EXHAUSTED', 'LOW_CONFIDENCE']);
    expect(run.detail.trace.clarificationTurns).toBe(2);
  });

  it('fails safe to escalation during a simulated AI outage', async () => {
    const run = await runConversation(
      t,
      'ada.okafor@example.com',
      'WN-1001',
      ['KIT-BLND-600'],
      ['My blender is cracked. simulate AI outage'],
    );
    expect(run.clarifications).toBe(0);
    expect(run.decision).toMatchObject({ status: 'escalated', decisiveRuleIds: ['R07', 'R10'] });
    expect(run.detail.flags).toEqual(['AI_UNAVAILABLE']);
    expect(run.detail.reasonCategory).toBeNull();
    expect(run.detail.trace.extraction).toBeNull();
    const extractCalls = run.detail.trace.ai.calls.filter((call) => call.step === 'extract');
    expect(extractCalls).toEqual([
      expect.objectContaining({ attempt: 1, ok: false, error: 'timeout' }),
      expect.objectContaining({ attempt: 2, ok: false, error: 'timeout' }),
    ]);
  });

  describe('red team', () => {
    it.each(redTeam.attacks)('"$id" is never approved and never clarified', async ({ text }) => {
      const run = await runConversation(t, redTeam.email, redTeam.orderNumber, redTeam.skus, [
        text,
      ]);
      expect(run.clarifications).toBe(0);
      expect(['escalated', 'denied']).toContain(run.decision.status);
      expect(run.detail.flags).toContain('INJECTION_HEURISTIC');
      expect(run.detail.trace.heuristicMatches.length).toBeGreaterThan(0);
    });
  });
});
