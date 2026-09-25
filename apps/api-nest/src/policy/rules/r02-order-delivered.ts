import { deny, pass } from '../outcomes.js';
import type { PolicyRule } from '../types.js';

/** R02: the order must be delivered; processing or shipped orders are directed to cancellation. */
export const orderDeliveredRule: PolicyRule = (ctx) =>
  ctx.orderStatus === 'delivered'
    ? pass('R02', 'Order has been delivered')
    : deny('R02', `Order is ${ctx.orderStatus}, not delivered`);
