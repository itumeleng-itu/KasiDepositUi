/** Pure (no Expo imports) so the shape, key and index rules can be unit-tested. */
import type { ClearingFailure, Deposit, DepositRecord, DepositStatus, VoucherFailure } from '../api/types';
import { isDepositFailureReason, isDepositStatus } from '../api/wire';
import { parseStoredDestination, type StoredDestination } from '../domain/destination';
import type { Cents } from '../domain/money';

/**
 * The index is a newest-first list of deposit ids; each redemption lives under its own key.
 * One key per record keeps every SecureStore value well under the 2048-byte size it warns at,
 * which a single list of 20 records would not.
 */
export const HISTORY_INDEX_KEY = 'kd.history.v1';
const ENTRY_KEY_PREFIX = 'kd.history.v1.';
const VERSION = 1;

/** Older redemptions fall off the end: this is a receipt drawer, not a statement. */
export const HISTORY_MAX_ENTRIES = 20;

/** A deposit the user sent from this phone, with what they saw on the confirm screen. */
export interface Redemption {
  depositId: string;
  reference: string;
  /** Epoch milliseconds: when Send succeeded. */
  sentAt: number;
  valueCents: Cents;
  feeCents: Cents;
  payoutCents: Cents;
  /** Snapshotted at Send time, like the active-deposit record, so later changes don't rewrite it. */
  destination: StoredDestination;
  /** The last status this phone saw. Only as fresh as the last time a screen asked the server. */
  status: DepositStatus;
  failureReason?: ClearingFailure | VoucherFailure;
}

/**
 * SecureStore keys may only hold letters, digits, '.', '-' and '_'. Anything else in the id
 * (and '_' itself, so the mapping stays one-to-one) is written as '_' plus its hex code.
 */
export function historyEntryKey(depositId: string): string {
  const safe = depositId.replace(/[^A-Za-z0-9.-]/g, (c) => `_${c.charCodeAt(0).toString(16)}_`);
  return `${ENTRY_KEY_PREFIX}${safe}`;
}

export function serialiseRedemption(redemption: Redemption): string {
  const { destination } = redemption;
  // Only the describable fields: a saved-destination record also carries bookkeeping times.
  const snapshot: StoredDestination =
    destination.kind === 'shapId'
      ? { kind: 'shapId', shapId: destination.shapId, shapName: destination.shapName, bankId: destination.bankId }
      : { kind: 'account', name: destination.name, accountLast4: destination.accountLast4, bankId: destination.bankId };
  return JSON.stringify({ version: VERSION, ...redemption, destination: snapshot });
}

function isCents(value: unknown): value is Cents {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Returns null for anything that is not exactly a valid, current-version record. */
export function parseRedemption(raw: string): Redemption | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;

  if (record.version !== VERSION) return null;
  const { depositId, reference, sentAt, valueCents, feeCents, payoutCents, status, failureReason } =
    record;
  if (typeof depositId !== 'string' || depositId.length === 0) return null;
  if (typeof reference !== 'string' || reference.length === 0) return null;
  if (typeof sentAt !== 'number' || !Number.isFinite(sentAt)) return null;
  if (!isCents(valueCents) || !isCents(feeCents) || !isCents(payoutCents)) return null;
  if (!isDepositStatus(status)) return null;
  if (failureReason !== undefined && !isDepositFailureReason(failureReason)) return null;

  const destination = parseStoredDestination(record.destination);
  if (destination === null) return null;

  return {
    depositId,
    reference,
    sentAt,
    valueCents,
    feeCents,
    payoutCents,
    destination,
    status,
    ...(failureReason !== undefined ? { failureReason } : {}),
  };
}

/** The saved index, or an empty one if it is missing or unreadable. */
export function parseHistoryIndex(raw: string | null): string[] {
  if (raw === null) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

export function serialiseHistoryIndex(ids: readonly string[]): string {
  return JSON.stringify(ids);
}

/**
 * Puts `depositId` first (moving it if it is already there) and trims to the cap. `evicted`
 * are the ids that fell off the end, whose entries should be deleted.
 */
export function addToHistoryIndex(
  ids: readonly string[],
  depositId: string,
  max: number = HISTORY_MAX_ENTRIES,
): { ids: string[]; evicted: string[] } {
  const next = [depositId, ...ids.filter((id) => id !== depositId)];
  return { ids: next.slice(0, max), evicted: next.slice(max) };
}

/** The record with the server's latest word on it. Unchanged if nothing the user sees moved. */
export function withLatestStatus(redemption: Redemption, latest: Deposit): Redemption {
  if (redemption.status === latest.status && redemption.failureReason === latest.failureReason) {
    return redemption;
  }
  const { failureReason: _previous, ...rest } = redemption;
  return {
    ...rest,
    status: latest.status,
    ...(latest.failureReason !== undefined ? { failureReason: latest.failureReason } : {}),
  };
}

/** A deposit as the server remembers it, in the shape this phone stores. */
export function fromDepositRecord(record: DepositRecord): Redemption {
  return {
    depositId: record.id,
    reference: record.reference,
    sentAt: record.createdAt,
    valueCents: record.valueCents,
    feeCents: record.feeCents,
    payoutCents: record.payoutCents,
    destination: record.destination,
    status: record.status,
    ...(record.failureReason !== undefined ? { failureReason: record.failureReason } : {}),
  };
}

/**
 * One list from what this phone saved and what the server returned: the server's copy wins
 * for a deposit both know (it has the latest status); deposits only this phone knows (sent
 * before registering, or not yet listed) are kept. Newest first, trimmed to the cap.
 */
export function mergeHistory(
  local: readonly Redemption[],
  server: readonly Redemption[],
  max: number = HISTORY_MAX_ENTRIES,
): Redemption[] {
  const byId = new Map<string, Redemption>();
  for (const r of local) byId.set(r.depositId, r);
  for (const r of server) byId.set(r.depositId, r);
  return [...byId.values()].sort((a, b) => b.sentAt - a.sentAt).slice(0, max);
}
