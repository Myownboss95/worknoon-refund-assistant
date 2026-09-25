import { deny, notApplicable, pass } from '../outcomes.js';
import type { PolicyRule } from '../types.js';

/** R03: refunds are available for `refundWindowDays` whole days after delivery. */
export const refundWindowRule: PolicyRule = (ctx) => {
  if (ctx.daysSinceDelivery === null) return notApplicable('R03', 'Order has not been delivered');
  return ctx.daysSinceDelivery > ctx.config.refundWindowDays
    ? deny(
        'R03',
        `Delivered ${ctx.daysSinceDelivery} days ago; window is ${ctx.config.refundWindowDays} days`,
      )
    : pass(
        'R03',
        `Delivered ${ctx.daysSinceDelivery} days ago, within the ${ctx.config.refundWindowDays}-day window`,
      );
};
