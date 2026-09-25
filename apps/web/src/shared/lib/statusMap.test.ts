import { FLAGS, REFUND_STATUSES, RULE_OUTCOMES } from '@worknoon/contracts';
import { flagLabel, flagMap, refundStatusMap, ruleOutcomeMap } from './statusMap';

describe('statusMap', () => {
  it('colors refund statuses: approved green, denied red, escalated amber', () => {
    expect(refundStatusMap.approved).toMatchObject({ label: 'Approved', tone: 'success' });
    expect(refundStatusMap.denied).toMatchObject({ label: 'Denied', tone: 'danger' });
    expect(refundStatusMap.escalated).toMatchObject({ label: 'Escalated', tone: 'warning' });
  });

  it('covers every status, rule outcome and flag in the contract', () => {
    for (const status of REFUND_STATUSES) expect(refundStatusMap[status].label).toBeTruthy();
    for (const outcome of RULE_OUTCOMES) expect(ruleOutcomeMap[outcome].label).toBeTruthy();
    for (const flag of FLAGS) expect(flagMap[flag].label).not.toBe(flag);
  });

  it('uses human labels for flags', () => {
    expect(flagLabel('INJECTION_HEURISTIC')).toBe('Injection pattern');
    expect(flagLabel('HIGH_REFUND_FREQUENCY')).toBe('High refund frequency');
    expect(flagLabel('SOMETHING_NEW')).toBe('Something new');
  });

  it('labels not_applicable as n/a', () => {
    expect(ruleOutcomeMap.not_applicable.label).toBe('n/a');
  });
});
