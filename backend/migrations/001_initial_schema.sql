-- MiniLedger initial schema.
-- Applied by `npm run db:migrate` (see src/db/migrate.ts).

-- One row per person who has logged in with their phone number.
CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  phone       VARCHAR(16) NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_phone_format CHECK (phone ~ '^\+[1-9][0-9]{7,14}$')
);

-- One-time passwords sent during login. We store a hash of the code, never the code itself.
CREATE TABLE otp_codes (
  id           SERIAL PRIMARY KEY,
  phone        VARCHAR(16) NOT NULL,
  code_hash    CHAR(64) NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX otp_codes_phone_created_idx ON otp_codes (phone, created_at DESC);

-- Money lent to friends. Every loan belongs to exactly one user.
CREATE TABLE loans (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  friend_name    VARCHAR(100) NOT NULL,
  -- Stored in the smallest currency unit (cents/paise) so sums are always exact.
  amount_cents   INTEGER NOT NULL,
  loan_date      DATE NOT NULL,
  due_date       DATE NOT NULL,
  status         VARCHAR(10) NOT NULL DEFAULT 'pending',
  repaid_date    DATE,
  -- Optional receipt photo stored as a data URI (data:image/jpeg;base64,...).
  receipt_image  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT loans_friend_name_not_blank CHECK (LENGTH(TRIM(friend_name)) > 0),
  CONSTRAINT loans_amount_positive CHECK (amount_cents > 0),
  CONSTRAINT loans_due_after_loan CHECK (due_date >= loan_date),
  CONSTRAINT loans_status_valid CHECK (status IN ('pending', 'repaid')),
  -- A repaid loan must have a repayment date; a pending loan must not.
  CONSTRAINT loans_repaid_date_matches_status CHECK (
    (status = 'repaid' AND repaid_date IS NOT NULL)
    OR (status = 'pending' AND repaid_date IS NULL)
  ),
  CONSTRAINT loans_repaid_after_loan CHECK (repaid_date IS NULL OR repaid_date >= loan_date)
);

CREATE INDEX loans_user_id_idx ON loans (user_id);
