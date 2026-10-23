// Client-side checks give instant feedback. The backend repeats every check,
// because a server must never trust what an app sends it.

const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_LOAN_AMOUNT = 10_000_000;

/** Removes spaces, dashes and brackets: '+91 98765-43210' -> '+919876543210'. */
export function normalizePhone(input: string): string {
  return input.replace(/[\s\-()]/g, '');
}

export function validatePhone(input: string): string | null {
  const phone = normalizePhone(input);
  if (phone.length === 0) {
    return 'Please enter your phone number.';
  }
  if (!PHONE_PATTERN.test(phone)) {
    return 'Enter the number with country code, for example +919876543210.';
  }
  return null;
}

export function validateOtp(code: string): string | null {
  return /^\d{6}$/.test(code.trim()) ? null : 'Enter the 6-digit code.';
}

export function isValidDate(value: string): boolean {
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

/** Parses "1,500.50" into 1500.5. Returns null for anything that is not a valid amount. */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/,/g, '').trim();
  if (!AMOUNT_PATTERN.test(cleaned)) {
    return null;
  }
  return Number(cleaned);
}

export interface LoanFormValues {
  friendName: string;
  amount: string;
  loanDate: string;
  dueDate: string;
}

export type LoanFormErrors = Partial<Record<keyof LoanFormValues, string>>;

export function validateLoanForm(values: LoanFormValues, today: string): LoanFormErrors {
  const errors: LoanFormErrors = {};

  const name = values.friendName.trim();
  if (name.length === 0) {
    errors.friendName = "Enter your friend's name.";
  } else if (name.length > 100) {
    errors.friendName = 'Name must be at most 100 characters.';
  }

  const amount = parseAmount(values.amount);
  if (amount === null) {
    errors.amount = 'Enter an amount like 500 or 499.50.';
  } else if (amount <= 0) {
    errors.amount = 'Amount must be greater than 0.';
  } else if (amount > MAX_LOAN_AMOUNT) {
    errors.amount = `Amount cannot be more than ${MAX_LOAN_AMOUNT.toLocaleString('en-IN')}.`;
  }

  if (!isValidDate(values.loanDate)) {
    errors.loanDate = 'Use the format YYYY-MM-DD.';
  } else if (values.loanDate > today) {
    errors.loanDate = 'Loan date cannot be in the future.';
  }

  if (!isValidDate(values.dueDate)) {
    errors.dueDate = 'Use the format YYYY-MM-DD.';
  } else if (isValidDate(values.loanDate) && values.dueDate < values.loanDate) {
    errors.dueDate = 'Due date cannot be before the loan date.';
  }

  return errors;
}

// Base64 makes data about 4/3 bigger, so ~2.8 million characters is roughly a 2 MB image.
// Must match the limit in backend/src/loans/loanSchemas.ts.
export const MAX_RECEIPT_DATA_URI_LENGTH = 2_800_000;
