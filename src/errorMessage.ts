import { isApiError } from './api/errors';
import { common, failureMessage, reassure } from './copy';

/**
 * What to tell the user about a failed call.
 *
 * A business error's message, and whether it carries the "your money is safe" reassurance, both
 * come from `failureMessage`, which is the single place that decides this from the reason's
 * identity/clearing/voucher category. A network error carries no `FailureReason`, so the caller
 * says whether the request could already have moved money before the connection dropped
 * (identity/voucher-phase calls: no, nothing was reserved yet; a deposit already under way: yes).
 */
export function describeError(error: unknown, options: { moneyMayHaveMoved: boolean }): string {
  if (isApiError(error) && error.kind === 'business' && error.reason !== undefined) {
    return failureMessage(error.reason);
  }
  if (isApiError(error) && error.kind === 'network') {
    return options.moneyMayHaveMoved ? reassure(common.noConnection) : common.noConnection;
  }
  // Not a typed API error at all — a crash rather than a business or network failure. This
  // should not be reachable; treated as an unknown clearing-phase failure, which always
  // reassures, since we have no way to know which phase it actually happened in.
  return failureMessage('unknown');
}
