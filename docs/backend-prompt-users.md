# Backend prompt: users, registration and deposit history

Paste everything below the line into a Claude Code session opened in `KasiDepositApi`.

---

The mobile app (`KasiDepositUi`) now requires users to register before depositing, and shows
each user their past deposits. The app is the source of truth for the wire contract, as it is for
the rest of `/v1`. Its side is already built: `src/api/wire.ts`, `src/api/http.ts`, `src/api/types.ts`
and `src/api/fake.ts` in the app repo. Please add the backend side.

Keep everything the README and existing code already enforce:

- snake_case JSON
- refusals as `{"reason": "<string>"}` with the status set in `REASON_STATUS`
- no amounts accepted from the client
- RLS enabled plus the `anon`/`authenticated` privileges revoked on **every new table**, as in
  migrations 0003 and 0004 (`tests/test_schema.py` enforces RLS)
- `op.f()` on check-constraint names
- enum types and triggers created and dropped explicitly in the migration
- logs never contain secrets or personal data (`app/log_redaction.py`)

## 1. Migration 0005: `users`, `user_sessions`, `deposits.user_id`

### `users`

| column | type | notes |
|---|---|---|
| `id` | uuid PK | default `uuid4` |
| `full_names` | text not null | normalised: trimmed, whitespace collapsed; 2 to 100 chars; at least two names |
| `id_number_hmac` | text not null, **unique** | HMAC-SHA256 of the 13-digit ID number, keyed with a new secret setting `ID_NUMBER_PEPPER` (at least 32 chars, `repr=False`, required in production). Used for uniqueness and lookup. |
| `id_number_encrypted` | bytea not null | The ID number encrypted with AES-GCM under a new secret setting `ID_NUMBER_KEY`. Keep it only because KYC (FICA) requires retaining the verified identity. Never returned by any endpoint. If you think retention isn't required yet, say so and leave this column out rather than storing plaintext. |
| `date_of_birth` | date not null | derived from the ID number |
| `shap_id` | text not null | E.164 with optional `@bank`, the canonical form the app sends |
| `bank_id` | text not null | from resolution |
| `status` | enum `user_status` (`active`, `suspended`) not null | default `active` |
| `id_verified_at` | timestamptz not null | when Home Affairs verification passed |
| `verification_ref` | text | the verification provider's reference |
| `created_at`, `updated_at` | timestamptz not null | `updated_at` by trigger, like `deposits` |

Never store the plaintext ID number anywhere: not in the database, not in logs, not in exceptions.

### `user_sessions`

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users not null | indexed |
| `token_hash` | text not null, unique | SHA-256 of the bearer token; the token itself is never stored |
| `created_at` | timestamptz not null | |
| `last_used_at` | timestamptz | |
| `revoked_at` | timestamptz | |

### `deposits`

- Add `user_id uuid null references users(id)`, indexed together with `created_at desc`.
- It is nullable only because existing rows predate users. Every new deposit must set it.

## 2. Registration: `POST /v1/users`

Request, no auth:

```json
{ "full_names": "Thabo Mokoena", "id_number": "8001015009087", "shap_id": "+27821234567" }
```

Validate in this order, refusing with these exact reasons. They are already in the app's
`RegistrationFailure` type, and the app shows its own message for each.

1. **ID format** → `id_number_invalid` (422). Check all of:
   - 13 digits
   - `YYMMDD` is a real date
   - digit 11 (citizenship) is 0, 1 or 2
   - the Luhn check digit is correct

   Mirror the app's `src/domain/saId.ts`. Century rule: a year that would be in the future
   belongs to the 1900s.
2. **Age** → `id_number_under_age` (422) if younger than 18 (the app's `MIN_AGE_YEARS`).
3. **Full names** → `invalid_registration` (422). The app validates names before sending, so
   this only guards direct API calls. The app doesn't know this reason, so it shows its generic
   message.
4. **ShapID**: resolve it with the existing `app/shapid.py` and refuse with its reasons
   (`shapid_not_found`, and so on) exactly as `POST /v1/deposits` does.
5. **Home Affairs verification** → `id_verification_failed` (422). Refuse when the ID number
   doesn't exist, the person is marked deceased, or the names don't match.
   - Add a new seam, `IdentityVerifier` in `app/identity.py`, with a mock in the style of
     `app/shapid.py`. The mock scenarios must match the app's fake, keyed off the ID's sequence
     digits (positions 7 to 10):
     - `0000`: verification failed
     - `0001`: `id_number_already_registered` (see step 7)
     - `0002`: `shapid_name_mismatch`
     - anything else: verified
   - Document the seam in the README's seam table, as the stand-in for a DHA-linked KYC
     provider.
6. **Name match** → `shapid_name_mismatch` (409). The ShapID's masked name (for example
   "M. Mothiba") must plausibly belong to the ID holder: compare its surname with the last of
   `full_names`, ignoring case and accents.
   - Read the POPIA note in `app/shapid.py` first. It says never to split or store the masked
     name. This comparison is a transient, confirmation-of-payee style check; persist only the
     pass/fail outcome.
   - If you judge this check shouldn't live here yet, keep the reason but make the check a
     setting that is off by default, and tell me.
