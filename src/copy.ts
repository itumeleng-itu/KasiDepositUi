/**
 * Every user-facing string lives here so it can be translated (Sepedi, isiZulu) later.
 * Sentence case, plain words, no exclamation marks, no apologising. Say what happened and
 * what to do. Bank names are proper nouns and live in domain/banks.ts.
 */
import { MIN_VOUCHER_CENTS } from './domain/fees';
import { formatRand, spokenAmounts, spokenRand, type Cents } from './domain/money';
import type { AccountError } from './domain/account';
import type { NameError } from './domain/name';
import type { DepositStatus, FailureReason } from './api/types';
import { PIN_LENGTH } from './domain/pin';

const MIN_VOUCHER = formatRand(MIN_VOUCHER_CENTS);

export const SAFE_MONEY = "Your money is safe and hasn't been lost.";

export const common = {
  back: 'Back',
  cancel: 'Cancel',
  tryAgain: 'Try again',
  noConnection: 'No connection. Check your data and try again.',
  noConnectionPolling: "No connection — we'll keep trying",
} as const;

export const setup = {
  titleFirstRun: 'Where should your money go?',
  titleChange: 'Change where your money goes',
  intro: 'Tell us the bank account that deposits should be paid into.',
  nameLabel: 'Account holder name',
  bankLabel: 'Bank',
  accountLabel: 'Account number',
  confirmAccountLabel: 'Confirm account number',
  save: 'Save details',
  cancel: common.cancel,
  privacyNote: 'Saved on this phone only. We never ask for your banking PIN or password.',
  saveFailed: "We couldn't save your details on this phone. Try again.",
  saving: 'Saving',
  nameError: {
    required: 'Enter the name on the bank account.',
    too_short: 'The name must be at least 2 letters.',
    too_long: 'The name must be 60 characters or fewer.',
    invalid_chars: 'Use letters, spaces, hyphens and apostrophes only.',
  } satisfies Record<NameError, string>,
  bankError: 'Choose your bank.',
  accountError: {
    required: 'Enter your account number.',
    too_short: 'An account number has at least 7 digits.',
    too_long: 'An account number has at most 11 digits.',
  } satisfies Record<AccountError, string>,
  confirmMismatch: "The account numbers don't match.",
  confirmRequired: 'Enter your account number again.',
  /** Shown under the disabled Save button: the first unmet requirement. */
  unmet: {
    name: 'Enter the name on the bank account.',
    bank: 'Choose your bank.',
    account: 'Enter a valid account number.',
    confirm: 'Enter your account number again, the same way.',
  },
} as const;

export const deposit = {
  payingInto: (masked: string, bank: string) => `Paying into ${masked} · ${bank}`,
  payingIntoLabel: (last4: string, bank: string) => `Paying into account ending ${last4} at ${bank}`,
  change: 'Change',
  changeLabel: 'Change where your money goes',
  heading: 'Enter your voucher PIN',
  helper: `It's the ${PIN_LENGTH}-digit number on your till slip.`,
  pinLabel: 'Voucher PIN',
  counter: (n: number) => `${n} of ${PIN_LENGTH} digits`,
  pinLabelWithCount: (n: number) => `Voucher PIN, ${n} of ${PIN_LENGTH} digits entered`,
  pasteTooLong: `That doesn't look like a ${PIN_LENGTH}-digit PIN`,
  continue: 'Continue',
  checking: 'Checking your voucher',
} as const;

export const confirm = {
  title: 'Check before you send',
  voucherValue: 'Voucher value',
  fee: 'Fee',
  youReceive: "You'll receive",
  paidInto: 'Paid into',
  note: "Money usually arrives within a minute. This can't be undone once sent.",
  /** The amount is in the button so the user confirms a specific number. */
  send: (payoutCents: Cents) => `Send ${formatRand(payoutCents)}`,
  /** Shown on the disabled button when the voucher is too small, instead of a misleading amount. */
  cannotSend: "Can't send this voucher",
  paidIntoSpoken: (name: string, bank: string, last4: string) =>
    `Paid into ${name}, ${bank}, account ending ${last4}`,
  sendLabel: (payoutCents: Cents) => `Send ${spokenRand(payoutCents)}`,
  sending: 'Sending',
  notMyDetails: "These aren't my details",
  tooSmall: `This voucher is too small to deposit. The minimum is ${MIN_VOUCHER}.`,
  /** Fee is shown as a deduction. U+2212 minus sign. */
  feeDisplay: (feeCents: Cents) => `− ${formatRand(feeCents)}`,
  feeLabel: (feeCents: Cents) => `Fee, ${spokenRand(feeCents)}`,
} as const;

