/** Keep only the digits from any text: spaces, dashes, line breaks and words all go. */
export function extractDigits(text: string): string {
  return text.replace(/\D/g, '');
}
