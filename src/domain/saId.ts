/**
 * South African ID numbers: YYMMDD SSSS C A Z.
 *
 *   YYMMDD  date of birth
 *   SSSS    sequence (0000-4999 female, 5000-9999 male) — not checked, and never shown
 *   C       0 citizen, 1 permanent resident, 2 refugee
 *   A       historically a race digit, now 8 or 9 — not checked (older IDs vary)
 *   Z       Luhn check digit over the first 12 digits
 *
 * This only proves the number is well formed. Whether it belongs to a real, living person
 * with these names is for the backend to verify with Home Affairs.
 */

export const SA_ID_LENGTH = 13;

/** A service that moves money: the account holder must be an adult. */
export const MIN_AGE_YEARS = 18;

export type SaIdError =
  | 'empty'
  | 'length'
  | 'digits'
  | 'birth_date'
  | 'citizenship'
  | 'checksum'
  | 'under_age';

export type SaIdParse =
  | { ok: true; idNumber: string; dateOfBirth: { year: number; month: number; day: number } }
  | { ok: false; reason: SaIdError };

/** Spaces, hyphens and the invisible characters a paste can carry. */
const FILLER_PATTERN = /[\s\-​‌‍﻿]/g;

export function normaliseSaId(raw: string): string {
  return raw.replace(FILLER_PATTERN, '');
}

/** Luhn over all 13 digits, check digit included: valid when the total is a multiple of 10. */
export function hasValidSaIdChecksum(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Whole years between the birth date and `now`, in UTC. */
function ageOn(dob: { year: number; month: number; day: number }, now: Date): number {
  let age = now.getUTCFullYear() - dob.year;
  const beforeBirthday =
    now.getUTCMonth() + 1 < dob.month ||
    (now.getUTCMonth() + 1 === dob.month && now.getUTCDate() < dob.day);
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * Never throws. The century is not in the number: a two-digit year that would put the birth
 * date in the future belongs to the 1900s, anything else to the 2000s.
 */
export function parseSaId(raw: string, now: Date = new Date()): SaIdParse {
  const idNumber = normaliseSaId(raw);
  if (idNumber.length === 0) return { ok: false, reason: 'empty' };
  if (!/^\d+$/.test(idNumber)) return { ok: false, reason: 'digits' };
  if (idNumber.length !== SA_ID_LENGTH) return { ok: false, reason: 'length' };

  const yy = Number(idNumber.slice(0, 2));
  const month = Number(idNumber.slice(2, 4));
  const day = Number(idNumber.slice(4, 6));
  const thisYear = now.getUTCFullYear();
  let year = 2000 + yy;
  if (year > thisYear) year -= 100;
  if (!isRealDate(year, month, day)) return { ok: false, reason: 'birth_date' };
  const dateOfBirth = { year, month, day };
  if (Date.UTC(year, month - 1, day) > now.getTime()) {
    // Only reachable in the current year: a date later this year is the 1900s.
    dateOfBirth.year -= 100;
    if (!isRealDate(dateOfBirth.year, month, day)) return { ok: false, reason: 'birth_date' };
  }

  if (!['0', '1', '2'].includes(idNumber[10])) return { ok: false, reason: 'citizenship' };
  if (!hasValidSaIdChecksum(idNumber)) return { ok: false, reason: 'checksum' };
  if (ageOn(dateOfBirth, now) < MIN_AGE_YEARS) return { ok: false, reason: 'under_age' };

  return { ok: true, idNumber, dateOfBirth };
}

/** "8001015009087" -> "800101 5009 08 7": the grouping printed in the green book and smart card. */
export function groupSaId(idNumber: string): string {
  const d = normaliseSaId(idNumber);
  return [d.slice(0, 6), d.slice(6, 10), d.slice(10, 12), d.slice(12)].filter(Boolean).join(' ');
}
