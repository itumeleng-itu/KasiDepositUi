import { ApiError } from './api/errors';
import type { FailureReason } from './api/types';
import { common, failureMessage, reassure, SAFE_MONEY } from './copy';
import { describeError } from './errorMessage';

describe('describeError: business errors always come from failureMessage', () => {
  it.each([
    'shapid_not_found',
    'shapid_suspended',
    'shapid_invalid_format',
    'shapid_ambiguous',
    'voucher_not_found',
    'voucher_already_redeemed',
    'voucher_too_small',
  ] as FailureReason[])('%s never reassures, whichever phase flag is passed', (reason) => {
    const message = failureMessage(reason);
    expect(describeError(ApiError.business(reason), { moneyMayHaveMoved: false })).toBe(message);
    expect(describeError(ApiError.business(reason), { moneyMayHaveMoved: true })).toBe(message);
    expect(message).not.toContain('safe');
  });

  it.each([
    'insufficient_float',
    'limit_exceeded',
    'bank_unavailable',
    'bank_processing_error',
    'unknown',
  ] as FailureReason[])('%s always reassures, whichever phase flag is passed', (reason) => {
    const message = failureMessage(reason);
    expect(describeError(ApiError.business(reason), { moneyMayHaveMoved: false })).toBe(message);
    expect(describeError(ApiError.business(reason), { moneyMayHaveMoved: true })).toBe(message);
    expect(message).toContain('safe');
  });
});

describe('describeError: network errors', () => {
  it('says there is no connection and never blames the voucher or the number', () => {
    const message = describeError(ApiError.network(), { moneyMayHaveMoved: false });
    expect(message).toBe(common.noConnection);
    expect(message).not.toMatch(/voucher|PIN|ShapID|number/i);
  });

  it('adds the reassurance once money could already have moved', () => {
    expect(describeError(ApiError.network(), { moneyMayHaveMoved: true })).toBe(
      reassure(common.noConnection),
    );
  });
});

describe('describeError: not a typed API error at all', () => {
  it('falls back to the unknown clearing-phase message, which reassures', () => {
    expect(describeError(new TypeError('boom'), { moneyMayHaveMoved: false })).toBe(
      failureMessage('unknown'),
    );
    expect(describeError('nope', { moneyMayHaveMoved: true })).toBe(failureMessage('unknown'));
  });
});

describe('SAFE_MONEY appears at most once in any message this function returns', () => {
  it.each([
    ApiError.business('bank_unavailable'),
    ApiError.network(),
    new TypeError('boom'),
  ])('never doubles the reassurance', (error) => {
    const message = describeError(error, { moneyMayHaveMoved: true });
    expect(message.split(SAFE_MONEY).length - 1).toBeLessThanOrEqual(1);
  });
});
