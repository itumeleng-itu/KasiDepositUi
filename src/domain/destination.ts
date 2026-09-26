import { lastFour, maskAccountNumber, validateAccountNumber } from './account';
import { bankName, isBankId, type BankId } from './banks';
import { validateName } from './name';
import { displayShapId, maskedShapId, parseShapId } from './shapId';

/**
 * A resolved, describable destination — what is actually saved and shown, as opposed to the
 * wire-level `Destination` in `src/api/types.ts` (used for `createDeposit`), which for the
 * ShapID kind carries only the pointer, not the name resolution learned from it.
 */
export type StoredDestination =
  | { kind: 'shapId'; shapId: string; shapName: string; bankId: BankId }
  | { kind: 'account'; name: string; accountNumber: string; bankId: BankId };

export interface DestinationDescription {
  /** The name to show first: the scheme-masked name, or the account holder's name. */
  primary: string;
  /** "Capitec · ••• ••• 4567" | "Capitec · ••••4417" */
  secondary: string;
  /** "082 123 4567 · Capitec" | "••••4417 · Capitec" */
  oneLine: string;
  /** What a screen reader says instead of `oneLine`: never reads the mask bullets aloud. */
  spokenOneLine: string;
}

/** Just the masked number, with no bank name attached — composes into any phrasing a screen wants. */
export function maskedIdentifier(d: StoredDestination): string {
  return d.kind === 'shapId' ? maskedShapId(d.shapId) : maskAccountNumber(d.accountNumber);
}

/**
 * Validates an unknown value as a `StoredDestination` of either kind. Shared by the destination
 * record (the saved, current destination) and the active-deposit record (a snapshot of the
 * destination a specific deposit was actually sent to), so the two storage layers cannot drift
 * on what counts as a valid destination.
 */
export function parseStoredDestination(value: unknown): StoredDestination | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;

  if (record.kind === 'shapId') {
    const { shapId, shapName, bankId } = record;
    if (typeof shapId !== 'string') return null;
    // Re-parsing must reproduce the stored value exactly: anything stored was already
    // canonicalised by parseShapId, so a mismatch means the record was tampered with or corrupt.
    const parsed = parseShapId(shapId);
    if (!parsed.ok || parsed.shapId !== shapId) return null;
    if (typeof shapName !== 'string' || shapName.length === 0) return null;
    if (!isBankId(bankId)) return null;
    return { kind: 'shapId', shapId, shapName, bankId };
  }

  if (record.kind === 'account') {
    const { name, accountNumber, bankId } = record;
    if (typeof name !== 'string' || validateName(name) !== null) return null;
    if (
      typeof accountNumber !== 'string' ||
      !/^\d+$/.test(accountNumber) ||
      validateAccountNumber(accountNumber) !== null
    ) {
      return null;
    }
    if (!isBankId(bankId)) return null;
    return { kind: 'account', name, accountNumber, bankId };
  }

  return null;
}

/** No screen branches on `kind` directly: it asks this instead. */
export function describeDestination(d: StoredDestination): DestinationDescription {
  const bank = bankName(d.bankId);
  if (d.kind === 'shapId') {
    const local = displayShapId(d.shapId);
    return {
      primary: d.shapName,
      secondary: `${bank} · ${maskedShapId(d.shapId)}`,
      oneLine: `${local} · ${bank}`,
      spokenOneLine: `${local} at ${bank}`,
    };
  }
  const masked = maskAccountNumber(d.accountNumber);
  return {
    primary: d.name,
    secondary: `${bank} · ${masked}`,
    oneLine: `${masked} · ${bank}`,
    spokenOneLine: `account ending ${lastFour(d.accountNumber)} at ${bank}`,
  };
}
