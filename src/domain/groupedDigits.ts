import { extractDigits } from './digits';

/** How a run of digits is displayed: the separators, and how many digits are allowed. */
export interface DigitGrouping {
  maxDigits: number;
  format(digits: string): string;
  /** Position in `format(digits)` that sits just after `digitIndex` digits. */
  caretForDigitIndex(digitIndex: number): number;
}

export interface GroupedEdit {
  digits: string;
  /** Caret position in `grouping.format(digits)`. */
  caret: number;
  /** A multi-digit change (paste) that would have exceeded `maxDigits`; nothing was taken. */
  pasteRejected: boolean;
}

function countDigits(text: string): number {
  return extractDigits(text).length;
}

/**
 * Turn what a TextInput now contains into new digits plus a caret.
 *
 * The input shows a grouped value ("1234 5678"), so we diff it against what we last rendered to
 * see what the user did: typed, deleted, or pasted. That keeps editing in the middle working and
 * stops backspace over a separator from being a no-op.
 */
export function applyGroupedEdit(
  prevDigits: string,
  nextText: string,
  grouping: DigitGrouping,
): GroupedEdit {
  const prevText = grouping.format(prevDigits);

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

  // Only a separator was deleted: treat it as deleting the digit before it.
  if (removed.length > 0 && removedDigits === 0 && inserted.length === 0 && start > 0) {
    start -= 1;
    removedDigits = 1;
  }

  const digits = prevDigits.slice(0, start) + insertedDigits + prevDigits.slice(start + removedDigits);

  if (digits.length > grouping.maxDigits) {
    return {
      digits: prevDigits,
      caret: grouping.caretForDigitIndex(Math.min(start + removedDigits, prevDigits.length)),
      // One extra typed digit is ignored quietly; a multi-digit change is a paste.
      pasteRejected: insertedDigits.length > 1,
    };
  }

  return {
    digits,
    caret: grouping.caretForDigitIndex(start + insertedDigits.length),
    pasteRejected: false,
  };
}
