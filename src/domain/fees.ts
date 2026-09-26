import type { Cents } from './money';

/** Smallest voucher we will deposit. */
export const MIN_VOUCHER_CENTS: Cents = 1000;

/**
 * Flat fee used by the fake API only. The real server decides the fee; the client just
 * displays `feeCents` and `payoutCents` from the lookup.
 */
export const FAKE_FLAT_FEE_CENTS: Cents = 500;

export function calculatePayout(valueCents: Cents, feeCents: Cents): Cents {
  return valueCents - feeCents;
}

/** A voucher can be deposited only if it meets the minimum and leaves something after the fee. */
export function isVoucherDepositable(valueCents: Cents, feeCents: Cents): boolean {
  return valueCents >= MIN_VOUCHER_CENTS && valueCents > feeCents;
}
