import type { BankId } from '../domain/banks';
import type { StoredDestination } from '../domain/destination';
import type { Cents } from '../domain/money';

export type { BankId, Cents };

/**
 * What `createDeposit` is told to pay. The ShapID kind carries only the pointer, not the name
 * resolution learned from it during setup (that lives in `StoredDestination`, domain/destination.ts).
 * Stored and transmitted in E.164: +27821234567, or +27821234567@fnb when bank-qualified.
 *
 * The `account` branch is never constructed by any screen today — every documented South
 * African payout API (Peach Payouts, Stitch Disbursements) addresses by account number and
 * universal branch code and none exposes proxy payout, so a real provider may force this
 * fallback. It is kept alive as a config change rather than something to rebuild later.
 */
export type Destination =
  | { kind: 'shapId'; shapId: string }
  | { kind: 'account'; name: string; accountNumber: string; bankId: BankId };

/**
 * What a stored, resolved destination becomes on the wire: drops `shapName` (the server already
 * knows it — it is what resolved it) and the storage bookkeeping fields (resolvedAt, savedAt).
 */
export function toApiDestination(stored: StoredDestination): Destination {
  return stored.kind === 'shapId'
    ? { kind: 'shapId', shapId: stored.shapId }
    : { kind: 'account', name: stored.name, accountNumber: stored.accountNumber, bankId: stored.bankId };
}

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
 * Registration and the signed-in session. Like identity failures these happen before any money
 * moves, so they never carry the reassurance. `not_registered` can come back from any call that
 * needs a user (the session on this phone was revoked or never existed): register again.
 */
export type RegistrationFailure =
  | 'id_number_invalid'
  | 'id_number_under_age'
  | 'id_verification_failed'
  | 'id_number_already_registered'
  | 'shapid_name_mismatch'
  | 'not_registered';

export const REGISTRATION_FAILURE_REASONS: Record<RegistrationFailure, true> = {
  id_number_invalid: true,
  id_number_under_age: true,
  id_verification_failed: true,
  id_number_already_registered: true,
  shapid_name_mismatch: true,
  not_registered: true,
};

export type FailureReason = IdentityFailure | ClearingFailure | VoucherFailure | RegistrationFailure;

/**
 * What registering sends. The ID number is sent once, here, and never stored on the phone. The
 * ShapID has already been resolved and confirmed by the user ("Is this you?") before this call.
 */
export interface Registration {
  fullNames: string;
  idNumber: string;
  shapId: string;
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
