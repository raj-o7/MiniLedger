# My Learning Guide to MiniLedger

This guide explains how MiniLedger works, in plain English, using the real code from this project.
Read it alongside the code: open each file as it is mentioned.

---

## 1. What the project does

MiniLedger answers three questions for someone who lends money to friends:

1. **Who owes me money, and how much?** (the loan list and the "Outstanding" total)
2. **Who is late paying me back?** (overdue loans, highlighted in red)
3. **How much have I lent and got back overall?** (the dashboard summary)

You log in with your phone number. Every loan you record belongs to you, and nobody else can see it.

---

## 2. The big picture: how the three parts talk

```
┌──────────────────┐   HTTP + JSON    ┌──────────────────┐     SQL      ┌──────────────┐
│   Mobile app     │ ───────────────► │   Backend API    │ ───────────► │  PostgreSQL  │
│ (React Native)   │ ◄─────────────── │ (Express server) │ ◄─────────── │  (database)  │
└──────────────────┘                  └──────────────────┘              └──────────────┘
   what you see                          the rules                        the memory
```

- The **mobile app** shows screens and collects input. It never talks to the database directly.
- The **backend** receives requests, checks who you are, validates input, applies the business
  rules (like "what counts as overdue") and reads/writes the database.
- **PostgreSQL** stores data permanently in tables.

A full round trip for "show me my loans":

1. You open the Loans screen. The app calls `getLoans('all')`.
2. That sends `GET http://localhost:4000/api/loans?status=all` with your token in a header.
3. Express checks the token (`requireAuth`), finds your user id, and runs
   `SELECT ... FROM loans WHERE user_id = $1`.
4. PostgreSQL returns rows. The backend converts them into JSON and adds `isOverdue` to each.
5. The app receives the JSON and draws a `LoanCard` for each loan.

---

## 3. Folder structure

```
MiniLedger/
├── backend/
│   ├── migrations/
│   │   └── 001_initial_schema.sql   ← creates the tables
│   ├── src/
│   │   ├── server.ts                ← starts the server (entry point)
│   │   ├── app.ts                   ← builds the Express app: middleware + routes
│   │   ├── config.ts                ← reads and checks environment variables
│   │   ├── db/
│   │   │   ├── pool.ts              ← database connection pool
│   │   │   └── migrate.ts           ← runs the SQL migration files
│   │   ├── auth/
│   │   │   ├── authRoutes.ts        ← /api/auth/... endpoints
│   │   │   ├── authService.ts       ← OTP + login logic (talks to the DB)
│   │   │   ├── authSchemas.ts       ← Zod rules for phone and code
│   │   │   ├── otp.ts               ← generate / hash / compare codes
│   │   │   └── token.ts             ← create / check JWT tokens
│   │   ├── loans/
│   │   │   ├── loanRoutes.ts        ← /api/loans/... endpoints
│   │   │   ├── loanRepository.ts    ← all SQL for the loans table
│   │   │   ├── loanRules.ts         ← pure business rules: overdue, summary, filters
│   │   │   └── loanSchemas.ts       ← Zod rules for loan input
│   │   ├── middleware/
│   │   │   ├── requireAuth.ts       ← blocks requests without a valid token
│   │   │   └── errorHandler.ts      ← turns errors into JSON responses
│   │   └── utils/                   ← small helpers: dates, money, AppError
│   └── tests/
│       ├── unit/                    ← tests for pure functions (no DB needed)
│       └── integration/             ← tests that call the real API + database
└── mobile/
    ├── App.tsx                      ← root component
    ├── src/
    │   ├── api/
    │   │   ├── client.ts            ← fetch wrapper: URL, token, errors
    │   │   ├── miniLedgerApi.ts     ← one function per endpoint
    │   │   └── types.ts             ← TypeScript shapes of the JSON
    │   ├── auth/AuthContext.tsx     ← who is logged in; saves the token
    │   ├── navigation/              ← which screens exist and when
    │   ├── screens/                 ← the six screens
    │   ├── components/              ← reusable UI pieces (Button, LoanCard...)
    │   ├── hooks/useFocusedData.ts  ← load data when a screen opens
    │   ├── utils/                   ← validation + formatting helpers
    │   └── theme.ts                 ← colours and spacing
    └── __tests__/                   ← mobile tests
```

