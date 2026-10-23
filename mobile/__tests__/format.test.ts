import { addDays, daysBetween, formatDate, formatMoney, toDateString } from '../src/utils/format';
import { describeDueDate } from '../src/screens/LoanDetailsScreen';

describe('formatMoney', () => {
  it('formats whole and decimal amounts in rupees', () => {
    expect(formatMoney(1500)).toBe('₹1,500');
    expect(formatMoney(1500.5)).toBe('₹1,500.50');
    expect(formatMoney(150000)).toBe('₹1,50,000'); // Indian digit grouping
  });
});

describe('date helpers', () => {
  it('formats dates for display', () => {
    expect(formatDate('2025-06-05')).toBe('5 Jun 2025');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2025-01-25', 7)).toBe('2025-02-01');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2025-06-10', '2025-06-15')).toBe(5);
    expect(daysBetween('2025-06-15', '2025-06-10')).toBe(-5);
  });

  it('uses the local calendar day', () => {
    expect(toDateString(new Date(2025, 0, 9))).toBe('2025-01-09');
  });
});

describe('describeDueDate', () => {
  const today = '2025-06-15';

  it.each([
    [{ status: 'pending', dueDate: '2025-06-12', isOverdue: true }, 'Overdue by 3 days'],
    [{ status: 'pending', dueDate: '2025-06-14', isOverdue: true }, 'Overdue by 1 day'],
    [{ status: 'pending', dueDate: '2025-06-15', isOverdue: false }, 'Due today'],
    [{ status: 'pending', dueDate: '2025-06-20', isOverdue: false }, 'Due in 5 days'],
    [{ status: 'repaid', dueDate: '2025-06-01', isOverdue: false }, 'Repaid'],
  ] as const)('%o -> %s', (loan, expected) => {
    expect(describeDueDate(loan, today)).toBe(expected);
  });
});
