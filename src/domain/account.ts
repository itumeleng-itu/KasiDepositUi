import { extractDigits } from './digits';
import type { DigitGrouping } from './groupedDigits';

export const ACCOUNT_MIN = 7;
export const ACCOUNT_MAX = 11;
/**
 * How many digits the field accepts. More than ACCOUNT_MAX so a too-long paste shows the
 * "at most 11 digits" error instead of being silently cut.
 */
export const ACCOUNT_INPUT_MAX = 20;

export type AccountError = 'required' | 'too_short' | 'too_long';

/** Strip every non-digit, so spaces, dashes and pasted text all work. */
export function normaliseAccountNumber(raw: string): string {
  return extractDigits(raw);
}

export function validateAccountNumber(raw: string): AccountError | null {
  const digits = normaliseAccountNumber(raw);
  if (digits.length === 0) return 'required';
  if (digits.length < ACCOUNT_MIN) return 'too_short';
  if (digits.length > ACCOUNT_MAX) return 'too_long';
  return null;
}

const FIRST_GROUP = 4;
const NEXT_GROUP = 3;

/** Display grouping only: first four digits, then groups of three. 1234567890 -> 1234 567 890 */
export function formatAccountNumber(digits: string): string {
  const groups: string[] = [];
  if (digits.length > 0) groups.push(digits.slice(0, FIRST_GROUP));
  for (let i = FIRST_GROUP; i < digits.length; i += NEXT_GROUP) {
    groups.push(digits.slice(i, i + NEXT_GROUP));
  }
  return groups.join(' ');
}

function caretForDigitIndex(digitIndex: number): number {
  if (digitIndex <= FIRST_GROUP) return digitIndex;
  return digitIndex + Math.ceil((digitIndex - FIRST_GROUP) / NEXT_GROUP);
}

export const ACCOUNT_GROUPING: DigitGrouping = {
  maxDigits: ACCOUNT_INPUT_MAX,
  format: formatAccountNumber,
  caretForDigitIndex,
};

export function lastFour(digits: string): string {
  return digits.slice(-4);
}

/** ••••4417. Used everywhere except the setup field itself. */
export function maskAccountNumber(digits: string): string {
  return `••••${lastFour(digits)}`;
}

export function accountNumbersMatch(a: string, b: string): boolean {
  return normaliseAccountNumber(a) === normaliseAccountNumber(b);
}
