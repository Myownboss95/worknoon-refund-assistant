import { describe, expect, it } from 'vitest';
import { AdminAuthLimiter } from '../../../src/common/admin-auth-limiter.js';
import type { AppConfig } from '../../../src/config/app-config.js';

const limiterWith = (limit: number): AdminAuthLimiter =>
  new AdminAuthLimiter({ rateLimitAdminFailuresPerMinute: limit } as AppConfig);

describe('AdminAuthLimiter', () => {
  it('blocks an IP once its failures reach the limit, per IP', () => {
    const limiter = limiterWith(2);
    limiter.recordFailure('10.0.0.1', 0);
    expect(limiter.isBlocked('10.0.0.1', 1)).toBe(false);
    limiter.recordFailure('10.0.0.1', 2);
    expect(limiter.isBlocked('10.0.0.1', 3)).toBe(true);
    expect(limiter.isBlocked('10.0.0.2', 3)).toBe(false);
  });

  it('unblocks when the one-minute window has passed', () => {
    const limiter = limiterWith(1);
    limiter.recordFailure('10.0.0.1', 0);
    expect(limiter.isBlocked('10.0.0.1', 59_999)).toBe(true);
    expect(limiter.isBlocked('10.0.0.1', 60_000)).toBe(false);
    limiter.recordFailure('10.0.0.1', 60_001);
    expect(limiter.isBlocked('10.0.0.1', 60_002)).toBe(true);
  });
});
