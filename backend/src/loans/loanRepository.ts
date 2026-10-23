import type { Pool } from 'pg';
import type { LoanStatus } from './loanRules';

/**
 * All SQL for the loans table lives here. Every query:
 *   - uses $1, $2 ... placeholders (parameterized queries) so user input can never change the SQL
 *   - filters by user_id so people can only ever see or change their own loans
 */

export interface LoanRecord {
  id: number;
  friendName: string;
  amountCents: number;
  loanDate: string;
  dueDate: string;
  status: LoanStatus;
  repaidDate: string | null;
  hasReceipt: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoanRecordWithReceipt extends LoanRecord {
  receiptImage: string | null;
}

interface LoanRow {
  id: number;
  friend_name: string;
  amount_cents: number;
  loan_date: string;
  due_date: string;
  status: LoanStatus;
  repaid_date: string | null;
  has_receipt: boolean;
  created_at: Date;
  updated_at: Date;
}

interface LoanRowWithReceipt extends LoanRow {
  receipt_image: string | null;
}

// The receipt image can be large, so list queries only report whether one exists.
const LOAN_COLUMNS = `
  id, friend_name, amount_cents, loan_date, due_date, status, repaid_date,
  (receipt_image IS NOT NULL) AS has_receipt, created_at, updated_at`;

function toLoanRecord(row: LoanRow): LoanRecord {
  return {
    id: row.id,
    friendName: row.friend_name,
    amountCents: row.amount_cents,
    loanDate: row.loan_date,
    dueDate: row.due_date,
    status: row.status,
    repaidDate: row.repaid_date,
    hasReceipt: row.has_receipt,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toLoanRecordWithReceipt(row: LoanRowWithReceipt): LoanRecordWithReceipt {
  return { ...toLoanRecord(row), receiptImage: row.receipt_image };
}

export interface NewLoan {
  friendName: string;
  amountCents: number;
  loanDate: string;
  dueDate: string;
  receiptImage: string | null;
}

export async function insertLoan(
  db: Pool,
  userId: number,
  loan: NewLoan,
): Promise<LoanRecordWithReceipt> {
  const result = await db.query<LoanRowWithReceipt>(
    `INSERT INTO loans (user_id, friend_name, amount_cents, loan_date, due_date, receipt_image)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${LOAN_COLUMNS}, receipt_image`,
    [userId, loan.friendName, loan.amountCents, loan.loanDate, loan.dueDate, loan.receiptImage],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('Insert did not return the new loan');
  }
  return toLoanRecordWithReceipt(row);
}

/** Pending loans first (earliest due date first), then repaid loans (most recent first). */
export async function findLoansByUser(db: Pool, userId: number): Promise<LoanRecord[]> {
  const result = await db.query<LoanRow>(
    `SELECT ${LOAN_COLUMNS}
     FROM loans
     WHERE user_id = $1
     ORDER BY (status = 'repaid'),
              CASE WHEN status = 'pending' THEN due_date END ASC,
              repaid_date DESC,
              id DESC`,
    [userId],
  );
  return result.rows.map(toLoanRecord);
}

export async function findLoanById(
  db: Pool,
  userId: number,
  loanId: number,
): Promise<LoanRecordWithReceipt | null> {
  const result = await db.query<LoanRowWithReceipt>(
    `SELECT ${LOAN_COLUMNS}, receipt_image
     FROM loans
     WHERE id = $1 AND user_id = $2`,
    [loanId, userId],
  );
  const row = result.rows[0];
  return row ? toLoanRecordWithReceipt(row) : null;
}

/**
 * Marks a pending loan as repaid. Returns null when no pending loan with this id belongs
 * to the user (it does not exist, belongs to someone else, or is already repaid).
 */
export async function markLoanRepaid(
  db: Pool,
  userId: number,
  loanId: number,
  repaidDate: string,
): Promise<LoanRecordWithReceipt | null> {
  const result = await db.query<LoanRowWithReceipt>(
    `UPDATE loans
     SET status = 'repaid', repaid_date = $3, updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'pending'
     RETURNING ${LOAN_COLUMNS}, receipt_image`,
    [loanId, userId, repaidDate],
  );
  const row = result.rows[0];
  return row ? toLoanRecordWithReceipt(row) : null;
}
