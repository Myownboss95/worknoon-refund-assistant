import { describe, expect, it } from 'vitest';
import {
  firstName,
  formatMoney,
  joinNames,
  maskEmail,
  renderTemplate,
} from '../../../src/common/formatting.js';
import { sanitizeMessageText } from '../../../src/common/text.js';
import { instantAfter, wholeDaysBetween } from '../../../src/common/time.js';

describe('formatMoney', () => {
  it.each([
    [129_900, '$1,299.00'],
    [8900, '$89.00'],
    [5, '$0.05'],
    [0, '$0.00'],
    [50_000, '$500.00'],
    [123_456_789, '$1,234,567.89'],
  ])('%i → %s', (cents, expected) => {
    expect(formatMoney(cents)).toBe(expected);
  });
});

describe('joinNames', () => {
  it.each([
    [['A'], 'A'],
    [['A', 'B'], 'A and B'],
    [['A', 'B', 'C'], 'A, B and C'],
    [['A', 'B', 'C', 'D'], 'A, B, C and D'],
  ])('%j → %s', (names, expected) => {
    expect(joinNames(names)).toBe(expected);
  });
});

describe('firstName', () => {
  it.each([
    ['Ada Okafor', 'Ada'],
    ['Cher', 'Cher'],
    ['Mary Jane Watson', 'Mary'],
  ])('%s → %s', (name, expected) => {
    expect(firstName(name)).toBe(expected);
  });
});

describe('maskEmail', () => {
  it.each([
    ['ada.okafor@example.com', 'a***@example.com'],
    ['b@example.org', 'b***@example.org'],
  ])('%s → %s', (email, expected) => {
    expect(maskEmail(email)).toBe(expected);
  });
});

describe('renderTemplate', () => {
  it('fills known placeholders and leaves unknown ones', () => {
    expect(renderTemplate('Hi {firstName}, {unknown}', { firstName: 'Ada' })).toBe(
      'Hi Ada, {unknown}',
    );
  });
});

describe('sanitizeMessageText', () => {
  it('strips control characters except newline and tab, then trims', () => {
    expect(sanitizeMessageText('  a\u0000b\u0007c\nd\te\r\u007f  ')).toBe('abc\nd\te');
  });

  it('can reduce text to nothing', () => {
    expect(sanitizeMessageText(' \u0001\u0002 ')).toBe('');
  });
});

describe('time', () => {
  const now = new Date('2026-09-25T10:00:00.000Z');

  it('counts whole days since delivery', () => {
    expect(wholeDaysBetween(new Date('2026-09-20T10:00:00.000Z'), now)).toBe(5);
    expect(wholeDaysBetween(new Date('2026-09-20T10:00:00.001Z'), now)).toBe(4);
  });

  it('orders a timestamp after a previous one', () => {
    const later = new Date('2026-09-25T10:00:05.000Z');
    expect(instantAfter(now, now).getTime()).toBe(now.getTime() + 1);
    expect(instantAfter(now, later)).toBe(later);
  });
});
