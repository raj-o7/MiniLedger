import request from 'supertest';
import type { Pool } from 'pg';
import type { Express } from 'express';
import { createApp } from '../../src/app';
import { OTP_MAX_ATTEMPTS } from '../../src/auth/authService';
import type { AppConfig } from '../../src/config';
import { createPool } from '../../src/db/pool';
import { runMigrations } from '../../src/db/migrate';
import { todayInTimeZone } from '../../src/utils/dates';

/**
 * These tests talk to a real PostgreSQL database.
 * Set TEST_DATABASE_URL (in your shell or .env) to an EMPTY database you don't care about:
 * every test deletes all rows in it.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeWithDatabase = TEST_DATABASE_URL ? describe : describe.skip;

if (!TEST_DATABASE_URL) {
  console.warn('Skipping API integration tests: TEST_DATABASE_URL is not set.');
}

const config: AppConfig = {
  port: 0,
  databaseUrl: TEST_DATABASE_URL ?? '',
  jwtSecret: 'integration-test-secret-at-least-32-chars',
  jwtExpiresInSeconds: 3600,
  timeZone: 'UTC',
};

/** YYYY-MM-DD for today plus (or minus) some number of days, in UTC. */
function daysFromToday(days: number): string {
  const date = new Date(`${todayInTimeZone('UTC')}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describeWithDatabase('MiniLedger API', () => {
  let db: Pool;
  let app: Express;
  const sentCodes = new Map<string, string>();

  async function login(phone: string): Promise<string> {
    await request(app).post('/api/auth/request-otp').send({ phone }).expect(200);
    const code = sentCodes.get(phone);
    const response = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone, code })
      .expect(200);
    return response.body.token;
  }

  function createLoan(token: string, body: Record<string, unknown>) {
    return request(app).post('/api/loans').set('Authorization', `Bearer ${token}`).send(body);
  }

  beforeAll(async () => {
    db = createPool(config.databaseUrl);
    await runMigrations(db);
    app = createApp({
      db,
      config,
      sendOtp: (phone, code) => {
        sentCodes.set(phone, code);
      },
    });
  });

  beforeEach(async () => {
    sentCodes.clear();
    await db.query('TRUNCATE loans, otp_codes, users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await db.end();
  });

  describe('general', () => {
    it('reports health', async () => {
      await request(app).get('/api/health').expect(200, { status: 'ok' });
    });

    it('returns JSON 404 for unknown routes', async () => {
      const response = await request(app).get('/api/nope').expect(404);
      expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
    });

    it('rejects malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/request-otp')
        .set('Content-Type', 'application/json')
        .send('{"phone": ')
        .expect(400);
      expect(response.body.error.code).toBe('INVALID_JSON');
    });
  });

  describe('authentication', () => {
    it('rejects invalid phone numbers', async () => {
      const response = await request(app)
        .post('/api/auth/request-otp')
        .send({ phone: '12345' })
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details[0].field).toBe('phone');
    });

    it('sends a six-digit code to the normalised phone number', async () => {
      const response = await request(app)
        .post('/api/auth/request-otp')
        .send({ phone: '+91 98765 43210' })
        .expect(200);
      expect(response.body).toEqual({
        message: 'Verification code sent.',
        phone: '+919876543210',
        expiresInSeconds: 300,
      });
      expect(sentCodes.get('+919876543210')).toMatch(/^\d{6}$/);
    });

    it('stores only a hash of the code', async () => {
      await request(app).post('/api/auth/request-otp').send({ phone: '+919876543210' });
      const stored = await db.query<{ code_hash: string }>('SELECT code_hash FROM otp_codes');
      expect(stored.rows[0]?.code_hash).not.toBe(sentCodes.get('+919876543210'));
      expect(stored.rows[0]?.code_hash).toHaveLength(64);
    });

    it('enforces a cooldown between code requests', async () => {
      await request(app).post('/api/auth/request-otp').send({ phone: '+919876543210' }).expect(200);
      const response = await request(app)
        .post('/api/auth/request-otp')
        .send({ phone: '+919876543210' })
        .expect(429);
      expect(response.body.error.code).toBe('OTP_COOLDOWN');
    });

    it('logs in with the correct code and returns a token and user', async () => {
      const phone = '+919876543210';
      await request(app).post('/api/auth/request-otp').send({ phone });
      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone, code: sentCodes.get(phone) })
        .expect(200);

      expect(typeof response.body.token).toBe('string');
      expect(response.body.user).toMatchObject({ id: 1, phone });

      const me = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${response.body.token}`)
        .expect(200);
      expect(me.body.user.phone).toBe(phone);
    });

    it('rejects a wrong code, and a code cannot be used twice', async () => {
      const phone = '+919876543210';
      await request(app).post('/api/auth/request-otp').send({ phone });
      const code = sentCodes.get(phone) ?? '';
      const wrongCode = code === '000000' ? '111111' : '000000';

      const wrong = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone, code: wrongCode })
        .expect(401);
      expect(wrong.body.error.code).toBe('OTP_INCORRECT');

      await request(app).post('/api/auth/verify-otp').send({ phone, code }).expect(200);
      const reused = await request(app).post('/api/auth/verify-otp').send({ phone, code }).expect(401);
      expect(reused.body.error.code).toBe('OTP_EXPIRED');
    });

    it(`locks the code after ${OTP_MAX_ATTEMPTS} wrong attempts`, async () => {
      const phone = '+919876543210';
      await request(app).post('/api/auth/request-otp').send({ phone });
      const code = sentCodes.get(phone) ?? '';
      const wrongCode = code === '000000' ? '111111' : '000000';

      for (let i = 0; i < OTP_MAX_ATTEMPTS; i += 1) {
        await request(app).post('/api/auth/verify-otp').send({ phone, code: wrongCode }).expect(401);
      }
      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone, code })
        .expect(401);
      expect(response.body.error.code).toBe('OTP_EXPIRED');
    });

    it('rejects an expired code', async () => {
      const phone = '+919876543210';
      await request(app).post('/api/auth/request-otp').send({ phone });
      await db.query("UPDATE otp_codes SET expires_at = NOW() - INTERVAL '1 second'");
      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone, code: sentCodes.get(phone) })
        .expect(401);
      expect(response.body.error.code).toBe('OTP_EXPIRED');
    });

    it('logs the same phone number into the same account every time', async () => {
      const phone = '+919876543210';
      const first = await login(phone);
      await db.query('DELETE FROM otp_codes'); // skip the resend cooldown
      const second = await login(phone);

      const meFirst = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${first}`);
      const meSecond = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${second}`);
      expect(meFirst.body.user.id).toBe(meSecond.body.user.id);
    });

    it('rejects missing or invalid tokens', async () => {
      await request(app).get('/api/auth/me').expect(401);
      await request(app).get('/api/loans').expect(401);
      const response = await request(app)
        .get('/api/loans')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('loans', () => {
    let token: string;

    beforeEach(async () => {
      token = await login('+919876543210');
    });

    it('creates a loan', async () => {
      const response = await createLoan(token, {
        friendName: ' Asha ',
        amount: 1500.5,
        loanDate: daysFromToday(-5),
        dueDate: daysFromToday(10),
      }).expect(201);

      expect(response.body.loan).toEqual({
        id: 1,
        friendName: 'Asha',
        amount: 1500.5,
        loanDate: daysFromToday(-5),
        dueDate: daysFromToday(10),
        status: 'pending',
        repaidDate: null,
        hasReceipt: false,
        receiptImage: null,
        isOverdue: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      const stored = await db.query('SELECT amount_cents FROM loans WHERE id = 1');
      expect(stored.rows[0]).toEqual({ amount_cents: 150050 });
    });

    it.each([
      [{ friendName: '', amount: 100 }, 'friendName'],
      [{ friendName: 'Ravi', amount: -1 }, 'amount'],
      [{ friendName: 'Ravi', amount: 1.234 }, 'amount'],
      [{ friendName: 'Ravi', amount: 100, dueDate: '2020-01-01' }, 'dueDate'],
      [{ friendName: 'Ravi', amount: 100, receiptImage: 'not-an-image' }, 'receiptImage'],
    ])('rejects invalid loan %#', async (overrides, field) => {
      const response = await createLoan(token, {
        loanDate: daysFromToday(-1),
        dueDate: daysFromToday(5),
        ...overrides,
      }).expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details[0].field).toBe(field);
    });

    it('rejects a loan date in the future', async () => {
      const response = await createLoan(token, {
        friendName: 'Ravi',
        amount: 100,
        loanDate: daysFromToday(1),
        dueDate: daysFromToday(5),
      }).expect(400);
      expect(response.body.error.message).toBe('Loan date cannot be in the future.');
    });

    it('stores a receipt image, hides it from the list and returns it in the details', async () => {
      const created = await createLoan(token, {
        friendName: 'Meera',
        amount: 200,
        loanDate: daysFromToday(0),
        dueDate: daysFromToday(7),
        receiptImage: TINY_PNG,
      }).expect(201);
      expect(created.body.loan.hasReceipt).toBe(true);

      const list = await request(app).get('/api/loans').set('Authorization', `Bearer ${token}`);
      expect(list.body.loans[0].hasReceipt).toBe(true);
      expect(list.body.loans[0]).not.toHaveProperty('receiptImage');

      const details = await request(app)
        .get(`/api/loans/${created.body.loan.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(details.body.loan.receiptImage).toBe(TINY_PNG);
    });

    it('lists loans with overdue flags and supports status filters', async () => {
      await createLoan(token, {
        friendName: 'Not due yet',
        amount: 100,
        loanDate: daysFromToday(-1),
        dueDate: daysFromToday(10),
      });
      await createLoan(token, {
        friendName: 'Overdue',
        amount: 200,
        loanDate: daysFromToday(-30),
        dueDate: daysFromToday(-2),
      });
      const repaidLater = await createLoan(token, {
        friendName: 'Repaid late',
        amount: 300,
        loanDate: daysFromToday(-30),
        dueDate: daysFromToday(-20),
      });
      await request(app)
        .patch(`/api/loans/${repaidLater.body.loan.id}/repay`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const all = await request(app).get('/api/loans').set('Authorization', `Bearer ${token}`);
      // Pending loans come first, earliest due date first; repaid loans last.
      expect(all.body.loans.map((l: { friendName: string }) => l.friendName)).toEqual([
        'Overdue',
        'Not due yet',
        'Repaid late',
      ]);
      expect(all.body.loans.map((l: { isOverdue: boolean }) => l.isOverdue)).toEqual([
        true,
        false,
        false,
      ]);

      const names = async (status: string) => {
        const response = await request(app)
          .get(`/api/loans?status=${status}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        return response.body.loans.map((l: { friendName: string }) => l.friendName);
      };
      expect(await names('pending')).toEqual(['Overdue', 'Not due yet']);
      expect(await names('overdue')).toEqual(['Overdue']);
      expect(await names('repaid')).toEqual(['Repaid late']);

      await request(app)
        .get('/api/loans?status=bogus')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('returns an empty list for a new user', async () => {
      const response = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(response.body).toEqual({ loans: [] });
    });

    it('returns 400 for a malformed id and 404 for a missing loan', async () => {
      await request(app).get('/api/loans/abc').set('Authorization', `Bearer ${token}`).expect(400);
      await request(app).get('/api/loans/999').set('Authorization', `Bearer ${token}`).expect(404);
    });

    describe('repayment', () => {
      let loanId: number;

      beforeEach(async () => {
        const created = await createLoan(token, {
          friendName: 'Kiran',
          amount: 750,
          loanDate: daysFromToday(-10),
          dueDate: daysFromToday(-1),
        });
        loanId = created.body.loan.id;
      });

      it('marks a loan as repaid today by default', async () => {
        const response = await request(app)
          .patch(`/api/loans/${loanId}/repay`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        expect(response.body.loan).toMatchObject({
          status: 'repaid',
          repaidDate: daysFromToday(0),
          isOverdue: false,
        });
      });

      it('accepts a specific repayment date', async () => {
        const response = await request(app)
          .patch(`/api/loans/${loanId}/repay`)
          .set('Authorization', `Bearer ${token}`)
          .send({ repaidDate: daysFromToday(-3) })
          .expect(200);
        expect(response.body.loan.repaidDate).toBe(daysFromToday(-3));
      });

      it('refuses to repay the same loan twice', async () => {
        await request(app)
          .patch(`/api/loans/${loanId}/repay`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        const response = await request(app)
          .patch(`/api/loans/${loanId}/repay`)
          .set('Authorization', `Bearer ${token}`)
          .expect(409);
        expect(response.body.error.code).toBe('LOAN_ALREADY_REPAID');
      });

      it('rejects repayment dates in the future or before the loan date', async () => {
        await request(app)
          .patch(`/api/loans/${loanId}/repay`)
          .set('Authorization', `Bearer ${token}`)
          .send({ repaidDate: daysFromToday(1) })
          .expect(400);
        await request(app)
          .patch(`/api/loans/${loanId}/repay`)
          .set('Authorization', `Bearer ${token}`)
          .send({ repaidDate: daysFromToday(-11) })
          .expect(400);
        await request(app)
          .patch(`/api/loans/${loanId}/repay`)
          .set('Authorization', `Bearer ${token}`)
          .send({ repaidDate: 'yesterday' })
          .expect(400);
      });
    });

    it('calculates the summary correctly', async () => {
      const empty = await request(app)
        .get('/api/loans/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(empty.body.summary.totalLoans).toBe(0);

      await createLoan(token, {
        friendName: 'Pending',
        amount: 1000.25,
        loanDate: daysFromToday(-1),
        dueDate: daysFromToday(30),
      });
      await createLoan(token, {
        friendName: 'Overdue',
        amount: 500.5,
        loanDate: daysFromToday(-30),
        dueDate: daysFromToday(-1),
      });
      await createLoan(token, {
        friendName: 'Due today',
        amount: 10,
        loanDate: daysFromToday(-3),
        dueDate: daysFromToday(0),
      });
      const overdueThenRepaid = await createLoan(token, {
        friendName: 'Repaid',
        amount: 250,
        loanDate: daysFromToday(-30),
        dueDate: daysFromToday(-10),
      });
      await request(app)
        .patch(`/api/loans/${overdueThenRepaid.body.loan.id}/repay`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const response = await request(app)
        .get('/api/loans/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(response.body.summary).toEqual({
        totalLent: 1760.75,
        totalRepaid: 250,
        outstanding: 1510.75,
        overdue: 500.5,
        totalLoans: 4,
        pendingLoans: 3,
        repaidLoans: 1,
        overdueLoans: 1,
      });
    });

    it("never shows or changes another user's loans", async () => {
      const created = await createLoan(token, {
        friendName: 'Private',
        amount: 999,
        loanDate: daysFromToday(-10),
        dueDate: daysFromToday(-5),
      });
      const loanId = created.body.loan.id;

      const otherToken = await login('+14155550123');
      const auth = { Authorization: `Bearer ${otherToken}` };

      const list = await request(app).get('/api/loans').set(auth).expect(200);
      expect(list.body.loans).toEqual([]);

      await request(app).get(`/api/loans/${loanId}`).set(auth).expect(404);
      await request(app).patch(`/api/loans/${loanId}/repay`).set(auth).expect(404);

      const summary = await request(app).get('/api/loans/summary').set(auth).expect(200);
      expect(summary.body.summary.totalLent).toBe(0);

      // The owner's loan is untouched.
      const ownerView = await request(app)
        .get(`/api/loans/${loanId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(ownerView.body.loan.status).toBe('pending');
    });

    it('enforces constraints in the database itself', async () => {
      const userId = 1;
      await expect(
        db.query(
          `INSERT INTO loans (user_id, friend_name, amount_cents, loan_date, due_date)
           VALUES ($1, 'Bad', -100, '2025-01-01', '2025-01-10')`,
          [userId],
        ),
      ).rejects.toThrow('loans_amount_positive');
      await expect(
        db.query(
          `INSERT INTO loans (user_id, friend_name, amount_cents, loan_date, due_date, status)
           VALUES ($1, 'Bad', 100, '2025-01-01', '2025-01-10', 'repaid')`,
          [userId],
        ),
      ).rejects.toThrow('loans_repaid_date_matches_status');
      await expect(
        db.query(
          `INSERT INTO loans (user_id, friend_name, amount_cents, loan_date, due_date)
           VALUES (12345, 'Nobody', 100, '2025-01-01', '2025-01-10')`,
        ),
      ).rejects.toThrow('foreign key');
    });
  });
});
