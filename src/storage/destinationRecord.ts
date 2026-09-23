/** Pure (no Expo imports) so the shape and version rules can be unit-tested. */
import { parseStoredDestination, type StoredDestination } from '../domain/destination';

export const DESTINATION_KEY = 'kd.destination.v2';
const VERSION = 2;

// An intersection, not `interface ... extends`: StoredDestination is a union, and an interface
// cannot extend one.
export type StoredDestinationRecord = StoredDestination & {
  /** Epoch milliseconds: when `resolveShapId` (or, for the account kind, saving) succeeded. */
  resolvedAt: number;
  /** Epoch milliseconds: when it was saved. Same as resolvedAt unless re-saved without re-resolving. */
  savedAt: number;
};

export function serialiseDestination(
  destination: StoredDestination,
  resolvedAt: number,
  savedAt: number,
): string {
  return JSON.stringify({ version: VERSION, ...destination, resolvedAt, savedAt });
}

/** Returns null for anything that is not exactly a valid, current-version record. */
export function parseDestination(raw: string): StoredDestinationRecord | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;

  if (record.version !== VERSION) return null;

  const destination = parseStoredDestination(record);
  if (destination === null) return null;

  const { resolvedAt, savedAt } = record;
  if (typeof resolvedAt !== 'number' || !Number.isFinite(resolvedAt)) return null;
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null;

  return { ...destination, resolvedAt, savedAt };
}
