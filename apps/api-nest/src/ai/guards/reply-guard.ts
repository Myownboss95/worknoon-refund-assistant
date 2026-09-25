import type { RefundStatus } from '@worknoon/contracts';
import type { ReplyGuardFile } from '../../config/contracts.schema.js';

export const REPLY_GUARD_VIOLATIONS = [
  'EMPTY',
  'TOO_LONG',
  'CONTRADICTS_DECISION',
  'LEAKS_INTERNALS',
  'WRONG_AMOUNT',
] as const;
export type ReplyGuardViolation = (typeof REPLY_GUARD_VIOLATIONS)[number];

const DOLLAR_AMOUNT = /\$\s?[\d,]+(\.\d{2})?/g;

export interface ReplyGuardInput {
  readonly reply: string;
  readonly status: RefundStatus;
  /** The decision amount formatted with formatMoney, e.g. `$89.00`. */
  readonly amount: string;
}

/** Checks a composed reply before it reaches the customer (contracts/reply-guard.json). */
export class ReplyGuard {
  private readonly leakPatterns: readonly RegExp[];

  constructor(private readonly rules: ReplyGuardFile) {
    this.leakPatterns = rules.leakPatterns.map((pattern) => new RegExp(pattern, 'i'));
  }

  check({ reply, status, amount }: ReplyGuardInput): ReplyGuardViolation[] {
    const violations: ReplyGuardViolation[] = [];
    if (reply.trim() === '') violations.push('EMPTY');
    if (reply.length > this.rules.maxLength) violations.push('TOO_LONG');

    const lower = reply.toLowerCase();
    if (this.rules.contradictions[status].some((phrase) => lower.includes(phrase.toLowerCase()))) {
      violations.push('CONTRADICTS_DECISION');
    }
    if (this.leakPatterns.some((pattern) => pattern.test(reply)))
      violations.push('LEAKS_INTERNALS');

    const amounts = [...reply.matchAll(DOLLAR_AMOUNT)].map((match) => match[0].replace(/\s/g, ''));
    const wrongAmount =
      status === 'approved' ? amounts.some((found) => found !== amount) : amounts.length > 0;
    if (wrongAmount) violations.push('WRONG_AMOUNT');

    return violations;
  }
}
