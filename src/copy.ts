/**
 * Every user-facing string lives here so it can be translated (Sepedi, isiZulu) later.
 * Sentence case, plain words, no exclamation marks, no apologising. Say what happened and
 * what to do. Bank names are proper nouns and live in domain/banks.ts.
 */
import { MIN_VOUCHER_CENTS } from './domain/fees';
import { formatRand, spokenAmounts, spokenRand, type Cents } from './domain/money';
import type { ShapIdFormatReason } from './domain/shapId';
import {
  CLEARING_FAILURE_REASONS,
  IDENTITY_FAILURE_REASONS,
  VOUCHER_FAILURE_REASONS,
  type DepositStatus,
  type FailureReason,
} from './api/types';
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
  helper: 'Your cellphone number, as registered with your bank for PayShap.',
  numberLabel: 'Cellphone number',
  bankPickerLabel: 'Bank',
  continue: 'Continue',
  checking: 'Checking your number',
  cancel: common.cancel,
  privacyNote: 'Saved on this phone only. We never ask for your banking PIN or password.',
  saveFailed: "We couldn't save your details on this phone. Try again.",
  saving: 'Saving',
  /** Per-field error, shown once the field has been left. Doubles as the format failure message. */
  parseError: {
    empty: 'Enter your cellphone number.',
    format: "That doesn't look like a South African mobile number.",
    unknown_bank: "We don't recognise that bank. Choose one from the list.",
  } satisfies Record<ShapIdFormatReason, string>,
  /** Shown under the disabled Continue button, even before the field has been touched. */
  unmet: {
    empty: 'Enter your cellphone number.',
    format: 'Enter a valid cellphone number.',
    unknown_bank: 'Choose a bank you recognise.',
  } satisfies Record<ShapIdFormatReason, string>,
  confirmTitle: 'Is this you?',
  confirmYes: 'Yes, save this',
  confirmNo: 'No, change number',
} as const;

export const deposit = {
  payingInto: (oneLine: string) => `Paying into ${oneLine}`,
  payingIntoLabel: (spokenOneLine: string) => `Paying into ${spokenOneLine}`,
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
  paidIntoSpoken: (primary: string, spokenOneLine: string) => `Paid into ${primary}, ${spokenOneLine}`,
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
      // A Deposit's failureReason is always a clearing or voucher reason (never identity, since
      // the destination was already resolved before Send), so failureMessage always carries the
      // reassurance here — which is correct: a deposit that reached this screen was accepted.
      return plain("We couldn't send this deposit", failureMessage(input.failureReason ?? 'unknown'));
    case 'still_processing':
      return plain(
        'Still processing',
        "This is taking longer than usual. Your money is safe. We'll keep checking.",
      );
  }
}

/**
 * Phase 1 (identity) failures never carry the reassurance: nothing was reserved yet, so nothing
 * needs "un-losing". Phase 2 (clearing) failures always do: settlement was attempted, and if it
 * did not go through the user needs telling that the attempt itself did not lose their money.
 * The voucher group is unchanged from before this migration and, like identity failures, is
 * pre-clearing — the PIN screen and confirm screen already keep the user in place on these.
 */
const FAILURE_MESSAGES: Record<FailureReason, string> = {
  shapid_not_found:
    "We couldn't find that number on PayShap. Check the digits, or register your number in your banking app.",
  shapid_suspended: "This account can't receive PayShap payments right now. Check with your bank.",
  shapid_invalid_format: "That doesn't look like a South African mobile number.",
  shapid_ambiguous:
    'This number is registered at more than one bank. Choose which bank should receive your money.',
  insufficient_float: "We couldn't send this right now.",
  limit_exceeded: "This is more than PayShap allows in one payment.",
  bank_unavailable: 'The bank is temporarily unavailable.',
  bank_processing_error: "The bank couldn't process this right now.",
  unknown: 'Something went wrong on our side.',
  voucher_not_found: "We couldn't find that PIN. Check each digit against your till slip.",
  voucher_already_redeemed: 'This voucher has already been used.',
  voucher_too_small: `This voucher is too small to deposit. The minimum is ${MIN_VOUCHER}.`,
} satisfies Record<FailureReason, string>;

const CLEARING_REASON_SET: ReadonlySet<string> = new Set(Object.keys(CLEARING_FAILURE_REASONS));

export function isClearingFailure(reason: FailureReason): boolean {
  return CLEARING_REASON_SET.has(reason);
}

/**
 * The one place `SAFE_MONEY` is appended to a message anywhere in the app. `failureMessage`
 * uses it below for every clearing failure; `src/errorMessage.ts` calls it directly for the one
 * other case that needs the same reassurance without a `FailureReason` to hand — a network
 * error once a request could already have moved money.
 */
export function reassure(message: string): string {
  return `${message} ${SAFE_MONEY}`;
}

/** The message for a reason, with the reassurance appended if and only if it is a clearing failure. */
export function failureMessage(reason: FailureReason): string {
  const message = FAILURE_MESSAGES[reason];
  return isClearingFailure(reason) ? reassure(message) : message;
}

export type NextStatusAction = 'try_again' | 'try_later' | 'make_another';

/**
 * What the status screen offers after a failed deposit. Only clearing and voucher reasons can
 * reach a `Deposit`, and none of them means "change your destination" — the destination was
 * already resolved successfully before Send, so there is nothing to change.
 */
export function nextStatusAction(reason: FailureReason): NextStatusAction {
  if (reason === 'insufficient_float') return 'try_later';
  if (reason === 'limit_exceeded') return 'make_another';
  return 'try_again';
}

/** Every member of each group, for the loop test that enforces the reassurance rule. */
export const ALL_IDENTITY_FAILURES = Object.keys(
  IDENTITY_FAILURE_REASONS,
) as (keyof typeof IDENTITY_FAILURE_REASONS)[];
export const ALL_CLEARING_FAILURES = Object.keys(
  CLEARING_FAILURE_REASONS,
) as (keyof typeof CLEARING_FAILURE_REASONS)[];
export const ALL_VOUCHER_FAILURES = Object.keys(
  VOUCHER_FAILURE_REASONS,
) as (keyof typeof VOUCHER_FAILURE_REASONS)[];
