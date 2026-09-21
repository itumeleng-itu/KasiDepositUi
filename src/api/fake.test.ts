import { calculatePayout, FAKE_FLAT_FEE_CENTS } from '../domain/fees';
import { ApiError } from './errors';
import { createFakeApi, randomDelayMs } from './fake';
import type { Beneficiary } from './types';

const beneficiary: Beneficiary = {
  name: 'Thabo Mokoena',
  accountNumber: '1234564417',
  bankId: 'capitec',
};

const pinEndingIn = (digit: number) => `123456789012345${digit}`;

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

describe('fake API: idempotency', () => {
  it('the same key returns the same deposit, not a second one', async () => {
    const { api } = setup();
    const { voucherToken } = await api.lookupVoucher(pinEndingIn(0));

    const first = await api.createDeposit(voucherToken, beneficiary, 'key-1');
    const second = await api.createDeposit(voucherToken, beneficiary, 'key-1');

    expect(second).toEqual(first);
    expect(second.id).toBe(first.id);
    expect(second.reference).toBe(first.reference);
  });

  it('two requests in flight at once with the same key create one deposit', async () => {
    const { api } = setup();
    const { voucherToken } = await api.lookupVoucher(pinEndingIn(0));

    const [a, b] = await Promise.all([
      api.createDeposit(voucherToken, beneficiary, 'key-1'),
      api.createDeposit(voucherToken, beneficiary, 'key-1'),
    ]);

    expect(a.id).toBe(b.id);
  });

  it('the same key still returns the original deposit if the beneficiary changed', async () => {
    const { api } = setup();
    const { voucherToken } = await api.lookupVoucher(pinEndingIn(0));

    const first = await api.createDeposit(voucherToken, beneficiary, 'key-1');
    const second = await api.createDeposit(
      voucherToken,
      { ...beneficiary, accountNumber: '9999999999' },
      'key-1',
    );

    expect(second.id).toBe(first.id);
  });

  it('a different key for an already-used voucher is refused, so it cannot pay twice', async () => {
    const { api } = setup();
    const { voucherToken } = await api.lookupVoucher(pinEndingIn(0));
    await api.createDeposit(voucherToken, beneficiary, 'key-1');

    const error = await rejection(api.createDeposit(voucherToken, beneficiary, 'key-2'));
    expect(error).toMatchObject({ kind: 'business', reason: 'voucher_already_redeemed' });
  });

  it('different vouchers with different keys make different deposits', async () => {
    const { api } = setup();
    const a = await api.lookupVoucher(pinEndingIn(0));
    const b = await api.lookupVoucher(pinEndingIn(0));

    const first = await api.createDeposit(a.voucherToken, beneficiary, 'key-a');
    const second = await api.createDeposit(b.voucherToken, beneficiary, 'key-b');

    expect(second.id).not.toBe(first.id);
    expect(second.reference).not.toBe(first.reference);
  });
});

describe('fake API: deposit lifecycle', () => {
  async function start(digit: number) {
    const ctx = setup();
    const { voucherToken } = await ctx.api.lookupVoucher(pinEndingIn(digit));
    const deposit = await ctx.api.createDeposit(voucherToken, beneficiary, `key-${digit}`);
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

  it('scenario 2 fails with invalid_account', async () => {
    const { api, clock, deposit } = await start(2);
    clock.now += 1600;
    expect((await api.getDepositStatus(deposit.id)).status).toBe('submitted');
    clock.now += 1600;
    expect(await api.getDepositStatus(deposit.id)).toMatchObject({
      status: 'failed',
      failureReason: 'invalid_account',
    });
  });

  it('scenario 3 fails with insufficient_float', async () => {
    const { api, clock, deposit } = await start(3);
    clock.now += 3200;
    expect(await api.getDepositStatus(deposit.id)).toMatchObject({
      status: 'failed',
      failureReason: 'insufficient_float',
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
    const error = await rejection(api.createDeposit(voucherToken, beneficiary, 'key-6'));
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
