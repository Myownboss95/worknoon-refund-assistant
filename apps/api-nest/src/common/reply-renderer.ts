import type { RefundStatus, ReviewDecision } from '@worknoon/contracts';
import type { FullPolicyConfig, ReplyTemplates, RuleId } from '../config/contracts.schema.js';
import { formatMoney, joinNames, renderTemplate } from './formatting.js';

export interface OutcomeReplyValues {
  readonly firstName: string;
  readonly itemNames: readonly string[];
  /** Already formatted, e.g. `$89.00`. */
  readonly amount: string;
  readonly customerReasons: readonly string[];
}

const ESCALATED_CUSTOMER_REASON =
  'A member of our support team will review your request within one business day.';
const HUMAN_DENIED_CUSTOMER_REASON =
  "After reviewing your request, we're unable to offer a refund.";

/**
 * Renders customer-facing text from contracts/reply-templates.json and the customer-safe reasons in
 * policy.config.json. Pure: no I/O, so the mock composer, fallbacks and system messages share it.
 */
export class ReplyRenderer {
  constructor(
    private readonly templates: ReplyTemplates,
    private readonly policy: FullPolicyConfig,
  ) {}

  greeting(firstName: string, orderNumber: string): string {
    return renderTemplate(this.templates.greeting, { firstName, orderNumber });
  }

  clarify(firstName: string, itemNames: readonly string[]): string {
    return renderTemplate(this.templates.clarify, { firstName, itemNames: joinNames(itemNames) });
  }

  /** The approved / denied / escalated reply (mock composer and every fallback). */
  outcome(status: RefundStatus, values: OutcomeReplyValues): string {
    return renderTemplate(this.templates[status], {
      firstName: values.firstName,
      itemNames: joinNames(values.itemNames),
      amount: values.amount,
      customerReason: values.customerReasons.join(' '),
    }).trim();
  }

  humanReview(decision: ReviewDecision, amountCents: number, note: string): string {
    const template =
      decision === 'approve' ? this.templates.humanApproved : this.templates.humanDenied;
    return renderTemplate(template, { amount: formatMoney(amountCents), note });
  }

  /** Customer-safe reasons for the decisive deny rules, placeholders filled from policy config. */
  customerReasons(decisiveRuleIds: readonly RuleId[]): string[] {
    const placeholders = {
      refundWindowDays: this.policy.refundWindowDays,
      changeOfMindWindowDays: this.policy.changeOfMindWindowDays,
    };
    return decisiveRuleIds
      .map((ruleId) => this.policy.customerReasons[ruleId])
      .filter((reason): reason is string => reason !== undefined)
      .map((reason) => renderTemplate(reason, placeholders));
  }

  /**
   * `Decision.customerReason` (contracts/openapi.yaml and docs/pipeline.md, "Clarifications"). A
   * human denial overrules escalate rules, which have no customer-safe wording, so it gets its own
   * sentence; a policy denial without customer-safe reasons falls back to the same sentence.
   */
  decisionReason(
    status: RefundStatus,
    amountCents: number,
    decisiveRuleIds: readonly RuleId[],
    decidedBy: 'policy' | 'human' = 'policy',
  ): string {
    if (status === 'denied' && decidedBy === 'human') return HUMAN_DENIED_CUSTOMER_REASON;
    switch (status) {
      case 'approved':
        return `Your refund of ${formatMoney(amountCents)} has been approved.`;
      case 'escalated':
        return ESCALATED_CUSTOMER_REASON;
      case 'denied': {
        const reasons = this.customerReasons(decisiveRuleIds);
        return reasons.length > 0 ? reasons.join(' ') : HUMAN_DENIED_CUSTOMER_REASON;
      }
    }
  }
}
