import { escalate, pass } from '../outcomes.js';
import type { PolicyRule } from '../types.js';

/** R10: only `approvableReasons` can be approved automatically; anything else goes to a human. */
export const noAutomaticApprovalPathRule: PolicyRule = (ctx) => {
  if (ctx.extraction === null)
    return escalate('R10', 'Reason unknown because the AI was unavailable');
  const reason = ctx.extraction.reasonCategory;
  return ctx.config.approvableReasons.includes(reason)
    ? pass('R10', `Reason "${reason}" can be decided automatically`)
    : escalate('R10', `Reason "${reason}" has no automatic approval path`);
};
