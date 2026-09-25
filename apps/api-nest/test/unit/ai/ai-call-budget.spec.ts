import { describe, expect, it } from 'vitest';
import { AiCallBudget } from '../../../src/ai/ai-call-budget.js';

const HOUR = 3_600_000;

describe('AiCallBudget', () => {
  it('allows up to the limit per rolling hour, then refuses', () => {
    const budget = new AiCallBudget(3);
    expect([0, 1, 2].map((at) => budget.tryAcquire(at))).toEqual([true, true, true]);
    expect(budget.tryAcquire(10)).toBe(false);
    expect(budget.tryAcquire(HOUR - 1)).toBe(false);
  });

  it('frees a slot once the oldest call is an hour old', () => {
    const budget = new AiCallBudget(2);
    budget.tryAcquire(0);
    budget.tryAcquire(1_000);
    expect(budget.tryAcquire(HOUR)).toBe(true);
    expect(budget.tryAcquire(HOUR + 1)).toBe(false);
    expect(budget.tryAcquire(HOUR + 1_000)).toBe(true);
  });

  it('does not count refused attempts', () => {
    const budget = new AiCallBudget(1);
    budget.tryAcquire(0);
    for (let at = 1; at < 10; at += 1) expect(budget.tryAcquire(at)).toBe(false);
    expect(budget.tryAcquire(HOUR)).toBe(true);
  });
});
