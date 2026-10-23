# MiniLedger API Documentation

Base URL during development: `http://localhost:4000`

The examples below are real responses from the running server.

## Conventions

**Format.** Requests and responses use JSON. Send `Content-Type: application/json` with a body.

**Authentication.** Protected endpoints need the token from `POST /api/auth/verify-otp`:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Tokens expire after `JWT_EXPIRES_IN` (default 7 days).

**Money.** Amounts are numbers in normal currency units (`1500.5` means 1500.50) with at most
2 decimal places. The database stores them as whole cents/paise (`150050`) so totals are exact.

**Dates.** Dates are strings in `YYYY-MM-DD` format, e.g. `"2026-10-24"`. Timestamps
(`createdAt`, `updatedAt`) are ISO 8601 strings in UTC.

**"Today".** The server decides what "today" is using the `APP_TIMEZONE` setting.

**Errors.** Every error response has this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Friend name is required",
    "details": [{ "field": "friendName", "message": "Friend name is required" }]
  }
}
```

`details` appears only for validation errors and lists every invalid field.
`message` is always safe to show to the user.

### Errors that any endpoint can return

| Status | code | When |
| --- | --- | --- |
| 400 | `INVALID_JSON` | The body is not valid JSON |
| 400 | `VALIDATION_ERROR` | A field is missing or invalid |
| 401 | `UNAUTHORIZED` | Protected endpoint: missing, invalid or expired token |
| 404 | `ROUTE_NOT_FOUND` | No endpoint matches the method + URL |
| 413 | `PAYLOAD_TOO_LARGE` | Body larger than 4 MB |
| 500 | `INTERNAL_ERROR` | Unexpected server problem (details are logged on the server only) |

### The Loan object

```json
{
  "id": 1,
  "friendName": "Asha",
  "amount": 2500,
  "loanDate": "2026-09-01",
  "dueDate": "2026-10-01",
  "status": "pending",
  "repaidDate": null,
  "hasReceipt": false,
  "isOverdue": true,
  "createdAt": "2026-10-23T20:02:15.282Z",
  "updatedAt": "2026-10-23T20:02:15.282Z"
}
```

| Field | Meaning |
| --- | --- |
| `status` | `"pending"` (not paid back yet) or `"repaid"` |
| `repaidDate` | Date it was repaid, or `null` while pending |
| `hasReceipt` | Whether a receipt photo is attached |
| `isOverdue` | `true` only when `status` is `"pending"` **and** `dueDate` is before today |
| `receiptImage` | *Only in single-loan responses.* `data:image/...;base64,...` or `null` |

---

## Health

### GET /api/health

**Purpose:** Check that the server is running and can reach the database.
**Authentication:** none.

**Response 200**

```json
{ "status": "ok" }
```

**Errors:** `500 INTERNAL_ERROR` if the database is unreachable.

---

## Authentication

### POST /api/auth/request-otp

**Purpose:** Generate a 6-digit login code for a phone number. In this development version
no SMS is sent; the code is printed in the backend terminal:

```
[MOCK OTP] Login code for +919876543210: 583648 (valid for 5 minutes)
```

**Authentication:** none.

**Request**

```json
{ "phone": "+91 98765 43210" }
```

| Field | Rules |
| --- | --- |
| `phone` | Required. International format with `+` and country code, 8–15 digits. Spaces, dashes and brackets are removed automatically. |

**Response 200**

```json
{
  "message": "Verification code sent.",
  "phone": "+919876543210",
  "expiresInSeconds": 300
}
```

`phone` is the cleaned-up number; use it when calling `verify-otp`.

**Errors**

| Status | code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Phone missing or not in international format |
| 429 | `OTP_COOLDOWN` | A code was requested for this number less than 30 seconds ago |

Requesting a new code invalidates any older unused code for that number.

---

### POST /api/auth/verify-otp

**Purpose:** Exchange the phone number and code for a login token. Creates the user account
on first login; later logins with the same number return the same account.

**Authentication:** none.

**Request**

```json
{ "phone": "+919876543210", "code": "583648" }
```

| Field | Rules |
| --- | --- |
| `phone` | Same rules as above |
| `code` | Required. Exactly 6 digits |

**Response 200**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "phone": "+919876543210",
    "createdAt": "2026-10-23T20:02:15.150Z"
  }
}
```

