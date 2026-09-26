import { isBankId, type BankId } from './banks';

export type ShapIdFormatReason = 'empty' | 'format' | 'unknown_bank';

export type ParseResult =
  | { ok: true; shapId: string; bank: BankId | null }
  | { ok: false; reason: ShapIdFormatReason };

/**
 * Characters that appear when someone pastes a number from WhatsApp, a contact card or a web
 * page: regular spaces, hyphens, en dashes, round brackets, non-breaking spaces, and the
 * zero-width characters some keyboards and copy sources insert invisibly.
 */
const FILLER_PATTERN = /[ \-–() ​‌‍﻿]/g;

function stripFiller(input: string): string {
  return input.replace(FILLER_PATTERN, '');
}

const MOBILE_PREFIXES = ['06', '07', '08'];

/**
 * '27821234567' or '+27821234567' -> '0821234567'. Not digits-with-optional-leading-plus -> null.
 *
 * The leading "27" is *replaced* by a single "0" rather than simply dropped, so a redundant
 * trunk zero after the country code ("+27 (0)82 123 4567", cleaned to "270821234567") produces
 * 11 digits instead of 10 and is rejected by the length check below rather than silently
 * repaired into a valid number.
 */
function toLocalDigits(numberPart: string): string | null {
  if (!/^\+?\d+$/.test(numberPart)) return null;
  let digits = numberPart.startsWith('+') ? numberPart.slice(1) : numberPart;
  if (digits.startsWith('27')) digits = '0' + digits.slice(2);
  return digits;
}

function isValidLocalMobile(digits: string): boolean {
  return digits.length === 10 && MOBILE_PREFIXES.includes(digits.slice(0, 2));
}

/** Never throws. The ShapID is stored and transmitted in this form: E.164, optionally @bank. */
export function parseShapId(input: string): ParseResult {
  const cleaned = stripFiller(input);
  if (cleaned.length === 0) return { ok: false, reason: 'empty' };

  const parts = cleaned.split('@');
  if (parts.length > 2) return { ok: false, reason: 'format' };
  const [numberPart, suffixPart] = parts;

  const localDigits = numberPart.length > 0 ? toLocalDigits(numberPart) : null;
  if (localDigits === null || !isValidLocalMobile(localDigits)) {
    return { ok: false, reason: 'format' };
  }

  const e164 = `+27${localDigits.slice(1)}`;
  if (parts.length === 1) return { ok: true, shapId: e164, bank: null };

  // @suffix is case-insensitive: @fnb, @FNB and @Fnb are the same pointer.
  const bank = suffixPart.toLowerCase();
  if (!isBankId(bank)) return { ok: false, reason: 'unknown_bank' };
  return { ok: true, shapId: `${e164}@${bank}`, bank };
}

/** Stored E.164 (with or without @suffix) -> local digits, e.g. "+27821234567" -> "0821234567". */
function toLocal(shapId: string): string {
  const [numberPart] = shapId.split('@');
  return '0' + numberPart.replace(/^\+27/, '');
}

function groupLocal(local: string): string {
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

/** "+27821234567" (with any @suffix dropped) -> "082 123 4567". */
export function displayShapId(shapId: string): string {
  return groupLocal(toLocal(shapId));
}

/** "+27821234567" -> "••• ••• 4567". Only the last 4 digits are ever shown. */
export function maskedShapId(shapId: string): string {
  return `••• ••• ${toLocal(shapId).slice(-4)}`;
}

export function bankSuffixOf(shapId: string): BankId | null {
  const at = shapId.indexOf('@');
  if (at === -1) return null;
  const suffix = shapId.slice(at + 1).toLowerCase();
  return isBankId(suffix) ? suffix : null;
}

/** Appends `@bank`, replacing any suffix the ShapID already carries. */
export function withBankSuffix(shapId: string, bank: BankId): string {
  const [numberPart] = shapId.split('@');
  return `${numberPart}@${bank}`;
}
