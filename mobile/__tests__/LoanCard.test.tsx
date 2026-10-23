import { fireEvent, render, screen } from '@testing-library/react-native';
import type { Loan } from '../src/api/types';
import { LoanCard } from '../src/components/LoanCard';

const baseLoan: Loan = {
  id: 7,
  friendName: 'Asha',
  amount: 1500.5,
  loanDate: '2025-06-01',
  dueDate: '2025-06-10',
  status: 'pending',
  repaidDate: null,
  hasReceipt: false,
  isOverdue: false,
  createdAt: '2025-06-01T10:00:00.000Z',
  updatedAt: '2025-06-01T10:00:00.000Z',
};

describe('LoanCard', () => {
  it('shows the friend, amount, due date and a Pending badge', async () => {
    await render(<LoanCard loan={baseLoan} onPress={jest.fn()} />);
    expect(screen.getByText('Asha')).toBeTruthy();
    expect(screen.getByText('₹1,500.50')).toBeTruthy();
    expect(screen.getByText('Due 10 Jun 2025')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
  });

  it('highlights overdue loans', async () => {
    await render(<LoanCard loan={{ ...baseLoan, isOverdue: true }} onPress={jest.fn()} />);
    expect(screen.getByText('Overdue')).toBeTruthy();
    expect(screen.getByText('₹1,500.50')).toHaveStyle({ color: '#DC2626' });
  });

  it('shows the repayment date for repaid loans', async () => {
    await render(
      <LoanCard loan={{ ...baseLoan, status: 'repaid', repaidDate: '2025-06-08' }} onPress={jest.fn()} />,
    );
    expect(screen.getByText('Repaid')).toBeTruthy();
    expect(screen.getByText('Repaid on 8 Jun 2025')).toBeTruthy();
  });

  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    await render(<LoanCard loan={baseLoan} onPress={onPress} />);
    await fireEvent.press(screen.getByTestId('loan-card-7'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
