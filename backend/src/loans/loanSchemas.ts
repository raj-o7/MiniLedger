import { z } from 'zod';
import { isValidDateString } from '../utils/dates';
import { hasAtMostTwoDecimals } from '../utils/money';

export const MAX_LOAN_AMOUNT = 10_000_000;

// Base64 makes data about 4/3 bigger, so ~2.8 million characters is roughly a 2 MB image.
export const MAX_RECEIPT_DATA_URI_LENGTH = 2_800_000;
const RECEIPT_DATA_URI_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

const dateSchema = z
  .string({ error: 'Date is required' })
  .refine(isValidDateString, 'Date must be a real date in YYYY-MM-DD format');

export const createLoanSchema = z
  .object({
    friendName: z
      .string({ error: 'Friend name is required' })
      .trim()
      .min(1, 'Friend name is required')
      .max(100, 'Friend name must be at most 100 characters'),
    amount: z
      .number({ error: 'Amount must be a number' })
      .positive('Amount must be greater than 0')
      .max(MAX_LOAN_AMOUNT, `Amount cannot be more than ${MAX_LOAN_AMOUNT}`)
      .refine(hasAtMostTwoDecimals, 'Amount can have at most 2 decimal places'),
    loanDate: dateSchema,
    dueDate: dateSchema,
    receiptImage: z
      .string()
      .max(MAX_RECEIPT_DATA_URI_LENGTH, 'Receipt image must be smaller than 2 MB')
      .regex(RECEIPT_DATA_URI_PATTERN, 'Receipt must be a JPEG, PNG or WebP image data URI')
      .nullish(),
  })
  .refine((loan) => loan.dueDate >= loan.loanDate, {
    message: 'Due date cannot be before the loan date',
    path: ['dueDate'],
  });

export type CreateLoanInput = z.infer<typeof createLoanSchema>;

export const repayLoanSchema = z.object({
  repaidDate: dateSchema.optional(),
});

export const loanFilterSchema = z.enum(['all', 'pending', 'overdue', 'repaid']);
export type LoanFilter = z.infer<typeof loanFilterSchema>;

export const listLoansQuerySchema = z.object({
  status: loanFilterSchema.default('all'),
});

const MAX_INTEGER_ID = 2_147_483_647; // largest value a PostgreSQL SERIAL column can hold

export const loanIdSchema = z
  .string()
  .regex(/^\d+$/, 'Loan id must be a positive whole number')
  .transform(Number)
  .refine((id) => id >= 1 && id <= MAX_INTEGER_ID, 'Loan id is out of range');
