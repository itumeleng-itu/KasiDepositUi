import { calculatePayout, FAKE_FLAT_FEE_CENTS } from '../domain/fees';
import { ApiError } from './errors';
import { createFakeApi, randomDelayMs } from './fake';

/** A saved payout method's id. The fake pays any id; deposits don't depend on which. */
const destination = 'fkm_test';

const pinEndingIn = (digit: number) => `123456789012345${digit}`;
const shapIdEndingIn = (digit: number, suffix?: string) =>
  `+2782123456${digit}${suffix ? `@${suffix}` : ''}`;

function setup() {
  const clock = { now: 1_000_000 };
  let counter = 0;
  const logs: string[] = [];
  const api = createFakeApi({
    delayMs: () => 0,
    now: () => clock.now,
    // Different every call, like real randomness, but repeatable.
    random: () => ((counter++ * 7919) % 10007) / 10007,
    log: (message) => logs.push(message),
  });
  return { api, clock, logs };
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('Expected the promise to reject');
}

describe('fake API: lookupVoucher scenarios', () => {
  it.each([
    [0, 50000],
    [2, 20000],
    [3, 100000],
    [5, 5000],
    [6, 800],
  ])('PIN ending in %d gives a %d cent voucher', async (digit, valueCents) => {
    const { api } = setup();
    const lookup = await api.lookupVoucher(pinEndingIn(digit));
    expect(lookup.valueCents).toBe(valueCents);
    expect(lookup.feeCents).toBe(FAKE_FLAT_FEE_CENTS);
    expect(lookup.payoutCents).toBe(calculatePayout(valueCents, FAKE_FLAT_FEE_CENTS));
    expect(lookup.voucherToken.length).toBeGreaterThan(0);
  });

  it('PIN ending in 1 is already redeemed', async () => {
    const { api } = setup();
    const error = await rejection(api.lookupVoucher(pinEndingIn(1)));
    expect(error).toMatchObject({ kind: 'business', reason: 'voucher_already_redeemed' });
  });

  it('PIN ending in 4 is a network error, not a business error', async () => {
    const { api } = setup();
    const error = await rejection(api.lookupVoucher(pinEndingIn(4)));
    expect(error.kind).toBe('network');
    expect(error.reason).toBeUndefined();
  });

  it.each([7, 8, 9])('PIN ending in %d is not found', async (digit) => {
    const { api } = setup();
    const error = await rejection(api.lookupVoucher(pinEndingIn(digit)));
    expect(error).toMatchObject({ kind: 'business', reason: 'voucher_not_found' });
  });

  it('a PIN that is not 16 digits is not found', async () => {
    const { api } = setup();
    const error = await rejection(api.lookupVoucher('1234'));
    expect(error).toMatchObject({ kind: 'business', reason: 'voucher_not_found' });
  });

  it('never logs the PIN', async () => {
    const { api, logs } = setup();
    const pin = pinEndingIn(0);
    await api.lookupVoucher(pin);
    await rejection(api.lookupVoucher(pinEndingIn(1)));
    expect(logs.length).toBeGreaterThan(0);
    for (const line of logs) {
      expect(line).not.toContain(pin);
      expect(line).not.toContain('12345678901234');
    }
  });
});

describe('fake API: resolveShapId scenarios', () => {
  it('a number ending in 9 is not found', async () => {
    const { api } = setup();
    const error = await rejection(api.resolveShapId(shapIdEndingIn(9)));
    expect(error).toMatchObject({ kind: 'business', reason: 'shapid_not_found' });
  });

  it('a number ending in 8 is suspended', async () => {
    const { api } = setup();
    const error = await rejection(api.resolveShapId(shapIdEndingIn(8)));
    expect(error).toMatchObject({ kind: 'business', reason: 'shapid_suspended' });
  });

  it('a number ending in 7 with no @suffix is ambiguous', async () => {
    const { api } = setup();
    const error = await rejection(api.resolveShapId(shapIdEndingIn(7)));
    expect(error).toMatchObject({ kind: 'business', reason: 'shapid_ambiguous' });
  });

  it('a number ending in 7 WITH a @bank suffix resolves normally, at that bank', async () => {
    const { api } = setup();
    const resolved = await api.resolveShapId(shapIdEndingIn(7, 'fnb'));
    expect(resolved).toEqual({ shapName: 'M. Mothiba', bankId: 'fnb' });
  });

  it('a number ending in 6 is a network error, not a business error', async () => {
    const { api } = setup();
    const error = await rejection(api.resolveShapId(shapIdEndingIn(6)));
    expect(error.kind).toBe('network');
    expect(error.reason).toBeUndefined();
  });

  it.each([0, 1, 2, 3, 4, 5])('any other last digit (%d) resolves at Capitec', async (digit) => {
    const { api } = setup();
    const resolved = await api.resolveShapId(shapIdEndingIn(digit));
    expect(resolved).toEqual({ shapName: 'M. Mothiba', bankId: 'capitec' });
  });

  it('never logs the ShapID', async () => {
    const { api, logs } = setup();
    const shapId = shapIdEndingIn(0);
    await api.resolveShapId(shapId);
    await rejection(api.resolveShapId(shapIdEndingIn(9)));
    expect(logs.length).toBeGreaterThan(0);
    for (const line of logs) expect(line).not.toContain(shapId);
  });
});

