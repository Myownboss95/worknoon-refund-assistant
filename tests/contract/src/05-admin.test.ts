import { beforeAll, describe, expect, it } from 'vitest';
import {
  ConversationDetailSchema,
  RefundRequestDetailSchema,
  RefundRequestListSchema,
  StatsSchema,
} from '@worknoon/contracts';
import {
  expectError,
  expectOk,
  playScenario,
  request,
  resetDemo,
  scenarios,
} from './support.js';

const byTitle = (id: number) => {
  const scenario = scenarios.find((s) => s.id === id);
  if (!scenario) throw new Error(`No scenario ${id}`);
  return scenario;
};

describe('admin dashboard, review and stats', () => {
  let emekaRequestId = '';
  let adaRequestId = '';

  beforeAll(async () => {
    await resetDemo();
    // Ada approved, Chidi denied, Emeka escalated, Musa escalated.
    adaRequestId = (await playScenario(byTitle(1))).last.decision!.refundRequestId;
    await playScenario(byTitle(3));
    emekaRequestId = (await playScenario(byTitle(5))).last.decision!.refundRequestId;
    await playScenario(byTitle(13));
  });

  it('lists assistant-created requests only, newest first', async () => {
    const list = expectOk(
      await request('GET', '/admin/refund-requests', { admin: true }),
      200,
      RefundRequestListSchema,
    );
    // Imported history (Halima, Kemi) is excluded.
    expect(list.meta).toEqual({ page: 1, perPage: 20, total: 4, lastPage: 1 });
    expect(list.data.map((r) => r.orderNumber)).toEqual(['WN-1013', 'WN-1005', 'WN-1003', 'WN-1001']);
    expect(list.data[3]?.customer).toEqual({ name: 'Ada Okafor', email: 'ada.okafor@example.com' });
  });

  it('filters by status and paginates', async () => {
    const escalated = expectOk(
      await request('GET', '/admin/refund-requests?status=escalated', { admin: true }),
      200,
      RefundRequestListSchema,
    );
    expect(escalated.data.map((r) => r.orderNumber)).toEqual(['WN-1013', 'WN-1005']);
    expect(escalated.data.every((r) => r.status === 'escalated')).toBe(true);

    const page2 = expectOk(
      await request('GET', '/admin/refund-requests?page=2&perPage=3', { admin: true }),
      200,
      RefundRequestListSchema,
    );
    expect(page2.meta).toEqual({ page: 2, perPage: 3, total: 4, lastPage: 2 });
    expect(page2.data.map((r) => r.orderNumber)).toEqual(['WN-1001']);

    const empty = expectOk(
      await request('GET', '/admin/refund-requests?page=9', { admin: true }),
      200,
      RefundRequestListSchema,
    );
    expect(empty.data).toEqual([]);
  });

  it('returns the full decision trace and audit trail', async () => {
    const ada = expectOk(
      await request('GET', `/admin/refund-requests/${adaRequestId}`, { admin: true }),
      200,
      RefundRequestDetailSchema,
    );
    expect(ada.status).toBe('approved');
    expect(ada.items).toEqual([
      expect.objectContaining({ sku: 'KIT-BLND-600', amountCents: 8900, quantity: 1, finalSale: false }),
    ]);
    expect(ada.trace.extraction?.reasonCategory).toBe('damaged');
    expect(ada.trace.rules.find((r) => r.ruleId === 'R08')?.outcome).toBe('approve');
    expect(ada.trace.ai.calls.map((c) => [c.step, c.ok])).toEqual([
      ['extract', true],
      ['compose', true],
    ]);
    expect(ada.conversation.messages.map((m) => m.role)).toEqual(['assistant', 'customer', 'assistant']);
    expect(ada.review).toBeNull();
    const types = ada.auditEvents.map((e) => e.type);
    expect(types).toContain('conversation.started');
    expect(types).toContain('refund.decided');
  });

  it('refuses to review a request that is not escalated', async () => {
    expectError(
      await request('POST', `/admin/refund-requests/${adaRequestId}/review`, {
        admin: true,
        body: { decision: 'deny', note: 'Changing my mind' },
      }),
      409,
      'REFUND_NOT_REVIEWABLE',
    );
  });

  it('requires a decision and a note of at least 3 characters', async () => {
    expectError(
      await request('POST', `/admin/refund-requests/${emekaRequestId}/review`, {
        admin: true,
        body: { decision: 'approve', note: 'ok' },
      }),
      422,
      'VALIDATION_FAILED',
    );
    expectError(
      await request('POST', `/admin/refund-requests/${emekaRequestId}/review`, {
        admin: true,
        body: { decision: 'maybe', note: 'Looks fine to me' },
      }),
      422,
      'VALIDATION_FAILED',
    );
  });

  it('lets a human approve an escalated request', async () => {
    const reviewed = expectOk(
      await request('POST', `/admin/refund-requests/${emekaRequestId}/review`, {
        admin: true,
        body: { decision: 'approve', note: 'Photos confirm the cracked screen.' },
      }),
      200,
      RefundRequestDetailSchema,
    );
    expect(reviewed.status).toBe('approved');
    expect(reviewed.decidedBy).toBe('human');
    expect(reviewed.review).toMatchObject({
      decision: 'approve',
      note: 'Photos confirm the cracked screen.',
      reviewer: 'admin',
    });
    expect(reviewed.auditEvents.map((e) => e.type)).toContain('refund.reviewed');
    // The policy trace is preserved as it was at decision time.
    expect(reviewed.trace.rules.find((r) => r.ruleId === 'R06')?.outcome).toBe('escalate');

    const conversation = expectOk(
      await request('GET', `/conversations/${reviewed.conversation.id}`),
      200,
      ConversationDetailSchema,
    );
    expect(conversation.decision).toMatchObject({ status: 'approved', decidedBy: 'human' });
    expect(conversation.messages.at(-1)?.role).toBe('system');
    expect(conversation.messages.at(-1)?.content).toContain('$1,299.00');

    expectError(
      await request('POST', `/admin/refund-requests/${emekaRequestId}/review`, {
        admin: true,
        body: { decision: 'deny', note: 'Second review' },
      }),
      409,
      'REFUND_NOT_REVIEWABLE',
    );
  });

  it('reports stats by outcome', async () => {
    const stats = expectOk(await request('GET', '/admin/stats', { admin: true }), 200, StatsSchema);
    expect(stats).toEqual({
      total: 4,
      byStatus: { approved: 2, denied: 1, escalated: 1 },
      escalatedTotal: 2,
      humanReviewed: 1,
      escalationRate: 0.5,
      autoResolutionRate: 0.5,
    });
  });
});
