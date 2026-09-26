/**
 * Wire format for the real backend, kept apart from http.ts so it can be unit-tested.
 *
 * ASSUMED contract (nothing on the backend exists yet; change here when it does):
 *   POST /vouchers/lookup   { pin }                                  -> voucher lookup
 *   GET  /shapid/{shapId}   (ShapID URL-encoded: + and @ survive)    -> resolved ShapID
 *   POST /deposits          { voucher_token, payout_method_id }      -> deposit
 *                           with an `Idempotency-Key` header
 *   GET  /deposits/{id}                                              -> deposit
 *   POST /users             { full_names, id_number }                -> registered user
 *   GET  /me/deposits                                                -> { deposits: [...] }
 *   GET  /me/payout-methods                                          -> { payout_methods: [...] }
 *   POST /me/payout-methods { kind: shap_id, shap_id } | { kind: account, bank, account_number }
 *                           plus make_default                        -> payout method
 *   POST /me/payout-methods/{id}/default                             -> { payout_methods: [...] }
 *   DELETE /me/payout-methods/{id}                                   -> { payout_methods: [...] }
 *   GET  /branch-codes/{code}                                        -> { bank, bank_name }
 *                           PLACEHOLDER: the branch-code API is still to come; `bank` is a
 *                           BANK_API_CODES value, or null for a bank we can't pay into
 *   Every call except POST /users and GET /shapid sends `Authorization: Bearer <token>`; a
 *   missing, unknown or revoked token is 401 `{ "reason": "not_registered" }`.
 *   JSON is snake_case. Errors are 4xx with `{ "reason": "<FailureReason>" }` or FastAPI's
 *   `{ "detail": { "reason": "<FailureReason>" } }`.
 */
import type { BankId } from '../domain/banks';
import { parseStoredDestination } from '../domain/destination';
import { ApiError } from './errors';
import {
  CLEARING_FAILURE_REASONS,
  IDENTITY_FAILURE_REASONS,
  REGISTRATION_FAILURE_REASONS,
  VOUCHER_FAILURE_REASONS,
  type BranchCodeLookup,
  type ClearingFailure,
  type Deposit,
  type DepositRecord,
  type NewPayoutMethod,
  type PayoutMethod,
  type DepositStatus,
  type FailureReason,
  type RegisteredUser,
  type Registration,
  type ResolvedShapId,
  type VoucherFailure,
  type VoucherLookup,
} from './types';

/**
 * Provider bank enum values. PLACEHOLDERS: replace with the real provider's enum once known.
 * The record is exhaustive, so adding a bank to BankId fails to compile until it is mapped here.
 */
export const BANK_API_CODES: Record<BankId, string> = {
  capitec: 'CAPITEC',
  fnb: 'FNB',
  standard_bank: 'STANDARD_BANK',
  absa: 'ABSA',
  nedbank: 'NEDBANK',
  tymebank: 'TYMEBANK',
  african_bank: 'AFRICAN_BANK',
  discovery_bank: 'DISCOVERY_BANK',
  bank_zero: 'BANK_ZERO',
  investec: 'INVESTEC',
};

