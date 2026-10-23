const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True when the value looks like YYYY-MM-DD and is a real calendar date (no 2025-02-30). */
export function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Today's date as YYYY-MM-DD in the given timezone.
 * Dates in YYYY-MM-DD form can be compared as plain strings: '2025-01-09' < '2025-01-10'.
 */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}
