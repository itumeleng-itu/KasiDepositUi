import { BANKS } from '../domain/banks';
import { ApiError } from './errors';
import {
  BANK_API_CODES,
  interpretErrorResponse,
  parseDeposit,
  newPayoutMethodToWire,
  parseAddedPayoutMethod,
  parseDepositHistory,
  parsePayoutMethods,
  parseRegisteredUser,
  parseResolvedShapId,
  parseVoucherLookup,
  registrationToWire,
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
    const business = ApiError.business('bank_unavailable');
    const network = ApiError.network();
    expect(business).toBeInstanceOf(ApiError);
    expect(business).toBeInstanceOf(Error);
    expect(business).toMatchObject({ kind: 'business', reason: 'bank_unavailable' });
    expect(network).toMatchObject({ kind: 'network', reason: undefined });
  });
});

describe('interpretErrorResponse', () => {
  it.each([500, 502, 503, 504, 408, 429])('treats %d as a network error', (status) => {
    expect(interpretErrorResponse(status, { reason: 'voucher_not_found' }).kind).toBe('network');
  });

  it('reads a voucher reason from a flat body', () => {
    expect(interpretErrorResponse(422, { reason: 'voucher_already_redeemed' })).toMatchObject({
      kind: 'business',
      reason: 'voucher_already_redeemed',
    });
  });

  it('reads a clearing reason from a FastAPI detail body', () => {
    expect(interpretErrorResponse(422, { detail: { reason: 'bank_unavailable' } })).toMatchObject({
      kind: 'business',
      reason: 'bank_unavailable',
    });
  });

  it('reads an identity reason (resolveShapId errors go through the same mapping)', () => {
    expect(interpretErrorResponse(404, { reason: 'shapid_not_found' })).toMatchObject({
      kind: 'business',
      reason: 'shapid_not_found',
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

describe('parseResolvedShapId', () => {
  it('maps a resolved ShapID', () => {
    expect(parseResolvedShapId({ shap_name: 'M. Mothiba', bank: 'CAPITEC' })).toEqual({
      shapName: 'M. Mothiba',
      bankId: 'capitec',
    });
  });

  it.each([
    ['a missing name', { bank: 'CAPITEC' }],
    ['an empty name', { shap_name: '', bank: 'CAPITEC' }],
    ['an unrecognised bank code', { shap_name: 'M. Mothiba', bank: 'NOT_A_BANK' }],
    ['a missing bank', { shap_name: 'M. Mothiba' }],
    ['not an object', null],
  ])('rejects %s as an unknown business error', (_name, body) => {
    const error = thrown(() => parseResolvedShapId(body));
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

  it('carries a clearing failure reason on a failed deposit', () => {
    expect(parseDeposit({ ...good, status: 'failed', failure_reason: 'bank_unavailable' })).toMatchObject({
      status: 'failed',
      failureReason: 'bank_unavailable',
    });
  });

  it('carries a voucher failure reason on a failed deposit', () => {
    expect(
      parseDeposit({ ...good, status: 'failed', failure_reason: 'voucher_already_redeemed' }),
    ).toMatchObject({ status: 'failed', failureReason: 'voucher_already_redeemed' });
  });

  it('never carries an identity failure reason: falls back to unknown instead', () => {
    // A deposit's destination was already resolved before it existed, so an identity failure
    // reported here is not something the server should ever say — treated as unknown rather
    // than trusted, since a Deposit's failureReason type promises only clearing or voucher.
    expect(parseDeposit({ ...good, status: 'failed', failure_reason: 'shapid_not_found' }).failureReason).toBe(
      'unknown',
    );
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
});

describe('payout methods on the wire', () => {
  it('sends a new PayShap number as its pointer, with the @suffix intact', () => {
    expect(newPayoutMethodToWire({ kind: 'shapId', shapId: '+27821234567@fnb' }, true)).toEqual({
      kind: 'shap_id',
      shap_id: '+27821234567@fnb',
      make_default: true,
    });
  });

  it('sends a new account with the provider bank code', () => {
    expect(
      newPayoutMethodToWire({ kind: 'account', bankId: 'standard_bank', accountNumber: '1234564417' }, false),
    ).toEqual({ kind: 'account', bank: 'STANDARD_BANK', account_number: '1234564417', make_default: false });
  });

  const shapRow = {
    id: 'pm-1',
    kind: 'shap_id',
    bank: 'FNB',
    is_default: true,
    shap_id: '+27825551234',
    shap_name: 'T. Mokoena',
    account_holder: null,
    account_last4: null,
  };
  const accountRow = {
    id: 'pm-2',
    kind: 'account',
    bank: 'CAPITEC',
    is_default: false,
    shap_id: null,
    shap_name: null,
    account_holder: 'Thabo Mokoena',
    account_last4: '4417',
  };

  it('parses the list into what the phone keeps: accounts by their last four digits only', () => {
    expect(parsePayoutMethods({ payout_methods: [shapRow, accountRow] })).toEqual([
      { id: 'pm-1', isDefault: true, kind: 'shapId', shapId: '+27825551234', shapName: 'T. Mokoena', bankId: 'fnb' },
      { id: 'pm-2', isDefault: false, kind: 'account', name: 'Thabo Mokoena', accountLast4: '4417', bankId: 'capitec' },
    ]);
  });

  it('drops a row it cannot read, and refuses a body without a list', () => {
    expect(parsePayoutMethods({ payout_methods: [{ ...accountRow, bank: 'NOPE' }, shapRow] })).toHaveLength(1);
    expect(thrown(() => parsePayoutMethods({}))).toMatchObject({ reason: 'unknown' });
    expect(thrown(() => parseAddedPayoutMethod({ ...shapRow, is_default: 'yes' }))).toMatchObject({
      reason: 'unknown',
    });
  });
});

describe('401: the phone is no longer registered', () => {
  it('is not_registered whatever the body says', () => {
    expect(interpretErrorResponse(401, undefined)).toMatchObject({ kind: 'business', reason: 'not_registered' });
    expect(interpretErrorResponse(401, { detail: 'Not authenticated' })).toMatchObject({
      reason: 'not_registered',
    });
  });

  it('reads registration reasons from the body', () => {
    expect(interpretErrorResponse(409, { reason: 'id_number_already_registered' })).toMatchObject({
      kind: 'business',
      reason: 'id_number_already_registered',
    });
  });
});

describe('registration wire', () => {
  it('sends snake_case', () => {
    expect(
      registrationToWire({ fullNames: 'Thabo Mokoena', idNumber: '8001015009087' }),
    ).toEqual({ full_names: 'Thabo Mokoena', id_number: '8001015009087' });
  });

  it('parses the registered user', () => {
    expect(
      parseRegisteredUser({ user_id: 'u-1', access_token: 't', full_names: 'Thabo Mokoena', extra: 1 }),
    ).toEqual({ userId: 'u-1', accessToken: 't', fullNames: 'Thabo Mokoena' });
  });

  it.each([
    undefined,
    { user_id: 'u-1', full_names: 'Thabo Mokoena' },
    { user_id: '', access_token: 't', full_names: 'Thabo Mokoena' },
    { user_id: 'u-1', access_token: 't', full_names: '' },
  ])('refuses %j as our problem', (body) => {
    expect(thrown(() => parseRegisteredUser(body))).toMatchObject({ kind: 'business', reason: 'unknown' });
  });
});

describe('parseDepositHistory', () => {
  const row = {
    id: 'dep-1',
    reference: 'KD-AAAAAA',
    status: 'completed',
    payout_cents: 49500,
    value_cents: 50000,
    fee_cents: 500,
    failure_reason: null,
    created_at: '2026-09-26T12:05:00Z',
    destination: { kind: 'shap_id', shap_id: '+27821234567', shap_name: 'M. Mothiba', bank: 'CAPITEC' },
  };

  it('parses a row into what the app shows', () => {
    expect(parseDepositHistory({ deposits: [row] })).toEqual([
      {
        id: 'dep-1',
        reference: 'KD-AAAAAA',
        status: 'completed',
        payoutCents: 49500,
        valueCents: 50000,
        feeCents: 500,
        createdAt: Date.UTC(2026, 8, 26, 12, 5),
        destination: { kind: 'shapId', shapId: '+27821234567', shapName: 'M. Mothiba', bankId: 'capitec' },
      },
    ]);
  });

  it('drops a row it cannot read and keeps the rest', () => {
    const broken = [
      { ...row, id: 'bad-date', created_at: 'yesterday' },
      { ...row, id: 'bad-bank', destination: { ...row.destination, bank: 'NOPE' } },
      { ...row, id: 'no-value', value_cents: undefined },
      { ...row, id: 'bad-status', status: 'lost' },
    ];
    expect(parseDepositHistory({ deposits: [...broken, row] }).map((d) => d.id)).toEqual(['dep-1']);
  });

  it('refuses a body without a list', () => {
    expect(thrown(() => parseDepositHistory({ items: [] }))).toMatchObject({ reason: 'unknown' });
  });
});
