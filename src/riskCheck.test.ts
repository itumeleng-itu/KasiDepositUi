import { ApiError } from './api/errors';
import { depositOptions, needsRiskCheck } from './riskCheck';

describe('needsRiskCheck', () => {
  it('is true only for the server asking for confirmation', () => {
    expect(needsRiskCheck(ApiError.business('confirmation_required'))).toBe(true);
  });

  it('a decline is an error to show, not a question to ask', () => {
    expect(needsRiskCheck(ApiError.business('deposit_declined'))).toBe(false);
  });

  it('is false for every other failure, including no signal and crashes', () => {
    expect(needsRiskCheck(ApiError.business('voucher_already_redeemed'))).toBe(false);
    expect(needsRiskCheck(ApiError.business('unknown'))).toBe(false);
    expect(needsRiskCheck(ApiError.network())).toBe(false);
    expect(needsRiskCheck(new TypeError('boom'))).toBe(false);
    expect(needsRiskCheck(undefined)).toBe(false);
  });
});

describe('depositOptions', () => {
  it('sends nothing extra until the user chooses Continue', () => {
    expect(depositOptions(false)).toEqual({});
  });

  it('carries the acknowledgement on every attempt after Continue', () => {
    expect(depositOptions(true)).toEqual({ riskAcknowledged: true });
  });
});