export const status = {
  makeAnother: 'Make another deposit',
  tryAgain: common.tryAgain,
  tryAgainLater: 'Try again later',
  changeAccount: 'Change account details',
  reference: (ref: string) => `Reference: ${ref}`,
  steps: { checked: 'Checked', sent: 'Sent', arrived: 'Arrived' },
  stepDone: 'done',
  stepCurrent: 'in progress',
  stepTodo: 'not yet',
  progressLabel: (current: string) => `Progress: ${current}`,
} as const;

export type StatusScreenState = DepositStatus | 'still_processing';

interface StatusCopyInput {
  payoutCents: Cents;
  /** Where the money went, if we know. A cold-opened screen may have to do without. */
  destination: { bankName: string; maskedAccount: string } | null;
  failureReason?: FailureReason;
}

export interface StatusText {
  headline: string;
  support: string;
  /** What a screen reader says: amounts as "495 rand", accounts as "ending 4417". */
  spokenHeadline: string;
  spokenSupport: string;
}

export function statusCopy(state: StatusScreenState, input: StatusCopyInput): StatusText {
  const plain = (headline: string, support: string): StatusText => ({
    headline,
    support,
    spokenHeadline: spokenAmounts(headline),
    // A failure reason can carry an amount ("The minimum is R10.00").
    spokenSupport: spokenAmounts(support),
  });
  const { destination } = input;

  switch (state) {
    case 'pending':
      return plain('Sending your money', 'Checking your voucher.');
    case 'submitted':
      return plain(
        'On its way',
        `Sent to ${destination ? destination.bankName : 'your bank'}. This usually takes under a minute.`,
      );
    case 'completed': {
      const support = destination
        ? `Paid into ${destination.maskedAccount} at ${destination.bankName}.`
        : 'Paid into your account.';
      return {
        headline: `${formatRand(input.payoutCents)} is in your account`,
        support,
        spokenHeadline: `${spokenRand(input.payoutCents)} is in your account`,
        spokenSupport: destination
          ? `Paid into account ending ${destination.maskedAccount.slice(-4)} at ${destination.bankName}.`
          : support,
      };
    }
    case 'failed':
      return plain(
        "We couldn't send this deposit",
        // Reason messages already end with a full stop.
        `${failure[input.failureReason ?? 'unknown'].message} ${SAFE_MONEY}`,
      );
    case 'still_processing':
      return plain(
        'Still processing',
        "This is taking longer than usual. Your money is safe. We'll keep checking.",
      );
  }
}

export type NextStep = 'stay' | 'change_details' | 'try_again' | 'try_later';

export const failure: Record<FailureReason, { message: string; next: NextStep }> = {
  voucher_not_found: {
    message: "We couldn't find that PIN. Check each digit against your till slip.",
    next: 'stay',
  },
  voucher_already_redeemed: { message: 'This voucher has already been used.', next: 'stay' },
  voucher_too_small: {
    message: `This voucher is too small to deposit. The minimum is ${MIN_VOUCHER}.`,
    next: 'stay',
  },
  invalid_account: {
    message: "Your bank didn't accept this account number.",
    next: 'change_details',
  },
  inactive_account: { message: "This bank account isn't active.", next: 'change_details' },
  bank_processing_error: {
    message: "Your bank couldn't process this right now.",
    next: 'try_again',
  },
  insufficient_float: { message: "We couldn't send this right now.", next: 'try_later' },
  unknown: { message: 'Something went wrong on our side.', next: 'try_again' },
};

/** Only these can be retried from the status screen (after a fresh lookup). */
export function isRetryable(reason: FailureReason | undefined): boolean {
  const next = failure[reason ?? 'unknown'].next;
  return next === 'try_again' || next === 'try_later';
}

export function needsAccountChange(reason: FailureReason | undefined): boolean {
  return reason === 'invalid_account' || reason === 'inactive_account';
}
