import type { MockFixturesFile } from '../config/contracts.schema.js';
import type { ReplyRenderer } from '../common/reply-renderer.js';
import type { ExtractionOutput } from './extraction-output.schema.js';
import {
  AnalyzerError,
  type AnalyzerResult,
  type ComposeInput,
  type ExtractInput,
  type RefundAnalyzer,
} from './refund-analyzer.js';

const NO_TOKENS = { inputTokens: 0, outputTokens: 0 } as const;

/**
 * Deterministic stand-in for the model (contracts/mock-llm-fixtures.json): the first fixture with a
 * substring of the lowercased latest message wins, else `extractDefault`. Compose renders templates.
 */
export class MockRefundAnalyzer implements RefundAnalyzer {
  readonly provider = 'mock' as const;
  readonly model: string;

  constructor(
    private readonly fixtures: MockFixturesFile,
    private readonly renderer: ReplyRenderer,
  ) {
    this.model = fixtures.model;
  }

  async extract(input: ExtractInput): Promise<AnalyzerResult<ExtractionOutput>> {
    const latest = input.latestMessage.toLowerCase();
    const fixture = this.fixtures.extract.find((candidate) =>
      candidate.anyOf.some((needle) => latest.includes(needle.toLowerCase())),
    );
    if (fixture === undefined) return { value: this.fixtures.extractDefault, usage: NO_TOKENS };
    if ('error' in fixture) throw new AnalyzerError(fixture.error);
    return { value: fixture.extraction, usage: NO_TOKENS };
  }

  async compose(input: ComposeInput): Promise<AnalyzerResult<string>> {
    const reply = this.renderer.outcome(input.outcome, {
      firstName: input.firstName,
      itemNames: input.itemNames,
      amount: input.amount,
      customerReasons: input.customerReasons,
    });
    return { value: reply, usage: NO_TOKENS };
  }
}
