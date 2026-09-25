import { deny, escalate, pass } from '../outcomes.js';
import type { PolicyRule } from '../types.js';

/**
 * R04: final sale items are not refundable, except that a merchant-fault reason (or an unknown
 * reason because the AI was unavailable) escalates instead of denying.
 */
export const finalSaleRule: PolicyRule = (ctx) => {
  const finalSaleCount = ctx.items.filter((item) => item.finalSale).length;
  if (finalSaleCount === 0) return pass('R04', 'No final sale items selected');

  if (ctx.extraction === null) {
    return escalate('R04', 'Final sale item selected and the reason is unknown (AI unavailable)');
  }
  const reason = ctx.extraction.reasonCategory;
  return ctx.config.merchantFaultReasons.includes(reason)
    ? escalate('R04', `Final sale item selected with merchant-fault reason "${reason}"`)
    : deny('R04', `Final sale item selected with reason "${reason}"`);
};
