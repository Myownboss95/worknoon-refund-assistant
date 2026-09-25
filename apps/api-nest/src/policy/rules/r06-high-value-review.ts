import { formatMoney } from '../../common/formatting.js';
import { escalate, pass } from '../outcomes.js';
import type { PolicyRule } from '../types.js';

/** R06: totals strictly above `humanReviewThresholdCents` need human review. */
export const highValueReviewRule: PolicyRule = (ctx) => {
  const threshold = ctx.config.humanReviewThresholdCents;
  return ctx.amountCents > threshold
    ? escalate('R06', `Total ${formatMoney(ctx.amountCents)} exceeds ${formatMoney(threshold)}`)
    : pass('R06', `Total ${formatMoney(ctx.amountCents)} is within ${formatMoney(threshold)}`);
};
