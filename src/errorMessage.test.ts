import { ApiError } from './api/errors';
import type { FailureReason } from './api/types';
import { common, failure, SAFE_MONEY } from './copy';
import { describeError } from './errorMessage';

describe('describeError before the voucher is accepted (PIN screen)', () => {
  it.each([
    ['voucher_not_found', 'stay'],
    ['voucher_already_redeemed', 'stay'],
    ['voucher_too_small', 'stay'],
  ] as const)('%s keeps the user on the PIN screen', (reason, next) => {
    const result = describeError(ApiError.business(reason), { voucherAccepted: false });
    expect(result).toEqual({ message: failure[reason].message, next });
    expect(result.message).not.toContain(SAFE_MONEY);
  });

  it('a network error says there is no connection and never blames the voucher', () => {
    const result = describeError(ApiError.network(), { voucherAccepted: false });
    expect(result).toEqual({ message: common.noConnection, next: 'try_again' });
    expect(result.message).not.toMatch(/voucher|PIN/i);
  });

  it('an unexpected error is reported as our problem', () => {
    expect(describeError(new TypeError('boom'), { voucherAccepted: false })).toEqual(failure.unknown);
    expect(describeError('nope', { voucherAccepted: false })).toEqual(failure.unknown);
  });
});

describe('describeError after the voucher is accepted (confirm and status)', () => {
  const reasons: FailureReason[] = [
    'voucher_not_found',
    'voucher_already_redeemed',
    'voucher_too_small',
    'invalid_account',
    'inactive_account',
    'bank_processing_error',
    'insufficient_float',
    'unknown',
  ];

  it.each(reasons)('%s adds that the money is safe', (reason) => {
    const result = describeError(ApiError.business(reason), { voucherAccepted: true });
    expect(result.message).toBe(`${failure[reason].message} ${SAFE_MONEY}`);
    expect(result.next).toBe(failure[reason].next);
  });

  it('a network error also says the money is safe', () => {
    expect(describeError(ApiError.network(), { voucherAccepted: true }).message).toBe(
      `${common.noConnection} ${SAFE_MONEY}`,
    );
  });
});
