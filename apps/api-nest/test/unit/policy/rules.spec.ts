import type { RuleOutcome } from '@worknoon/contracts';
import { describe, expect, it } from 'vitest';
import { orderOwnershipRule } from '../../../src/policy/rules/r01-order-ownership.js';
import { orderDeliveredRule } from '../../../src/policy/rules/r02-order-delivered.js';
import { refundWindowRule } from '../../../src/policy/rules/r03-refund-window.js';
import { finalSaleRule } from '../../../src/policy/rules/r04-final-sale.js';
import { singleRefundPerItemRule } from '../../../src/policy/rules/r05-single-refund-per-item.js';
import { highValueReviewRule } from '../../../src/policy/rules/r06-high-value-review.js';
import { suspiciousSignalsRule } from '../../../src/policy/rules/r07-suspicious-signals.js';
import { merchantFaultRule } from '../../../src/policy/rules/r08-merchant-fault.js';
import { changeOfMindRule } from '../../../src/policy/rules/r09-change-of-mind.js';
import { noAutomaticApprovalPathRule } from '../../../src/policy/rules/r10-no-automatic-approval-path.js';
import type { PolicyContext, PolicyRule } from '../../../src/policy/types.js';
import { context, extraction, item } from '../../support/policy-context.js';

interface Case {
  readonly name: string;
  readonly ctx: PolicyContext;
  readonly outcome: RuleOutcome;
}

function table(ruleId: string, rule: PolicyRule, cases: readonly Case[]): void {
  describe(ruleId, () => {
    it.each(cases)('$name → $outcome', ({ ctx, outcome }) => {
      const result = rule(ctx);
      expect(result.ruleId).toBe(ruleId);
      expect(result.outcome).toBe(outcome);
      expect(result.reason.length).toBeGreaterThan(0);
    });
  });
}

table('R01', orderOwnershipRule, [
  { name: 'order belongs to the customer', ctx: context(), outcome: 'pass' },
  {
    name: 'order belongs to someone else',
    ctx: context({ orderCustomerId: '00000000-0000-4000-8000-000000000999' }),
    outcome: 'deny',
  },
]);

table('R02', orderDeliveredRule, [
  { name: 'delivered', ctx: context(), outcome: 'pass' },
  {
    name: 'processing',
    ctx: context({ orderStatus: 'processing', daysSinceDelivery: null }),
    outcome: 'deny',
  },
  {
    name: 'shipped',
    ctx: context({ orderStatus: 'shipped', daysSinceDelivery: null }),
    outcome: 'deny',
  },
]);

table('R03', refundWindowRule, [
  { name: 'day 0', ctx: context({ daysSinceDelivery: 0 }), outcome: 'pass' },
  { name: 'day 30 (boundary)', ctx: context({ daysSinceDelivery: 30 }), outcome: 'pass' },
  { name: 'day 31', ctx: context({ daysSinceDelivery: 31 }), outcome: 'deny' },
  { name: 'day 60', ctx: context({ daysSinceDelivery: 60 }), outcome: 'deny' },
  {
    name: 'not delivered',
    ctx: context({ orderStatus: 'processing', daysSinceDelivery: null }),
    outcome: 'not_applicable',
  },
]);

