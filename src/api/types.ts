import type { BankId } from '../domain/banks';
import type { StoredDestination } from '../domain/destination';
import type { Cents } from '../domain/money';

export type { BankId, Cents };

/**
 * Where a user can be paid: a PayShap number or a bank account, saved on the server and checked
 * when it was added (the number is registered for PayShap in the user's own name; the account
 * belongs to the user's ID number). A deposit is sent to one by `id`. On the phone an account is
 * only its holder, bank and last four digits: the full number never comes back.
 */
export type PayoutMethod = StoredDestination & {
  id: string;
  /** The one "Paying into" uses. Exactly one method is the default whenever there are any. */
  isDefault: boolean;
};

/**
 * What adding a payout method sends. The account number is sent once, here, and never stored on
 * the phone. A ShapID is E.164, +27821234567, or +27821234567@fnb when bank-qualified.
 */
export type NewPayoutMethod =
  | { kind: 'shapId'; shapId: string }
  | { kind: 'account'; bankId: BankId; accountNumber: string };

export interface ResolvedShapId {
  /**
   * Masked by the scheme for POPIA reasons — typically an initial and surname ("M. Mothiba"),
   * sometimes asterisked. This is my best understanding of the scheme's masking, not verified
   * against primary documentation, and may be asterisked differently or bank-dependent. NEVER
   * a full legal name, and never something to expand, split or parse: treat as opaque display
   * text of unknown length.
   */
  shapName: string;
  bankId: BankId;
}

export interface VoucherLookup {
  voucherToken: string; // opaque handle from the server; the PIN is not needed again after lookup
  valueCents: Cents;
  feeCents: Cents;
  payoutCents: Cents;
}

export type DepositStatus = 'pending' | 'submitted' | 'completed' | 'failed';

/**
 * Phase 1 of PayShap: the ShapID is looked up in the proxy directory before any clearing
 * message exists. Nothing is reserved and nothing can be lost, so these failures must never
 * carry the "your money is safe" reassurance — saying it would imply money was ever at risk.
 * Only ever thrown by `resolveShapId`.
 */
export type IdentityFailure =
  | 'shapid_not_found'
  | 'shapid_suspended'
  | 'shapid_invalid_format'
  | 'shapid_ambiguous';

/**
 * The exhaustive member list, kept next to the type so adding a reason to the union fails to
 * compile here until it is added below too — and everything that needs every member (the wire
 * parser, copy.ts's message table, the reassurance-rule test) shares this one list rather than
 * each keeping its own, which could silently drift.
 */
export const IDENTITY_FAILURE_REASONS: Record<IdentityFailure, true> = {
  shapid_not_found: true,
  shapid_suspended: true,
  shapid_invalid_format: true,
  shapid_ambiguous: true,
};

/**
 * Phase 2 of PayShap: the payment has been dispatched and failures occur after funds were
 * committed. Settlement is irrevocable once accepted, so these failures always carry the
 * reassurance. Only ever thrown by `createDeposit` or seen on a polled `Deposit`.
 */
export type ClearingFailure =
  | 'insufficient_float'
  | 'limit_exceeded'
  | 'bank_unavailable'
  | 'bank_processing_error'
  | 'unknown';

export const CLEARING_FAILURE_REASONS: Record<ClearingFailure, true> = {
  insufficient_float: true,
  limit_exceeded: true,
  bank_unavailable: true,
  bank_processing_error: true,
  unknown: true,
};

/** The voucher switch, not the payout rail: unchanged by the ShapID migration. */
export type VoucherFailure = 'voucher_not_found' | 'voucher_already_redeemed' | 'voucher_too_small';

export const VOUCHER_FAILURE_REASONS: Record<VoucherFailure, true> = {
  voucher_not_found: true,
  voucher_already_redeemed: true,
  voucher_too_small: true,
};

/**
 * Registration, the signed-in session, and adding payout methods. Like identity failures these
 * happen before any money moves, so they never carry the reassurance. `not_registered` can come
 * back from any call that needs a user (the session on this phone was revoked or never
 * existed): register again.
 */
export type RegistrationFailure =
  | 'id_number_invalid'
  | 'id_number_under_age'
  | 'id_verification_failed'
  | 'id_number_already_registered'
  | 'invalid_registration'
  | 'registration_unavailable'
  | 'not_registered'
  | 'shapid_name_mismatch'
  | 'invalid_account'
  | 'account_not_found'
  | 'account_holder_mismatch'
  | 'accounts_unavailable'
  | 'payout_method_limit'
  | 'payout_method_not_found';

export const REGISTRATION_FAILURE_REASONS: Record<RegistrationFailure, true> = {
  id_number_invalid: true,
  id_number_under_age: true,
  id_verification_failed: true,
  id_number_already_registered: true,
  invalid_registration: true,
  registration_unavailable: true,
  not_registered: true,
  shapid_name_mismatch: true,
  invalid_account: true,
  account_not_found: true,
  account_holder_mismatch: true,
  accounts_unavailable: true,
  payout_method_limit: true,
  payout_method_not_found: true,
};

export type FailureReason = IdentityFailure | ClearingFailure | VoucherFailure | RegistrationFailure;

/**
 * What registering sends: who the user is. Where they are paid is added afterwards, as a payout
 * method. The ID number is sent once, here, and never stored on the phone.
 */
export interface Registration {
  fullNames: string;
  idNumber: string;
}

export interface RegisteredUser {
  userId: string;
  /** Opaque bearer token for every later call. Stored in SecureStore, never logged. */
  accessToken: string;
  /** As the server stored them, which is what the app shows from now on. */
  fullNames: string;
}

/**
 * One of the signed-in user's deposits as the server remembers it, for "Your deposits".
 * Unlike `Deposit` (the status poll), it carries what was sent and where.
 */
export interface DepositRecord extends Deposit {
  valueCents: Cents;
  feeCents: Cents;
  /** Epoch milliseconds. */
  createdAt: number;
  destination: StoredDestination;
}

export interface Deposit {
  id: string;
  reference: string; // human-quotable, e.g. KD-7F3A9C
  status: DepositStatus;
  payoutCents: Cents;
  /**
   * Narrower than `FailureReason`: by the time a deposit exists its destination has already
   * been resolved, so an identity failure cannot occur here — only at `resolveShapId` time.
   */
  failureReason?: ClearingFailure | VoucherFailure;
}
