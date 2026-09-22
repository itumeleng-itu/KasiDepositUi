import type { BankId } from '../domain/banks';
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

export type FailureReason = IdentityFailure | ClearingFailure | VoucherFailure;

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
