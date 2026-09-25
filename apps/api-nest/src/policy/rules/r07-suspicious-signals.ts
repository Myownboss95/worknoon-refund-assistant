import type { Flag } from '@worknoon/contracts';
import { escalate, pass } from '../outcomes.js';
import type { PolicyContext, PolicyRule } from '../types.js';

const FLAG_DESCRIPTIONS: Record<Flag, string> = {
  HIGH_REFUND_FREQUENCY: 'frequent recent refunds',
  CLAIM_CONFLICT: 'claim conflicts with order data',
  INJECTION_HEURISTIC: 'injection pattern in customer text',
  INJECTION_MODEL: 'model suspects injection',
  LOW_CONFIDENCE: 'low confidence in the reason',
  AI_UNAVAILABLE: 'AI unavailable',
  CLARIFICATION_EXHAUSTED: 'clarification limit reached',
  REPLY_GUARD_FALLBACK: 'reply guard fallback',
  COMPOSE_UNAVAILABLE: 'compose unavailable',
};

function suspiciousFlags(ctx: PolicyContext): Flag[] {
  const { config, extraction } = ctx;
  const flags: Flag[] = [];

  if (ctx.recentApprovedRefunds >= config.suspiciousRefundCount)
    flags.push('HIGH_REFUND_FREQUENCY');

  if (extraction === null) {
    flags.push('AI_UNAVAILABLE');
  } else {
    const deliveredButNotReceived =
      extraction.reasonCategory === 'not_received' && ctx.orderStatus === 'delivered';
    if (extraction.claimsConflict || deliveredButNotReceived) flags.push('CLAIM_CONFLICT');
    if (extraction.injectionSuspected) flags.push('INJECTION_MODEL');
    const unclearAfterLimit = extraction.reasonCategory === 'unclear' && ctx.clarificationExhausted;
    if (extraction.confidence < config.minAiConfidence || unclearAfterLimit)
      flags.push('LOW_CONFIDENCE');
  }

  if (ctx.heuristicMatches.length > 0) flags.push('INJECTION_HEURISTIC');

  return flags.sort();
}

/** R07: suspicious signals need human review; the signals that fired are recorded as flags. */
export const suspiciousSignalsRule: PolicyRule = (ctx) => {
  const flags = suspiciousFlags(ctx);
  if (flags.length === 0) return pass('R07', 'No suspicious signals');
  const description = flags.map((flag) => FLAG_DESCRIPTIONS[flag]).join(', ');
  return escalate('R07', `Suspicious signals: ${description}`, flags);
};
