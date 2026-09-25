import { describe, expect, it } from 'vitest';
import { HealthSchema, PolicySchema } from '@worknoon/contracts';
import { BACKEND, expectError, expectOk, readContract, request } from './support.js';

describe('system endpoints', () => {
  it('reports health, backend identity and mock AI mode', async () => {
    const health = expectOk(await request('GET', '/health'), 200, HealthSchema);
    expect(health.status).toBe('ok');
    expect(health.database).toBe('ok');
    expect(health.backend).toBe(BACKEND);
    // The suite's expected outcomes come from the mock fixtures, so it must run in mock mode.
    expect(health.ai).toEqual({ provider: 'mock', model: 'mock' });
    expect(health.policyVersion).toBe('1.0');
  });

  it('serves the policy document and the config both backends read', async () => {
    const policy = expectOk(await request('GET', '/policy'), 200, PolicySchema);
    const config = readContract<Record<string, unknown>>('policy.config.json');
    expect(policy.version).toBe(config.version);
    expect(policy.markdown).toContain('# Refund Policy v1.0');
    for (const key of Object.keys(PolicySchema.shape.config.shape)) {
      expect(policy.config[key as keyof typeof policy.config], key).toEqual(config[key]);
    }
  });

  it('answers unknown routes with the shared error shape', async () => {
    expectError(await request('GET', '/does-not-exist'), 404, 'NOT_FOUND');
  });
});
