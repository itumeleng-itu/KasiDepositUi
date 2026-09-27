import type { DigitGrouping } from './groupedDigits';

/** South African branch codes, including every bank's universal one, are six digits. */
export const BRANCH_CODE_LENGTH = 6;

export const BRANCH_CODE_GROUPING: DigitGrouping = {
  maxDigits: BRANCH_CODE_LENGTH,
  format: (digits) => digits,
  caretForDigitIndex: (digitIndex) => digitIndex,
};

export function isCompleteBranchCode(digits: string): boolean {
  return /^\d+$/.test(digits) && digits.length === BRANCH_CODE_LENGTH;
}
