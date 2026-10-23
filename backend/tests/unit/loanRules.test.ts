import { calculateSummary, isOverdue, matchesFilter, type LoanFacts } from '../../src/loans/loanRules';

const TODAY = '2025-06-15';

function loan(amountCents: number, status: LoanFacts['status'], dueDate: string): LoanFacts {
  return { amountCents, status, dueDate };
}

describe('isOverdue', () => {
  it('is true for a pending loan whose due date has passed', () => {
    expect(isOverdue(loan(100, 'pending', '2025-06-14'), TODAY)).toBe(true);
  });

  it('is false for a pending loan due today', () => {
    expect(isOverdue(loan(100, 'pending', TODAY), TODAY)).toBe(false);
  });

  it('is false for a pending loan due in the future', () => {
    expect(isOverdue(loan(100, 'pending', '2025-07-01'), TODAY)).toBe(false);
  });

  it('is never true for a repaid loan, even if its due date passed', () => {
    expect(isOverdue(loan(100, 'repaid', '2020-01-01'), TODAY)).toBe(false);
  });
});

describe('matchesFilter', () => {
  const pendingFuture = loan(100, 'pending', '2025-07-01');
  const pendingPast = loan(100, 'pending', '2025-06-01');
  const repaid = loan(100, 'repaid', '2025-06-01');

  it.each([
    ['all', [true, true, true]],
    ['pending', [true, true, false]],
    ['overdue', [false, true, false]],
    ['repaid', [false, false, true]],
  ] as const)('filter "%s"', (filter, expected) => {
    const results = [pendingFuture, pendingPast, repaid].map((l) => matchesFilter(l, filter, TODAY));
    expect(results).toEqual(expected);
  });
});

describe('calculateSummary', () => {
  it('returns zeros when there are no loans', () => {
    expect(calculateSummary([], TODAY)).toEqual({
      totalLent: 0,
      totalRepaid: 0,
      outstanding: 0,
      overdue: 0,
      totalLoans: 0,
      pendingLoans: 0,
      repaidLoans: 0,
      overdueLoans: 0,
    });
  });

  it('adds up lent, repaid, outstanding and overdue amounts correctly', () => {
    const loans = [
      loan(100_000, 'pending', '2025-07-01'), // 1000.00 pending, not due yet
      loan(50_050, 'pending', '2025-06-01'), // 500.50 pending and overdue
      loan(25_000, 'repaid', '2025-05-01'), // 250.00 repaid (past due date, but repaid)
      loan(1_000, 'pending', TODAY), // 10.00 due today, not overdue
    ];

    expect(calculateSummary(loans, TODAY)).toEqual({
      totalLent: 1760.5,
      totalRepaid: 250,
      outstanding: 1510.5,
      overdue: 500.5,
      totalLoans: 4,
      pendingLoans: 3,
      repaidLoans: 1,
      overdueLoans: 1,
    });
  });

  it('does not count repaid loans as overdue', () => {
    const summary = calculateSummary([loan(5_000, 'repaid', '2020-01-01')], TODAY);
    expect(summary.overdue).toBe(0);
    expect(summary.overdueLoans).toBe(0);
    expect(summary.outstanding).toBe(0);
  });

  it('keeps decimal amounts exact (no 0.1 + 0.2 = 0.30000000000000004)', () => {
    const summary = calculateSummary(
      [loan(10, 'pending', '2025-07-01'), loan(20, 'pending', '2025-07-01')],
      TODAY,
    );
    expect(summary.totalLent).toBe(0.3);
  });
});
