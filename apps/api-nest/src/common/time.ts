export const MS_PER_DAY = 86_400_000;

/** Whole days between two instants: `floor((now − then) / 24h)`. */
export function wholeDaysBetween(then: Date, now: Date): number {
  return Math.floor((now.getTime() - then.getTime()) / MS_PER_DAY);
}

export function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * MS_PER_DAY);
}

/** A timestamp strictly after `previous`, so messages stored in quick succession keep their order. */
export function instantAfter(previous: Date, now: Date = new Date()): Date {
  return now.getTime() > previous.getTime() ? now : new Date(previous.getTime() + 1);
}
