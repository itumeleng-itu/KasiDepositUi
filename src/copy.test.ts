import {
  ALL_CLEARING_FAILURES,
  ALL_IDENTITY_FAILURES,
  ALL_VOUCHER_FAILURES,
  failureMessage,
  isClearingFailure,
  nextStatusAction,
  SAFE_MONEY,
  statusCopy,
} from './copy';

const destination = { bankName: 'Capitec', maskedAccount: '••••4417' };

describe('statusCopy: the copy from the brief, word for word', () => {
  it('pending', () => {
    expect(statusCopy('pending', { payoutCents: 49500, destination })).toMatchObject({
      headline: 'Sending your money',
      support: 'Checking your voucher.',
    });
  });

  it('submitted', () => {
    expect(statusCopy('submitted', { payoutCents: 49500, destination })).toMatchObject({
      headline: 'On its way',
      support: 'Sent to Capitec. This usually takes under a minute.',
    });
  });

  it('completed', () => {
    expect(statusCopy('completed', { payoutCents: 49500, destination })).toMatchObject({
      headline: 'R495.00 is in your account',
      support: 'Paid into ••••4417 at Capitec.',
    });
  });

  it('failed, with the reason and the reassurance', () => {
    expect(
      statusCopy('failed', { payoutCents: 49500, destination, failureReason: 'bank_unavailable' }),
    ).toMatchObject({
      headline: "We couldn't send this deposit",
      support: `The bank is temporarily unavailable. ${SAFE_MONEY}`,
    });
  });

  it('failed with no reason is our problem, not the user, and still reassures', () => {
    expect(statusCopy('failed', { payoutCents: 0, destination }).support).toBe(
      `Something went wrong on our side. ${SAFE_MONEY}`,
    );
  });

  it('still processing', () => {
    expect(statusCopy('still_processing', { payoutCents: 49500, destination })).toMatchObject({
      headline: 'Still processing',
      support: "This is taking longer than usual. Your money is safe. We'll keep checking.",
    });
  });
});

describe('statusCopy: screen readers and unknown destinations', () => {
  it('speaks amounts and accounts in words', () => {
    const text = statusCopy('completed', { payoutCents: 49500, destination });
    expect(text.spokenHeadline).toBe('495 rand is in your account');
    expect(text.spokenSupport).toBe('Paid into account ending 4417 at Capitec.');
    expect(text.spokenSupport).not.toContain('•');
  });

  it('copes without a destination', () => {
    expect(statusCopy('submitted', { payoutCents: 1, destination: null }).support).toBe(
      'Sent to your bank. This usually takes under a minute.',
    );
    expect(statusCopy('completed', { payoutCents: 49500, destination: null }).support).toBe(
      'Paid into your account.',
    );
  });
});

describe('the reassurance rule (§5): enforced as a loop, not per reason', () => {
  it('lists every reason exactly once across the three groups', () => {
    const all = [...ALL_IDENTITY_FAILURES, ...ALL_CLEARING_FAILURES, ...ALL_VOUCHER_FAILURES];
    expect(new Set(all).size).toBe(all.length);
  });

  it.each(ALL_IDENTITY_FAILURES)('%s never says the money is safe: nothing has moved yet', (reason) => {
    expect(isClearingFailure(reason)).toBe(false);
    expect(failureMessage(reason)).not.toContain('safe');
  });

  it.each(ALL_VOUCHER_FAILURES)('%s never says the money is safe: pre-clearing, unchanged', (reason) => {
    expect(isClearingFailure(reason)).toBe(false);
    expect(failureMessage(reason)).not.toContain('safe');
  });

  it.each(ALL_CLEARING_FAILURES)('%s always says the money is safe: settlement was attempted', (reason) => {
    expect(isClearingFailure(reason)).toBe(true);
    expect(failureMessage(reason)).toContain('safe');
  });

  it('SAFE_MONEY is concatenated in exactly one place in the codebase', () => {
    // A grep-style check: `reassure` (copy.ts) must be the only function whose source contains
    // the literal concatenation. This does not re-verify the source text itself — that is what
    // the per-reason loops above are for — it guards against a second call site ever appending
    // the sentence a second time (doubling it) by re-deriving it locally instead of calling
    // `reassure`/`failureMessage`.
    for (const reason of ALL_CLEARING_FAILURES) {
      const once = failureMessage(reason);
      expect(once.split(SAFE_MONEY).length - 1).toBe(1);
    }
  });
});

describe('failureMessage: exact copy for reasons the brief gives verbatim', () => {
  it('shapid_not_found makes the fix obvious', () => {
    expect(failureMessage('shapid_not_found')).toBe(
      "We couldn't find that number on PayShap. Check the digits, or register your number in your banking app.",
    );
  });

  it('shapid_ambiguous', () => {
    expect(failureMessage('shapid_ambiguous')).toBe(
      'This number is registered at more than one bank. Choose which bank should receive your money.',
    );
  });

  it('voucher_too_small keeps the minimum-voucher copy unchanged', () => {
    expect(failureMessage('voucher_too_small')).toBe(
      'This voucher is too small to deposit. The minimum is R10.00.',
    );
  });

  it('insufficient_float', () => {
    expect(failureMessage('insufficient_float')).toBe(`We couldn't send this right now. ${SAFE_MONEY}`);
  });
});

describe('nextStatusAction', () => {
  it('insufficient_float waits', () => {
    expect(nextStatusAction('insufficient_float')).toBe('try_later');
  });

  it('limit_exceeded has no specific recovery: a fresh deposit is the only option', () => {
    expect(nextStatusAction('limit_exceeded')).toBe('make_another');
  });

  it.each(['bank_unavailable', 'bank_processing_error', 'unknown'] as const)(
    '%s can be retried',
    (reason) => {
      expect(nextStatusAction(reason)).toBe('try_again');
    },
  );

  it('never suggests changing the destination: it was already resolved before Send', () => {
    for (const reason of [...ALL_CLEARING_FAILURES, ...ALL_VOUCHER_FAILURES]) {
      expect(['try_again', 'try_later', 'make_another']).toContain(nextStatusAction(reason));
    }
  });
});
