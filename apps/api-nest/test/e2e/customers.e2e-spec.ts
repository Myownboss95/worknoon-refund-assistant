import {
  ConversationDetailSchema,
  ErrorResponseSchema,
  HealthSchema,
  PolicySchema,
} from '@worknoon/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, createTestApp, resetDemo, verify, type TestApp } from './support/test-app.js';

describe('customer endpoints (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    await resetDemo(t.http);
  });

  afterAll(async () => {
    await t.close();
  });

  describe('POST /customers/verify', () => {
    it('starts a conversation with a greeting', async () => {
      const verified = await verify(t.http, 'ada.okafor@example.com', 'WN-1001');
      expect(verified.conversation).toMatchObject({ status: 'open', clarificationTurns: 0 });
      expect(verified.customer).toEqual({ name: 'Ada Okafor', firstName: 'Ada' });
      expect(verified.order).toMatchObject({
        orderNumber: 'WN-1001',
        status: 'delivered',
        totalCents: 8900,
        currency: 'USD',
      });
      expect(verified.order.items[0]).toMatchObject({
        sku: 'KIT-BLND-600',
        lineTotalCents: 8900,
        refundStatus: null,
      });
      expect(verified.messages).toHaveLength(1);
      expect(verified.messages[0]).toMatchObject({
        role: 'assistant',
        itemIds: null,
        content:
          'Hi Ada, thanks for verifying your order WN-1001. Select the item or items this is about, then tell me what went wrong.',
      });
      const events = await t.prisma.auditEvent.findMany({
        where: { conversationId: verified.conversation.id },
      });
      expect(events.map((event) => event.type)).toEqual(['conversation.started']);
    });

    it('normalises the email and order number', async () => {
      const verified = await verify(t.http, '  Ada.OKAFOR@Example.com ', ' wn-1001 ');
      expect(verified.order.orderNumber).toBe('WN-1001');
    });

    it('shows existing refund state on the order items', async () => {
      const verified = await verify(t.http, 'kemi.ade@example.com', 'WN-1011');
      const states = Object.fromEntries(
        verified.order.items.map((item) => [item.sku, item.refundStatus]),
      );
      expect(states).toEqual({ 'HOM-LAMP-DSK': 'approved', 'OFF-STND-MON': null });
    });

    it.each([
      ['an unknown email', 'nobody@example.com', 'WN-1001'],
      ['an unknown order', 'ada.okafor@example.com', 'WN-9999'],
      ["another customer's order", 'ada.okafor@example.com', 'WN-1002'],
    ])('fails generically for %s', async (_case, email, orderNumber) => {
      const response = await t.http.post(`${API}/customers/verify`).send({ email, orderNumber });
      expect(response.status).toBe(404);
      expect(ErrorResponseSchema.parse(response.body)).toEqual({
        error: {
          code: 'VERIFICATION_FAILED',
          message: "We couldn't find an order matching those details.",
        },
      });
    });

    it('audits failed verification with a masked email', async () => {
      await t.http
        .post(`${API}/customers/verify`)
        .send({ email: 'someone.else@example.com', orderNumber: 'WN-1001' })
        .expect(404);
      const event = await t.prisma.auditEvent.findFirst({
        where: { type: 'verification.failed' },
        orderBy: { createdAt: 'desc' },
      });
      expect(event?.data).toEqual({ email: 's***@example.com', orderNumber: 'WN-1001' });
      expect(JSON.stringify(event?.data)).not.toContain('someone.else');
    });

    it.each([
      [{ email: 'not-an-email', orderNumber: 'WN-1001' }, ['email']],
      [{ email: 'ada.okafor@example.com', orderNumber: 'W!' }, ['orderNumber']],
      [{ email: `${'a'.repeat(250)}@example.com`, orderNumber: 'WN-1001' }, ['email']],
      [{}, ['email', 'orderNumber']],
      [{ email: 42, orderNumber: ['x'] }, ['email', 'orderNumber']],
    ])('rejects %j with 422', async (body, fields) => {
      const response = await t.http.post(`${API}/customers/verify`).send(body);
      expect(response.status).toBe(422);
      const error = ErrorResponseSchema.parse(response.body).error;
      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.details?.map((detail) => detail.field)).toEqual(fields);
    });

    it('rejects malformed JSON with 422', async () => {
      const response = await t.http
        .post(`${API}/customers/verify`)
        .set('Content-Type', 'application/json')
        .send('{"email":');
      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'The request is invalid.',
          details: [{ field: 'body', message: 'The request body is not valid JSON.' }],
        },
      });
    });
  });

  describe('GET /conversations/:id', () => {
    it('returns the conversation with history and no decision yet', async () => {
      const verified = await verify(t.http, 'ben.carter@example.com', 'WN-1002');
      const response = await t.http
        .get(`${API}/conversations/${verified.conversation.id}`)
        .expect(200);
      const detail = ConversationDetailSchema.parse(response.body);
      expect(detail.decision).toBeNull();
      expect(detail.messages).toEqual(verified.messages);
    });

    it.each([
      ['an unknown id', '5b0d6f3e-2a52-4a55-9d5c-0b7ad2e4d2a1'],
      ['a non-UUID id', 'not-a-uuid'],
    ])('returns 404 for %s', async (_case, id) => {
      const response = await t.http.get(`${API}/conversations/${id}`);
      expect(response.status).toBe(404);
      expect(ErrorResponseSchema.parse(response.body).error.code).toBe('NOT_FOUND');
    });
  });

  describe('system endpoints', () => {
    it('reports health', async () => {
      const response = await t.http.get(`${API}/health`).expect(200);
      expect(HealthSchema.parse(response.body)).toMatchObject({
        status: 'ok',
        backend: 'nest',
        database: 'ok',
        ai: { provider: 'mock', model: 'mock' },
        policyVersion: '1.0',
      });
    });

    it('returns the policy document and config', async () => {
      const response = await t.http.get(`${API}/policy`).expect(200);
      const policy = PolicySchema.parse(response.body);
      expect(policy.version).toBe('1.0');
      expect(policy.markdown).toContain('# Refund Policy v1.0');
      expect(policy.config).toMatchObject({
        refundWindowDays: 30,
        humanReviewThresholdCents: 50_000,
      });
      expect(response.body.config.approvableReasons).toEqual([
        'damaged',
        'defective',
        'wrong_item',
        'changed_mind',
      ]);
    });

    it.each([
      ['get', '/customers/verify'],
      ['delete', '/health'],
      ['put', '/admin/stats'],
    ] as const)('returns 404 NOT_FOUND for a wrong method: %s %s', async (method, path) => {
      const response = await t.http[method](`${API}${path}`);
      expect(response.status).toBe(404);
      expect(ErrorResponseSchema.parse(response.body).error.code).toBe('NOT_FOUND');
    });

    it('lists order items by sku', async () => {
      const verified = await verify(t.http, 'ngozi.eze@example.com', 'WN-1014');
      expect(verified.order.items.map((item) => item.sku)).toEqual(['HOM-LAMP-TBL', 'HOM-TBL-OAK']);
    });

    it('returns 404 NOT_FOUND for unknown routes', async () => {
      const response = await t.http.get(`${API}/does-not-exist`);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
    });

    it('sets a request id, security headers and CORS for the configured origin', async () => {
      const response = await t.http.get(`${API}/health`).set('Origin', 'http://localhost:8080');
      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:8080');
    });
  });
});
