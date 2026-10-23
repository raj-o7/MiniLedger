/**
 * Money is stored as whole cents (or paise) so adding amounts never produces
 * floating point surprises like 0.1 + 0.2 = 0.30000000000000004.
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function hasAtMostTwoDecimals(amount: number): boolean {
  return Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6;
}
