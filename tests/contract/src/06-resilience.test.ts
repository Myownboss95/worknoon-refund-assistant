import { beforeAll, describe, expect, it } from 'vitest';
import { detail, itemIdsFor, resetDemo, send, verify } from './support.js';

describe('AI failure and clarification limits', () => {
  beforeAll(async () => {
    await resetDemo();
  });

  it('fails safe to escalation when the AI is unavailable', async () => {
    const ada = await verify('ada.okafor@example.com', 'WN-1001');
    const reply = await send(
      ada.conversation.id,
      'The jug is cracked. simulate ai outage',
      itemIdsFor(ada, ['KIT-BLND-600']),
    );

    expect(reply.decision?.status).toBe('escalated');
    expect(reply.reply.content.length).toBeGreaterThan(0);

    const trace = (await detail(reply.decision!.refundRequestId)).trace;
    expect(trace.extraction).toBeNull();
    expect(trace.flags).toContain('AI_UNAVAILABLE');
    const extractCalls = trace.ai.calls.filter((c) => c.step === 'extract');
    expect(extractCalls.map((c) => [c.attempt, c.ok])).toEqual([
      [1, false],
      [2, false],
    ]);
    expect(extractCalls.every((c) => c.error !== null)).toBe(true);
    expect(trace.rules.find((r) => r.ruleId === 'R07')?.outcome).toBe('escalate');
    expect(trace.rules.find((r) => r.ruleId === 'R10')?.outcome).toBe('escalate');
  });

  it('asks once, then escalates after a second unclear message', async () => {
    const olivia = await verify('olivia.chen@example.com', 'WN-1015');
    const itemIds = itemIdsFor(olivia, ['APP-SWTR-NVY']);

    const first = await send(olivia.conversation.id, "I'm not happy with it.", itemIds);
    expect(first.decision).toBeNull();
    expect(first.conversation).toMatchObject({ status: 'open', clarificationTurns: 1 });

    const second = await send(olivia.conversation.id, 'Hmm, I just am not happy.', itemIds);
    expect(second.decision?.status).toBe('escalated');
    expect(second.conversation).toMatchObject({ status: 'closed', clarificationTurns: 2 });

    const trace = (await detail(second.decision!.refundRequestId)).trace;
    expect(trace.flags).toEqual(['CLARIFICATION_EXHAUSTED', 'LOW_CONFIDENCE']);
    expect(trace.extraction?.reasonCategory).toBe('unclear');
  });

  it('strips control characters before storing the message', async () => {
    const fatima = await verify('fatima.bello@example.com', 'WN-1006');
    const reply = await send(
      fatima.conversation.id,
      'I changed my mind\u0000\u0007 about the blanket.',
      itemIdsFor(fatima, ['HOM-THRW-LIN']),
    );
    expect(reply.messages[0]?.content).toBe('I changed my mind about the blanket.');
    expect(reply.decision?.status).toBe('approved');
  });
});
