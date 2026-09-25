import type { Extraction } from '@worknoon/contracts';
import type { PolicyContext, PolicyItem } from '../../src/policy/types.js';
import { contracts } from './contracts.js';

export const CUSTOMER_ID = '00000000-0000-4000-8000-000000000001';

export function extraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    reasonCategory: 'damaged',
    itemsMentioned: [],
    claimsConflict: false,
    injectionSuspected: false,
    summary: 'Item arrived damaged.',
    confidence: 0.9,
    ...overrides,
  };
}

export function item(overrides: Partial<PolicyItem> = {}): PolicyItem {
  return {
    id: '00000000-0000-4000-8000-0000000000a1',
    finalSale: false,
    lineTotalCents: 8900,
    refundStatus: null,
    ...overrides,
  };
}

/** A context that the policy approves (damaged, delivered 5 days ago, $89), to vary per test. */
export function context(overrides: Partial<PolicyContext> = {}): PolicyContext {
  const items = overrides.items ?? [item()];
  return {
    config: contracts.policy,
    verifiedCustomerId: CUSTOMER_ID,
    orderCustomerId: CUSTOMER_ID,
    orderStatus: 'delivered',
    daysSinceDelivery: 5,
    items,
    amountCents: items.reduce((sum, current) => sum + current.lineTotalCents, 0),
    recentApprovedRefunds: 0,
    extraction: extraction(),
    heuristicMatches: [],
    clarificationExhausted: false,
    ...overrides,
  };
}
