/** Pure (no Expo imports) so the shape and version rules can be unit-tested. */
import type { PayoutMethod } from '../api/types';
import { parseStoredDestination } from '../domain/destination';

/**
 * The phone's copy of the user's payout methods, so "Paying into" shows instantly and offline.
 * The server's list is the truth; this is replaced whenever the server answers. Holds no full
 * account number (only the last four digits), so it gives nothing away if the phone is lost.
 */
export const PAYOUT_METHODS_KEY = 'kd.payoutMethods.v1';
const VERSION = 1;

/** Keys from before payout methods: one saved destination. Removed, never migrated. */
export const LEGACY_DESTINATION_KEYS = ['kd.destination.v2', 'kd.beneficiary.v1'];

export function serialisePayoutMethods(methods: readonly PayoutMethod[]): string {
  return JSON.stringify({ version: VERSION, methods });
}

function parseMethod(value: unknown): PayoutMethod | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const { id, isDefault } = record;
  if (typeof id !== 'string' || id.length === 0 || typeof isDefault !== 'boolean') return null;
  const destination = parseStoredDestination(record);
  return destination === null ? null : { ...destination, id, isDefault };
}

/** Unreadable entries are dropped; an unreadable record is an empty list. */
export function parsePayoutMethods(raw: string): PayoutMethod[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (typeof data !== 'object' || data === null) return [];
  const record = data as Record<string, unknown>;
  if (record.version !== VERSION || !Array.isArray(record.methods)) return [];
  return record.methods.map(parseMethod).filter((m): m is PayoutMethod => m !== null);
}

/** The one "Paying into" uses: the default, or failing that the first. */
export function defaultMethod(methods: readonly PayoutMethod[]): PayoutMethod | null {
  return methods.find((m) => m.isDefault) ?? methods[0] ?? null;
}
