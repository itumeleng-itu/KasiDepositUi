import { maskAccountNumber } from './account';
import { bankName, type BankId } from './banks';
import { displayShapId, maskedShapId } from './shapId';

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
}

/** No screen branches on `kind` directly: it asks this instead. */
export function describeDestination(d: StoredDestination): DestinationDescription {
  const bank = bankName(d.bankId);
  if (d.kind === 'shapId') {
    return {
      primary: d.shapName,
      secondary: `${bank} · ${maskedShapId(d.shapId)}`,
      oneLine: `${displayShapId(d.shapId)} · ${bank}`,
    };
  }
  const masked = maskAccountNumber(d.accountNumber);
  return {
    primary: d.name,
    secondary: `${bank} · ${masked}`,
    oneLine: `${masked} · ${bank}`,
  };
}
