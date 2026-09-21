export const ACCOUNT_MIN = 7;
export const ACCOUNT_MAX = 11;

export type AccountError = 'required' | 'too_short' | 'too_long';

/** Strip every non-digit, so spaces, dashes and pasted text all work. */
export function normaliseAccountNumber(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function validateAccountNumber(raw: string): AccountError | null {
  const digits = normaliseAccountNumber(raw);
  if (digits.length === 0) return 'required';
  if (digits.length < ACCOUNT_MIN) return 'too_short';
  if (digits.length > ACCOUNT_MAX) return 'too_long';
  return null;
}

/** Display grouping only: first four digits, then groups of three. 1234567890 -> 1234 567 890 */
export function formatAccountNumber(digits: string): string {
  const groups: string[] = [];
  if (digits.length > 0) groups.push(digits.slice(0, 4));
  for (let i = 4; i < digits.length; i += 3) groups.push(digits.slice(i, i + 3));
  return groups.join(' ');
}

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