7. **Uniqueness** via `id_number_hmac`:
   - **Same ID, same full names and same ShapID**: this is the same person reinstalling. Issue a
     new session, revoke the old ones, and return 200.
   - **Same ID, different details** → `id_number_already_registered` (409).
   - Let the unique constraint decide the race between two registrations of one ID, as
     `deposits.idempotency_key` does. Don't pre-check.

On success, 201 (new user) or 200 (re-link):

```json
{ "user_id": "<uuid>", "access_token": "<opaque>", "full_names": "Thabo Mokoena" }
```

The access token is at least 32 random bytes, URL-safe. Only its SHA-256 is stored. It has no
expiry for now, but store `created_at` so one can be added later.

Please also note in the README (don't build it yet): verifying the user owns the PayShap number
(an OTP to it) belongs in a follow-up, and until then re-linking relies on knowing the ID number,
names and number together.

## 3. Authentication on `/v1`

- Every `/v1` route except `POST /v1/users`, `GET /v1/shapid/{id}` and `GET /health` requires
  `Authorization: Bearer <token>`.
- A missing, unknown or revoked token, or a suspended user, is **401 `{"reason": "not_registered"}`**.
  The app maps any 401 to that reason, clears its session and goes to its register screen.
- Update `last_used_at`, at most once a minute per session so polling doesn't write on every
  request.
- Build it as a FastAPI dependency, `CurrentUser`, in `app/auth.py`.
- `/demo/*` and `/till` are unchanged.

## 4. Deposits belong to users

- **`POST /v1/deposits`** sets `user_id`.
  - An idempotency replay by a *different* user returns `deposit_not_found` (404) rather than
    the other user's deposit.
- **`GET /v1/deposits/{id}`** returns only the caller's own deposits. Another user's deposit is
  `deposit_not_found` (404), never 403, so ids can't be probed.
- **Destination snapshot:** when resolving a `shap_id` destination, also store `shap_name` in
  `deposits.destination` next to `bank_id`. It is display text only (the same masked text the
  app shows and saves on the phone), so the history can say who was paid.
  - Update the POPIA comments in `app/shapid.py` and on `Deposit.destination` to say exactly this.
  - Older rows without it: fall back to a re-resolve when listing, or leave the row out of the
    history and log a count. Say which you chose.

## 5. History: `GET /v1/me/deposits`

Auth required. It returns the caller's 20 most recent deposits, newest first. Optionally accept
`?limit=` (1 to 50, default 20).

```json
{
  "deposits": [
    {
      "id": "<uuid>",
      "reference": "KD-7F3A9C",
      "status": "completed",
      "payout_cents": 49500,
      "value_cents": 50000,
      "fee_cents": 500,
      "failure_reason": null,
      "created_at": "2026-09-26T12:05:00Z",
      "destination": { "kind": "shap_id", "shap_id": "+27821234567", "shap_name": "M. Mothiba", "bank": "CAPITEC" }
    }
  ]
}
```

- `status` and `failure_reason` are the app-facing values, exactly as `DepositResponse` maps
  them today.
- `value_cents` is `amount_cents`.
- `bank` is the upper-case API code from `BANK_API_CODES`, as the ShapID route returns it.
- An `account` destination is `{ "kind": "account", "name", "account_number", "bank" }`.
- Listing must **not** advance in-flight payouts. It is read-only. Only `GET /v1/deposits/{id}`
  moves a deposit forward.

## 6. Tests

Follow the existing style (`tests/test_v1_routes.py`, `tests/test_schema_deposits.py`). Cover
at least:

- every registration refusal and its HTTP status
- a re-link returns 200, and the old token then gets 401
- two concurrent registrations of one ID end with one user
- the plaintext ID number never appears in:
  - any table (scan every text/bytea column)
  - any log line (use `caplog`)
  - any response
- 401 on every protected route without a token, and with a revoked one
- user A can't read user B's deposit (404) and can't see it in `/v1/me/deposits`
- an idempotency replay across users
- `/v1/me/deposits` ordering, limit and shape, and that it doesn't advance payouts
- RLS is enabled on `users` and `user_sessions`
- the migration downgrades cleanly (enum and trigger dropped)

## 7. Docs

- **README:** add the routes to the `/v1` table, the new seam, the two new secrets in
  `.env.example` (with a command to generate them), and a "Demo scenarios" row for the
  registration IDs:
  - `8001010000081`: verification failed
  - `8001010001089`: already registered
  - `8001010002087`: name mismatch
  - `8001015009087`: registers

  These match the app's `TESTING.md`.
- **`render.yaml`:** add the two secrets as `sync: false`.

When you're done, list anything in this contract you had to change or couldn't do, so the app
can be updated to match.
