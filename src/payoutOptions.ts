import type { PayoutMethod } from './api/types';

/**
 * The server's cap, mirrored from MAX_METHODS in the API's
 * app/payout_methods.py. The server stays the authority: this only lets
 * the screen stop before an add would be refused, because a refusal the
 * user could not have predicted reads as a fault.
 */
export const MAX_PAYOUT_METHODS = 5;

export interface PayoutOptions {
  /** Offer "Use a PayShap number". */
  payShap: boolean;
  /** Offer "Add a bank account". */
  account: boolean;
  /** Nothing can be added until something is removed. */
  full: boolean;
}

/**
 * Which ways of being paid are still worth offering.
 *
 * A PayShap number is offered only until there is one. Your number is
 * your number, so a second is far more often a mistake than an intent —
 * though the server does allow it, which makes this a product decision
 * taken here rather than a rule the API enforces.
 *
 * Bank accounts stay on offer: more than one is ordinary.
 */
export function payoutOptions(methods: readonly PayoutMethod[]): PayoutOptions {
  const full = methods.length >= MAX_PAYOUT_METHODS;
  return {
    payShap: !full && !methods.some((method) => method.kind === 'shapId'),
    account: !full,
    full,
  };
}
