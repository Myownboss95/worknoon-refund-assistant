import { formatMoney, formatPercent } from './formatMoney';

describe('formatMoney', () => {
  it.each([
    [129900, '$1,299.00'],
    [8900, '$89.00'],
    [5, '$0.05'],
    [0, '$0.00'],
    [50000, '$500.00'],
    [123456789, '$1,234,567.89'],
  ])('formats %i cents as %s', (cents, expected) => {
    expect(formatMoney(cents)).toBe(expected);
  });

  it('formats negative amounts with a leading minus', () => {
    expect(formatMoney(-2550)).toBe('-$25.50');
  });
});

describe('formatPercent', () => {
  it('renders a ratio as a percentage', () => {
    expect(formatPercent(0.3333)).toBe('33.3%');
    expect(formatPercent(0)).toBe('0.0%');
    expect(formatPercent(1, 0)).toBe('100%');
  });
});
