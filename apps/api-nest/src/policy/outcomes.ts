import type { Flag, RuleOutcome } from '@worknoon/contracts';
import type { RuleEvaluation, RuleId } from './types.js';

const result =
  (outcome: RuleOutcome) =>
  (ruleId: RuleId, reason: string, flags: readonly Flag[] = []): RuleEvaluation => ({
    ruleId,
    outcome,
    reason,
    flags,
  });

export const pass = result('pass');
export const notApplicable = result('not_applicable');
export const deny = result('deny');
export const escalate = result('escalate');
export const approve = result('approve');
