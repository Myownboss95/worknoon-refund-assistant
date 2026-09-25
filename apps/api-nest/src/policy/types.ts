import type {
  Extraction,
  Flag,
  OrderStatus,
  RefundStatus,
  RuleOutcome,
  RuleResult,
} from '@worknoon/contracts';
import type { FullPolicyConfig, RuleId } from '../config/contracts.schema.js';

export type { RuleId };

/** Whether an item is already covered by an approved (`approved`) or escalated (`pending`) request. */
export type ItemRefundStatus = 'approved' | 'pending' | null;

export interface PolicyItem {
  readonly id: string;
  readonly finalSale: boolean;
  readonly lineTotalCents: number;
  readonly refundStatus: ItemRefundStatus;
}

/** Everything a rule may look at. Built from the database and the extraction; never from customer text. */
export interface PolicyContext {
  readonly config: FullPolicyConfig;
  readonly verifiedCustomerId: string;
  readonly orderCustomerId: string;
  readonly orderStatus: OrderStatus;
  /** `null` when the order has not been delivered. */
  readonly daysSinceDelivery: number | null;
  readonly items: readonly PolicyItem[];
  readonly amountCents: number;
  readonly recentApprovedRefunds: number;
  /** `null` when the AI was unavailable (the extraction failed twice). */
  readonly extraction: Extraction | null;
  readonly heuristicMatches: readonly string[];
  /** True when this turn reached the clarification limit. */
  readonly clarificationExhausted: boolean;
}

export interface RuleEvaluation {
  readonly ruleId: RuleId;
  readonly outcome: RuleOutcome;
  readonly reason: string;
  /** Signals raised by the rule (only R07 raises any). */
  readonly flags: readonly Flag[];
}

export type PolicyRule = (ctx: PolicyContext) => RuleEvaluation;

export interface PolicyDecision {
  readonly status: RefundStatus;
  readonly decisiveRuleIds: readonly RuleId[];
  readonly rules: readonly RuleResult[];
  /** Flags raised by the rules, sorted and unique. */
  readonly flags: readonly Flag[];
}
