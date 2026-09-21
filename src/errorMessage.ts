import { isApiError } from './api/errors';
import { common, failure, SAFE_MONEY, type NextStep } from './copy';

export interface ErrorDescription {
  message: string;
  next: NextStep;
}

/**
 * What to tell the user about a failed call. Business errors say why; network errors say only
 * that there is no connection and never imply the voucher is bad. Anything we did not expect
 * is reported as our problem.
 *
 * Once the voucher has been accepted, every failure also says the money is safe.
 */
export function describeError(
  error: unknown,
  options: { voucherAccepted: boolean },
): ErrorDescription {
  let base: ErrorDescription;
  if (isApiError(error) && error.kind === 'network') {
    base = { message: common.noConnection, next: 'try_again' };
  } else if (isApiError(error) && error.reason !== undefined) {
    base = failure[error.reason];
  } else {
    base = failure.unknown;
  }

  return options.voucherAccepted
    ? { message: `${base.message} ${SAFE_MONEY}`, next: base.next }
    : base;
}
