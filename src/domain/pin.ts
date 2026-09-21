export const PIN_LENGTH = 16;
const GROUP = 4;

export function extractDigits(text: string): string {
  return text.replace(/\D/g, '');
}

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

export type PinParse =
  | { ok: true; pin: string }
  | { ok: false; reason: 'too_many' | 'too_few' };

/** Whole-string paste: any format, with leading/trailing text. Exactly 16 digits or nothing. */
export function normalisePin(text: string): PinParse {
  const digits = extractDigits(text);
  if (digits.length === PIN_LENGTH) return { ok: true, pin: digits };
  return { ok: false, reason: digits.length > PIN_LENGTH ? 'too_many' : 'too_few' };
}

export interface PinEdit {
  digits: string;
  /** Caret position in `formatPin(digits)`. */
  caret: number;
  /** A paste that would have made the PIN longer than 16 digits; nothing was taken. */
  pasteRejected: boolean;
}

function countDigits(text: string): number {
  return extractDigits(text).length;
}

/**
 * Turn what the TextInput now contains into new PIN digits plus a caret.
 *
 * The input shows a grouped value, so we diff it against what we last rendered to see what the
 * user actually did: typed, deleted, or pasted. This keeps editing in the middle working and
 * stops a backspace over a group's space from being a no-op.
 */
export function applyPinEdit(prevDigits: string, nextText: string): PinEdit {
  const prevText = formatPin(prevDigits);

  let prefix = 0;
  const maxPrefix = Math.min(prevText.length, nextText.length);
  while (prefix < maxPrefix && prevText[prefix] === nextText[prefix]) prefix++;

  let suffix = 0;
  const maxSuffix = Math.min(prevText.length, nextText.length) - prefix;
  while (
    suffix < maxSuffix &&
    prevText[prevText.length - 1 - suffix] === nextText[nextText.length - 1 - suffix]
  ) {
    suffix++;
  }

  const removed = prevText.slice(prefix, prevText.length - suffix);
  const inserted = nextText.slice(prefix, nextText.length - suffix);

  let start = countDigits(prevText.slice(0, prefix));
  let removedDigits = countDigits(removed);
  const insertedDigits = extractDigits(inserted);

  // Only a group separator was deleted: treat it as deleting the digit before it.
  if (removed.length > 0 && removedDigits === 0 && inserted.length === 0 && start > 0) {
    start -= 1;
    removedDigits = 1;
  }

  const digits = prevDigits.slice(0, start) + insertedDigits + prevDigits.slice(start + removedDigits);

  if (digits.length > PIN_LENGTH) {
    return {
      digits: prevDigits,
      caret: caretForDigitIndex(Math.min(start + removedDigits, prevDigits.length)),
      // One extra typed digit is ignored quietly; a multi-digit change is a paste.
      pasteRejected: insertedDigits.length > 1,
    };
  }

  return {
    digits,
    caret: caretForDigitIndex(start + insertedDigits.length),
    pasteRejected: false,
  };
}
