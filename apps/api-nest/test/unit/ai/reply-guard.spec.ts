import { describe, expect, it } from 'vitest';
import { ReplyGuard } from '../../../src/ai/guards/reply-guard.js';
import { contracts } from '../../support/contracts.js';

const guard = new ReplyGuard(contracts.replyGuard);

describe('ReplyGuard', () => {
  it.each([
    {
      name: 'a correct approval',
      status: 'approved' as const,
      reply:
        'Hi Ada, your refund of $89.00 has been approved and goes back to your card in 5 to 10 business days.',
      violations: [],
    },
    {
      name: 'an empty reply',
      status: 'approved' as const,
      reply: '   ',
      violations: ['EMPTY'],
    },
    {
      name: 'an overly long reply',
      status: 'escalated' as const,
      reply: `Hi Ada, ${'a'.repeat(800)}`,
      violations: ['TOO_LONG'],
    },
    {
      name: 'an approval that says it is under review',
      status: 'approved' as const,
      reply: 'Hi Ada, your refund of $89.00 is Under Review.',
      violations: ['CONTRADICTS_DECISION'],
    },
    {
      name: 'a denial that promises money',
      status: 'denied' as const,
      reply: 'Hi Ada, you will receive your money soon.',
      violations: ['CONTRADICTS_DECISION'],
    },
    {
      name: 'an escalation that says approved',
      status: 'escalated' as const,
      reply: 'Hi Ada, your refund has been approved.',
      violations: ['CONTRADICTS_DECISION'],
    },
    {
      name: 'a rule id',
      status: 'denied' as const,
      reply: 'Hi Ada, rule R03 applies here.',
      violations: ['LEAKS_INTERNALS'],
    },
    {
      name: 'mentions of internals',
      status: 'escalated' as const,
      reply: 'Our language model flagged your message.',
      violations: ['LEAKS_INTERNALS'],
    },
    {
      name: 'a wrong approved amount',
      status: 'approved' as const,
      reply: 'Hi Ada, your refund of $5,000.00 is on its way.',
      violations: ['WRONG_AMOUNT'],
    },
    {
      name: 'an approved amount with a space after the dollar sign',
      status: 'approved' as const,
      reply: 'Hi Ada, your refund of $ 89.00 is on its way.',
      violations: [],
    },
    {
      name: 'a dollar amount in an escalation',
      status: 'escalated' as const,
      reply: 'Hi Ada, a colleague will look at your $89.00 request.',
      violations: ['WRONG_AMOUNT'],
    },
  ])('$name → $violations', ({ status, reply, violations }) => {
    expect(guard.check({ status, reply, amount: '$89.00' })).toEqual(violations);
  });

  it('reports several violations in a fixed order', () => {
    expect(
      guard.check({ status: 'denied', amount: '$89.00', reply: 'R05: you will receive $89.00.' }),
    ).toEqual(['CONTRADICTS_DECISION', 'LEAKS_INTERNALS', 'WRONG_AMOUNT']);
  });
});