const finalSale = [item({ finalSale: true })];
table('R04', finalSaleRule, [
  { name: 'no final sale items', ctx: context(), outcome: 'pass' },
  {
    name: 'final sale, changed mind',
    ctx: context({ items: finalSale, extraction: extraction({ reasonCategory: 'changed_mind' }) }),
    outcome: 'deny',
  },
  {
    name: 'final sale, other',
    ctx: context({ items: finalSale, extraction: extraction({ reasonCategory: 'other' }) }),
    outcome: 'deny',
  },
  {
    name: 'final sale, not received',
    ctx: context({ items: finalSale, extraction: extraction({ reasonCategory: 'not_received' }) }),
    outcome: 'deny',
  },
  ...(['damaged', 'defective', 'wrong_item'] as const).map((reasonCategory) => ({
    name: `final sale, ${reasonCategory}`,
    ctx: context({ items: finalSale, extraction: extraction({ reasonCategory }) }),
    outcome: 'escalate' as const,
  })),
  {
    name: 'final sale, AI unavailable',
    ctx: context({ items: finalSale, extraction: null }),
    outcome: 'escalate',
  },
  {
    name: 'one of two items is final sale',
    ctx: context({
      items: [item(), item({ id: 'b', finalSale: true })],
      extraction: extraction({ reasonCategory: 'changed_mind' }),
    }),
    outcome: 'deny',
  },
]);

table('R05', singleRefundPerItemRule, [
  { name: 'no existing refund', ctx: context(), outcome: 'pass' },
  {
    name: 'already approved',
    ctx: context({ items: [item({ refundStatus: 'approved' })] }),
    outcome: 'deny',
  },
  {
    name: 'pending review',
    ctx: context({ items: [item({ refundStatus: 'pending' })] }),
    outcome: 'deny',
  },
  {
    name: 'one of two items already refunded',
    ctx: context({ items: [item(), item({ id: 'b', refundStatus: 'approved' })] }),
    outcome: 'deny',
  },
]);

table('R06', highValueReviewRule, [
  { name: '$89.00', ctx: context(), outcome: 'pass' },
  { name: '50000 cents (boundary)', ctx: context({ amountCents: 50_000 }), outcome: 'pass' },
  { name: '50001 cents', ctx: context({ amountCents: 50_001 }), outcome: 'escalate' },
  { name: '$1,299.00', ctx: context({ amountCents: 129_900 }), outcome: 'escalate' },
]);

table('R07', suspiciousSignalsRule, [
  { name: 'no signals', ctx: context(), outcome: 'pass' },
  { name: '2 recent refunds', ctx: context({ recentApprovedRefunds: 2 }), outcome: 'pass' },
  { name: '3 recent refunds', ctx: context({ recentApprovedRefunds: 3 }), outcome: 'escalate' },
  {
    name: 'confidence 0.6 (boundary)',
    ctx: context({ extraction: extraction({ confidence: 0.6 }) }),
    outcome: 'pass',
  },
  {
    name: 'confidence 0.59',
    ctx: context({ extraction: extraction({ confidence: 0.59 }) }),
    outcome: 'escalate',
  },
  { name: 'AI unavailable', ctx: context({ extraction: null }), outcome: 'escalate' },
]);

table('R08', merchantFaultRule, [
  ...(['damaged', 'defective', 'wrong_item'] as const).map((reasonCategory) => ({
    name: reasonCategory,
    ctx: context({ extraction: extraction({ reasonCategory }) }),
    outcome: 'approve' as const,
  })),
  {
    name: 'damaged on day 30 (inside the window)',
    ctx: context({ daysSinceDelivery: 30 }),
    outcome: 'approve',
  },
  {
    name: 'damaged on day 31 (outside the window)',
    ctx: context({ daysSinceDelivery: 31 }),
    outcome: 'not_applicable',
  },
  {
    name: 'damaged but not delivered',
    ctx: context({ orderStatus: 'shipped', daysSinceDelivery: null }),
    outcome: 'not_applicable',
  },
  {
    name: 'changed mind',
    ctx: context({ extraction: extraction({ reasonCategory: 'changed_mind' }) }),
    outcome: 'not_applicable',
  },
  { name: 'AI unavailable', ctx: context({ extraction: null }), outcome: 'not_applicable' },
]);

