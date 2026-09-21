import type { BankId } from '../domain/banks';
import type { Cents } from '../domain/money';

export type { BankId, Cents };

export interface Beneficiary {
  name: string;
  accountNumber: string; // digits only
  bankId: BankId;
}

export interface VoucherLookup {
  voucherToken: string; // opaque handle from the server; the PIN is not needed again after lookup
  valueCents: Cents;
  feeCents: Cents;
  payoutCents: Cents;
}

export type DepositStatus = 'pending' | 'submitted' | 'completed' | 'failed';

export type FailureReason =
  | 'voucher_not_found'
  | 'voucher_already_redeemed'
  | 'voucher_too_small'
  | 'invalid_account'
  | 'inactive_account'
  | 'bank_processing_error'
  | 'insufficient_float'
  | 'unknown';

export interface Deposit {
  id: string;
  reference: string; // human-quotable, e.g. KD-7F3A9C
  status: DepositStatus;
  payoutCents: Cents;
  failureReason?: FailureReason;
}
