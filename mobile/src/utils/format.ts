// Change these two values to show a different currency.
const LOCALE = 'en-IN';
const CURRENCY = 'INR';

const wholeFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 0,
});
const decimalFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 1500 -> '₹1,500' and 1500.5 -> '₹1,500.50' */
export function formatMoney(amount: number): string {
  return Number.isInteger(amount) ? wholeFormatter.format(amount) : decimalFormatter.format(amount);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2025-06-05' -> '5 Jun 2025' */
export function formatDate(isoDate: string): string {
  const year = isoDate.slice(0, 4);
  const month = MONTHS[Number(isoDate.slice(5, 7)) - 1] ?? '';
  const day = Number(isoDate.slice(8, 10));
  return `${day} ${month} ${year}`;
}

/** A Date as YYYY-MM-DD using the phone's local calendar day. */
export function toDateString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayString(): string {
  return toDateString(new Date());
}

/** Adds days to a YYYY-MM-DD date and returns a new YYYY-MM-DD date. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). Positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
