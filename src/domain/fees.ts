import type { Cents } from './money';

/** Smallest voucher we will deposit. */
export const MIN_VOUCHER_CENTS: Cents = 1000;

/**
 * Fee rate used by the fake API only, in basis points (hundredths of a percent): 250 is 2.5%.
 * The real server decides the fee; the client just displays `feeCents` and `payoutCents` from
 * the lookup.
 */
export const FAKE_FEE_BASIS_POINTS = 250;

/** `basisPoints` of a voucher, rounded half up to a whole cent, as the server does. */
export function calculateFee(valueCents: Cents, basisPoints: number): Cents {
  return Math.floor((valueCents * basisPoints + 5000) / 10000);
}

export function calculatePayout(valueCents: Cents, feeCents: Cents): Cents {
  return valueCents - feeCents;
}

/** A voucher can be deposited only if it meets the minimum and leaves something after the fee. */
export function isVoucherDepositable(valueCents: Cents, feeCents: Cents): boolean {
  return valueCents >= MIN_VOUCHER_CENTS && valueCents > feeCents;
}
