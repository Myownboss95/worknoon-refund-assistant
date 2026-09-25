import type { InjectionPatternsFile } from '../../config/contracts.schema.js';

interface CompiledPattern {
  readonly id: string;
  readonly regex: RegExp;
}

/**
 * Heuristic prompt-injection detector (contracts/injection-patterns.json). Runs on every customer
 * message independently of the model, so a model that is fooled still cannot hide the attempt.
 */
export class InjectionDetector {
  private readonly patterns: readonly CompiledPattern[];

  constructor(file: InjectionPatternsFile) {
    this.patterns = file.patterns.map(({ id, pattern }) => ({
      id,
      regex: new RegExp(pattern, 'im'),
    }));
  }

  /** Ids of the patterns matching any of the messages, sorted and unique. */
  detect(messages: readonly string[]): string[] {
    const matched = this.patterns
      .filter(({ regex }) => messages.some((message) => regex.test(message)))
      .map(({ id }) => id);
    return [...new Set(matched)].sort();
  }
}
