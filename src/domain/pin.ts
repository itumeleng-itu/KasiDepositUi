import { extractDigits } from './digits';
import { applyGroupedEdit, type DigitGrouping, type GroupedEdit } from './groupedDigits';

export const PIN_LENGTH = 16;
const GROUP = 4;

export { extractDigits };

/** 1234567890123456 -> 1234 5678 9012 3456 (no trailing space while typing). */
export function formatPin(digits: string): string {
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += GROUP) groups.push(digits.slice(i, i + GROUP));
  return groups.join(' ');
}

/** Position in the formatted string that sits just after `digitIndex` digits. */
export function caretForDigitIndex(digitIndex: number): number {
  return digitIndex > 0 ? digitIndex + Math.floor((digitIndex - 1) / GROUP) : 0;
}

export const PIN_GROUPING: DigitGrouping = {
  maxDigits: PIN_LENGTH,
  format: formatPin,
  caretForDigitIndex,
};

export type PinParse =
  | { ok: true; pin: string }
  | { ok: false; reason: 'too_many' | 'too_few' };

/** Whole-string paste: any format, with leading/trailing text. Exactly 16 digits or nothing. */
export function normalisePin(text: string): PinParse {
  const digits = extractDigits(text);
  if (digits.length === PIN_LENGTH) return { ok: true, pin: digits };
  return { ok: false, reason: digits.length > PIN_LENGTH ? 'too_many' : 'too_few' };
}

export type PinEdit = GroupedEdit;

/** See `applyGroupedEdit`. Typing a 17th digit is ignored; a paste past 16 is rejected whole. */
export function applyPinEdit(prevDigits: string, nextText: string): PinEdit {
  return applyGroupedEdit(prevDigits, nextText, PIN_GROUPING);
}
