import { fromCents } from '../utils/money';
import type { LoanFilter } from './loanSchemas';

/**
 * Pure business rules for loans. "Pure" means these functions only use their inputs
 * (no database, no clock), which makes them easy to understand and to unit test.
 */

export type LoanStatus = 'pending' | 'repaid';

export interface LoanFacts {
  amountCents: number;
  status: LoanStatus;
  dueDate: string; // YYYY-MM-DD
}

export interface LoanSummary {
  totalLent: number;
  totalRepaid: number;
  outstanding: number;
  overdue: number;
  totalLoans: number;
  pendingLoans: number;
  repaidLoans: number;
  overdueLoans: number;
}

/**
 * A loan is overdue when it is still pending and its due date is before today.
 * A loan due today is not overdue yet, and a repaid loan is never overdue.
 */
export function isOverdue(loan: Pick<LoanFacts, 'status' | 'dueDate'>, today: string): boolean {
  return loan.status === 'pending' && loan.dueDate < today;
}

export function matchesFilter(loan: LoanFacts, filter: LoanFilter, today: string): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'pending':
      return loan.status === 'pending';
    case 'repaid':
      return loan.status === 'repaid';
    case 'overdue':
      return isOverdue(loan, today);
  }
}

export function calculateSummary(loans: LoanFacts[], today: string): LoanSummary {
  let totalLentCents = 0;
  let totalRepaidCents = 0;
  let overdueCents = 0;
  let repaidLoans = 0;
  let overdueLoans = 0;

  for (const loan of loans) {
    totalLentCents += loan.amountCents;

    if (loan.status === 'repaid') {
      totalRepaidCents += loan.amountCents;
      repaidLoans += 1;
    } else if (isOverdue(loan, today)) {
      overdueCents += loan.amountCents;
      overdueLoans += 1;
    }
  }

  return {
    totalLent: fromCents(totalLentCents),
    totalRepaid: fromCents(totalRepaidCents),
    outstanding: fromCents(totalLentCents - totalRepaidCents),
    overdue: fromCents(overdueCents),
    totalLoans: loans.length,
    pendingLoans: loans.length - repaidLoans,
    repaidLoans,
    overdueLoans,
  };
}
