/**
 * Wire format for the real backend, kept apart from http.ts so it can be unit-tested.
 *
 * ASSUMED contract (nothing on the backend exists yet; change here when it does):
 *   POST /vouchers/lookup   { pin }                                  -> voucher lookup
 *   POST /deposits          { voucher_token, beneficiary }           -> deposit
 *                           with an `Idempotency-Key` header
 *   GET  /deposits/{id}                                              -> deposit
 *   JSON is snake_case. Errors are 4xx with `{ "reason": "<FailureReason>" }` or FastAPI's
 *   `{ "detail": { "reason": "<FailureReason>" } }`.
 */
import type { BankId } from '../domain/banks';
import { ApiError } from './errors';
import type { Beneficiary, Deposit, DepositStatus, FailureReason, VoucherLookup } from './types';

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

const FAILURE_REASONS: Record<FailureReason, true> = {
  voucher_not_found: true,
  voucher_already_redeemed: true,
  voucher_too_small: true,
  invalid_account: true,
  inactive_account: true,
  bank_processing_error: true,
  insufficient_float: true,
  unknown: true,
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
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FAILURE_REASONS, value);
}

function isDepositStatus(value: unknown): value is DepositStatus {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(DEPOSIT_STATUSES, value);
}

function isCents(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function beneficiaryToWire(beneficiary: Beneficiary) {
  return {
    name: beneficiary.name,
    account_number: beneficiary.accountNumber,
    bank: BANK_API_CODES[beneficiary.bankId],
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
  return ApiError.business(isFailureReason(reason) ? reason : 'unknown');
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
    deposit.failureReason = isFailureReason(body.failure_reason) ? body.failure_reason : 'unknown';
  }
  return deposit;
}
