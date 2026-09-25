import { HealthSchema, StatsSchema } from '@worknoon/contracts';
import { jsonResponse } from '@/test/utils';
import { getErrorMessage } from '@/shared/lib/errorMessages';
import { ApiError } from './ApiError';
import { createApiClient } from './client';

const health = {
  status: 'ok',
  backend: 'laravel',
  database: 'ok',
  ai: { provider: 'mock', model: 'mock' },
  policyVersion: '1.0',
  time: '2026-09-25T10:00:00.000Z',
};

function clientWith(response: Response | Error, adminToken?: string) {
  const fetchImpl = vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  return {
    client: createApiClient({ baseUrl: '/api/laravel/v1', adminToken, fetchImpl }),
    fetchImpl,
  };
}

describe('createApiClient', () => {
  it('builds the URL from the base URL and parses success with the schema', async () => {
    const { client, fetchImpl } = clientWith(jsonResponse(health));
    await expect(client.get('/health', undefined, HealthSchema)).resolves.toEqual(health);
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/laravel/v1/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('serialises query params, skipping empty values', async () => {
    const stats = {
      total: 0,
      byStatus: { approved: 0, denied: 0, escalated: 0 },
      escalatedTotal: 0,
      humanReviewed: 0,
      escalationRate: 0,
      autoResolutionRate: 0,
    };
    const { client, fetchImpl } = clientWith(jsonResponse(stats));
    await client.get('/admin/stats', { status: undefined, page: 2, perPage: 10 }, StatsSchema);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('/api/laravel/v1/admin/stats?page=2&perPage=10');
  });

  it('sends JSON bodies and the admin token header', async () => {
    const { client, fetchImpl } = clientWith(
      jsonResponse({ reset: true, customers: 15, orders: 15 }),
      'demo-admin',
    );
    const { ResetResponseSchema } = await import('@worknoon/contracts');
    await client.post('/admin/demo/reset', { a: 1 }, ResetResponseSchema);
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect(init.headers).toMatchObject({
      'X-Admin-Token': 'demo-admin',
      'Content-Type': 'application/json',
    });
  });

  it('maps an error envelope to ApiError with status, code, message and details', async () => {
    const { client } = clientWith(
      jsonResponse(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'The given data was invalid.',
            details: [{ field: 'email', message: 'Must be a valid email.' }],
          },
        },
        422,
      ),
    );
    const error = await client
      .post('/customers/verify', {}, HealthSchema)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'The given data was invalid.',
    });
    expect((error as ApiError).fieldError('email')).toBe('Must be a valid email.');
  });

  it('maps VERIFICATION_FAILED and RATE_LIMITED to friendly messages', async () => {
    const verification = await clientWith(
      jsonResponse(
        { error: { code: 'VERIFICATION_FAILED', message: "We couldn't find an order." } },
        404,
      ),
    )
      .client.post('/customers/verify', {}, HealthSchema)
      .catch((caught: unknown) => caught);
    expect(verification).toMatchObject({ status: 404, code: 'VERIFICATION_FAILED' });
    expect(getErrorMessage(verification)).toMatch(/couldn't find an order/i);

    const limited = await clientWith(
      jsonResponse({ error: { code: 'RATE_LIMITED', message: 'Slow down' } }, 429),
    )
      .client.post('/customers/verify', {}, HealthSchema)
      .catch((caught: unknown) => caught);
    expect(limited).toMatchObject({ status: 429, code: 'RATE_LIMITED' });
    expect(getErrorMessage(limited)).toMatch(/wait a moment/i);
  });

  it('falls back to a status-based code when the error body is not an envelope', async () => {
    const { client } = clientWith(new Response('<html>Bad gateway</html>', { status: 502 }));
    await expect(client.get('/health', undefined, HealthSchema)).rejects.toMatchObject({
      status: 502,
      code: 'NETWORK_ERROR',
    });
  });

  it('reports network failures as NETWORK_ERROR', async () => {
    const { client } = clientWith(new TypeError('Failed to fetch'));
    await expect(client.get('/health', undefined, HealthSchema)).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });
  });

  it('rejects a success response that does not match the contract', async () => {
    const { client } = clientWith(jsonResponse({ ...health, status: 'great' }));
    const error = await client
      .get('/health', undefined, HealthSchema)
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: 'INVALID_RESPONSE' });
    expect((error as ApiError).details[0]?.field).toBe('status');
  });
});
