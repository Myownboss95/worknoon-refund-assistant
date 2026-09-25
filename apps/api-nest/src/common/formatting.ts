/** Formatting helpers shared with the Laravel backend (docs/pipeline.md, "Formatting helpers"). */

/** `129900 → $1,299.00`, `8900 → $89.00`, `5 → $0.05`. */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(absolute / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const remainder = (absolute % 100).toString().padStart(2, '0');
  return `${sign}$${dollars}.${remainder}`;
}

/** 1 → `A`; 2 → `A and B`; 3+ → `A, B and C`. */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  const head = names.slice(0, -1).join(', ');
  return `${head} and ${names[names.length - 1] ?? ''}`;
}

/** Text before the first space. */
export function firstName(name: string): string {
  const trimmed = name.trim();
  const space = trimmed.indexOf(' ');
  return space === -1 ? trimmed : trimmed.slice(0, space);
}

/** First character of the local part + `***@` + domain. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  return `${email.charAt(0)}***@${email.slice(at + 1)}`;
}

/** Replaces `{name}` placeholders; unknown placeholders are left untouched. */
export function renderTemplate(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}