const changedMind = extraction({ reasonCategory: 'changed_mind' });
table('R09', changeOfMindRule, [
  {
    name: 'day 7',
    ctx: context({ extraction: changedMind, daysSinceDelivery: 7 }),
    outcome: 'approve',
  },
  {
    name: 'day 14 (boundary)',
    ctx: context({ extraction: changedMind, daysSinceDelivery: 14 }),
    outcome: 'approve',
  },
  {
    name: 'day 15',
    ctx: context({ extraction: changedMind, daysSinceDelivery: 15 }),
    outcome: 'deny',
  },
  {
    name: 'not delivered',
    ctx: context({ extraction: changedMind, orderStatus: 'processing', daysSinceDelivery: null }),
    outcome: 'not_applicable',
  },
  { name: 'other reason', ctx: context(), outcome: 'not_applicable' },
  { name: 'AI unavailable', ctx: context({ extraction: null }), outcome: 'not_applicable' },
]);

table('R10', noAutomaticApprovalPathRule, [
  ...(['damaged', 'defective', 'wrong_item', 'changed_mind'] as const).map((reasonCategory) => ({
    name: reasonCategory,
    ctx: context({ extraction: extraction({ reasonCategory }) }),
    outcome: 'pass' as const,
  })),
  ...(['not_received', 'other', 'unclear'] as const).map((reasonCategory) => ({
    name: reasonCategory,
    ctx: context({ extraction: extraction({ reasonCategory }) }),
    outcome: 'escalate' as const,
  })),
  { name: 'AI unavailable', ctx: context({ extraction: null }), outcome: 'escalate' },
]);

describe('R07 flags', () => {
  it.each([
    {
      name: 'high refund frequency',
      ctx: context({ recentApprovedRefunds: 4 }),
      flags: ['HIGH_REFUND_FREQUENCY'],
    },
    {
      name: 'model-reported conflict',
      ctx: context({ extraction: extraction({ claimsConflict: true }) }),
      flags: ['CLAIM_CONFLICT'],
    },
    {
      name: 'not received on a delivered order',
      ctx: context({ extraction: extraction({ reasonCategory: 'not_received' }) }),
      flags: ['CLAIM_CONFLICT'],
    },
    {
      name: 'not received on a shipped order is not a conflict',
      ctx: context({
        orderStatus: 'shipped',
        daysSinceDelivery: null,
        extraction: extraction({ reasonCategory: 'not_received' }),
      }),
      flags: [],
    },
    {
      name: 'heuristic injection',
      ctx: context({ heuristicMatches: ['system_prompt'] }),
      flags: ['INJECTION_HEURISTIC'],
    },
    {
      name: 'model injection',
      ctx: context({ extraction: extraction({ injectionSuspected: true }) }),
      flags: ['INJECTION_MODEL'],
    },
    {
      name: 'low confidence',
      ctx: context({ extraction: extraction({ confidence: 0.3 }) }),
      flags: ['LOW_CONFIDENCE'],
    },
    {
      name: 'unclear after the clarification limit',
      ctx: context({
        extraction: extraction({ reasonCategory: 'unclear', confidence: 0.9 }),
        clarificationExhausted: true,
      }),
      flags: ['LOW_CONFIDENCE'],
    },
    {
      name: 'unclear before the limit (confident)',
      ctx: context({ extraction: extraction({ reasonCategory: 'unclear', confidence: 0.9 }) }),
      flags: [],
    },
    { name: 'AI unavailable', ctx: context({ extraction: null }), flags: ['AI_UNAVAILABLE'] },
    {
      name: 'several signals, sorted',
      ctx: context({
        recentApprovedRefunds: 3,
        heuristicMatches: ['ignore_instructions'],
        extraction: extraction({ injectionSuspected: true, claimsConflict: true }),
      }),
      flags: ['CLAIM_CONFLICT', 'HIGH_REFUND_FREQUENCY', 'INJECTION_HEURISTIC', 'INJECTION_MODEL'],
    },
  ])('$name', ({ ctx, flags }) => {
    expect(suspiciousSignalsRule(ctx).flags).toEqual(flags);
  });
});
