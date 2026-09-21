import { failure, isRetryable, needsAccountChange, statusCopy } from './copy';
import type { FailureReason } from './api/types';

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
      statusCopy('failed', {
        payoutCents: 49500,
        destination,
        failureReason: 'invalid_account',
      }),
    ).toMatchObject({
      headline: "We couldn't send this deposit",
      support: "Your bank didn't accept this account number. Your money is safe and hasn't been lost.",
    });
  });

  it('failed with no reason is our problem, not the user', () => {
    expect(statusCopy('failed', { payoutCents: 0, destination }).support).toBe(
      "Something went wrong on our side. Your money is safe and hasn't been lost.",
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

  it('speaks amounts that appear inside a failure reason', () => {
    const text = statusCopy('failed', {
      payoutCents: 0,
      destination,
      failureReason: 'voucher_too_small',
    });
    expect(text.support).toContain('R10.00');
    expect(text.spokenSupport).toContain('10 rand');
    expect(text.spokenSupport).not.toContain('R10.00');
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

describe('failure next steps', () => {
  it('only account problems ask for new account details', () => {
    expect(needsAccountChange('invalid_account')).toBe(true);
    expect(needsAccountChange('inactive_account')).toBe(true);
    expect(needsAccountChange('bank_processing_error')).toBe(false);
    expect(needsAccountChange(undefined)).toBe(false);
  });

  it('bank, float and unknown problems are retryable; account and voucher ones are not', () => {
    const retryable: FailureReason[] = ['bank_processing_error', 'insufficient_float', 'unknown'];
    const notRetryable: FailureReason[] = [
      'invalid_account',
      'inactive_account',
      'voucher_not_found',
      'voucher_already_redeemed',
      'voucher_too_small',
    ];
    for (const reason of retryable) expect(isRetryable(reason)).toBe(true);
    for (const reason of notRetryable) expect(isRetryable(reason)).toBe(false);
    expect(isRetryable(undefined)).toBe(true);
  });

  it('keeps the message table from the brief', () => {
    expect(failure.insufficient_float).toEqual({
      message: "We couldn't send this right now.",
      next: 'try_later',
    });
    expect(failure.voucher_too_small.message).toBe(
      'This voucher is too small to deposit. The minimum is R10.00.',
    );
  });
});