const DEPOSIT_STATUSES: Record<DepositStatus, true> = {
  pending: true,
  submitted: true,
  completed: true,
  failed: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFailureReason(value: unknown): value is FailureReason {
  return (
    typeof value === 'string' &&
    (Object.prototype.hasOwnProperty.call(IDENTITY_FAILURE_REASONS, value) ||
      Object.prototype.hasOwnProperty.call(CLEARING_FAILURE_REASONS, value) ||
      Object.prototype.hasOwnProperty.call(VOUCHER_FAILURE_REASONS, value) ||
      Object.prototype.hasOwnProperty.call(REGISTRATION_FAILURE_REASONS, value))
  );
}

export function isDepositFailureReason(value: unknown): value is ClearingFailure | VoucherFailure {
  return (
    typeof value === 'string' &&
    (Object.prototype.hasOwnProperty.call(CLEARING_FAILURE_REASONS, value) ||
      Object.prototype.hasOwnProperty.call(VOUCHER_FAILURE_REASONS, value))
  );
}

export function isDepositStatus(value: unknown): value is DepositStatus {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(DEPOSIT_STATUSES, value);
}

function isCents(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function newPayoutMethodToWire(method: NewPayoutMethod, makeDefault: boolean) {
  if (method.kind === 'shapId') {
    return { kind: 'shap_id', shap_id: method.shapId, make_default: makeDefault };
  }
  return {
    kind: 'account',
    bank: BANK_API_CODES[method.bankId],
    account_number: method.accountNumber,
    make_default: makeDefault,
  };
}

/** Turn a non-2xx response into a typed error. 5xx, timeouts and rate limits are 'network'. */
export function interpretErrorResponse(status: number, body: unknown): ApiError {
  if (status >= 500 || status === 408 || status === 429) {
    return ApiError.network(`Server responded ${status}`);
  }
  const reason = isRecord(body)
    ? (body.reason ?? (isRecord(body.detail) ? body.detail.reason : undefined))
    : undefined;
  if (isFailureReason(reason)) return ApiError.business(reason);
  // Whatever the body says, a 401 means this phone's session is no good: register again.
  return ApiError.business(status === 401 ? 'not_registered' : 'unknown');
}

// A 2xx we cannot read is our problem, not the user's connection and not a bad voucher.
function malformed(): ApiError {
  return ApiError.business('unknown');
}

export function parseVoucherLookup(body: unknown): VoucherLookup {
  if (
    !isRecord(body) ||
    typeof body.voucher_token !== 'string' ||
    body.voucher_token.length === 0 ||
    !isCents(body.value_cents) ||
    !isCents(body.fee_cents) ||
    !isCents(body.payout_cents)
  ) {
    throw malformed();
  }
  return {
    voucherToken: body.voucher_token,
    valueCents: body.value_cents,
    feeCents: body.fee_cents,
    payoutCents: body.payout_cents,
  };
}

/**
 * The `@bank` suffix format is my best understanding of a scheme-level bank code, case
 * insensitive. It may be a different identifier; this is why it is mapped to our own `BankId`
 * slugs (via `BANK_API_CODES`, reversed) rather than passed through raw. Not verified against
 * primary scheme documentation.
 */
export function parseResolvedShapId(body: unknown): ResolvedShapId {
  if (!isRecord(body) || typeof body.shap_name !== 'string' || body.shap_name.length === 0) {
    throw malformed();
  }
  const bankId = (Object.keys(BANK_API_CODES) as BankId[]).find(
    (id) => BANK_API_CODES[id] === body.bank,
  );
  if (!bankId) throw malformed();
  return { shapName: body.shap_name, bankId };
}

export function parseBranchCodeLookup(body: unknown): BranchCodeLookup {
  if (!isRecord(body) || typeof body.bank_name !== 'string' || body.bank_name.length === 0) {
    throw malformed();
  }
  return { bankName: body.bank_name, bankId: bankIdOf(body.bank) ?? null };
}

export function parseDeposit(body: unknown): Deposit {
  if (
    !isRecord(body) ||
    typeof body.id !== 'string' ||
    typeof body.reference !== 'string' ||
    !isDepositStatus(body.status) ||
    !isCents(body.payout_cents)
  ) {
    throw malformed();
  }
  const deposit: Deposit = {
    id: body.id,
    reference: body.reference,
    status: body.status,
    payoutCents: body.payout_cents,
  };
  if (body.status === 'failed') {
    deposit.failureReason = isDepositFailureReason(body.failure_reason)
      ? body.failure_reason
      : 'unknown';
  }
  return deposit;
}

export function registrationToWire(registration: Registration) {
  return {
    full_names: registration.fullNames,
    id_number: registration.idNumber,
  };
}

export function parseRegisteredUser(body: unknown): RegisteredUser {
  if (
    !isRecord(body) ||
    typeof body.user_id !== 'string' ||
    body.user_id.length === 0 ||
    typeof body.access_token !== 'string' ||
    body.access_token.length === 0 ||
    typeof body.full_names !== 'string' ||
    body.full_names.length === 0
  ) {
    throw malformed();
  }
  return { userId: body.user_id, accessToken: body.access_token, fullNames: body.full_names };
}

function bankIdOf(code: unknown): BankId | undefined {
  return (Object.keys(BANK_API_CODES) as BankId[]).find((id) => BANK_API_CODES[id] === code);
}

/**
 * A destination on the wire (a past deposit's, or a payout method's), as the app stores it.
 * Accounts arrive as their last four digits only; the server never sends the full number.
 */
function parseWireDestination(value: unknown) {
  if (!isRecord(value)) return null;
  const bankId = bankIdOf(value.bank);
  if (value.kind === 'shap_id') {
    return parseStoredDestination({
      kind: 'shapId',
      shapId: value.shap_id,
      shapName: value.shap_name,
      bankId,
    });
  }
  if (value.kind === 'account') {
    return parseStoredDestination({
      kind: 'account',
      name: value.name ?? value.account_holder,
      accountLast4: value.account_last4,
      bankId,
    });
  }
  return null;
}

function parseDepositRecord(value: unknown): DepositRecord | null {
  if (!isRecord(value) || !isCents(value.value_cents) || !isCents(value.fee_cents)) return null;
  const createdAt = typeof value.created_at === 'string' ? Date.parse(value.created_at) : NaN;
  if (!Number.isFinite(createdAt)) return null;
  const destination = parseWireDestination(value.destination);
  if (destination === null) return null;
  let deposit: Deposit;
  try {
    deposit = parseDeposit(value);
  } catch {
    return null;
  }
  return { ...deposit, valueCents: value.value_cents, feeCents: value.fee_cents, createdAt, destination };
}

/**
 * The list is the server's; one unreadable entry is dropped rather than failing the whole
 * screen, so a single odd row cannot hide the rest of the user's history.
 */
export function parseDepositHistory(body: unknown): DepositRecord[] {
  if (!isRecord(body) || !Array.isArray(body.deposits)) throw malformed();
  return body.deposits
    .map(parseDepositRecord)
    .filter((record): record is DepositRecord => record !== null);
}

function parsePayoutMethod(value: unknown): PayoutMethod | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) return null;
  if (typeof value.is_default !== 'boolean') return null;
  const destination = parseWireDestination(value);
  return destination === null ? null : { ...destination, id: value.id, isDefault: value.is_default };
}

export function parseAddedPayoutMethod(body: unknown): PayoutMethod {
  const method = parsePayoutMethod(body);
  if (method === null) throw malformed();
  return method;
}

/** As with history, one unreadable entry is dropped rather than hiding the rest. */
export function parsePayoutMethods(body: unknown): PayoutMethod[] {
  if (!isRecord(body) || !Array.isArray(body.payout_methods)) throw malformed();
  return body.payout_methods
    .map(parsePayoutMethod)
    .filter((method): method is PayoutMethod => method !== null);
}
