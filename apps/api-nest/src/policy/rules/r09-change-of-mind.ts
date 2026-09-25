import { approve, deny, notApplicable } from '../outcomes.js';
import type { PolicyRule } from '../types.js';

/** R09: change-of-mind refunds within `changeOfMindWindowDays` of delivery. */
export const changeOfMindRule: PolicyRule = (ctx) => {
  if (ctx.extraction?.reasonCategory !== 'changed_mind') {
    return notApplicable('R09', 'Reason is not a change of mind');
  }
  if (ctx.daysSinceDelivery === null) return notApplicable('R09', 'Order has not been delivered');
  const window = ctx.config.changeOfMindWindowDays;
  return ctx.daysSinceDelivery <= window
    ? approve(
        'R09',
        `Change of mind ${ctx.daysSinceDelivery} days after delivery (limit ${window})`,
      )
    : deny('R09', `Change of mind ${ctx.daysSinceDelivery} days after delivery (limit ${window})`);
};