**Errors**

| Status | code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Phone or code has the wrong format |
| 401 | `OTP_INCORRECT` | Wrong code (counts as one attempt) |
| 401 | `OTP_EXPIRED` | No active code: never requested, expired (5 min), already used, or 5 attempts used up |

---

### GET /api/auth/me

**Purpose:** Return the logged-in user.
**Authentication:** required.

**Response 200**

```json
{
  "user": { "id": 1, "phone": "+919876543210", "createdAt": "2026-10-23T20:02:15.150Z" }
}
```

**Errors:** `401 UNAUTHORIZED`.

---

## Loans

All loan endpoints require authentication. A user can only ever see or change **their own**
loans; another user's loan behaves exactly as if it did not exist (404).

### GET /api/loans/summary

**Purpose:** Totals for the dashboard.
**Authentication:** required.

**Response 200**

```json
{
  "summary": {
    "totalLent": 3300.75,
    "totalRepaid": 2500,
    "outstanding": 800.75,
    "overdue": 0,
    "totalLoans": 2,
    "pendingLoans": 1,
    "repaidLoans": 1,
    "overdueLoans": 0
  }
}
```

| Field | How it is calculated |
| --- | --- |
| `totalLent` | Sum of the amounts of **all** loans |
| `totalRepaid` | Sum of the amounts of loans with status `repaid` |
| `outstanding` | `totalLent - totalRepaid` (the sum of pending loans) |
| `overdue` | Sum of loans that are `pending` **and** past their due date. Repaid loans are never included |
| `totalLoans` | Number of loans |
| `pendingLoans` / `repaidLoans` / `overdueLoans` | Counts for each group (`overdueLoans` is part of `pendingLoans`) |

A user with no loans gets all zeros.

**Errors:** `401 UNAUTHORIZED`.

---

### GET /api/loans

**Purpose:** List the user's loans.
**Authentication:** required.

**Query parameters**

| Name | Values | Default |
| --- | --- | --- |
| `status` | `all`, `pending`, `overdue`, `repaid` | `all` |

Example: `GET /api/loans?status=overdue`

**Order:** pending loans first (earliest due date first), then repaid loans (most recently repaid first).

**Response 200**

```json
{
  "loans": [
    {
      "id": 1,
      "friendName": "Asha",
      "amount": 2500,
      "loanDate": "2026-09-01",
      "dueDate": "2026-10-01",
      "status": "pending",
      "repaidDate": null,
      "hasReceipt": false,
      "isOverdue": true,
      "createdAt": "2026-10-23T20:02:15.282Z",
      "updatedAt": "2026-10-23T20:02:15.282Z"
    }
  ]
}
```

The list never includes `receiptImage` (images can be large); use `hasReceipt` and fetch the
single loan when needed. A user with no loans gets `{ "loans": [] }`.

**Errors:** `400 VALIDATION_ERROR` (unknown `status` value), `401 UNAUTHORIZED`.

---

### POST /api/loans

**Purpose:** Record a new loan. New loans always start as `pending`.
**Authentication:** required.

**Request**

```json
{
  "friendName": "Asha",
  "amount": 1500.5,
  "loanDate": "2026-10-20",
  "dueDate": "2026-11-20",
  "receiptImage": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

| Field | Rules |
| --- | --- |
| `friendName` | Required string, 1–100 characters (surrounding spaces are trimmed) |
| `amount` | Required **number** (not a string), greater than 0, at most 10,000,000, max 2 decimal places |
| `loanDate` | Required `YYYY-MM-DD`, a real calendar date, not in the future |
| `dueDate` | Required `YYYY-MM-DD`, on or after `loanDate` (may be in the past) |
| `receiptImage` | Optional (`null` or omitted for none). A data URI of a JPEG, PNG or WebP image, at most ~2 MB of image data |

**Response 201**: the created loan, including `receiptImage`:

```json
{
  "loan": {
    "id": 2,
    "friendName": "Asha",
    "amount": 1500.5,
    "loanDate": "2026-10-20",
    "dueDate": "2026-11-20",
    "status": "pending",
    "repaidDate": null,
    "hasReceipt": true,
    "receiptImage": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "isOverdue": false,
    "createdAt": "2026-10-23T20:05:00.000Z",
    "updatedAt": "2026-10-23T20:05:00.000Z"
  }
}
```

**Errors**

| Status | code | Example message |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | `Friend name is required` |
| 400 | `VALIDATION_ERROR` | `Amount must be greater than 0` |
| 400 | `VALIDATION_ERROR` | `Amount can have at most 2 decimal places` |
| 400 | `VALIDATION_ERROR` | `Date must be a real date in YYYY-MM-DD format` |
| 400 | `VALIDATION_ERROR` | `Due date cannot be before the loan date` |
| 400 | `VALIDATION_ERROR` | `Loan date cannot be in the future.` |
| 400 | `VALIDATION_ERROR` | `Receipt must be a JPEG, PNG or WebP image data URI` |
| 401 | `UNAUTHORIZED` | |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 4 MB |

Real example of a validation error (empty name, negative amount, no dates):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Friend name is required",
    "details": [
      { "field": "friendName", "message": "Friend name is required" },
      { "field": "amount", "message": "Amount must be greater than 0" },
      { "field": "loanDate", "message": "Date is required" },
      { "field": "dueDate", "message": "Date is required" }
    ]
  }
}
```

