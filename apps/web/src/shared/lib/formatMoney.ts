/**
 * Formats integer cents as US dollars, matching the backends' formatMoney helper exactly:
 * `129900 -> $1,299.00`, `8900 -> $89.00`, `5 -> $0.05`.
 */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const rest = (abs % 100).toString().padStart(2, '0');
  return `${sign}$${dollars}.${rest}`;
}

export function formatPercent(ratio: number, fractionDigits = 1): string {
  return `${(ratio * 100).toFixed(fractionDigits)}%`;
}
