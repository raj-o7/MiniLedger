import { createLoanSchema, loanIdSchema } from '../../src/loans/loanSchemas';

const validLoan = {
  friendName: 'Asha',
  amount: 1500.5,
  loanDate: '2025-06-01',
  dueDate: '2025-06-30',
};

function firstError(input: unknown): string | undefined {
  const result = createLoanSchema.safeParse(input);
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('createLoanSchema', () => {
  it('accepts a valid loan and trims the friend name', () => {
    const parsed = createLoanSchema.parse({ ...validLoan, friendName: '  Asha  ' });
    expect(parsed.friendName).toBe('Asha');
  });

  it('accepts a valid receipt image data URI', () => {
    const receiptImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    expect(createLoanSchema.safeParse({ ...validLoan, receiptImage }).success).toBe(true);
  });

  it.each([
    [{ ...validLoan, friendName: '   ' }, 'Friend name is required'],
    [{ ...validLoan, amount: 0 }, 'Amount must be greater than 0'],
    [{ ...validLoan, amount: -5 }, 'Amount must be greater than 0'],
    [{ ...validLoan, amount: '100' }, 'Amount must be a number'],
    [{ ...validLoan, amount: 10.123 }, 'Amount can have at most 2 decimal places'],
    [{ ...validLoan, amount: 10_000_001 }, 'Amount cannot be more than 10000000'],
    [{ ...validLoan, loanDate: '2025-02-30' }, 'Date must be a real date in YYYY-MM-DD format'],
    [{ ...validLoan, dueDate: '2025-05-01' }, 'Due date cannot be before the loan date'],
    [{ ...validLoan, receiptImage: 'data:text/plain;base64,aGVsbG8=' }, 'Receipt must be a JPEG, PNG or WebP image data URI'],
  ])('rejects invalid input %#', (input, message) => {
    expect(firstError(input)).toBe(message);
  });
});

describe('loanIdSchema', () => {
  it('parses positive whole numbers', () => {
    expect(loanIdSchema.parse('17')).toBe(17);
  });

  it.each(['abc', '-1', '0', '1.5', '99999999999'])('rejects "%s"', (value) => {
    expect(loanIdSchema.safeParse(value).success).toBe(false);
  });
});
