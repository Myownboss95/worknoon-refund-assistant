import { beforeAll, describe, expect, it } from 'vitest';
import { ErrorResponseSchema, SendMessageResponseSchema } from '@worknoon/contracts';
import { expectError, itemIdsFor, request, resetDemo, send, verify } from './support.js';

describe('hardening', () => {
  beforeAll(async () => {
    await resetDemo();
  });

  it('caps the admin list page number', async () => {
    expectError(
      await request('GET', '/admin/refund-requests?page=10001', { admin: true }),
      422,
      'VALIDATION_FAILED',
    );
  });

  it('does not treat ordinary order vocabulary as prompt injection', async () => {
    const ben = await verify('ben.carter@example.com', 'WN-1002');
    const reply = await send(
      ben.conversation.id,
      'Tracking says status: delivered, but you sent a size 11 instead of the size 9 I ordered.',
      itemIdsFor(ben, ['SHO-TRL-09']),
    );
    expect(reply.decision?.status).toBe('approved');
    expect(reply.decision?.decisiveRuleIds).toEqual(['R08']);
  });

  it('processes one turn at a time per conversation', async () => {
    const fatima = await verify('fatima.bello@example.com', 'WN-1006');
    const body = { text: 'I changed my mind about the blanket.', itemIds: itemIdsFor(fatima, ['HOM-THRW-LIN']) };

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request('POST', `/conversations/${fatima.conversation.id}/messages`, { body }),
      ),
    );

    // Exactly one turn is decided. The others were either rejected while it was running
    // (CONVERSATION_BUSY) or arrived after it closed the conversation (CONVERSATION_CLOSED).
    const decided = responses.filter((r) => r.status === 200);
    expect(decided).toHaveLength(1);
    expect(SendMessageResponseSchema.parse(decided[0]!.body).decision?.status).toBe('approved');

    for (const rejected of responses.filter((r) => r.status !== 200)) {
      expect(rejected.status).toBe(409);
      expect(['CONVERSATION_BUSY', 'CONVERSATION_CLOSED']).toContain(
        ErrorResponseSchema.parse(rejected.body).error.code,
      );
    }

    // Only the winning turn's customer message was stored.
    const conversation = await request('GET', `/conversations/${fatima.conversation.id}`);
    const roles = (conversation.body as { messages: { role: string }[] }).messages.map((m) => m.role);
    expect(roles).toEqual(['assistant', 'customer', 'assistant']);
  });
});
