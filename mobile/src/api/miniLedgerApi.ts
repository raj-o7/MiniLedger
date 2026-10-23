import { apiRequest } from './client';
import type { Loan, LoanDetails, LoanFilter, LoanSummary, NewLoan, User } from './types';

export function requestOtp(phone: string) {
  return apiRequest<{ message: string; phone: string; expiresInSeconds: number }>(
    '/api/auth/request-otp',
    { method: 'POST', body: { phone } },
  );
}

export function verifyOtp(phone: string, code: string) {
  return apiRequest<{ token: string; user: User }>('/api/auth/verify-otp', {
    method: 'POST',
    body: { phone, code },
  });
}

export async function getSummary(): Promise<LoanSummary> {
  const data = await apiRequest<{ summary: LoanSummary }>('/api/loans/summary');
  return data.summary;
}

export async function getLoans(filter: LoanFilter = 'all'): Promise<Loan[]> {
  const data = await apiRequest<{ loans: Loan[] }>(`/api/loans?status=${filter}`);
  return data.loans;
}

export async function getLoan(id: number): Promise<LoanDetails> {
  const data = await apiRequest<{ loan: LoanDetails }>(`/api/loans/${id}`);
  return data.loan;
}

export async function createLoan(loan: NewLoan): Promise<LoanDetails> {
  const data = await apiRequest<{ loan: LoanDetails }>('/api/loans', {
    method: 'POST',
    body: loan,
  });
  return data.loan;
}

export async function repayLoan(id: number, repaidDate?: string): Promise<LoanDetails> {
  const data = await apiRequest<{ loan: LoanDetails }>(`/api/loans/${id}/repay`, {
    method: 'PATCH',
    body: repaidDate ? { repaidDate } : {},
  });
  return data.loan;
}