---

### GET /api/loans/:id

**Purpose:** Get one loan, including its receipt image.
**Authentication:** required.

Example: `GET /api/loans/1`

**Response 200**

```json
{
  "loan": {
    "id": 1,
    "friendName": "Asha",
    "amount": 2500,
    "loanDate": "2026-09-01",
    "dueDate": "2026-10-01",
    "status": "pending",
    "repaidDate": null,
    "hasReceipt": false,
    "receiptImage": null,
    "isOverdue": true,
    "createdAt": "2026-10-23T20:02:15.282Z",
    "updatedAt": "2026-10-23T20:02:15.282Z"
  }
}
```

**Errors**

| Status | code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | `:id` is not a positive whole number |
| 401 | `UNAUTHORIZED` | |
| 404 | `LOAN_NOT_FOUND` | No such loan, or it belongs to another user |

---

### PATCH /api/loans/:id/repay

**Purpose:** Mark a pending loan as repaid.
**Authentication:** required.

**Request** (the body is optional)

```json
{ "repaidDate": "2026-10-22" }
```

| Field | Rules |
| --- | --- |
| `repaidDate` | Optional `YYYY-MM-DD`. Defaults to today. Cannot be in the future or before the loan date |

**Response 200**: the updated loan:

```json
{
  "loan": {
    "id": 1,
    "friendName": "Asha",
    "amount": 2500,
    "loanDate": "2026-09-01",
    "dueDate": "2026-10-01",
    "status": "repaid",
    "repaidDate": "2026-10-24",
    "hasReceipt": false,
    "receiptImage": null,
    "isOverdue": false,
    "createdAt": "2026-10-23T20:02:15.282Z",
    "updatedAt": "2026-10-23T20:02:15.309Z"
  }
}
```

**Errors**

| Status | code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Bad `:id`, invalid `repaidDate`, date in the future, or before the loan date |
| 401 | `UNAUTHORIZED` | |
| 404 | `LOAN_NOT_FOUND` | No such loan, or it belongs to another user |
| 409 | `LOAN_ALREADY_REPAID` | The loan was already marked as repaid |

---

## Trying it with curl

```bash
# 1. Ask for a code (look in the backend terminal for it)
curl -X POST http://localhost:4000/api/auth/request-otp \
  -H 'Content-Type: application/json' -d '{"phone":"+919876543210"}'

# 2. Log in (replace 123456 with the printed code) and copy the token
curl -X POST http://localhost:4000/api/auth/verify-otp \
  -H 'Content-Type: application/json' -d '{"phone":"+919876543210","code":"123456"}'

# 3. Use the token
TOKEN=paste_token_here
curl -X POST http://localhost:4000/api/loans -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"friendName":"Asha","amount":2500,"loanDate":"2026-09-01","dueDate":"2026-10-01"}'
curl http://localhost:4000/api/loans -H "Authorization: Bearer $TOKEN"
curl -X PATCH http://localhost:4000/api/loans/1/repay -H "Authorization: Bearer $TOKEN"
curl http://localhost:4000/api/loans/summary -H "Authorization: Bearer $TOKEN"
```
