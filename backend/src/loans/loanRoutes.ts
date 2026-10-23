import { Router } from 'express';
import type { Pool } from 'pg';
import type { AppConfig } from '../config';
import { getUserId } from '../middleware/requireAuth';
import { todayInTimeZone } from '../utils/dates';
import { AppError } from '../utils/errors';
import { fromCents, toCents } from '../utils/money';
import {
  findLoanById,
  findLoansByUser,
  insertLoan,
  markLoanRepaid,
  type LoanRecord,
  type LoanRecordWithReceipt,
} from './loanRepository';
import { calculateSummary, isOverdue, matchesFilter } from './loanRules';
import {
  createLoanSchema,
  listLoansQuerySchema,
  loanIdSchema,
  repayLoanSchema,
} from './loanSchemas';

/** The JSON shape sent to the app: amounts in normal units and a ready-made overdue flag. */
function toLoanResponse(loan: LoanRecord, today: string) {
  const { amountCents, ...rest } = loan;
  return { ...rest, amount: fromCents(amountCents), isOverdue: isOverdue(loan, today) };
}

function toLoanDetailsResponse(loan: LoanRecordWithReceipt, today: string) {
  return { ...toLoanResponse(loan, today), receiptImage: loan.receiptImage };
}

function loanNotFound(): AppError {
  return new AppError(404, 'LOAN_NOT_FOUND', 'Loan not found.');
}

export function createLoanRouter(db: Pool, config: AppConfig): Router {
  const router = Router();
  const today = () => todayInTimeZone(config.timeZone);

  // Registered before "/:id" so that "summary" is not treated as a loan id.
  router.get('/summary', async (req, res) => {
    const loans = await findLoansByUser(db, getUserId(req));
    res.json({ summary: calculateSummary(loans, today()) });
  });

  router.get('/', async (req, res) => {
    const { status } = listLoansQuerySchema.parse(req.query);
    const todayDate = today();
    const loans = await findLoansByUser(db, getUserId(req));
    const visible = loans.filter((loan) => matchesFilter(loan, status, todayDate));
    res.json({ loans: visible.map((loan) => toLoanResponse(loan, todayDate)) });
  });

  router.post('/', async (req, res) => {
    const input = createLoanSchema.parse(req.body);
    const todayDate = today();
    if (input.loanDate > todayDate) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Loan date cannot be in the future.');
    }

    const loan = await insertLoan(db, getUserId(req), {
      friendName: input.friendName,
      amountCents: toCents(input.amount),
      loanDate: input.loanDate,
      dueDate: input.dueDate,
      receiptImage: input.receiptImage ?? null,
    });
    res.status(201).json({ loan: toLoanDetailsResponse(loan, todayDate) });
  });

  router.get('/:id', async (req, res) => {
    const loanId = loanIdSchema.parse(req.params.id);
    const loan = await findLoanById(db, getUserId(req), loanId);
    if (!loan) {
      throw loanNotFound();
    }
    res.json({ loan: toLoanDetailsResponse(loan, today()) });
  });

  router.patch('/:id/repay', async (req, res) => {
    const userId = getUserId(req);
    const loanId = loanIdSchema.parse(req.params.id);
    // A request with no JSON body leaves req.body undefined; treat that as "no fields sent".
    const { repaidDate: requestedDate } = repayLoanSchema.parse(req.body ?? {});
    const todayDate = today();
    const repaidDate = requestedDate ?? todayDate;

    const existing = await findLoanById(db, userId, loanId);
    if (!existing) {
      throw loanNotFound();
    }
    if (existing.status === 'repaid') {
      throw new AppError(409, 'LOAN_ALREADY_REPAID', 'This loan is already marked as repaid.');
    }
    if (repaidDate > todayDate) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Repayment date cannot be in the future.');
    }
    if (repaidDate < existing.loanDate) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Repayment date cannot be before the loan date.');
    }

    const updated = await markLoanRepaid(db, userId, loanId, repaidDate);
    if (!updated) {
      // Another request repaid it between our read and our update.
      throw new AppError(409, 'LOAN_ALREADY_REPAID', 'This loan is already marked as repaid.');
    }
    res.json({ loan: toLoanDetailsResponse(updated, todayDate) });
  });

  return router;
}