**Why split the backend like this?** Each file has one job:

- *routes* decide **which URL does what** (the HTTP layer),
- *schemas* decide **what input is allowed**,
- *repository/service* files **talk to the database**,
- *rules* hold **pure business logic** that is easy to test.

When something breaks, you know where to look.

---

## 4. Important files and their purpose

| File | Purpose |
| --- | --- |
| `backend/src/server.ts` | Loads `.env`, checks the DB connection, starts listening on the port |
| `backend/src/app.ts` | Wires everything together. Tests use it without starting a real server |
| `backend/src/config.ts` | Validates env vars with Zod and stops with a clear message if something is wrong |
| `backend/migrations/001_initial_schema.sql` | Tables, relationships and constraints |
| `backend/src/loans/loanRules.ts` | `isOverdue` and `calculateSummary`: the heart of the app's logic |
| `backend/src/loans/loanRepository.ts` | Every SQL query for loans, all parameterized, all filtered by `user_id` |
| `backend/src/middleware/requireAuth.ts` | Reads `Authorization: Bearer ...` and sets `req.userId` |
| `backend/src/middleware/errorHandler.ts` | One place that converts any error into a JSON error response |
| `mobile/src/api/client.ts` | Every network request goes through `apiRequest` here |
| `mobile/src/auth/AuthContext.tsx` | Remembers the token in secure storage; logs you out on 401 |
| `mobile/src/navigation/RootNavigator.tsx` | Shows login screens or app screens depending on login state |
| `mobile/src/components/LoanCard.tsx` | One row in the loan list, red when overdue |

---

## 5. How the backend starts

`server.ts` is the entry point. Simplified:

```ts
loadEnvFileIfPresent();              // read backend/.env into process.env
const config = loadConfig();         // validate it (throws a readable error if not)
const db = createPool(config.databaseUrl);
await db.query('SELECT 1');          // fail early if PostgreSQL is not reachable
const app = createApp({ db, config });
app.listen(config.port, ...);
```

`createApp` in `app.ts` adds the pieces in order. **Order matters in Express**: a request
travels down this list until something sends a response.

```ts
app.use(express.json({ limit: '4mb' }));          // 1. turn the JSON body into req.body
app.get('/api/health', ...);                      // 2. public health check
app.use('/api/auth', createAuthRouter(...));      // 3. login routes (public)
app.use('/api/loans', requireAuth(config.jwtSecret), createLoanRouter(db, config)); // 4. protected
app.use(notFoundHandler);                         // 5. nothing matched → 404
app.use(errorHandler);                            // 6. something threw → JSON error
```

Notice that `requireAuth` sits in front of **every** loan route. You cannot forget to protect
a new loan endpoint, because the whole router is protected.

**Dependency injection.** `createApp` receives the database pool and config as arguments
instead of creating them itself. That's why the tests can pass in a *test* database and a fake
`sendOtp` function that captures codes instead of printing them.

---

## 6. How authentication works

### Step 1: request a code (`POST /api/auth/request-otp`)

In `authService.ts`, `requestOtp`:

1. Refuses if a code was requested for this phone in the last 30 seconds (stops spamming).
2. Retires older unused codes, so only the newest one works.
3. Generates a random 6-digit code with `crypto.randomInt` (`otp.ts`).
4. Stores a **hash** of the code, never the code itself:

```ts
export function hashOtp(code: string, secret: string): string {
  return createHmac('sha256', secret).update(code).digest('hex');
}
```

5. "Sends" it. In development `logOtpToConsole` prints it to the terminal.

> **Why hash?** If someone stole a copy of the database, they still couldn't read the codes.
> Using the server secret as the HMAC key means the database alone isn't enough to recover them.

### Step 2: verify the code (`POST /api/auth/verify-otp`)

`verifyOtp` is careful about attackers guessing codes. It first **counts the attempt** and only
then compares, all in one SQL statement:

```sql
UPDATE otp_codes SET attempts = attempts + 1
WHERE id = (SELECT id FROM otp_codes
            WHERE phone = $1 AND consumed_at IS NULL AND expires_at > NOW()
            ORDER BY created_at DESC LIMIT 1)
AND attempts < $2          -- $2 is 5: after 5 tries the code stops working
RETURNING id, code_hash
```

If no row comes back, the code is expired, used, or out of attempts → `401 OTP_EXPIRED`.
If the hash doesn't match → `401 OTP_INCORRECT`. Comparison uses `timingSafeEqual` so the
response time doesn't leak how close a guess was.

On success the code is marked as used, and the user is created **or** fetched:

```sql
INSERT INTO users (phone) VALUES ($1)
ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
RETURNING id, phone, created_at
```

`ON CONFLICT` means: "if this phone already exists, don't fail, just give me the existing row".

### Step 3: the token (JWT)

`token.ts` creates a **JSON Web Token**: a signed string that says "this is user 1".

```ts
jwt.sign({}, secret, { subject: String(userId), expiresIn: expiresInSeconds, algorithm: 'HS256' });
```

The server signs it with `JWT_SECRET`. Anyone can *read* a JWT, but nobody can *change* it
without the secret; the signature would no longer match. That's why `JWT_SECRET` must be long
and private.

### Step 4: protected routes

`requireAuth.ts` runs before every loan route:

```ts
const header = req.headers.authorization;           // "Bearer eyJhbGci..."
if (!header || !header.startsWith('Bearer ')) throw new AppError(401, 'UNAUTHORIZED', ...);
const userId = verifyToken(header.slice('Bearer '.length).trim(), jwtSecret);
if (userId === null) throw new AppError(401, 'UNAUTHORIZED', ...);
req.userId = userId;                                 // routes read this with getUserId(req)
next();                                              // continue to the actual route
```