describe('fake API: idempotency', () => {
  it('the same key returns the same deposit, not a second one', async () => {
    const { api } = setup();
    const { voucherToken } = await api.lookupVoucher(pinEndingIn(0));

    const first = await api.createDeposit(voucherToken, destination, 'key-1');
    const second = await api.createDeposit(voucherToken, destination, 'key-1');

    expect(second).toEqual(first);
    expect(second.id).toBe(first.id);
    expect(second.reference).toBe(first.reference);
  });

  it('two requests in flight at once with the same key create one deposit', async () => {
    const { api } = setup();
    const { voucherToken } = await api.lookupVoucher(pinEndingIn(0));

    const [a, b] = await Promise.all([
      api.createDeposit(voucherToken, destination, 'key-1'),
      api.createDeposit(voucherToken, destination, 'key-1'),
    ]);

    expect(a.id).toBe(b.id);
  });

  it('the same key still returns the original deposit if the destination changed', async () => {
    const { api } = setup();
    const { voucherToken } = await api.lookupVoucher(pinEndingIn(0));

    const first = await api.createDeposit(voucherToken, destination, 'key-1');
    const second = await api.createDeposit(voucherToken, 'fkm_another', 'key-1');

    expect(second.id).toBe(first.id);
  });

  it('a different key for an already-used voucher is refused, so it cannot pay twice', async () => {
    const { api } = setup();
    const { voucherToken } = await api.lookupVoucher(pinEndingIn(0));
    await api.createDeposit(voucherToken, destination, 'key-1');

    const error = await rejection(api.createDeposit(voucherToken, destination, 'key-2'));
    expect(error).toMatchObject({ kind: 'business', reason: 'voucher_already_redeemed' });
  });

  it('different vouchers with different keys make different deposits', async () => {
    const { api } = setup();
    const a = await api.lookupVoucher(pinEndingIn(0));
    const b = await api.lookupVoucher(pinEndingIn(0));

    const first = await api.createDeposit(a.voucherToken, destination, 'key-a');
    const second = await api.createDeposit(b.voucherToken, destination, 'key-b');

    expect(second.id).not.toBe(first.id);
    expect(second.reference).not.toBe(first.reference);
  });
});

describe('fake API: deposit lifecycle', () => {
  async function start(digit: number) {
    const ctx = setup();
    const { voucherToken } = await ctx.api.lookupVoucher(pinEndingIn(digit));
    const deposit = await ctx.api.createDeposit(voucherToken, destination, `key-${digit}`);
    return { ...ctx, deposit };
  }

  it('scenario 0: pending, then submitted, then completed', async () => {
    const { api, clock, deposit } = await start(0);
    expect(deposit.status).toBe('pending');
    expect(deposit.payoutCents).toBe(49500);
    expect(deposit.reference).toMatch(/^KD-[0-9A-F]{6}$/);

    clock.now += 1600;
    expect((await api.getDepositStatus(deposit.id)).status).toBe('submitted');

    clock.now += 1600;
    const done = await api.getDepositStatus(deposit.id);
    expect(done.status).toBe('completed');
    expect(done.failureReason).toBeUndefined();
  });

  it('scenario 2 fails with insufficient_float', async () => {
    const { api, clock, deposit } = await start(2);
    clock.now += 1600;
    expect((await api.getDepositStatus(deposit.id)).status).toBe('submitted');
    clock.now += 1600;
    expect(await api.getDepositStatus(deposit.id)).toMatchObject({
      status: 'failed',
      failureReason: 'insufficient_float',
    });
  });

  it('scenario 3 fails with bank_unavailable', async () => {
    const { api, clock, deposit } = await start(3);
    clock.now += 3200;
    expect(await api.getDepositStatus(deposit.id)).toMatchObject({
      status: 'failed',
      failureReason: 'bank_unavailable',
    });
  });

  it('scenario 5 stays submitted for 100 seconds, then completes', async () => {
    const { api, clock, deposit } = await start(5);
    clock.now += 2000;
    expect((await api.getDepositStatus(deposit.id)).status).toBe('submitted');
    clock.now += 95_000;
    expect((await api.getDepositStatus(deposit.id)).status).toBe('submitted');
    clock.now += 10_000;
    expect((await api.getDepositStatus(deposit.id)).status).toBe('completed');
  });

  it('scenario 6 cannot be deposited: too small', async () => {
    const { api } = setup();
    const { voucherToken } = await api.lookupVoucher(pinEndingIn(6));
    const error = await rejection(api.createDeposit(voucherToken, destination, 'key-6'));
    expect(error).toMatchObject({ kind: 'business', reason: 'voucher_too_small' });
  });

  it('status survives an app restart: a fresh instance can read an old deposit', async () => {
    const { deposit, clock } = await start(0);
    clock.now += 3200;
    const restarted = createFakeApi({ delayMs: () => 0, now: () => clock.now, log: () => {} });
    expect(await restarted.getDepositStatus(deposit.id)).toMatchObject({
      id: deposit.id,
      reference: deposit.reference,
      status: 'completed',
      payoutCents: 49500,
    });
  });

  it('an unknown deposit id is a business error, not a crash', async () => {
    const { api } = setup();
    const error = await rejection(api.getDepositStatus('nonsense'));
    expect(error).toMatchObject({ kind: 'business', reason: 'unknown' });
  });

  it('logs status changes once, not on every poll', async () => {
    const { api, clock, deposit, logs } = await start(0);
    const before = logs.length;
    await api.getDepositStatus(deposit.id);
    await api.getDepositStatus(deposit.id);
    expect(logs.length).toBe(before);
    clock.now += 1600;
    await api.getDepositStatus(deposit.id);
    expect(logs.length).toBe(before + 1);
  });
});

