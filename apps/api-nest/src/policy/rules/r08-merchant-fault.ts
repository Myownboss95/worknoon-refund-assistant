import { approve, notApplicable } from '../outcomes.js';
import type { PolicyRule } from '../types.js';

/** R08: damaged, defective or wrong items delivered within the refund window support approval. */
export const merchantFaultRule: PolicyRule = (ctx) => {
  const reason = ctx.extraction?.reasonCategory;
  if (reason === undefined || !ctx.config.merchantFaultReasons.includes(reason)) {
    return notApplicable('R08', 'Reason is not a merchant fault');
  }
  if (ctx.daysSinceDelivery === null) return notApplicable('R08', 'Order has not been delivered');
  return ctx.daysSinceDelivery <= ctx.config.refundWindowDays
    ? approve('R08', `Merchant-fault reason "${reason}" within the refund window`)
    : notApplicable('R08', 'Delivered outside the refund window');
};
