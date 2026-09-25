const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `Sep 25, 2026` */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = toDate(value);
  return date ? dateFormatter.format(date) : '';
}

/** `Sep 25, 10:04 AM` */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : '';
}

/** `10:04 AM` */
export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = toDate(value);
  return date ? timeFormatter.format(date) : '';
}

/** `3 days ago`, `just now`. */
export function formatRelative(value: string | Date, now: Date = new Date()): string {
  const date = toDate(value);
  if (!date) return '';
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  return rtf.format(Math.round(seconds / 86400), 'day');
}
