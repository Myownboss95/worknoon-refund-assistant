import type { Flag, ReasonCategory, RefundStatus, RuleOutcome } from '@worknoon/contracts';

export type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'accent';

export interface StatusMeta {
  label: string;
  tone: Tone;
  description?: string;
}

export const refundStatusMap: Record<RefundStatus, StatusMeta> = {
  approved: {
    label: 'Approved',
    tone: 'success',
    description: 'Refund issued automatically or by a reviewer.',
  },
  denied: {
    label: 'Denied',
    tone: 'danger',
    description: 'The request did not meet the refund policy.',
  },
  escalated: { label: 'Escalated', tone: 'warning', description: 'Waiting for a human reviewer.' },
};

export const itemRefundStatusMap: Record<'approved' | 'pending', StatusMeta> = {
  approved: { label: 'Refunded', tone: 'success' },
  pending: { label: 'Under review', tone: 'warning' },
};

export const ruleOutcomeMap: Record<RuleOutcome, StatusMeta> = {
  pass: { label: 'Pass', tone: 'neutral' },
  not_applicable: { label: 'n/a', tone: 'neutral' },
  deny: { label: 'Deny', tone: 'danger' },
  escalate: { label: 'Escalate', tone: 'warning' },
  approve: { label: 'Approve', tone: 'success' },
};

export const flagMap: Record<Flag, StatusMeta> = {
  HIGH_REFUND_FREQUENCY: {
    label: 'High refund frequency',
    tone: 'warning',
    description: 'Several approved refunds for this customer recently.',
  },
  CLAIM_CONFLICT: {
    label: 'Claim conflict',
    tone: 'warning',
    description: 'The claim conflicts with order data.',
  },
  INJECTION_HEURISTIC: {
    label: 'Injection pattern',
    tone: 'danger',
    description: 'A message matched a known prompt-injection pattern.',
  },
  INJECTION_MODEL: {
    label: 'Injection suspected by AI',
    tone: 'danger',
    description: 'The model flagged a possible prompt injection.',
  },
  LOW_CONFIDENCE: {
    label: 'Low AI confidence',
    tone: 'warning',
    description: 'The model was not confident about the reason.',
  },
  AI_UNAVAILABLE: {
    label: 'AI unavailable',
    tone: 'danger',
    description: 'The analyzer failed; the request was escalated safely.',
  },
  CLARIFICATION_EXHAUSTED: {
    label: 'Clarifications exhausted',
    tone: 'warning',
    description: 'The customer stayed unclear after the allowed clarification turns.',
  },
  REPLY_GUARD_FALLBACK: {
    label: 'Reply guard fallback',
    tone: 'info',
    description: 'The composed reply failed the guard; a template was used.',
  },
  COMPOSE_UNAVAILABLE: {
    label: 'Compose unavailable',
    tone: 'info',
    description: 'Reply composition failed; a template was used.',
  },
};

export const reasonCategoryMap: Record<ReasonCategory, string> = {
  damaged: 'Damaged',
  defective: 'Defective',
  wrong_item: 'Wrong item',
  changed_mind: 'Changed mind',
  not_received: 'Not received',
  other: 'Other',
  unclear: 'Unclear',
};

export const decidedByMap: Record<'policy' | 'human', StatusMeta> = {
  policy: { label: 'Policy', tone: 'neutral' },
  human: { label: 'Human', tone: 'accent' },
};

export const orderStatusMap: Record<'processing' | 'shipped' | 'delivered', StatusMeta> = {
  processing: { label: 'Processing', tone: 'info' },
  shipped: { label: 'Shipped', tone: 'info' },
  delivered: { label: 'Delivered', tone: 'success' },
};

/** Falls back gracefully for values a newer backend might add. */
export function flagLabel(flag: string): string {
  return (flagMap as Record<string, StatusMeta | undefined>)[flag]?.label ?? humanize(flag);
}

export function humanize(value: string): string {
  const text = value.replace(/[._]/g, ' ').toLowerCase().trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
