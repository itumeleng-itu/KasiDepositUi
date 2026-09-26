/**
 * Every user-facing string lives here so it can be translated (Sepedi, isiZulu) later.
 * Sentence case, plain words, no exclamation marks, no apologising. Say what happened and
 * what to do. Bank names are proper nouns and live in domain/banks.ts.
 */
import { MIN_VOUCHER_CENTS } from './domain/fees';
import { formatRand, spokenAmounts, spokenRand, type Cents } from './domain/money';
import { ACCOUNT_MAX, ACCOUNT_MIN, type AccountError } from './domain/account';
import type { FullNamesError } from './domain/name';
import { MIN_AGE_YEARS, type SaIdError } from './domain/saId';
import type { ShapIdFormatReason } from './domain/shapId';
import {
  CLEARING_FAILURE_REASONS,
  IDENTITY_FAILURE_REASONS,
  REGISTRATION_FAILURE_REASONS,
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

export const register = {
  title: 'Register',
  helper: 'We need these once, to know it is really you. Use the details on your ID.',
  fullNamesLabel: 'Full names',
  fullNamesHelper: 'All your names and surname, as on your ID.',
  idNumberLabel: 'SA ID number',
  idNumberHelper: 'The 13 digits on your green ID book or smart ID card.',
  continue: 'Continue',
  privacyNote:
    'Your ID number is sent to us once to verify you with Home Affairs. It is not saved on this phone.',
  fullNamesError: {
    required: 'Enter your full names.',
    one_name: 'Enter your first name and surname.',
    too_long: 'That is longer than we can accept. Use the names on your ID.',
    invalid_chars: 'Use letters, spaces, hyphens and apostrophes only.',
  } satisfies Record<FullNamesError, string>,
  idNumberError: {
    empty: 'Enter your ID number.',
    length: 'An SA ID number has 13 digits.',
    digits: 'An SA ID number has digits only.',
    birth_date: "That isn't a valid SA ID number. Check the first 6 digits (your birth date).",
    citizenship: "That isn't a valid SA ID number. Check each digit against your ID.",
    checksum: "That isn't a valid SA ID number. Check each digit against your ID.",
    under_age: `You must be ${MIN_AGE_YEARS} or older to use KasiDeposit.`,
  } satisfies Record<SaIdError, string>,
  /** Shown under the disabled Continue button, even before a field has been touched. */
  unmet: 'Fill in both to continue.',
  registering: 'Registering',
} as const;

/** Where the user is paid: choosing, adding and switching between PayShap numbers and accounts. */
export const payout = {
  chooseTitle: 'How do you want to get paid?',
  chooseHelper: 'You can add more later and choose which one to use.',
  payShapTitle: 'PayShap',
  payShapBody: 'Your cellphone number, if it is set up for PayShap in your banking app.',
  accountTitle: 'Bank account',
  accountBody: 'Your bank and account number, in your own name.',
  chooseLabel: (title: string, body: string) => `${title}. ${body}`,

  listTitle: 'Where your money goes',
  listHelper: 'Tap one to pay into it.',
  empty: "You haven't added anywhere to be paid yet.",
  payingInto: 'Paying into',
  kind: { shapId: 'PayShap', account: 'Bank account' },
  cardLabel: (kind: string, primary: string, spokenOneLine: string, selected: boolean) =>
    `${kind}, ${primary}, ${spokenOneLine}${selected ? ', paying into this one' : ''}`,
  cardHint: 'Pays into this one',
  remove: 'Remove',
  removeLabel: (spokenOneLine: string) => `Remove ${spokenOneLine}`,
  removeTitle: 'Remove this?',
  removeBody: (oneLine: string) => `You won't be able to pay into ${oneLine} until you add it again.`,
  addPayShap: 'Add a PayShap number',
  addAccount: 'Add a bank account',
  offline: "No connection. Showing what's saved on this phone.",
  changeFailed: "We couldn't change that. Check your connection and try again.",

  addPayShapTitle: 'Your PayShap number',
  addPayShapHelper: 'The cellphone number you set up for PayShap in your banking app. It must be in your name.',
  numberLabel: 'Cellphone number',
  bankPickerLabel: 'Which bank is it set up at?',
  addAccountTitle: 'Your bank account',
  addAccountHelper: 'The account must be in your own name. We check this with your bank.',
  holderLabel: 'Account holder',
  bankLabel: 'Bank',
  accountLabel: 'Account number',
  add: 'Add',
  checkingPayShap: 'Checking with PayShap',
  checkingAccount: 'Checking with your bank',
  useAccountInstead: 'Use a bank account instead',
  usePayShapInstead: 'Use PayShap instead',
  accountPrivacy: 'Your account number is sent once and kept encrypted. It is never saved on this phone.',
  /** Per-field error, shown once the field has been left. */
  parseError: {
    empty: 'Enter your cellphone number.',
    format: "That doesn't look like a South African mobile number.",
    unknown_bank: "We don't recognise that bank. Choose one from the list.",
  } satisfies Record<ShapIdFormatReason, string>,
  /** Shown under the disabled Add button, even before the field has been touched. */
  unmet: {
    empty: 'Enter your cellphone number.',
    format: 'Enter a valid cellphone number.',
    unknown_bank: 'Choose a bank you recognise.',
  } satisfies Record<ShapIdFormatReason, string>,
  accountError: {
    required: 'Enter your account number.',
    too_short: `An account number has at least ${ACCOUNT_MIN} digits.`,
    too_long: `An account number has at most ${ACCOUNT_MAX} digits.`,
  } satisfies Record<AccountError, string>,
  accountUnmet: 'Choose your bank and enter the account number.',
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
  scanButton: 'Scan voucher QR',
  historyButton: 'Your deposits',
} as const;

export const scan = {
  instruction: 'Point your camera at the QR code on the voucher slip.',
  invalidQr: "This isn't a KasiDeposit voucher. Scan the QR code on the till slip, or type the PIN.",
  /** Announced to a screen reader the moment a valid scan is found, before the lookup starts. */
  voucherFoundAnnouncement: 'Voucher found, checking…',
  typePinInstead: 'Type the PIN instead',
  permission: {
    // Shown before the OS dialog has ever been answered; the request fires automatically.
    asking: 'Asking for camera access…',
    deniedTitle: 'Camera access needed',
    deniedBody: 'KasiDeposit needs the camera to scan the QR code on your voucher slip.',
    tryAgain: 'Try again',
    permanentlyDeniedBody:
      'Camera access was turned off for KasiDeposit. Turn it on in Settings to scan a voucher.',
    openSettings: 'Open settings',
  },
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
  notMyDetails: 'Pay into a different account',
  tooSmall: `This voucher is too small to deposit. The minimum is ${MIN_VOUCHER}.`,
  /** Fee is shown as a deduction. U+2212 minus sign. */
  feeDisplay: (feeCents: Cents) => `− ${formatRand(feeCents)}`,
  feeLabel: (feeCents: Cents) => `Fee, ${spokenRand(feeCents)}`,
} as const;

export const status = {
  makeAnother: 'Make another deposit',
  tryAgain: common.tryAgain,
  tryAgainLater: 'Try again later',
  reference: (ref: string) => `Reference: ${ref}`,
  steps: { checked: 'Checked', sent: 'Sent', arrived: 'Arrived' },
  stepDone: 'done',
  stepCurrent: 'in progress',
  stepTodo: 'not yet',
  progressLabel: (current: string) => `Progress: ${current}`,
} as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "26 Sep 2026, 14:05" in the phone's local time. Built by hand so it reads the same on every device. */
export function formatSentAt(epochMs: number): string {
  const d = new Date(epochMs);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

export const history = {
  title: 'Your deposits',
  empty: 'Deposits you make will show here.',
  note: 'Your last 20 deposits.',
  /** Offline: the list is only what this phone had saved. */
  phoneOnly: "No connection. Showing what's saved on this phone.",
  /** Short, for the list: the words carry the state, not colour. */
  statusLabel: {
    pending: 'Sending',
    submitted: 'On its way',
    completed: 'Paid',
    failed: 'Not sent',
  } satisfies Record<DepositStatus, string>,
  rowLabel: (payoutCents: Cents, statusLabel: string, oneLine: string, when: string) =>
    `${spokenRand(payoutCents)}, ${statusLabel}, to ${oneLine}, ${when}`,
  rowHint: 'Opens the details',
  detailTitle: 'Deposit details',
  received: 'Received',
  sent: 'Sent',
  status: 'Status',
  reference: 'Reference',
  viewStatus: 'Follow this deposit',
  checking: 'Checking the latest status',
  notFound: "We couldn't find this deposit on this phone.",
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
  id_number_invalid: "That isn't a valid SA ID number. Check each digit against your ID.",
  id_number_under_age: `You must be ${MIN_AGE_YEARS} or older to use KasiDeposit.`,
  id_verification_failed:
    "We couldn't verify these details with Home Affairs. Check your names and ID number match your ID.",
  invalid_registration: 'Check your names. Use the names on your ID, with letters only.',
  registration_unavailable: "We can't register anyone right now. Try again later.",
  invalid_account: "That doesn't look like a valid account number. Check it in your banking app.",
  account_not_found: "We couldn't find that account at that bank. Check the bank and the account number.",
  account_holder_mismatch: 'This account is not in your name. Use an account in your own name.',
  accounts_unavailable: "We can't add bank accounts right now. Try again later, or use PayShap.",
  payout_method_limit: 'You can save up to 5. Remove one to add another.',
  payout_method_not_found: 'That one was already removed. Choose another.',
  id_number_already_registered:
    'This ID number is already registered with different details. Check your details, or contact support.',
  shapid_name_mismatch:
    'This PayShap number is registered to someone else. Use a number in your own name, or a bank account.',
  not_registered: 'You need to register again on this phone to continue.',
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
export const ALL_REGISTRATION_FAILURES = Object.keys(
  REGISTRATION_FAILURE_REASONS,
) as (keyof typeof REGISTRATION_FAILURE_REASONS)[];
