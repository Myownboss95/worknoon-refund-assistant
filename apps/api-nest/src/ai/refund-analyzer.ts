import type { AiProvider, OrderStatus, RefundStatus } from '@worknoon/contracts';
import type { AiErrorCode } from '../config/contracts.schema.js';
import type { ExtractionOutput } from './extraction-output.schema.js';

export const REFUND_ANALYZER = Symbol('REFUND_ANALYZER');

export interface ExtractInput {
  /** Every customer message in the conversation, oldest first (including the latest). */
  readonly customerMessages: readonly string[];
  readonly latestMessage: string;
  readonly order: {
    readonly orderNumber: string;
    readonly status: OrderStatus;
    readonly daysSinceDelivery: number | null;
    readonly selectedItems: readonly {
      readonly name: string;
      readonly quantity: number;
      readonly finalSale: boolean;
    }[];
  };
}

export interface ComposeInput {
  readonly outcome: RefundStatus;
  /** Already formatted, e.g. `$89.00`. */
  readonly amount: string;
  readonly firstName: string;
  readonly itemNames: readonly string[];
  /** Customer-safe reasons; only present for denied outcomes. */
  readonly customerReasons: readonly string[];
  readonly summary: string | null;
}

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface AnalyzerResult<T> {
  readonly value: T;
  readonly usage: TokenUsage;
}

/** A failed model call, reduced to a short code; raw provider messages never leave the analyzer. */
export class AnalyzerError extends Error {
  constructor(
    readonly code: AiErrorCode,
    readonly usage: TokenUsage = { inputTokens: 0, outputTokens: 0 },
  ) {
    super(`AI call failed: ${code}`);
    this.name = 'AnalyzerError';
  }
}

/**
 * The only thing the AI does: turn customer text into structured signals, and phrase a decision
 * that has already been made. It never decides and never produces an amount.
 */
export interface RefundAnalyzer {
  readonly provider: AiProvider;
  readonly model: string;
  extract(input: ExtractInput): Promise<AnalyzerResult<ExtractionOutput>>;
  compose(input: ComposeInput): Promise<AnalyzerResult<string>>;
}