describe('randomDelayMs', () => {
  it('stays within 500-900 ms', () => {
    expect(randomDelayMs(() => 0)).toBe(500);
    expect(randomDelayMs(() => 0.999999)).toBe(900);
    expect(randomDelayMs(() => 0.5)).toBeGreaterThanOrEqual(500);
    expect(randomDelayMs(() => 0.5)).toBeLessThanOrEqual(900);
  });
});

describe('fake API: registerUser scenarios', () => {
  const registration = (idNumber: string) => ({
    fullNames: '  Thabo   Mokoena ',
    idNumber,
  });

  function registeringSetup() {
    const s = setup();
    s.clock.now = Date.UTC(2026, 8, 26);
    return s;
  }

  it('registers a valid adult ID, with a token and tidied names', async () => {
    const { api, logs } = registeringSetup();
    const user = await api.registerUser(registration('8001015009087'));
    expect(user.accessToken).toMatch(/^fkt_/);
    expect(user.userId).toMatch(/^fku_/);
    expect(user.fullNames).toBe('Thabo Mokoena');
    expect(logs.join('\n')).not.toContain('8001015009087');
  });

  it.each([
    ['8001010000081', 'id_verification_failed'],
    ['8001010001089', 'id_number_already_registered'],
    ['8001015009088', 'id_number_invalid'],
    ['0809275001083', 'id_number_under_age'],
  ])('%s -> %s', async (id, reason) => {
    const { api } = registeringSetup();
    expect(await rejection(api.registerUser(registration(id)))).toMatchObject({
      kind: 'business',
      reason,
    });
  });

  it('sequence 0003 simulates no signal', async () => {
    const { api } = registeringSetup();
    expect(await rejection(api.registerUser(registration('8001010003085')))).toMatchObject({
      kind: 'network',
    });
  });
});

