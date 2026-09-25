import type { Flag, RefundStatus, RuleOutcome } from '@worknoon/contracts';
import { orderOwnershipRule } from './rules/r01-order-ownership.js';
import { orderDeliveredRule } from './rules/r02-order-delivered.js';
import { refundWindowRule } from './rules/r03-refund-window.js';
import { finalSaleRule } from './rules/r04-final-sale.js';
import { singleRefundPerItemRule } from './rules/r05-single-refund-per-item.js';
import { highValueReviewRule } from './rules/r06-high-value-review.js';
import { suspiciousSignalsRule } from './rules/r07-suspicious-signals.js';
import { merchantFaultRule } from './rules/r08-merchant-fault.js';
import { changeOfMindRule } from './rules/r09-change-of-mind.js';
import { noAutomaticApprovalPathRule } from './rules/r10-no-automatic-approval-path.js';
import type { PolicyContext, PolicyDecision, PolicyRule, RuleEvaluation } from './types.js';

/** R01..R10 in evaluation order (policy/refund-policy.md). */
export const POLICY_RULES: readonly PolicyRule[] = [
  orderOwnershipRule,
  orderDeliveredRule,
  refundWindowRule,
  finalSaleRule,
  singleRefundPerItemRule,
  highValueReviewRule,
  suspiciousSignalsRule,
  merchantFaultRule,
  changeOfMindRule,
  noAutomaticApprovalPathRule,
];

/** Precedence: deny > escalate > approve; nothing decisive falls back to escalation (fail safe). */
const PRECEDENCE: readonly { outcome: RuleOutcome; status: RefundStatus }[] = [
  { outcome: 'deny', status: 'denied' },
  { outcome: 'escalate', status: 'escalated' },
  { outcome: 'approve', status: 'approved' },
];

function combine(
  evaluations: readonly RuleEvaluation[],
): Pick<PolicyDecision, 'status' | 'decisiveRuleIds'> {
  for (const { outcome, status } of PRECEDENCE) {
    const decisive = evaluations.filter((evaluation) => evaluation.outcome === outcome);
    if (decisive.length > 0) {
      return { status, decisiveRuleIds: decisive.map((evaluation) => evaluation.ruleId) };
    }
  }
  return { status: 'escalated', decisiveRuleIds: [] };
}

/** Evaluates every rule and combines the outcomes. Pure: same context, same decision. */
export function evaluatePolicy(
  ctx: PolicyContext,
  rules: readonly PolicyRule[] = POLICY_RULES,
): PolicyDecision {
  const evaluations = rules.map((rule) => rule(ctx));
  const flags = [...new Set<Flag>(evaluations.flatMap((evaluation) => evaluation.flags))].sort();
  return {
    ...combine(evaluations),
    rules: evaluations.map(({ ruleId, outcome, reason }) => ({ ruleId, outcome, reason })),
    flags,
  };
}
