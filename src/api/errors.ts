import type { FailureReason } from './types';

/**
 * 'business': the server understood and said no; `reason` says why. Shown as that reason.
 * 'network':  offline, timeout or 5xx. Never implies the voucher is bad.
 */
export type ApiErrorKind = 'business' | 'network';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** Present for 'business' errors only. */
  readonly reason: FailureReason | undefined;

  private constructor(kind: ApiErrorKind, reason: FailureReason | undefined, message: string) {
    super(message);
    // Keep instanceof working when classes are transpiled down.
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'ApiError';
    this.kind = kind;
    this.reason = reason;
  }

  static business(reason: FailureReason): ApiError {
    return new ApiError('business', reason, `Request refused: ${reason}`);
  }

  static network(message = 'Network request failed'): ApiError {
    return new ApiError('network', undefined, message);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