describe('fake API: payout methods', () => {
  async function registered() {
    const s = setup();
    s.clock.now = Date.UTC(2026, 8, 26);
    await s.api.registerUser({ fullNames: 'Thabo Sipho Mokoena', idNumber: '8001015009087' });
    return s;
  }

  it("adds the user's own PayShap number in their masked name, as the default", async () => {
    const { api } = await registered();
    const added = await api.addPayoutMethod({ kind: 'shapId', shapId: '+27825551234@fnb' }, false);
    expect(added).toMatchObject({
      kind: 'shapId',
      shapId: '+27825551234@fnb',
      shapName: 'T. Mokoena',
      bankId: 'fnb',
      isDefault: true,
    });
    expect(await api.listPayoutMethods()).toEqual([added]);
  });

  it.each([
    [shapIdEndingIn(5), 'shapid_name_mismatch'],
    [shapIdEndingIn(9), 'shapid_not_found'],
    [shapIdEndingIn(8), 'shapid_suspended'],
    [shapIdEndingIn(7), 'shapid_ambiguous'],
  ])('refuses %s: %s', async (shapId, reason) => {
    const { api } = await registered();
    expect(await rejection(api.addPayoutMethod({ kind: 'shapId', shapId }, true))).toMatchObject({
      kind: 'business',
      reason,
    });
    expect(await api.listPayoutMethods()).toEqual([]);
  });

  it('adds an account in the registered name, keeping only its last four digits', async () => {
    const { api, logs } = await registered();
    const added = await api.addPayoutMethod(
      { kind: 'account', bankId: 'absa', accountNumber: '1234564417' },
      false,
    );
    expect(added).toMatchObject({ kind: 'account', name: 'Thabo Sipho Mokoena', accountLast4: '4417' });
    expect(JSON.stringify(added)).not.toContain('1234564417');
    expect(logs.join('\n')).not.toContain('1234564417');
  });

  it.each([
    ['1234564419', 'account_not_found'],
    ['1234564418', 'account_holder_mismatch'],
    ['12345', 'invalid_account'],
  ])('refuses account %s: %s', async (accountNumber, reason) => {
    const { api } = await registered();
    const refused = api.addPayoutMethod({ kind: 'account', bankId: 'absa', accountNumber }, true);
    expect(await rejection(refused)).toMatchObject({ kind: 'business', reason });
  });

  it('switches the default, promotes on removal, returns duplicates, and stops at five', async () => {
    const { api } = await registered();
    const shap = await api.addPayoutMethod({ kind: 'shapId', shapId: '+27825551234' }, false);
    const account = await api.addPayoutMethod({ kind: 'account', bankId: 'fnb', accountNumber: '1234564417' }, true);
    expect((await api.listPayoutMethods()).map((m) => [m.id, m.isDefault])).toEqual([
      [account.id, true],
      [shap.id, false],
    ]);
    expect((await api.setDefaultPayoutMethod(shap.id))[0].id).toBe(shap.id);
    expect(await api.removePayoutMethod(shap.id)).toEqual([{ ...account, isDefault: true }]);
    expect((await api.addPayoutMethod({ kind: 'account', bankId: 'fnb', accountNumber: '1234564417' }, false)).id).toBe(
      account.id,
    );
    for (const last of [0, 1, 2, 3]) {
      await api.addPayoutMethod({ kind: 'account', bankId: 'absa', accountNumber: `123456440${last}` }, false);
    }
    const sixth = api.addPayoutMethod({ kind: 'account', bankId: 'absa', accountNumber: '1234564405' }, false);
    expect(await rejection(sixth)).toMatchObject({ reason: 'payout_method_limit' });
  });
});

describe('fake API: listMyDeposits', () => {
  it('lists deposits created this session, newest first, with where each went', async () => {
    const { api, clock } = setup();
    clock.now = Date.UTC(2026, 8, 26);
    await api.registerUser({ fullNames: 'Thabo Mokoena', idNumber: '8001015009087' });
    const shap = await api.addPayoutMethod({ kind: 'shapId', shapId: '+27825551234@fnb' }, true);
    const account = await api.addPayoutMethod({ kind: 'account', bankId: 'capitec', accountNumber: '1234564417' }, false);

    const first = await api.lookupVoucher(pinEndingIn(0));
    const a = await api.createDeposit(first.voucherToken, shap.id, 'key-a');
    clock.now += 1000;
    const second = await api.lookupVoucher(pinEndingIn(2));
    const b = await api.createDeposit(second.voucherToken, account.id, 'key-b');

    const listed = await api.listMyDeposits();
    expect(listed.map((d) => d.id)).toEqual([b.id, a.id]);
    expect(listed[1]).toMatchObject({
      valueCents: 50000,
      feeCents: FAKE_FLAT_FEE_CENTS,
      payoutCents: calculatePayout(50000, FAKE_FLAT_FEE_CENTS),
      destination: { kind: 'shapId', shapId: '+27825551234@fnb', shapName: 'T. Mokoena', bankId: 'fnb' },
    });
    expect(listed[0].destination).toEqual({
      kind: 'account',
      name: 'Thabo Mokoena',
      accountLast4: '4417',
      bankId: 'capitec',
    });
  });
});

describe('lookupBranchCode', () => {
  it('finds a bank by its universal branch code', async () => {
    const { api } = setup();
    await expect(api.lookupBranchCode('198765')).resolves.toEqual({ bankName: 'Nedbank', bankId: 'nedbank' });
  });

  it("finds a real bank we can't pay into, with no bank id", async () => {
    const { api } = setup();
    await expect(api.lookupBranchCode('584000')).resolves.toEqual({ bankName: 'Grindrod Bank', bankId: null });
  });

  it('rejects an unknown code', async () => {
    const { api } = setup();
    const error = await rejection(api.lookupBranchCode('123456'));
    expect(error).toMatchObject({ kind: 'business', reason: 'branch_code_not_found' });
  });
});
