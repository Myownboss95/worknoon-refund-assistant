import {
  ConversationDetailSchema,
  ErrorResponseSchema,
  RefundRequestDetailSchema,
  RefundRequestListSchema,
  ResetResponseSchema,
  StatsSchema,
  type RefundStatus,
} from '@worknoon/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
  type TestApp,
} from './support/test-app.js';

/** Scenario ids run for this suite: 1 approved, 3 denied, 5 escalated (R06), 13 escalated (R04). */
const SCENARIO_IDS = [1, 3, 5, 13] as const;

describe('admin endpoints (e2e)', () => {
  let t: TestApp;
  const requestIds = new Map<number, string>();

  const admin = (method: 'get' | 'post', path: string) =>
    t.http[method](`${API}/admin${path}`).set('X-Admin-Token', ADMIN_TOKEN);

  beforeAll(async () => {
    t = await createTestApp();
    await resetDemo(t.http);
    for (const id of SCENARIO_IDS) {
      const scenario = contracts.scenarios.scenarios.find((candidate) => candidate.id === id);
      if (scenario === undefined) throw new Error(`Scenario ${id} missing`);
      const verified = await verify(t.http, scenario.email, scenario.orderNumber);
      const response = await sendMessage(
        t.http,
        verified.conversation.id,
        scenario.messages[0] ?? '',
        itemIdsFor(verified, scenario.skus),
      );
      requestIds.set(id, response.decision?.refundRequestId ?? '');
    }
  });

  afterAll(async () => {
    await t.close();
  });

  const requestId = (scenarioId: number): string => {
    const id = requestIds.get(scenarioId);
    if (id === undefined) throw new Error(`No request for scenario ${scenarioId}`);
    return id;
  };

  describe('authentication', () => {
    it.each([
      ['GET', '/refund-requests'],
      ['GET', '/stats'],
      ['POST', '/demo/reset'],
      ['GET', '/refund-requests/not-a-uuid'],
    ])('%s %s requires the admin token', async (method, path) => {
      for (const token of [undefined, '', 'wrong-token', `${ADMIN_TOKEN}x`]) {
        const url = `${API}/admin${path}`;
        const call = method === 'GET' ? t.http.get(url) : t.http.post(url);
        const response = await (token === undefined ? call : call.set('X-Admin-Token', token));
        expect(response.status).toBe(401);
        expect(ErrorResponseSchema.parse(response.body).error.code).toBe('ADMIN_UNAUTHORIZED');
      }
    });
  });

  describe('GET /admin/refund-requests', () => {
    it('lists assistant-created requests newest first, excluding imported history', async () => {
      const list = RefundRequestListSchema.parse(
        (await admin('get', '/refund-requests').expect(200)).body,
      );
      expect(list.meta).toEqual({ page: 1, perPage: 20, total: 4, lastPage: 1 });
      expect(list.data.map((row) => row.id)).toEqual([...SCENARIO_IDS].reverse().map(requestId));
      expect(list.data[0]).toMatchObject({
        status: 'escalated',
        decidedBy: 'policy',
        customer: { name: 'Musa Garba', email: 'musa.garba@example.com' },
        orderNumber: 'WN-1013',
        amountCents: 8500,
        currency: 'USD',
        reasonCategory: 'damaged',
        flags: [],
        decisiveRuleIds: ['R04'],
      });
    });

    it.each<[RefundStatus, number[]]>([
      ['approved', [1]],
      ['denied', [3]],
      ['escalated', [13, 5]],
    ])('filters by status %s', async (status, scenarios) => {
      const list = RefundRequestListSchema.parse(
        (await admin('get', `/refund-requests?status=${status}`).expect(200)).body,
      );
      expect(list.data.map((row) => row.id)).toEqual(scenarios.map(requestId));
    });

    it('paginates', async () => {
      const page2 = RefundRequestListSchema.parse(
        (await admin('get', '/refund-requests?page=2&perPage=3').expect(200)).body,
      );
      expect(page2.meta).toEqual({ page: 2, perPage: 3, total: 4, lastPage: 2 });
      expect(page2.data.map((row) => row.id)).toEqual([requestId(1)]);

      const beyond = RefundRequestListSchema.parse(
        (await admin('get', '/refund-requests?page=9').expect(200)).body,
      );
      expect(beyond.data).toEqual([]);
      const last = RefundRequestListSchema.parse(
        (await admin('get', '/refund-requests?page=10000').expect(200)).body,
      );
      expect(last.meta.page).toBe(10_000);
    });

    it.each(['status=pending', 'page=0', 'page=10001', 'perPage=101', 'page=abc'])(
      'rejects %s with 422',
      async (query) => {
        const response = await admin('get', `/refund-requests?${query}`);
        expect(response.status).toBe(422);
        expect(ErrorResponseSchema.parse(response.body).error.code).toBe('VALIDATION_FAILED');
      },
    );
  });

  describe('GET /admin/refund-requests/:id', () => {
    it('returns the full decision trace', async () => {
      const detail = RefundRequestDetailSchema.parse(
        (await admin('get', `/refund-requests/${requestId(5)}`).expect(200)).body,
      );
      expect(detail.items).toEqual([
        expect.objectContaining({
          sku: 'ELE-AERO-14',
          name: 'AeroBook 14 Laptop',
          quantity: 1,
          amountCents: 129_900,
          finalSale: false,
        }),
      ]);
      expect(detail.conversation.messages.map((message) => message.role)).toEqual([
        'assistant',
        'customer',
        'assistant',
      ]);
      expect(detail.trace).toMatchObject({
        policyVersion: '1.0',
        facts: {
          orderStatus: 'delivered',
          daysSinceDelivery: 3,
          amountCents: 129_900,
          recentApprovedRefunds: 0,
          finalSaleItemIds: [],
          alreadyRefundedItemIds: [],
        },
        extraction: { reasonCategory: 'damaged', confidence: 0.93, injectionSuspected: false },
        heuristicMatches: [],
        flags: [],
        clarificationTurns: 0,
        ai: {
          provider: 'mock',
          model: 'mock',
          promptVersions: { extract: 'extract.v1', compose: 'compose.v1' },
        },
        replyGuard: { passed: true, violations: [], usedTemplate: false },
      });
      expect(detail.trace.rules.find((rule) => rule.ruleId === 'R06')?.outcome).toBe('escalate');
      expect(detail.review).toBeNull();
      expect(detail.auditEvents.map((event) => event.type)).toEqual([
        'conversation.started',
        'refund.decided',
      ]);
      expect(detail.auditEvents[1]?.data).toEqual({
        status: 'escalated',
        decisiveRuleIds: ['R06'],
        flags: [],
        amountCents: 129_900,
      });
    });

    it('returns 404 for imported history, unknown and non-UUID ids', async () => {
      const imported = await t.prisma.refundRequest.findFirstOrThrow({
        where: { decidedBy: 'import' },
      });
      for (const id of [imported.id, 'f5c1b7a2-1f38-4c7e-8a51-3d7c2b9e0a44', 'abc']) {
        const response = await admin('get', `/refund-requests/${id}`);
        expect(response.status).toBe(404);
        expect(ErrorResponseSchema.parse(response.body).error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('POST /admin/refund-requests/:id/review', () => {
    it('approves an escalated request, notifies the customer and audits it', async () => {
      const response = await admin('post', `/refund-requests/${requestId(5)}/review`)
        .send({ decision: 'approve', note: '  Photos confirm the cracked screen.  ' })
        .expect(200);
      const detail = RefundRequestDetailSchema.parse(response.body);
      expect(detail).toMatchObject({
        status: 'approved',
        decidedBy: 'human',
        decisiveRuleIds: ['R06'],
      });
      expect(detail.review).toMatchObject({
        decision: 'approve',
        note: 'Photos confirm the cracked screen.',
        reviewer: 'admin',
      });
      expect(detail.conversation.messages.at(-1)).toMatchObject({
        role: 'system',
        content:
          'Update from our support team: your refund of $1,299.00 has been approved. It will go back to your original payment method within 5 to 10 business days. Note from the reviewer: Photos confirm the cracked screen.',
      });
      expect(detail.auditEvents.at(-1)).toMatchObject({
        type: 'refund.reviewed',
        actor: 'admin',
        data: { decision: 'approve', note: 'Photos confirm the cracked screen.' },
      });

      const conversation = ConversationDetailSchema.parse(
        (await t.http.get(`${API}/conversations/${detail.conversation.id}`).expect(200)).body,
      );
      expect(conversation.decision).toMatchObject({
        status: 'approved',
        decidedBy: 'human',
        customerReason: 'Your refund of $1,299.00 has been approved.',
      });
      expect(conversation.order.items[0]?.refundStatus).toBe('approved');
    });

    it('denies an escalated request', async () => {
      const response = await admin('post', `/refund-requests/${requestId(13)}/review`)
        .send({ decision: 'deny', note: 'Clearance item, damage not confirmed.' })
        .expect(200);
      const detail = RefundRequestDetailSchema.parse(response.body);
      expect(detail).toMatchObject({
        status: 'denied',
        decidedBy: 'human',
        decisiveRuleIds: ['R04'],
        flags: [],
      });
      expect(detail.conversation.messages.at(-1)?.content).toBe(
        "Update from our support team: after reviewing your request, we're unable to offer a refund. Note from the reviewer: Clearance item, damage not confirmed.",
      );
      expect(detail.trace.rules.find((rule) => rule.ruleId === 'R04')?.outcome).toBe('escalate');
      const conversation = ConversationDetailSchema.parse(
        (await t.http.get(`${API}/conversations/${detail.conversation.id}`).expect(200)).body,
      );
      expect(conversation.decision).toMatchObject({
        status: 'denied',
        decidedBy: 'human',
        decisiveRuleIds: ['R04'],
        customerReason: "After reviewing your request, we're unable to offer a refund.",
      });
    });

    it.each([
      ['already reviewed', 5],
      ['approved by policy', 1],
      ['denied by policy', 3],
    ])('returns 409 REFUND_NOT_REVIEWABLE when %s', async (_case, scenarioId) => {
      const response = await admin('post', `/refund-requests/${requestId(scenarioId)}/review`).send(
        {
          decision: 'deny',
          note: 'Second opinion',
        },
      );
      expect(response.status).toBe(409);
      expect(ErrorResponseSchema.parse(response.body).error.code).toBe('REFUND_NOT_REVIEWABLE');
    });

    it.each([
      [{ decision: 'maybe', note: 'Looks fine' }, ['decision']],
      [{ decision: 'approve', note: '  x ' }, ['note']],
      [{ decision: 'approve', note: 'n'.repeat(1001) }, ['note']],
      [{}, ['decision', 'note']],
    ])('rejects %j with 422', async (body, fields) => {
      const response = await admin('post', `/refund-requests/${requestId(5)}/review`).send(body);
      expect(response.status).toBe(422);
      const { error } = ErrorResponseSchema.parse(response.body);
      expect(error.details?.map((detail) => detail.field)).toEqual(fields);
    });

    it('returns 404 for an unknown request', async () => {
      const response = await admin(
        'post',
        '/refund-requests/c3d1a8e2-7d6b-4f1a-9e3c-5b2a1d0f9e88/review',
      ).send({
        decision: 'approve',
        note: 'Looks fine',
      });
      expect(response.status).toBe(404);
    });
  });

  describe('GET /admin/stats', () => {
    it('counts outcomes and rates', async () => {
      const stats = StatsSchema.parse((await admin('get', '/stats').expect(200)).body);
      // After the reviews above: 1 approved by policy, 1 denied by policy, 1 approved by a human,
      // 1 denied by a human (both human decisions were escalations).
      expect(stats).toEqual({
        total: 4,
        byStatus: { approved: 2, denied: 2, escalated: 0 },
        escalatedTotal: 2,
        humanReviewed: 2,
        escalationRate: 0.5,
        autoResolutionRate: 0.5,
      });
    });
  });

  describe('POST /admin/demo/reset', () => {
    it('truncates and re-seeds', async () => {
      const reset = ResetResponseSchema.parse(
        (await admin('post', '/demo/reset').expect(200)).body,
      );
      expect(reset).toEqual({ reset: true, customers: 15, orders: 19 });
      const stats = StatsSchema.parse((await admin('get', '/stats').expect(200)).body);
      expect(stats).toEqual({
        total: 0,
        byStatus: { approved: 0, denied: 0, escalated: 0 },
        escalatedTotal: 0,
        humanReviewed: 0,
        escalationRate: 0,
        autoResolutionRate: 0,
      });
      expect(await t.prisma.refundRequest.count({ where: { decidedBy: 'import' } })).toBe(5);
      expect(await t.prisma.auditEvent.count()).toBe(0);
    });
  });
});

class ProductionLikeConfig extends AppConfig {
  override readonly demoMode = false;
}

class StrictAdminFailuresConfig extends AppConfig {
  override readonly rateLimitAdminFailuresPerMinute = 3;
}

const expectCode = (body: unknown, code: string): void => {
  expect(ErrorResponseSchema.parse(body).error.code).toBe(code);
};

describe('admin hardening with DEMO_MODE off (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp((builder) =>
      builder.overrideProvider(AppConfig).useClass(ProductionLikeConfig),
    );
  });

  afterAll(async () => {
    await t.close();
  });

  it('answers POST /admin/demo/reset with 404 after the token check, and resets nothing', async () => {
    const before = await t.prisma.customer.count();
    const unauthenticated = await t.http.post(`${API}/admin/demo/reset`);
    expect(unauthenticated.status).toBe(401);
    const response = await t.http.post(`${API}/admin/demo/reset`).set('X-Admin-Token', ADMIN_TOKEN);
    expect(response.status).toBe(404);
    expectCode(response.body, 'NOT_FOUND');
    expect(await t.prisma.customer.count()).toBe(before);
  });
});

describe('admin failed-token limit (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp((builder) =>
      builder.overrideProvider(AppConfig).useClass(StrictAdminFailuresConfig),
    );
  });

  afterAll(async () => {
    await t.close();
  });

  it('rate-limits every admin route for an IP after too many failed tokens', async () => {
    // Successful requests do not count.
    await t.http.get(`${API}/admin/stats`).set('X-Admin-Token', ADMIN_TOKEN).expect(200);
    for (const token of [undefined, 'wrong-1', 'wrong-2']) {
      const call = t.http.get(`${API}/admin/stats`);
      const response = await (token === undefined ? call : call.set('X-Admin-Token', token));
      expect(response.status).toBe(401);
    }
    // Now even the right token is refused, on any admin route, and a spoofed X-Forwarded-For
    // does not help because no proxy is trusted by default.
    for (const path of ['/stats', '/refund-requests', '/demo/reset']) {
      const method = path === '/demo/reset' ? 'post' : 'get';
      const response = await t.http[method](`${API}/admin${path}`)
        .set('X-Admin-Token', ADMIN_TOKEN)
        .set('X-Forwarded-For', '203.0.113.7');
      expect(response.status).toBe(429);
      expectCode(response.body, 'RATE_LIMITED');
    }
    // Non-admin routes are unaffected.
    await t.http.get(`${API}/health`).expect(200);
  });
});

class TrustedLoopbackConfig extends AppConfig {
  override readonly trustedProxies = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
  override readonly rateLimitAdminFailuresPerMinute = 1;
}

describe('admin failure limit behind a trusted proxy (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp((builder) =>
      builder.overrideProvider(AppConfig).useClass(TrustedLoopbackConfig),
    );
  });

  afterAll(async () => {
    await t.close();
  });

  const asClient = (ip: string, token: string) =>
    t.http.get(`${API}/admin/stats`).set('X-Forwarded-For', ip).set('X-Admin-Token', token);

  it('keys failures on the X-Forwarded-For client of a trusted proxy', async () => {
    expect((await asClient('203.0.113.7', 'wrong')).status).toBe(401);
    expect((await asClient('203.0.113.7', ADMIN_TOKEN)).status).toBe(429);
    expect((await asClient('203.0.113.8', ADMIN_TOKEN)).status).toBe(200);
  });
});
