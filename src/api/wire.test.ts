import { BANKS } from '../domain/banks';
import { ApiError } from './errors';
import {
  BANK_API_CODES,
  beneficiaryToWire,
  interpretErrorResponse,
  parseDeposit,
  parseVoucherLookup,
} from './wire';

function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the function to throw');
}

describe('ApiError', () => {
  it('keeps instanceof and distinguishes the two kinds', () => {
    const business = ApiError.business('invalid_account');
    const network = ApiError.network();
    expect(business).toBeInstanceOf(ApiError);
    expect(business).toBeInstanceOf(Error);
    expect(business).toMatchObject({ kind: 'business', reason: 'invalid_account' });
    expect(network).toMatchObject({ kind: 'network', reason: undefined });
  });
});

describe('interpretErrorResponse', () => {
  it.each([500, 502, 503, 504, 408, 429])('treats %d as a network error', (status) => {
    expect(interpretErrorResponse(status, { reason: 'voucher_not_found' }).kind).toBe('network');
  });

  it('reads the reason from a flat body', () => {
    expect(interpretErrorResponse(422, { reason: 'voucher_already_redeemed' })).toMatchObject({
      kind: 'business',
      reason: 'voucher_already_redeemed',
    });
  });

  it('reads the reason from a FastAPI detail body', () => {
    expect(interpretErrorResponse(404, { detail: { reason: 'voucher_not_found' } })).toMatchObject({
      kind: 'business',
      reason: 'voucher_not_found',
    });
  });

  it.each([
    ['an unrecognised reason', { reason: 'made_up' }],
    ['a body with no reason', {}],
    ['a string detail', { detail: 'Not found' }],
    ['a non-object body', 'oops'],
    ['no body', undefined],
  ])('falls back to unknown for %s', (_name, body) => {
    expect(interpretErrorResponse(400, body)).toMatchObject({ kind: 'business', reason: 'unknown' });
  });
});

describe('parseVoucherLookup', () => {
  const good = { voucher_token: 'abc', value_cents: 50000, fee_cents: 500, payout_cents: 49500 };

  it('maps snake_case to the app type', () => {
    expect(parseVoucherLookup(good)).toEqual({
      voucherToken: 'abc',
      valueCents: 50000,
      feeCents: 500,
      payoutCents: 49500,
    });
  });

  it.each([
    ['a missing field', { ...good, fee_cents: undefined }],
    ['a float amount', { ...good, value_cents: 500.5 }],
    ['an amount sent as a string', { ...good, payout_cents: '49500' }],
    ['an empty token', { ...good, voucher_token: '' }],
    ['not an object', null],
  ])('rejects %s as an unknown business error', (_name, body) => {
    const error = thrown(() => parseVoucherLookup(body));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'business', reason: 'unknown' });
  });
});

describe('parseDeposit', () => {
  const good = { id: 'd1', reference: 'KD-7F3A9C', status: 'submitted', payout_cents: 49500 };

  it('maps a deposit without a failure reason', () => {
    expect(parseDeposit(good)).toEqual({
      id: 'd1',
      reference: 'KD-7F3A9C',
      status: 'submitted',
      payoutCents: 49500,
    });
  });

  it('carries the failure reason on a failed deposit', () => {
    expect(parseDeposit({ ...good, status: 'failed', failure_reason: 'inactive_account' })).toMatchObject({
      status: 'failed',
      failureReason: 'inactive_account',
    });
  });

  it('uses unknown when a failed deposit has no valid reason', () => {
    expect(parseDeposit({ ...good, status: 'failed' }).failureReason).toBe('unknown');
    expect(parseDeposit({ ...good, status: 'failed', failure_reason: 'nope' }).failureReason).toBe('unknown');
  });

  it('rejects an unrecognised status', () => {
    const error = thrown(() => parseDeposit({ ...good, status: 'refunded' }));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'business', reason: 'unknown' });
  });
});

describe('bank mapping', () => {
  it('maps every bank to a provider code', () => {
    for (const bank of BANKS) expect(BANK_API_CODES[bank.id]).toEqual(expect.any(String));
  });

  it('sends account details in wire format', () => {
    expect(
      beneficiaryToWire({ name: 'Thabo Mokoena', accountNumber: '1234564417', bankId: 'standard_bank' }),
    ).toEqual({ name: 'Thabo Mokoena', account_number: '1234564417', bank: 'STANDARD_BANK' });
  });
});
