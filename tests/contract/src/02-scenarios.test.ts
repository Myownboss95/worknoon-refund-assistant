import { beforeAll, describe, expect, it } from 'vitest';
import { ConversationDetailSchema } from '@worknoon/contracts';
import { detail, expectOk, playScenario, request, resetDemo, scenarios } from './support.js';

describe('the 15 demo scenarios', () => {
  beforeAll(async () => {
    await resetDemo();
  });

  it.each(scenarios.map((s) => [`#${s.id} ${s.title}`, s] as const))('%s', async (_, scenario) => {
    const { verified, replies, last } = await playScenario(scenario);
    const { expected } = scenario;

    // Every turn before the last is a clarification: no decision, conversation still open.
    replies.slice(0, -1).forEach((reply, turn) => {
      expect(reply.decision, `turn ${turn + 1} should ask a follow-up`).toBeNull();
      expect(reply.conversation.status).toBe('open');
      expect(reply.reply.role).toBe('assistant');
    });

    const decision = last.decision;
    expect(decision, 'final turn must reach a decision').not.toBeNull();
    expect(decision!.status).toBe(expected.status);
    expect(decision!.decidedBy).toBe('policy');
    expect(decision!.decisiveRuleIds).toEqual(expected.decisiveRuleIds);
    expect(decision!.amountCents).toBe(expected.amountCents);
    expect(decision!.currency).toBe('USD');
    expect(decision!.customerReason.length).toBeGreaterThan(0);
    expect(last.conversation.status).toBe('closed');
    expect(last.conversation.clarificationTurns).toBe(expected.clarifications);
    expect(last.messages.map((m) => m.role)).toEqual(['customer', 'assistant']);
    expect(last.reply.content.length).toBeGreaterThan(0);
    expect(last.reply.content.length).toBeLessThanOrEqual(800);

    const trace = (await detail(decision!.refundRequestId)).trace;
    expect(trace.flags).toEqual(expected.flags);
    expect(trace.clarificationTurns).toBe(expected.clarifications);
    expect(trace.rules.map((r) => r.ruleId)).toEqual([
      'R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10',
    ]);
    expect(trace.facts.amountCents).toBe(expected.amountCents);
    expect(trace.policyVersion).toBe('1.0');
    expect(trace.ai.provider).toBe('mock');
    expect(trace.ai.promptVersions).toEqual({ extract: 'extract.v1', compose: 'compose.v1' });
    expect(trace.replyGuard.passed).toBe(true);

    const conversation = expectOk(
      await request('GET', `/conversations/${verified.conversation.id}`),
      200,
      ConversationDetailSchema,
    );
    expect(conversation.conversation.status).toBe('closed');
    expect(conversation.decision).toEqual(decision);
    // greeting + (customer, assistant) per turn
    expect(conversation.messages).toHaveLength(1 + 2 * scenario.messages.length);
  });

  it('marks refunded and pending items on a fresh verification', async () => {
    const ada = expectOk(
      await request('POST', '/customers/verify', {
        body: { email: 'ada.okafor@example.com', orderNumber: 'WN-1001' },
      }),
      201,
      (await import('@worknoon/contracts')).VerifyResponseSchema,
    );
    expect(ada.order.items[0]?.refundStatus).toBe('approved');

    const emeka = expectOk(
      await request('POST', '/customers/verify', {
        body: { email: 'emeka.obi@example.com', orderNumber: 'WN-1005' },
      }),
      201,
      (await import('@worknoon/contracts')).VerifyResponseSchema,
    );
    expect(emeka.order.items[0]?.refundStatus).toBe('pending');
  });
});
