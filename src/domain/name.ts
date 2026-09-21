export const NAME_MIN = 2;
export const NAME_MAX = 60;

export type NameError = 'required' | 'too_short' | 'too_long' | 'invalid_chars';

/** Trim, and collapse any internal run of whitespace to one space. */
export function normaliseName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

// Letters (including accented, and combining marks from decomposed accents), then letters,
// spaces, hyphens and apostrophes (straight or curly). Must start with a letter.
const NAME_PATTERN = /^[\p{L}][\p{L}\p{M} '’-]*$/u;

export function validateName(raw: string): NameError | null {
  const name = normaliseName(raw);
  if (name.length === 0) return 'required';
  if (name.length < NAME_MIN) return 'too_short';
  if (name.length > NAME_MAX) return 'too_long';
  if (!NAME_PATTERN.test(name)) return 'invalid_chars';
  return null;
}
