import { describe, expect, it } from 'vitest';
import { AiCallRunner } from '../../../src/ai/ai-call-runner.js';
import { MockRefundAnalyzer } from '../../../src/ai/mock-refund-analyzer.js';
import { AnalyzerError } from '../../../src/ai/refund-analyzer.js';
import { ReplyRenderer } from '../../../src/common/reply-renderer.js';
import { contracts } from '../../support/contracts.js';

const analyzer = new MockRefundAnalyzer(
  contracts.mockFixtures,
  new ReplyRenderer(contracts.templates, contracts.policy),
);
const runner = new AiCallRunner();
const usage = { inputTokens: 10, outputTokens: 5 };

describe('AiCallRunner', () => {
  it('records a single successful attempt', async () => {
    const outcome = await runner.run(analyzer, 'extract', 'extract.v1', async () => ({
      value: 'ok',
      usage,
    }));
    expect(outcome.value).toBe('ok');
    expect(outcome.calls).toEqual([
      expect.objectContaining({
        step: 'extract',
        attempt: 1,
        ok: true,
        inputTokens: 10,
        outputTokens: 5,
        error: null,
      }),
    ]);
  });

  it('retries exactly once and records both attempts', async () => {
    let attempts = 0;
    const outcome = await runner.run(analyzer, 'compose', 'compose.v1', async () => {
      attempts += 1;
      if (attempts === 1) throw new AnalyzerError('timeout');
      return { value: 'second', usage };
    });
    expect(outcome.value).toBe('second');
    expect(outcome.calls.map((call) => [call.attempt, call.ok, call.error])).toEqual([
      [1, false, 'timeout'],
      [2, true, null],
    ]);
  });

  it('gives up after two failures and maps unknown errors to provider_error', async () => {
    let attempts = 0;
    const outcome = await runner.run(analyzer, 'extract', 'extract.v1', async () => {
      attempts += 1;
      throw new Error('boom');
    });
    expect(attempts).toBe(2);
    expect(outcome.value).toBeNull();
    expect(outcome.calls.map((call) => call.error)).toEqual(['provider_error', 'provider_error']);
  });
});
