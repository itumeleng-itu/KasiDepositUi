/** Pure (no Expo imports) so the shape and expiry rules can be unit-tested. */
import { parseStoredDestination, type StoredDestination } from '../domain/destination';

export const ACTIVE_DEPOSIT_KEY = 'kd.activeDeposit.v2';
const VERSION = 2;

/** Entries older than this are ignored: a deposit is long finished by then. */
export const ACTIVE_DEPOSIT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface ActiveDeposit {
  depositId: string;
  reference: string;
  /** Epoch milliseconds. The status screen measures its polling schedule from here. */
  startedAt: number;
  /**
   * The resolved destination the deposit was actually sent to, snapshotted at Send time — so
   * the status screen can describe it correctly even if the saved destination changes, or the
   * app is reopened cold with only this record. The same `StoredDestination` shape (and the
   * same validator) as the destination record, so the two cannot drift on what counts as valid.
   */
  destination: StoredDestination;
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
  const { depositId, reference, startedAt, destination } = record;
  if (typeof depositId !== 'string' || depositId.length === 0) return { kind: 'invalid' };
  if (typeof reference !== 'string' || reference.length === 0) return { kind: 'invalid' };
  if (typeof startedAt !== 'number' || !Number.isFinite(startedAt)) return { kind: 'invalid' };

  const parsedDestination = parseStoredDestination(destination);
  if (parsedDestination === null) return { kind: 'invalid' };

  if (now - startedAt > ACTIVE_DEPOSIT_MAX_AGE_MS) return { kind: 'expired' };
  return {
    kind: 'valid',
    deposit: { depositId, reference, startedAt, destination: parsedDestination },
  };
}
