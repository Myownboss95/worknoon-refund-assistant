import { describe, expect, it } from 'vitest';
import { evaluatePolicy, POLICY_RULES } from '../../../src/policy/engine.js';
import { approve, deny, escalate, notApplicable, pass } from '../../../src/policy/outcomes.js';
import type { PolicyRule } from '../../../src/policy/types.js';
import { context, extraction, item } from '../../support/policy-context.js';

const rules = (...outcomes: PolicyRule[]): PolicyRule[] => outcomes;

describe('evaluatePolicy', () => {
  it('evaluates all ten rules in order', () => {
    const decision = evaluatePolicy(context());
    expect(POLICY_RULES).toHaveLength(10);
    expect(decision.rules.map((rule) => rule.ruleId)).toEqual([
      'R01',
      'R02',
      'R03',
      'R04',
      'R05',
      'R06',
      'R07',
      'R08',
      'R09',
      'R10',
    ]);
  });

  it('approves a damaged item within the window (R08)', () => {
    const decision = evaluatePolicy(context());
    expect(decision).toMatchObject({ status: 'approved', decisiveRuleIds: ['R08'], flags: [] });
  });

  describe('precedence', () => {
    const ctx = context();

    it('deny beats escalate and approve', () => {
      const decision = evaluatePolicy(
        ctx,
        rules(
          () => approve('R08', 'a'),
          () => escalate('R06', 'e'),
          () => deny('R03', 'd'),
          () => deny('R09', 'd'),
        ),
      );
      expect(decision.status).toBe('denied');
      expect(decision.decisiveRuleIds).toEqual(['R03', 'R09']);
    });

    it('escalate beats approve', () => {
      const decision = evaluatePolicy(
        ctx,
        rules(
          () => approve('R08', 'a'),
          () => escalate('R06', 'e'),
        ),
      );
      expect(decision).toMatchObject({ status: 'escalated', decisiveRuleIds: ['R06'] });
    });

    it('falls back to escalation when nothing is decisive', () => {
      const decision = evaluatePolicy(
        ctx,
        rules(
          () => pass('R01', 'p'),
          () => notApplicable('R09', 'n'),
        ),
      );
      expect(decision).toMatchObject({ status: 'escalated', decisiveRuleIds: [] });
    });
  });

  it('denies a final sale change of mind with R04 only', () => {
    const decision = evaluatePolicy(
      context({
        items: [item({ finalSale: true })],
        extraction: extraction({ reasonCategory: 'changed_mind' }),
      }),
    );
    expect(decision).toMatchObject({ status: 'denied', decisiveRuleIds: ['R04'] });
  });

  it('escalates a damaged final sale item (R04), even though R08 approves', () => {
    const decision = evaluatePolicy(context({ items: [item({ finalSale: true })] }));
    expect(decision).toMatchObject({ status: 'escalated', decisiveRuleIds: ['R04'] });
    expect(decision.rules.find((rule) => rule.ruleId === 'R08')?.outcome).toBe('approve');
  });

  it('escalates when the AI is unavailable (R07 + R10) and flags it', () => {
    const decision = evaluatePolicy(context({ extraction: null }));
    expect(decision).toMatchObject({
      status: 'escalated',
      decisiveRuleIds: ['R07', 'R10'],
      flags: ['AI_UNAVAILABLE'],
    });
  });

  it('escalates an AI-unavailable final sale item via R04, R07 and R10', () => {
    const decision = evaluatePolicy(
      context({ extraction: null, items: [item({ finalSale: true })] }),
    );
    expect(decision).toMatchObject({ status: 'escalated', decisiveRuleIds: ['R04', 'R07', 'R10'] });
  });

  it('still denies when the AI is unavailable but the window has passed', () => {
    const decision = evaluatePolicy(context({ extraction: null, daysSinceDelivery: 45 }));
    expect(decision).toMatchObject({ status: 'denied', decisiveRuleIds: ['R03'] });
  });

  it('denies an undelivered order with R02 (R03 and R09 not applicable)', () => {
    const decision = evaluatePolicy(
      context({
        orderStatus: 'processing',
        daysSinceDelivery: null,
        extraction: extraction({ reasonCategory: 'changed_mind' }),
      }),
    );
    expect(decision).toMatchObject({ status: 'denied', decisiveRuleIds: ['R02'] });
  });

  it('escalates prompt injection even when the reason is approvable', () => {
    const decision = evaluatePolicy(context({ heuristicMatches: ['ignore_instructions'] }));
    expect(decision).toMatchObject({
      status: 'escalated',
      decisiveRuleIds: ['R07'],
      flags: ['INJECTION_HEURISTIC'],
    });
  });

  it('escalates not received on a delivered order with R07 and R10', () => {
    const decision = evaluatePolicy(
      context({ extraction: extraction({ reasonCategory: 'not_received' }) }),
    );
    expect(decision).toMatchObject({
      status: 'escalated',
      decisiveRuleIds: ['R07', 'R10'],
      flags: ['CLAIM_CONFLICT'],
    });
  });

  it('is pure: the same context gives the same decision', () => {
    const ctx = context({ recentApprovedRefunds: 5 });
    expect(evaluatePolicy(ctx)).toEqual(evaluatePolicy(ctx));
  });
});
