import { beforeAll, describe, expect, it } from 'vitest';
import {
  expectError,
  itemIdsFor,
  request,
  resetDemo,
  send,
  verify,
} from './support.js';

const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

describe('error contract', () => {
  beforeAll(async () => {
    await resetDemo();
  });

  describe('verification', () => {
    it('gives the same generic answer for a wrong email and an unknown order', async () => {
      const wrongEmail = expectError(
        await request('POST', '/customers/verify', {
          body: { email: 'someone.else@example.com', orderNumber: 'WN-1001' },
        }),
        404,
        'VERIFICATION_FAILED',
      );
      const unknownOrder = expectError(
        await request('POST', '/customers/verify', {
          body: { email: 'ada.okafor@example.com', orderNumber: 'WN-9999' },
        }),
        404,
        'VERIFICATION_FAILED',
      );
      expect(wrongEmail.message).toBe(unknownOrder.message);
    });

    it('normalises email case and order number case', async () => {
      const verified = await verify('  ADA.Okafor@Example.com ', 'wn-1001');
      expect(verified.order.orderNumber).toBe('WN-1001');
      expect(verified.customer.firstName).toBe('Ada');
      expect(verified.messages).toHaveLength(1);
      expect(verified.messages[0]?.role).toBe('assistant');
    });

    it('rejects malformed input with field details', async () => {
      const error = expectError(
        await request('POST', '/customers/verify', { body: { email: 'not-an-email', orderNumber: '!' } }),
        422,
        'VALIDATION_FAILED',
      );
      const fields = (error.details ?? []).map((d) => d.field).sort();
      expect(fields).toEqual(['email', 'orderNumber']);
    });

    it('rejects a missing body', async () => {
      expectError(await request('POST', '/customers/verify', { body: {} }), 422, 'VALIDATION_FAILED');
    });
  });

  describe('messages', () => {
    it('returns NOT_FOUND for unknown and malformed conversation ids', async () => {
      expectError(await request('GET', `/conversations/${UNKNOWN_UUID}`), 404, 'NOT_FOUND');
      expectError(await request('GET', '/conversations/not-a-uuid'), 404, 'NOT_FOUND');
      expectError(
        await request('POST', `/conversations/${UNKNOWN_UUID}/messages`, {
          body: { text: 'hello', itemIds: [UNKNOWN_UUID] },
        }),
        404,
        'NOT_FOUND',
      );
    });

    it('rejects items that are not on the conversation order', async () => {
      const ada = await verify('ada.okafor@example.com', 'WN-1001');
      const ben = await verify('ben.carter@example.com', 'WN-1002');
      const error = expectError(
        await request('POST', `/conversations/${ada.conversation.id}/messages`, {
          body: { text: 'It arrived cracked.', itemIds: itemIdsFor(ben, ['SHO-TRL-09']) },
        }),
        422,
        'VALIDATION_FAILED',
      );
      expect(error.details?.map((d) => d.field)).toContain('itemIds');
    });

    it('rejects empty, oversized and item-less messages', async () => {
      const ada = await verify('ada.okafor@example.com', 'WN-1001');
      const itemIds = itemIdsFor(ada, ['KIT-BLND-600']);
      const path = `/conversations/${ada.conversation.id}/messages`;

      expectError(await request('POST', path, { body: { text: '   ', itemIds } }), 422, 'VALIDATION_FAILED');
      expectError(
        await request('POST', path, { body: { text: 'x'.repeat(1001), itemIds } }),
        422,
        'VALIDATION_FAILED',
      );
      expectError(
        await request('POST', path, { body: { text: 'It is cracked', itemIds: [] } }),
        422,
        'VALIDATION_FAILED',
      );
      expectError(
        await request('POST', path, { body: { text: 'It is cracked', itemIds: ['nope'] } }),
        422,
        'VALIDATION_FAILED',
      );
    });

    it('closes the conversation once a decision is reached', async () => {
      const ada = await verify('ada.okafor@example.com', 'WN-1001');
      const itemIds = itemIdsFor(ada, ['KIT-BLND-600']);
      const first = await send(ada.conversation.id, 'The jug arrived cracked.', itemIds);
      expect(first.decision?.status).toBe('approved');

      expectError(
        await request('POST', `/conversations/${ada.conversation.id}/messages`, {
          body: { text: 'One more thing', itemIds },
        }),
        409,
        'CONVERSATION_CLOSED',
      );
    });

    it('denies a second refund for an item that was just refunded', async () => {
      const ada = await verify('ada.okafor@example.com', 'WN-1001');
      expect(ada.order.items[0]?.refundStatus).toBe('approved');
      const again = await send(ada.conversation.id, 'The jug arrived cracked.', itemIdsFor(ada, ['KIT-BLND-600']));
      expect(again.decision?.status).toBe('denied');
      expect(again.decision?.decisiveRuleIds).toEqual(['R05']);
    });
  });

  describe('admin auth', () => {
    it.each([
      ['GET', '/admin/refund-requests'],
      ['GET', '/admin/stats'],
      ['GET', `/admin/refund-requests/${UNKNOWN_UUID}`],
      ['POST', `/admin/refund-requests/${UNKNOWN_UUID}/review`],
      ['POST', '/admin/demo/reset'],
    ] as const)('%s %s requires the admin token', async (method, path) => {
      expectError(await request(method, path), 401, 'ADMIN_UNAUTHORIZED');
      expectError(await request(method, path, { admin: true, token: 'wrong-token' }), 401, 'ADMIN_UNAUTHORIZED');
    });

    it('returns NOT_FOUND for an unknown refund request', async () => {
      expectError(
        await request('GET', `/admin/refund-requests/${UNKNOWN_UUID}`, { admin: true }),
        404,
        'NOT_FOUND',
      );
    });

    it('validates list filters', async () => {
      expectError(
        await request('GET', '/admin/refund-requests?status=bogus', { admin: true }),
        422,
        'VALIDATION_FAILED',
      );
    });
  });
});
