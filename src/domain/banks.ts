export type BankId =
  | 'capitec'
  | 'fnb'
  | 'standard_bank'
  | 'absa'
  | 'nedbank'
  | 'tymebank'
  | 'african_bank'
  | 'discovery_bank'
  | 'bank_zero'
  | 'investec';

export interface Bank {
  id: BankId;
  /** Proper noun, shown as-is in every language. */
  name: string;
}

/** Display order. The slug is internal; the API layer maps it to the provider's enum. */
export const BANKS: readonly Bank[] = [
  { id: 'capitec', name: 'Capitec' },
  { id: 'fnb', name: 'FNB' },
  { id: 'standard_bank', name: 'Standard Bank' },
  { id: 'absa', name: 'Absa' },
  { id: 'nedbank', name: 'Nedbank' },
  { id: 'tymebank', name: 'TymeBank' },
  { id: 'african_bank', name: 'African Bank' },
  { id: 'discovery_bank', name: 'Discovery Bank' },
  { id: 'bank_zero', name: 'Bank Zero' },
  { id: 'investec', name: 'Investec' },
];

/**
 * The four most-used banks, shown as rows on the bank-account screen. Every other bank is found
 * by its branch code, so the list never grows long enough to overwhelm.
 */
export const POPULAR_BANK_IDS: readonly BankId[] = ['capitec', 'fnb', 'absa', 'standard_bank'];

export function isBankId(value: unknown): value is BankId {
  return typeof value === 'string' && BANKS.some((bank) => bank.id === value);
}

export function bankName(id: BankId): string {
  const bank = BANKS.find((b) => b.id === id);
  // BankId is a closed union, so this only fails if BANKS and BankId drift apart.
  if (!bank) throw new Error(`Unknown bank id: ${id}`);
  return bank.name;
}
