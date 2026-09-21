/** Pure (no Expo imports) so the shape and expiry rules can be unit-tested. */
import { isBankId, type BankId } from '../domain/banks';

export const ACTIVE_DEPOSIT_KEY = 'kd.activeDeposit.v1';
const VERSION = 1;

/** Entries older than this are ignored: a deposit is long finished by then. */
export const ACTIVE_DEPOSIT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface ActiveDeposit {
  depositId: string;
  reference: string;
  /** Epoch milliseconds. The status screen measures its polling schedule from here. */
  startedAt: number;
  /**
   * Where the money went, so the status screen can say "Paid into ••••4417 at Capitec" even
   * if the saved details change or the app was reopened cold with only this record.
   */
  bankId: BankId;
  accountLast4: string;
}

export function serialiseActiveDeposit(deposit: ActiveDeposit): string {
  return JSON.stringify({ version: VERSION, ...deposit });
}

export type ActiveDepositParse =
  | { kind: 'valid'; deposit: ActiveDeposit }
  | { kind: 'expired' }
  | { kind: 'invalid' };

export function parseActiveDeposit(raw: string, now: number): ActiveDepositParse {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { kind: 'invalid' };
  }
  if (typeof data !== 'object' || data === null) return { kind: 'invalid' };
  const record = data as Record<string, unknown>;

  if (record.version !== VERSION) return { kind: 'invalid' };
  const { depositId, reference, startedAt, bankId, accountLast4 } = record;
  if (typeof depositId !== 'string' || depositId.length === 0) return { kind: 'invalid' };
  if (typeof reference !== 'string' || reference.length === 0) return { kind: 'invalid' };
  if (typeof startedAt !== 'number' || !Number.isFinite(startedAt)) return { kind: 'invalid' };
  if (!isBankId(bankId)) return { kind: 'invalid' };
  if (typeof accountLast4 !== 'string' || !/^\d{1,4}$/.test(accountLast4)) {
    return { kind: 'invalid' };
  }

  if (now - startedAt > ACTIVE_DEPOSIT_MAX_AGE_MS) return { kind: 'expired' };
  return { kind: 'valid', deposit: { depositId, reference, startedAt, bankId, accountLast4 } };
}
