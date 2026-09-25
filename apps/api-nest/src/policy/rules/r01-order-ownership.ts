import { deny, pass } from '../outcomes.js';
import type { PolicyRule } from '../types.js';

/** R01: the order must belong to the verified customer. */
export const orderOwnershipRule: PolicyRule = (ctx) =>
  ctx.orderCustomerId === ctx.verifiedCustomerId
    ? pass('R01', 'Order belongs to the verified customer')
    : deny('R01', 'Order does not belong to the verified customer');