`verifyToken` also insists on the `HS256` algorithm, which blocks a classic trick where an
attacker sends a token with algorithm `"none"` (there's a unit test for this).

### On the phone

- `OtpScreen` calls `verifyOtp`, then `signIn(token, user)` from `AuthContext`.
- `signIn` saves the token with `expo-secure-store` (Keychain on iOS / Keystore on Android) and
  tells the API client to send it with every request.
- `RootNavigator` sees the state change to `signedIn` and swaps the login screens for the app
  screens automatically. No manual navigation is needed.
- If any request later returns **401** (token expired), the client calls the handler registered
  by `AuthContext`, which logs you out.

---

## 7. How loan creation works

**On the phone** (`AddLoanScreen.tsx`):

1. You fill in the form. Amount is typed as text, e.g. `"1,500.50"`.
2. On **Save**, `validateLoanForm` (in `utils/validation.ts`) checks everything and shows errors
   under each field immediately, without a network request.
3. If valid, `parseAmount("1,500.50")` → `1500.5`, and `createLoan({...})` sends:

```json
{ "friendName": "Asha", "amount": 1500.5, "loanDate": "2026-10-20", "dueDate": "2026-11-20" }
```

4. Optional receipt: `expo-image-picker` returns the photo as base64 text; the app turns it into
   `data:image/jpeg;base64,...` and includes it as `receiptImage`.
5. On success the form is *replaced* by the new loan's details screen.

**On the server** (`loanRoutes.ts`, `POST /`):

```ts
const input = createLoanSchema.parse(req.body);      // 1. validate (throws → 400)
if (input.loanDate > todayDate) throw new AppError(400, ...);   // 2. rule needing "today"
const loan = await insertLoan(db, getUserId(req), {  // 3. save, owned by the current user
  friendName: input.friendName,
  amountCents: toCents(input.amount),                //    1500.5 → 150050
  ...
});
res.status(201).json({ loan: toLoanDetailsResponse(loan, todayDate) });  // 4. reply
```

**Why validate twice (phone *and* server)?** The phone's checks give instant feedback, but anyone
can send requests to your API without your app (with curl, for example). The server must
never trust the client. The database constraints are a third safety net.

**Zod** (`loanSchemas.ts`) describes the allowed input in one place:

```ts
amount: z
  .number({ error: 'Amount must be a number' })
  .positive('Amount must be greater than 0')
  .max(MAX_LOAN_AMOUNT, `Amount cannot be more than ${MAX_LOAN_AMOUNT}`)
  .refine(hasAtMostTwoDecimals, 'Amount can have at most 2 decimal places'),
```

If `parse` fails it throws a `ZodError`, and `errorHandler.ts` turns that into a 400 response
listing every bad field.

**Why store money as cents?** Computers store decimals approximately:
`0.1 + 0.2` is `0.30000000000000004` in JavaScript. Whole numbers are exact, so the database
stores `amount_cents INTEGER` and the API converts at the edges (`toCents` / `fromCents` in
`utils/money.ts`).

---

## 8. How repayment works

`PATCH /api/loans/:id/repay` in `loanRoutes.ts`:

1. Validate the id (`loanIdSchema`) and the optional `repaidDate` (default: today).
2. Load the loan **for this user**. Not found (or someone else's) → `404`.
3. Already repaid → `409 LOAN_ALREADY_REPAID`.
4. Date in the future or before the loan date → `400`.
5. Update it:

```sql
UPDATE loans
SET status = 'repaid', repaid_date = $3, updated_at = NOW()
WHERE id = $1 AND user_id = $2 AND status = 'pending'
RETURNING ...
```

The `AND status = 'pending'` matters: if two "repay" requests arrive at the same moment, only
one can update the row; the other gets no row back and returns `409`.

In the app, `LoanDetailsScreen` shows a confirmation dialog (`Alert.alert`) first, then calls
`repayLoan(id)` and replaces the displayed loan with the updated one from the server.

---

## 9. How summary calculations work

All the rules live in `backend/src/loans/loanRules.ts`. These are **pure functions**: they only
use their inputs (no database, no clock), so they are easy to read and to test.

**Overdue** has exactly one definition, used everywhere:

```ts
export function isOverdue(loan, today: string): boolean {
  return loan.status === 'pending' && loan.dueDate < today;
}
```

- Due **yesterday**, still pending → overdue
- Due **today** → not overdue yet
- **Repaid** → never overdue, even if it was repaid late

(Dates in `YYYY-MM-DD` form sort correctly as plain text, so `<` works on them.)

**Summary** walks through the loans once, adding whole cents:

```ts
for (const loan of loans) {
  totalLentCents += loan.amountCents;
  if (loan.status === 'repaid') {
    totalRepaidCents += loan.amountCents;
    repaidLoans += 1;
  } else if (isOverdue(loan, today)) {
    overdueCents += loan.amountCents;
    overdueLoans += 1;
  }
}
// outstanding = totalLent - totalRepaid
```

Because of the `if / else if`, a repaid loan can never reach the overdue branch.

**Where does "today" come from?** `todayInTimeZone(config.timeZone)` in `utils/dates.ts`.
At 20:00 UTC on 1 March it is already 2 March in India, so the timezone (from `APP_TIMEZONE`)
decides when a loan becomes overdue. There's a unit test for exactly this case.

**Worked example** (today = 2025-06-15), from `tests/unit/loanRules.test.ts`:

| Loan | Amount | Status | Due | Counts as |
| --- | --- | --- | --- | --- |
| A | 1000.00 | pending | 2025-07-01 | outstanding |
| B | 500.50 | pending | 2025-06-01 | outstanding **and** overdue |
| C | 250.00 | repaid | 2025-05-01 | repaid (not overdue) |
| D | 10.00 | pending | 2025-06-15 | outstanding (due today, not overdue) |

Result: totalLent 1760.50, totalRepaid 250, outstanding 1510.50, overdue 500.50, totalLoans 4.

> **Trade-off to know about:** the summary loads all of a user's loans and adds them up in
> TypeScript. For a personal ledger (hundreds of loans) this is fast and keeps the rules in one
> readable place. An app with millions of rows would do the sums in SQL (`SUM(...) FILTER (WHERE ...)`).

---

## 10. How API requests work (mobile side)

Every request goes through `apiRequest` in `mobile/src/api/client.ts`. It:

1. Builds the full URL from `API_URL` (from `EXPO_PUBLIC_API_URL` in `mobile/.env`).
2. Adds headers: `Content-Type: application/json` and `Authorization: Bearer <token>`.
3. Cancels the request after 15 seconds (`AbortController`).
4. If the network fails (server off, wrong IP), throws a friendly `ApiError`:
   *"Could not reach the server at http://... Check that the backend is running..."*
5. If the server answers with an error, reads `{ error: { code, message } }` and throws an
   `ApiError` with that message, so screens can show it directly.
6. On 401 while logged in, triggers automatic logout.

`miniLedgerApi.ts` then has one tiny function per endpoint:

```ts
export async function getLoans(filter: LoanFilter = 'all'): Promise<Loan[]> {
  const data = await apiRequest<{ loans: Loan[] }>(`/api/loans?status=${filter}`);
  return data.loans;
}
```

Screens use them through the `useFocusedData` hook, which:
- loads data each time the screen **comes into view** (so the dashboard updates after you add a loan),
- supports pull-to-refresh,
- ignores late answers from older requests (e.g. when you switch filters quickly).

Each screen then handles the four UI states:

```tsx
if (!loans) {
  return error ? <ErrorView message={error} onRetry={retry} />   // failed
               : <LoadingView message="Loading loans..." />;      // loading
}
// ...FlatList with ListEmptyComponent={<EmptyState .../>}        // empty
// ...otherwise the list of LoanCards                             // data
```

---

## 11. How PostgreSQL is used

### Tables (`backend/migrations/001_initial_schema.sql`)

```
users                     otp_codes                    loans
─────                     ─────────                    ─────
id (PK)  ◄──────────┐     id (PK)                      id (PK)
phone (UNIQUE)      │     phone                        user_id (FK → users.id)
created_at          │     code_hash                    friend_name
                    │     expires_at                   amount_cents
                    │     attempts                     loan_date, due_date
                    │     consumed_at                  status ('pending' | 'repaid')
                    │     created_at                   repaid_date
                    └───────────────────────────────── receipt_image
                                                       created_at, updated_at
```

- **Primary key (PK):** a unique id for each row (`SERIAL` = auto-incrementing number).
- **Foreign key (FK):** `loans.user_id REFERENCES users(id)` means every loan must belong to a
  real user. `ON DELETE CASCADE` removes a user's loans if the user is deleted.
- **Index:** `loans_user_id_idx` makes "find this user's loans" fast.

### Constraints: the database protects itself

Even if a bug in the code tried to save bad data, PostgreSQL would refuse:

```sql
CONSTRAINT loans_amount_positive CHECK (amount_cents > 0),
CONSTRAINT loans_due_after_loan CHECK (due_date >= loan_date),
CONSTRAINT loans_status_valid CHECK (status IN ('pending', 'repaid')),
CONSTRAINT loans_repaid_date_matches_status CHECK (
  (status = 'repaid' AND repaid_date IS NOT NULL)
  OR (status = 'pending' AND repaid_date IS NULL)
),
```

An integration test (`enforces constraints in the database itself`) proves these work.

### Parameterized queries (protection against SQL injection)

Every query uses `$1, $2, ...` placeholders, with values passed separately:

```ts
await db.query(
  `SELECT ... FROM loans WHERE id = $1 AND user_id = $2`,
  [loanId, userId],
);
```

**Never** build SQL by gluing strings together like `` `WHERE id = ${id}` ``. With placeholders,
PostgreSQL treats the value purely as data, so a "name" like `'; DROP TABLE loans; --` is just
stored as a weird name.

### "Users only see their own loans"

Every loan query includes `user_id = $2` (the id from the token, never from the request body).
If you ask for someone else's loan id, the query simply finds nothing and you get `404`, the
same answer as for a loan that doesn't exist, so you can't even learn that it exists.

### Connection pool and migrations

- `db/pool.ts` creates a **pool**: a few open connections that requests share, instead of
  connecting from scratch every time. It also tells `pg` to keep `DATE` columns as
  `'YYYY-MM-DD'` strings (by default they become JavaScript `Date` objects, which can shift the
  day by timezone, a classic bug).
- `db/migrate.ts` applies each `.sql` file in `migrations/` once, in order, inside a transaction,
  and remembers what it applied in a `schema_migrations` table. To change the schema later, add
  `002_something.sql`; never edit a migration that has already run.

---

## 12. How to run the project (quick version)

Full details are in [README.md](README.md).

```bash
# Terminal 1: backend
cd MiniLedger/backend
cp .env.example .env        # then edit DATABASE_URL and JWT_SECRET
npm install
npm run db:migrate
npm run dev
```

```bash
# Terminal 2: mobile app
cd MiniLedger/mobile
cp .env.example .env        # then set EXPO_PUBLIC_API_URL
npm install
npx expo start
```

Log in with your number, then read the 6-digit code from Terminal 1.

---

## 13. Common errors and their solutions

| Error message | Cause | Fix |
| --- | --- | --- |
| `Invalid environment configuration: DATABASE_URL: ...` | `backend/.env` missing or incomplete | `cp .env.example .env` and fill it in |
| `JWT_SECRET must be at least 32 characters long` | Secret too short | Generate one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `Could not connect to PostgreSQL (connect ECONNREFUSED ...)` | PostgreSQL isn't running | `brew services start postgresql@17` |
| `password authentication failed for user ...` | Wrong user/password in `DATABASE_URL` | Check the values you used in `CREATE USER` |
| `database "miniledger" does not exist` | Database not created | Run the `CREATE DATABASE` command from the README |
| `relation "loans" does not exist` | Tables not created | `npm run db:migrate` |
| `EADDRINUSE: address already in use :::4000` | Another process uses port 4000 (maybe an old server) | Stop it, or set `PORT=4001` in `.env` (and update the app's URL) |
| App: *"Could not reach the server at http://localhost:4000"* on a real phone | `localhost` on a phone means the phone itself | Set `EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:4000` and restart with `npx expo start --clear` |
| Same, on Android emulator | Emulator's localhost is the emulator | Use `http://10.0.2.2:4000` |
| Same, everything looks right | Phone and computer on different Wi-Fi, or firewall blocking | Same network; allow Node in macOS Firewall settings |
| *"Please wait 30 seconds before requesting another code."* | Resend cooldown | Wait, then use the code already printed in the terminal |
| *"This code has expired or was tried too many times."* | 5 minutes passed or 5 wrong tries | Request a new code |
| *"Your session has expired. Please log in again."* | Token expired or `JWT_SECRET` changed | Log in again |
| Integration tests show as **skipped** | `TEST_DATABASE_URL` not set | Set it to an empty test database (see README → Testing) |
| Expo Go: *"Project is incompatible with this version of Expo Go"* | Expo Go doesn't support SDK 58 | Update Expo Go from the app store |
| `.env` change in `mobile/` has no effect | Expo caches env values | `npx expo start --clear` |

---

## 14. What to learn first (suggested order)

1. **JavaScript basics → TypeScript basics**: types, interfaces, `async/await`, Promises.
2. **HTTP**: methods (GET/POST/PATCH), status codes (200, 201, 400, 401, 404, 409, 500), headers,
   JSON. Practise with the curl examples in API_DOCUMENTATION.md.
3. **SQL**: `SELECT / INSERT / UPDATE`, `WHERE`, primary and foreign keys. Open `psql` and
   look at your data: `SELECT * FROM loans;`
4. **Express**: routes, middleware, error handling. Read `app.ts`, then `loanRoutes.ts`.
5. **Validation with Zod**: read `loanSchemas.ts` and its tests.
6. **Testing**: read `tests/unit/loanRules.test.ts` first (simplest), then the integration tests.
7. **React**: components, props, `useState`, `useEffect`. Then React Native's `View`, `Text`,
   `FlatList`.
8. **React Navigation and Context**: `RootNavigator.tsx` and `AuthContext.tsx`.

A good exercise once you're comfortable: add a "notes" field to loans. You'll touch every
layer: a new migration, the Zod schema, the repository SQL, the API response, the mobile type,
the form, the details screen, and the tests.
