import { Injectable, Logger } from '@nestjs/common';
import type { AiCall } from '@worknoon/contracts';
import { currentRequestId } from '../common/request-context.js';
import { AnalyzerError, type AnalyzerResult, type RefundAnalyzer } from './refund-analyzer.js';

export const MAX_AI_ATTEMPTS = 2;

export type AiStep = AiCall['step'];

export interface AiCallOutcome<T> {
  /** `null` when every attempt failed. */
  readonly value: T | null;
  /** One entry per attempt, for the decision trace. */
  readonly calls: readonly AiCall[];
}

/**
 * Runs one AI step with a single retry, recording every attempt for the trace and writing one
 * structured log line per attempt. Never logs prompts, message text or provider error messages.
 */
@Injectable()
export class AiCallRunner {
  private readonly logger = new Logger('AiCall');

  async run<T>(
    analyzer: RefundAnalyzer,
    step: AiStep,
    promptVersion: string,
    call: () => Promise<AnalyzerResult<T>>,
  ): Promise<AiCallOutcome<T>> {
    const calls: AiCall[] = [];
    for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt += 1) {
      const startedAt = performance.now();
      let entry: AiCall;
      let value: T | null = null;
      try {
        const result = await call();
        value = result.value;
        entry = this.entry(step, attempt, startedAt, true, result.usage, null);
      } catch (error) {
        const failure =
          error instanceof AnalyzerError ? error : new AnalyzerError('provider_error');
        entry = this.entry(step, attempt, startedAt, false, failure.usage, failure.code);
      }
      calls.push(entry);
      this.log(analyzer, promptVersion, entry);
      if (entry.ok) return { value, calls };
    }
    return { value: null, calls };
  }

  private entry(
    step: AiStep,
    attempt: number,
    startedAt: number,
    ok: boolean,
    usage: { inputTokens: number; outputTokens: number },
    error: AiCall['error'],
  ): AiCall {
    return {
      step,
      attempt,
      ok,
      latencyMs: Math.round(performance.now() - startedAt),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      error,
    };
  }

  private log(analyzer: RefundAnalyzer, promptVersion: string, entry: AiCall): void {
    const line = {
      event: 'ai_call',
      requestId: currentRequestId(),
      step: entry.step,
      attempt: entry.attempt,
      provider: analyzer.provider,
      model: analyzer.model,
      promptVersion,
      latencyMs: entry.latencyMs,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      ok: entry.ok,
      error: entry.error,
    };
    if (entry.ok) this.logger.log(line);
    else this.logger.warn(line);
  }
}
