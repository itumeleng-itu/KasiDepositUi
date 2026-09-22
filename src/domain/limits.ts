import type { Cents } from './money';

/** R50,000 — national PayShap ceiling. */
export const SCHEME_MAX_CENTS: Cents = 5_000_000;

// Individual banks set their own lower caps — some as low as R2,000 to R3,000 on certain
// channels — and we cannot know the destination bank's limit before attempting. The
// provider's `limit_exceeded` is the runtime backstop.

// Documented South African payout APIs enforce a R10 minimum, which our existing
// MIN_VOUCHER_CENTS rule (see fees.ts) happens to match.
