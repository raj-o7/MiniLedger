// These types mirror the JSON returned by the backend (see API_DOCUMENTATION.md).

export interface User {
  id: number;
  phone: string;
  createdAt: string;
}

export type LoanStatus = 'pending' | 'repaid';
export type LoanFilter = 'all' | 'pending' | 'overdue' | 'repaid';

export interface Loan {
  id: number;
  friendName: string;
  amount: number;
  loanDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  status: LoanStatus;
  repaidDate: string | null;
  hasReceipt: boolean;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoanDetails extends Loan {
  receiptImage: string | null; // data:image/jpeg;base64,...
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

export interface NewLoan {
  friendName: string;
  amount: number;
  loanDate: string;
  dueDate: string;
  receiptImage?: string;
}
