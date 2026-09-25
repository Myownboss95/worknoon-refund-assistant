import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app-config.js';

const WINDOW_MS = 60_000;
/** Expired windows are swept once this many client IPs are tracked, so memory stays bounded. */
const SWEEP_THRESHOLD = 10_000;

interface FailureWindow {
  readonly startedAt: number;
  failures: number;
}

/**
 * Counts failed admin authentications per client IP in a one-minute window that starts at the first
 * failure. Once RATE_LIMIT_ADMIN_FAILURES_PER_MINUTE failures are recorded, the IP is blocked from
 * every admin route until the window passes. Successful requests never count. In-process, like the
 * Nest throttler storage.
 */
@Injectable()
export class AdminAuthLimiter {
  private readonly windows = new Map<string, FailureWindow>();
  private readonly limit: number;

  constructor(config: AppConfig) {
    this.limit = config.rateLimitAdminFailuresPerMinute;
  }

  isBlocked(ip: string, now: number = Date.now()): boolean {
    const window = this.current(ip, now);
    return window !== undefined && window.failures >= this.limit;
  }

  recordFailure(ip: string, now: number = Date.now()): void {
    const window = this.current(ip, now);
    if (window !== undefined) {
      window.failures += 1;
      return;
    }
    if (this.windows.size >= SWEEP_THRESHOLD) this.sweep(now);
    this.windows.set(ip, { startedAt: now, failures: 1 });
  }

  private current(ip: string, now: number): FailureWindow | undefined {
    const window = this.windows.get(ip);
    if (window === undefined) return undefined;
    if (now - window.startedAt >= WINDOW_MS) {
      this.windows.delete(ip);
      return undefined;
    }
    return window;
  }

  private sweep(now: number): void {
    for (const [ip, window] of this.windows) {
      if (now - window.startedAt >= WINDOW_MS) this.windows.delete(ip);
    }
  }
}
