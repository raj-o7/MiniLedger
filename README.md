# MiniLedger

MiniLedger is a small money-lending tracker. It helps you remember money you lent to friends,
see who has paid you back, and spot loans that are overdue.

It has two parts:

- **backend/**: a REST API (Node.js, TypeScript, Express, PostgreSQL)
- **mobile/**: a phone app (React Native, Expo, TypeScript) that talks to the API

New to the code? Read [MY_LEARNING_GUIDE.md](MY_LEARNING_GUIDE.md) after this file.
The full endpoint reference is in [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

---

## Features

**Login**
- Log in with a phone number and a 6-digit one-time code (OTP)
- The OTP is mocked: no SMS is sent, the code is printed in the backend terminal
- Codes expire after 5 minutes, allow 5 attempts, and can be re-sent after 30 seconds
- After login the app receives a token (JWT) and stays logged in after restarts

**Loans**
- Add a loan: friend's name, amount, loan date, due date, optional receipt photo
- List loans, filtered by All / Pending / Overdue / Repaid
- Overdue loans are highlighted in red
- View a loan's details, including the receipt photo
- Mark a loan as repaid (records the repayment date)

**Dashboard summary**
- Total lent, total repaid, outstanding amount, overdue amount, number of loans
- Repaid loans are never counted as overdue
- Each user can only see and change their own loans

---

## Technology stack

| Part | Technology |
| --- | --- |
| Backend runtime | Node.js 20.12+ (developed on Node 22) |
| Backend language | TypeScript 5.9 |
| Web framework | Express 5 |
| Database | PostgreSQL (13 or newer; verified with PostgreSQL 18) |
| Database driver | `pg` (node-postgres) |
| Input validation | Zod 4 |
| Login tokens | `jsonwebtoken` (JWT, HS256) |
| Backend tests | Jest 30, ts-jest, Supertest |
| Mobile | React Native 0.88, Expo SDK 58, TypeScript 6 |
| Navigation | React Navigation 7 (native stack) |
| Secure token storage | `expo-secure-store` |
| Receipt photos | `expo-image-picker` |
| Mobile tests | Jest 30, jest-expo, React Native Testing Library |

---

## Project structure

```
MiniLedger/
├── README.md                  ← you are here
├── MY_LEARNING_GUIDE.md       ← beginner walkthrough of the code
├── API_DOCUMENTATION.md       ← every endpoint, request and response
├── IMPLEMENTATION_PROGRESS.md ← what was built and verified
├── backend/
│   ├── migrations/            ← SQL that creates the database tables
│   ├── src/                   ← API source code
│   └── tests/                 ← unit + integration tests
└── mobile/
    ├── App.tsx                ← app entry point
    ├── src/                   ← screens, components, API client
    └── __tests__/             ← mobile tests
```

---

## Installation

You need:

- **Node.js 20.12 or newer** (check with `node -v`)
- **PostgreSQL** running on your computer (see [Database setup](#database-setup))
- For the phone app: the **Expo Go** app on your phone, or an iOS Simulator (needs Xcode) /
  Android Emulator (needs Android Studio)

Install the dependencies of both parts:

```bash
cd MiniLedger/backend
npm install
```

```bash
cd MiniLedger/mobile
npm install
```

---

## Database setup

### 1. Install and start PostgreSQL (macOS with Homebrew)

```bash
brew install postgresql@17
```

```bash
brew services start postgresql@17
```

Homebrew does not put this version on your PATH automatically. Add it (then open a new terminal):

```bash
echo 'export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"' >> ~/.zshrc
```

(Alternatives: [Postgres.app](https://postgresapp.com/) on macOS, or the official installer
from postgresql.org on Windows/Linux.)

### 2. Create a database user and the databases

Pick your own password instead of `choose_a_password`:

```bash
psql postgres -c "CREATE USER miniledger_user WITH PASSWORD 'choose_a_password';"
```

```bash
psql postgres -c "CREATE DATABASE miniledger OWNER miniledger_user;"
```

Optional, for the integration tests (they delete all data in this database):

```bash
psql postgres -c "CREATE DATABASE miniledger_test OWNER miniledger_user;"
```

### 3. Configure the backend

```bash
cd MiniLedger/backend
cp .env.example .env
```

Open `backend/.env` and set:

- `DATABASE_URL`: `postgres://miniledger_user:choose_a_password@localhost:5432/miniledger`
- `JWT_SECRET`: a long random value. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- `APP_TIMEZONE`: your timezone, e.g. `Asia/Kolkata`. It decides what "today" means for overdue checks.
- `TEST_DATABASE_URL` (optional): the `miniledger_test` database, used only by tests.

Never commit `.env`. It is already listed in `.gitignore`.

### 4. Create the tables

```bash
cd MiniLedger/backend
npm run db:migrate
```

You should see `Applied migrations: 001_initial_schema.sql`. Running it again is safe;
it prints `Database is already up to date.`

---

## How to run the backend

Development mode (restarts automatically when you edit code):

```bash
cd MiniLedger/backend
npm run dev
```

Production-style (compile to JavaScript first, then run it):

```bash
cd MiniLedger/backend
npm run build
npm start
```

You should see `MiniLedger API listening on http://localhost:4000`.
Check it in another terminal:

```bash
curl http://localhost:4000/api/health
```

Expected answer: `{"status":"ok"}`

When someone requests a login code, it appears in this terminal like:

```
[MOCK OTP] Login code for +919876543210: 483920 (valid for 5 minutes)
```

---

## How to run the mobile app

1. Start the backend first (see above).
2. Tell the app where the backend is:

```bash
cd MiniLedger/mobile
cp .env.example .env
```

Edit `mobile/.env` and set `EXPO_PUBLIC_API_URL`:

| Where the app runs | Value |
| --- | --- |
| iOS Simulator | `http://localhost:4000` |
| Android Emulator | `http://10.0.2.2:4000` |
| Real phone with Expo Go (same Wi-Fi as your computer) | `http://YOUR_COMPUTER_IP:4000` |

Find your computer's IP on macOS with:

```bash
ipconfig getifaddr en0
```

3. Start Expo:

```bash
cd MiniLedger/mobile
npx expo start
```

4. Then either scan the QR code with **Expo Go** (Android) or the Camera app (iOS), or press
   `i` for the iOS Simulator / `a` for the Android Emulator.

If you change `.env`, stop Expo and run `npx expo start --clear` so the new value is picked up.

**Note:** Expo Go must support SDK 58 (install the latest Expo Go from the app store).
The web target (`w`) is not supported: secure storage is not available in browsers and the
API does not enable CORS.

### Using the app

1. Enter your phone number with country code (e.g. `+91 98765 43210`) and tap **Send code**.
2. Look at the backend terminal for the 6-digit code and enter it.
3. On the dashboard, tap **Add a loan**. Fill in the form; the `+1 week` buttons fill in the due date.
4. Open a loan to see details and tap **Mark as repaid** when your friend pays you back.

---

## Testing

### Backend

```bash
cd MiniLedger/backend
npm run typecheck   # type-checks source and tests
npm test            # runs all tests
npm run build       # compiles to dist/
```

- **Unit tests** (`tests/unit/`) need no database and always run.
- **Integration tests** (`tests/integration/`) call the real API against PostgreSQL.
  They run only when `TEST_DATABASE_URL` is set (in your shell or in `backend/.env`);
  otherwise Jest reports them as *skipped*. They delete all rows in that database before
  each test, so **never point `TEST_DATABASE_URL` at a database with real data**.

Example with the variable in your shell:

```bash
TEST_DATABASE_URL=postgres://miniledger_user:choose_a_password@localhost:5432/miniledger_test npm test
```

### Mobile

```bash
cd MiniLedger/mobile
npm run typecheck
npm test
```

Mobile tests cover validation, formatting, the API client (with a mocked network) and the
loan card component (including overdue highlighting).

---

## API documentation

All endpoints are under `http://localhost:4000/api`. Summary:

| Method | URL | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | No | Check the server and database are up |
| POST | `/api/auth/request-otp` | No | Send a login code to a phone number |
| POST | `/api/auth/verify-otp` | No | Exchange phone + code for a token |
| GET | `/api/auth/me` | Yes | Get the logged-in user |
| GET | `/api/loans/summary` | Yes | Totals for the dashboard |
| GET | `/api/loans?status=all\|pending\|overdue\|repaid` | Yes | List your loans |
| POST | `/api/loans` | Yes | Create a loan |
| GET | `/api/loans/:id` | Yes | Get one loan, including the receipt image |
| PATCH | `/api/loans/:id/repay` | Yes | Mark a loan as repaid |

"Auth: Yes" means you must send the header `Authorization: Bearer <token>`.
Errors always look like `{ "error": { "code": "...", "message": "..." } }`.

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for request bodies, responses and error cases.

---

## Known limitations

- OTP delivery is mocked (printed to the terminal). Connect an SMS provider before real use.
- Receipt photos are stored in the database as base64 text (max ~2 MB). Fine for a small app;
  larger apps usually store files in object storage (e.g. S3) instead.
- A loan is either fully pending or fully repaid. Partial repayments, editing and deleting
  loans are not implemented.
- See [IMPLEMENTATION_PROGRESS.md](IMPLEMENTATION_PROGRESS.md) for what was and wasn't verified.
