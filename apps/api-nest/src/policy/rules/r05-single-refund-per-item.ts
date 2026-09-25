import { deny, pass } from '../outcomes.js';
import type { PolicyRule } from '../types.js';

/** R05: an item can only be refunded once (an approved or pending request blocks another). */
export const singleRefundPerItemRule: PolicyRule = (ctx) => {
  const claimed = ctx.items.filter((item) => item.refundStatus !== null);
  if (claimed.length === 0) return pass('R05', 'No selected item has an existing refund');
  const approved = claimed.filter((item) => item.refundStatus === 'approved').length;
  const pending = claimed.length - approved;
  return deny(
    'R05',
    `${claimed.length} selected item(s) already covered: ${approved} approved, ${pending} pending review`,
  );
};
