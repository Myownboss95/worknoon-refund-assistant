import { Logger } from '@nestjs/common';

const ONE_HOUR_MS = 3_600_000;

/**
 * Global budget of real provider calls (every extract and compose attempt) per rolling hour
 * (LLM_MAX_CALLS_PER_HOUR). The count lives in this process: it is exact for a single Nest
 * instance, and with several replicas each one gets the full budget. Not applied to the mock.
 */
export class AiCallBudget {
  private readonly logger = new Logger('AiCallBudget');
  /** Start times of the calls made in the last hour, oldest first; never longer than the limit. */
  private readonly calls: number[] = [];
  private lastWarnedAt: number | null = null;

  constructor(private readonly maxCallsPerHour: number) {}

  /** Records a call and returns true, or returns false (recording nothing) if the budget is spent. */
  tryAcquire(now: number = Date.now()): boolean {
    while (this.calls.length > 0 && (this.calls[0] ?? now) <= now - ONE_HOUR_MS) {
      this.calls.shift();
    }
    if (this.calls.length >= this.maxCallsPerHour) {
      this.warnOncePerHour(now);
      return false;
    }
    this.calls.push(now);
    return true;
  }

  private warnOncePerHour(now: number): void {
    if (this.lastWarnedAt !== null && now - this.lastWarnedAt < ONE_HOUR_MS) return;
    this.lastWarnedAt = now;
    this.logger.warn({ event: 'ai_budget_exhausted', maxCallsPerHour: this.maxCallsPerHour });
  }
}
