import {
  isValidDate,
  normalizePhone,
  parseAmount,
  validateLoanForm,
  validateOtp,
  validatePhone,
} from '../src/utils/validation';

describe('phone validation', () => {
  it('normalises spaces and dashes', () => {
    expect(normalizePhone('+91 98765-43210')).toBe('+919876543210');
  });

  it('accepts international numbers and rejects others', () => {
    expect(validatePhone('+91 98765 43210')).toBeNull();
    expect(validatePhone('')).toBe('Please enter your phone number.');
    expect(validatePhone('9876543210')).toMatch(/country code/);
    expect(validatePhone('+91abc')).toMatch(/country code/);
  });
});

describe('OTP validation', () => {
  it('requires exactly six digits', () => {
    expect(validateOtp('123456')).toBeNull();
    expect(validateOtp('12345')).not.toBeNull();
    expect(validateOtp('abcdef')).not.toBeNull();
  });
});

describe('amount parsing', () => {
  it.each([
    ['1500', 1500],
    ['1,500.50', 1500.5],
    [' 99.9 ', 99.9],
  ])('parses "%s"', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(['', 'abc', '-5', '1.234', '1e5'])('rejects "%s"', (input) => {
    expect(parseAmount(input)).toBeNull();
  });
});

describe('date validation', () => {
  it('accepts real dates only', () => {
    expect(isValidDate('2024-02-29')).toBe(true);
    expect(isValidDate('2025-02-29')).toBe(false);
    expect(isValidDate('25-01-01')).toBe(false);
  });
});

describe('validateLoanForm', () => {
  const today = '2025-06-15';
  const valid = { friendName: 'Asha', amount: '500', loanDate: '2025-06-10', dueDate: '2025-07-10' };

  it('returns no errors for a valid form', () => {
    expect(validateLoanForm(valid, today)).toEqual({});
  });

  it('reports every problem at once', () => {
    expect(
      validateLoanForm({ friendName: ' ', amount: '0', loanDate: '2025-06-20', dueDate: 'soon' }, today),
    ).toEqual({
      friendName: "Enter your friend's name.",
      amount: 'Amount must be greater than 0.',
      loanDate: 'Loan date cannot be in the future.',
      dueDate: 'Use the format YYYY-MM-DD.',
    });
  });

  it('rejects a due date before the loan date', () => {
    expect(validateLoanForm({ ...valid, dueDate: '2025-06-01' }, today).dueDate).toBe(
      'Due date cannot be before the loan date.',
    );
  });

  it('rejects amounts above the maximum', () => {
    expect(validateLoanForm({ ...valid, amount: '10000001' }, today).amount).toMatch(/cannot be more/);
  });
});
