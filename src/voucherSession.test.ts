import {
  clearVoucherSession,
  currentVoucherSession,
  ensureIdempotencyKey,
  startVoucherSession,
} from './voucherSession';

const lookup = { voucherToken: 't1', valueCents: 50000, feeCents: 500, payoutCents: 49500 };

function counter() {
  let n = 0;
  return jest.fn(() => `key-${++n}`);
}

afterEach(() => clearVoucherSession());

describe('voucher session', () => {
  it('holds the lookup for the confirm screen', () => {
    startVoucherSession(lookup);
    expect(currentVoucherSession()?.lookup).toEqual(lookup);
  });

  it('has no key until one is asked for', () => {
    expect(startVoucherSession(lookup).idempotencyKey).toBeNull();
  });

  it('makes the key once and reuses it for every retry of the same voucher', () => {
    const generate = counter();
    const session = startVoucherSession(lookup);

    const first = ensureIdempotencyKey(session, generate);
    const retry = ensureIdempotencyKey(session, generate);
    const another = ensureIdempotencyKey(session, generate);

    expect(first).toBe('key-1');
    expect(retry).toBe(first);
    expect(another).toBe(first);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('reads the same key back through currentVoucherSession', () => {
    const generate = counter();
    const session = startVoucherSession(lookup);
    ensureIdempotencyKey(session, generate);
    expect(currentVoucherSession()?.idempotencyKey).toBe('key-1');
  });

  it('a different voucher gets a different key', () => {
    const generate = counter();
    const first = ensureIdempotencyKey(startVoucherSession(lookup), generate);
    const second = ensureIdempotencyKey(
      startVoucherSession({ ...lookup, voucherToken: 't2' }),
      generate,
    );
    expect(second).not.toBe(first);
  });

  it('can be cleared', () => {
    startVoucherSession(lookup);
    clearVoucherSession();
    expect(currentVoucherSession()).toBeNull();
  });
});
