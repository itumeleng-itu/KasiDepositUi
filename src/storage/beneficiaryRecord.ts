/** Pure (no Expo imports) so the shape rules can be unit-tested. */
import type { Beneficiary } from '../api/types';
import { validateAccountNumber } from '../domain/account';
import { isBankId } from '../domain/banks';
import { validateName } from '../domain/name';

export const BENEFICIARY_KEY = 'kd.beneficiary.v1';
const VERSION = 1;

export interface StoredBeneficiary extends Beneficiary {
  /** Epoch milliseconds. */
  savedAt: number;
}

export function serialiseBeneficiary(beneficiary: Beneficiary, savedAt: number): string {
  return JSON.stringify({
    version: VERSION,
    name: beneficiary.name,
    accountNumber: beneficiary.accountNumber,
    bankId: beneficiary.bankId,
    savedAt,
  });
}

/** Returns null for anything that is not exactly a valid, current-version record. */
export function parseBeneficiary(raw: string): StoredBeneficiary | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;

  if (record.version !== VERSION) return null;
  const { name, accountNumber, bankId, savedAt } = record;
  if (typeof name !== 'string' || validateName(name) !== null) return null;
  if (
    typeof accountNumber !== 'string' ||
    !/^\d+$/.test(accountNumber) ||
    validateAccountNumber(accountNumber) !== null
  ) {
    return null;
  }
  if (!isBankId(bankId)) return null;
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null;

  return { name, accountNumber, bankId, savedAt };
}
