import Anthropic, {
  AnthropicError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
} from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { AiCallBudget } from './ai-call-budget.js';
import { ExtractionOutputSchema, type ExtractionOutput } from './extraction-output.schema.js';
import type { SystemPrompts } from './prompts/prompts.js';
import { buildComposeUserContent, buildExtractUserContent } from './prompts/user-content.js';
import {
  AnalyzerError,
  type AnalyzerResult,
  type ComposeInput,
  type ExtractInput,
  type RefundAnalyzer,
  type TokenUsage,
} from './refund-analyzer.js';

export const AI_CALL_TIMEOUT_MS = 20_000;
const EXTRACT_MAX_TOKENS = 1024;
const COMPOSE_MAX_TOKENS = 400;
const EXTRACTION_FORMAT = zodOutputFormat(ExtractionOutputSchema);
export const EXTRACT_TEMPERATURE = 0;
export const COMPOSE_TEMPERATURE = 0.3;

/**
 * Models released after Claude Opus 4.6 reject any temperature other than 1.0 (see the SDK's
 * deprecation note), so a temperature is only sent to the model families that still accept it.
 */
const ACCEPTS_TEMPERATURE = /^claude-(3|(haiku|sonnet|opus)-4-[0-6](-|$))/;

export function temperatureFor(model: string, temperature: number): { temperature?: number } {
  return ACCEPTS_TEMPERATURE.test(model) ? { temperature } : {};
}

export interface ClaudeSettings {
  readonly apiKey: string;
  readonly model: string;
}

function toUsage(usage: { input_tokens: number; output_tokens: number }): TokenUsage {
  return { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens };
}

/** Reduces any failure to a short code; provider messages are never passed on. */
function toAnalyzerError(error: unknown): AnalyzerError {
  if (error instanceof AnalyzerError) return error;
  if (error instanceof APIConnectionTimeoutError || error instanceof APIUserAbortError) {
    return new AnalyzerError('timeout');
  }
  if (error instanceof APIError) return new AnalyzerError('provider_error');
  // The SDK raises a plain AnthropicError when structured output fails to parse or validate.
  if (error instanceof AnthropicError) return new AnalyzerError('invalid_output');
  return new AnalyzerError('provider_error');
}

/**
 * Claude via the Anthropic SDK. The SDK does not retry (maxRetries 0): the pipeline retries once
 * itself so that every attempt is visible in the decision trace. Every attempt draws on the hourly
 * call budget first; when it is spent the attempt fails as `provider_error` without calling Claude,
 * so the pipeline takes its normal fail-safe path.
 */
export class ClaudeRefundAnalyzer implements RefundAnalyzer {
  readonly provider = 'anthropic' as const;
  readonly model: string;
  private readonly client: Anthropic;

  constructor(
    settings: ClaudeSettings,
    private readonly prompts: SystemPrompts,
    private readonly budget: AiCallBudget,
    client?: Anthropic,
  ) {
    this.model = settings.model;
    this.client =
      client ??
      new Anthropic({ apiKey: settings.apiKey, timeout: AI_CALL_TIMEOUT_MS, maxRetries: 0 });
  }

  async extract(input: ExtractInput): Promise<AnalyzerResult<ExtractionOutput>> {
    try {
      this.spendBudget();
      const message = await this.client.messages.parse({
        model: this.model,
        max_tokens: EXTRACT_MAX_TOKENS,
        ...temperatureFor(this.model, EXTRACT_TEMPERATURE),
        system: this.prompts.extract,
        messages: [{ role: 'user', content: buildExtractUserContent(input) }],
        output_config: { format: EXTRACTION_FORMAT },
      });
      const usage = toUsage(message.usage);
      if (message.parsed_output === null) throw new AnalyzerError('invalid_output', usage);
      return { value: message.parsed_output, usage };
    } catch (error) {
      throw toAnalyzerError(error);
    }
  }

  async compose(input: ComposeInput): Promise<AnalyzerResult<string>> {
    try {
      this.spendBudget();
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: COMPOSE_MAX_TOKENS,
        ...temperatureFor(this.model, COMPOSE_TEMPERATURE),
        system: this.prompts.compose,
        messages: [{ role: 'user', content: buildComposeUserContent(input) }],
      });
      const usage = toUsage(message.usage);
      const text = message.content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('')
        .trim();
      if (text === '' || message.stop_reason === 'refusal') {
        throw new AnalyzerError('invalid_output', usage);
      }
      return { value: text, usage };
    } catch (error) {
      throw toAnalyzerError(error);
    }
  }

  private spendBudget(): void {
    if (!this.budget.tryAcquire()) throw new AnalyzerError('provider_error');
  }
}
