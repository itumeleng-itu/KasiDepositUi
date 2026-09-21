/** Integer cents. Never a float, never parsed back out of a formatted string. */
export type Cents = number;

function assertCents(cents: Cents): void {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Cents must be a safe integer, got ${cents}`);
  }
}

function splitCents(cents: Cents): { sign: string; rands: string; centsPart: string } {
  assertCents(cents);
  const abs = Math.abs(cents);
  return {
    sign: cents < 0 ? '-' : '',
    rands: String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '),
    centsPart: String(abs % 100).padStart(2, '0'),
  };
}

/** South African convention: space thousands separator, full stop decimals. R1 234.56 */
export function formatRand(cents: Cents): string {
  const { sign, rands, centsPart } = splitCents(cents);
  return `${sign}R${rands}.${centsPart}`;
}

/** For screen readers, which read "R495.00" badly. "495 rand", "495 rand 50 cents". */
export function spokenRand(cents: Cents): string {
  assertCents(cents);
  const abs = Math.abs(cents);
  const rands = Math.floor(abs / 100);
  const remainder = abs % 100;
  const sign = cents < 0 ? 'minus ' : '';
  const randPart = `${rands} rand`;
  return remainder === 0 ? `${sign}${randPart}` : `${sign}${randPart} ${remainder} cents`;
}
