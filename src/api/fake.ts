/**
 * In-memory fake backend for demos and tests. Every scenario is chosen by the last digit of the
 * PIN or the ShapID's number, so any case can be reproduced on a phone without code changes
 * (see TESTING.md).
 *
 * Voucher scenarios (PIN's last digit):
 *   0  R500 voucher    pending -> submitted (1.5 s) -> completed (3 s)
 *   1  error           voucher_already_redeemed
 *   2  R200 voucher    ... -> failed insufficient_float (3 s)
 *   3  R1 000 voucher  ... -> failed bank_unavailable (3 s)
 *   4  network error on lookup (simulates no signal)
 *   5  R50 voucher     submitted stays for 100 s, then completed
 *   6  R8 voucher      lookup works; too small to deposit
 *   7-9 error          voucher_not_found
 *
 * ShapID scenarios (last digit of the number, ignoring any @suffix):
 *   9  shapid_not_found
 *   8  shapid_suspended
 *   7  shapid_ambiguous, unless a @bank suffix is present — then resolves at that bank
 *   6  network error (simulates no signal)
 *   anything else  { shapName: 'M. Mothiba', bankId: 'capitec' }
 *
 * The voucher scenario, payout and start time are encoded in the voucher token and deposit id,
 * so `getDepositStatus` keeps working after the app is killed and reopened (resume-after-close).
 * Idempotency and the "voucher already used" check are remembered in memory only, like a real
 * server's database would be for the life of this process.
 *
 * Registration scenarios (the ID number's sequence digits, positions 7-10 of 13):
 *   8001010000081  sequence 0000  id_verification_failed
 *   8001010001089  sequence 0001  id_number_already_registered
 *   8001010003085  sequence 0003  network error (simulates no signal)
 *   any other valid adult ID (e.g. 8001015009087)  registered
 *
 * Adding a PayShap number: the ShapID scenarios above, plus
 *   5  shapid_name_mismatch (registered, but to someone else)
 *   anything else  registered in the user's own name: "T. Mokoena" for Thabo Mokoena
 * Adding a bank account (the account number's last digit):
 *   9  account_not_found     8  account_holder_mismatch     anything else  verified
 * At most 5 payout methods.
 *
 * Branch codes: each bank's universal branch code finds that bank, e.g. 198765 Nedbank,
 * 678910 TymeBank; 584000 is Grindrod Bank, a real bank we can't pay into yet; any other code
 * is branch_code_not_found.
 *
 * The fake has no database: registered names, payout methods and the deposits listed by
 * `listMyDeposits` last until the app reloads. The app keeps its own copies of both lists, so
 * after a reload "Paying into" and history still show; the payout-methods screen then shows
 * what was added since.
 *
 * Logs never contain the PIN, the ShapID, the ID number or an account number: only the
 * scenario digits.
 */
import { isBankId } from '../domain/banks';
import { calculatePayout, FAKE_FLAT_FEE_CENTS, MIN_VOUCHER_CENTS } from '../domain/fees';
import type { StoredDestination } from '../domain/destination';
import { parseSaId } from '../domain/saId';
import { formatRand, type Cents } from '../domain/money';
import { ApiError } from './errors';
import type { ApiClient } from './client';
import type {
  BankId,
  BranchCodeLookup,
  ClearingFailure,
  Deposit,
  DepositRecord,
  DepositStatus,
  NewPayoutMethod,
  PayoutMethod,
  RegisteredUser,
  Registration,
  ResolvedShapId,
  VoucherFailure,
  VoucherLookup,
} from './types';

/** Universal branch codes. Null: a real bank that isn't one we can pay into. */
const FAKE_BRANCH_CODES: Readonly<Record<string, { bankName: string; bankId: BankId | null }>> = {
  '470010': { bankName: 'Capitec', bankId: 'capitec' },
  '250655': { bankName: 'FNB', bankId: 'fnb' },
  '632005': { bankName: 'Absa', bankId: 'absa' },
  '051001': { bankName: 'Standard Bank', bankId: 'standard_bank' },
  '198765': { bankName: 'Nedbank', bankId: 'nedbank' },
  '678910': { bankName: 'TymeBank', bankId: 'tymebank' },
  '430000': { bankName: 'African Bank', bankId: 'african_bank' },
  '679000': { bankName: 'Discovery Bank', bankId: 'discovery_bank' },
  '888000': { bankName: 'Bank Zero', bankId: 'bank_zero' },
  '580105': { bankName: 'Investec', bankId: 'investec' },
  '584000': { bankName: 'Grindrod Bank', bankId: null },
};

const SCENARIO_VOUCHER_CENTS: Readonly<Record<number, Cents>> = {
  0: 50000,
  2: 20000,
  3: 100000,
  5: 5000,
  6: 800,
};

const SUBMITTED_AFTER_MS = 1500;
const COMPLETED_AFTER_MS = 3000;
const SLOW_COMPLETED_AFTER_MS = SUBMITTED_AFTER_MS + 100_000;

const TOKEN_PREFIX = 'fkv';
const DEPOSIT_PREFIX = 'fkd';

/** 500-900 ms, inclusive, so calls feel like a real network. */
export function randomDelayMs(random: () => number = Math.random): number {
  return 500 + Math.floor(random() * 401);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FakeApiOptions {
  /** Delay applied to every call. Tests pass `() => 0`. */
  delayMs?: () => number;
  now?: () => number;
  random?: () => number;
  log?: (message: string) => void;
}

interface TokenParts {
  scenario: number;
  valueCents: Cents;
}

interface DepositParts {
  scenario: number;
  payoutCents: Cents;
  createdAt: number;
  code: string; // 6 hex chars, becomes the reference
}

function decodeToken(token: string): TokenParts | null {
  const match = /^fkv_(\d)_(\d+)_[0-9a-z]+$/.exec(token);
  if (!match) return null;
  return { scenario: Number(match[1]), valueCents: Number(match[2]) };
}

function decodeDepositId(id: string): DepositParts | null {
  const match = /^fkd_(\d)_(\d+)_([0-9a-z]+)_([0-9A-F]{6})$/.exec(id);
  if (!match) return null;
  return {
    scenario: Number(match[1]),
    payoutCents: Number(match[2]),
    createdAt: parseInt(match[3], 36),
    code: match[4],
  };
}

function statusAt(
  scenario: number,
  elapsedMs: number,
): { status: DepositStatus; failureReason?: ClearingFailure | VoucherFailure } {
  if (elapsedMs < SUBMITTED_AFTER_MS) return { status: 'pending' };

  switch (scenario) {
    case 2:
      return elapsedMs < COMPLETED_AFTER_MS
        ? { status: 'submitted' }
        : { status: 'failed', failureReason: 'insufficient_float' };
    case 3:
      return elapsedMs < COMPLETED_AFTER_MS
        ? { status: 'submitted' }
        : { status: 'failed', failureReason: 'bank_unavailable' };
    case 5:
      return { status: elapsedMs < SLOW_COMPLETED_AFTER_MS ? 'submitted' : 'completed' };
    default:
      return { status: elapsedMs < COMPLETED_AFTER_MS ? 'submitted' : 'completed' };
  }
}

export function createFakeApi(options: FakeApiOptions = {}): ApiClient {
  const delayMs = options.delayMs ?? (() => randomDelayMs());
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const log = options.log ?? ((message: string) => console.log(message));

  /** idempotency key -> deposit id */
  const depositByKey = new Map<string, string>();
  /** voucher token -> the key that redeemed it */
  const keyByToken = new Map<string, string>();
  /** last status logged per deposit, so polling logs transitions rather than every second */
  const lastLoggedStatus = new Map<string, DepositStatus>();
  /** deposit id -> where it was sent, for listMyDeposits; newest last */
  const sentTo = new Map<string, StoredDestination>();
  /** Saved payout methods, in the order added. */
  let methods: PayoutMethod[] = [];
  /** The registered user's names, to put on their own PayShap numbers and accounts. */
  let registeredNames = 'Thabo Mokoena';

  const MAX_METHODS = 5;

  /** "Thabo Sipho Mokoena" -> "T. Mokoena": the masked name PayShap shows. */
  const maskedName = (fullNames: string) => {
    const parts = fullNames.split(' ');
    return `${parts[0].charAt(0).toUpperCase()}. ${parts[parts.length - 1]}`;
  };

  /** Default first, then newest, as the server lists them. */
  const listed = () => [...methods.filter((m) => m.isDefault), ...methods.filter((m) => !m.isDefault).reverse()];

  function save(method: PayoutMethod, makeDefault: boolean): PayoutMethod {
    const existing = methods.find((m) =>
      m.kind === 'shapId' && method.kind === 'shapId'
        ? m.shapId === method.shapId
        : m.kind === 'account' && method.kind === 'account'
          ? m.bankId === method.bankId && m.accountLast4 === method.accountLast4
          : false,
    );
    const target = existing ?? method;
    if (!existing) {
      if (methods.length >= MAX_METHODS) throw ApiError.business('payout_method_limit');
      methods.push(target);
    }
    if (makeDefault || methods.length === 1) {
      methods = methods.map((m) => ({ ...m, isDefault: m.id === target.id }));
    }
    return methods.find((m) => m.id === target.id) ?? target;
  }

  const randomChars = (radix: 16 | 36, length: number) =>
    Math.floor(random() * radix ** length)
      .toString(radix)
      .padStart(length, '0');

  function viewDeposit(id: string): Deposit {
    const parts = decodeDepositId(id);
    if (!parts) throw ApiError.business('unknown');

    const { status, failureReason } = statusAt(parts.scenario, now() - parts.createdAt);
    const deposit: Deposit = {
      id,
      reference: `KD-${parts.code}`,
      status,
      payoutCents: parts.payoutCents,
    };
    if (failureReason) deposit.failureReason = failureReason;

    if (lastLoggedStatus.get(id) !== status) {
      lastLoggedStatus.set(id, status);
      log(
        `[fake-api] getDepositStatus scenario ${parts.scenario} -> ${status}` +
          (failureReason ? ` (${failureReason})` : ''),
      );
    }
    return deposit;
  }

  return {
    async lookupVoucher(pin: string): Promise<VoucherLookup> {
      await sleep(delayMs());

      const scenario = /^\d{16}$/.test(pin) ? Number(pin[pin.length - 1]) : null;
      if (scenario === null) {
        log('[fake-api] lookupVoucher: not a 16-digit PIN -> voucher_not_found');
        throw ApiError.business('voucher_not_found');
      }

      if (scenario === 4) {
        log('[fake-api] lookupVoucher scenario 4 -> network error');
        throw ApiError.network('Simulated no signal');
      }
      if (scenario === 1) {
        log('[fake-api] lookupVoucher scenario 1 -> voucher_already_redeemed');
        throw ApiError.business('voucher_already_redeemed');
      }
      const valueCents = SCENARIO_VOUCHER_CENTS[scenario];
      if (valueCents === undefined) {
        log(`[fake-api] lookupVoucher scenario ${scenario} -> voucher_not_found`);
        throw ApiError.business('voucher_not_found');
      }

      const feeCents = FAKE_FLAT_FEE_CENTS;
      log(`[fake-api] lookupVoucher scenario ${scenario} -> ${formatRand(valueCents)} voucher`);
      return {
        voucherToken: `${TOKEN_PREFIX}_${scenario}_${valueCents}_${randomChars(36, 6)}`,
        valueCents,
        feeCents,
        payoutCents: calculatePayout(valueCents, feeCents),
      };
    },

    async lookupBranchCode(branchCode: string): Promise<BranchCodeLookup> {
      await sleep(delayMs());
      const found = FAKE_BRANCH_CODES[branchCode];
      if (!found) {
        log('[fake-api] lookupBranchCode -> branch_code_not_found');
        throw ApiError.business('branch_code_not_found');
      }
      log(`[fake-api] lookupBranchCode -> ${found.bankName}`);
      return found;
    },

    async resolveShapId(shapId: string): Promise<ResolvedShapId> {
      await sleep(delayMs());

      const [numberPart, rawSuffix] = shapId.split('@');
      const digit = numberPart.slice(-1);

      if (digit === '9') {
        log('[fake-api] resolveShapId scenario 9 -> shapid_not_found');
        throw ApiError.business('shapid_not_found');
      }
      if (digit === '8') {
        log('[fake-api] resolveShapId scenario 8 -> shapid_suspended');
        throw ApiError.business('shapid_suspended');
      }
      if (digit === '7') {
        if (rawSuffix === undefined) {
          log('[fake-api] resolveShapId scenario 7 -> shapid_ambiguous');
          throw ApiError.business('shapid_ambiguous');
        }
        const bankId = isBankId(rawSuffix) ? rawSuffix : 'capitec';
        log(`[fake-api] resolveShapId scenario 7 with a bank chosen -> resolved at ${bankId}`);
        return { shapName: 'M. Mothiba', bankId };
      }
      if (digit === '6') {
        log('[fake-api] resolveShapId scenario 6 -> network error');
        throw ApiError.network('Simulated no signal');
      }

      log(`[fake-api] resolveShapId scenario ${digit} -> resolved at capitec`);
      return { shapName: 'M. Mothiba', bankId: 'capitec' };
    },

    async createDeposit(
      voucherToken: string,
      payoutMethodId: string,
      idempotencyKey: string,
    ): Promise<Deposit> {
      await sleep(delayMs());

      // Idempotency first: the same key always returns the same deposit, even if the
      // destination changed since. A real server does this to make double-pay impossible.
      const existing = depositByKey.get(idempotencyKey);
      if (existing) {
        log(`[fake-api] createDeposit replay of key ${idempotencyKey.slice(0, 8)} -> same deposit`);
        return viewDeposit(existing);
      }

      const token = decodeToken(voucherToken);
      if (!token) {
        log('[fake-api] createDeposit: unknown voucher token -> voucher_not_found');
        throw ApiError.business('voucher_not_found');
      }
      if (token.valueCents < MIN_VOUCHER_CENTS) {
        log(`[fake-api] createDeposit scenario ${token.scenario} -> voucher_too_small`);
        throw ApiError.business('voucher_too_small');
      }
      // A different key for an already-redeemed voucher would be a second payout.
      if (keyByToken.has(voucherToken)) {
        log(`[fake-api] createDeposit scenario ${token.scenario} -> voucher_already_redeemed`);
        throw ApiError.business('voucher_already_redeemed');
      }

      const payoutCents = calculatePayout(token.valueCents, FAKE_FLAT_FEE_CENTS);
      const createdAt = now();
      const code = randomChars(16, 6).toUpperCase();
      const id = `${DEPOSIT_PREFIX}_${token.scenario}_${payoutCents}_${createdAt.toString(36)}_${code}`;

      depositByKey.set(idempotencyKey, id);
      // After a reload the fake has forgotten its methods; any id still pays (the app's own copy
      // of the method is what history shows then).
      const method = methods.find((m) => m.id === payoutMethodId);
      if (method) {
        const { id: _methodId, isDefault: _isDefault, ...destination } = method;
        sentTo.set(id, destination);
      }
      keyByToken.set(voucherToken, idempotencyKey);
      log(
        `[fake-api] createDeposit scenario ${token.scenario} -> new deposit KD-${code} ` +
          `(${formatRand(payoutCents)})`,
      );
      return viewDeposit(id);
    },

    async getDepositStatus(id: string): Promise<Deposit> {
      await sleep(delayMs());
      return viewDeposit(id);
    },

    async registerUser(registration: Registration): Promise<RegisteredUser> {
      await sleep(delayMs());

      const parsed = parseSaId(registration.idNumber, new Date(now()));
      if (!parsed.ok) {
        const reason = parsed.reason === 'under_age' ? 'id_number_under_age' : 'id_number_invalid';
        log(`[fake-api] registerUser -> ${reason}`);
        throw ApiError.business(reason);
      }
      const sequence = parsed.idNumber.slice(6, 10);
      if (sequence === '0000') {
        log('[fake-api] registerUser sequence 0000 -> id_verification_failed');
        throw ApiError.business('id_verification_failed');
      }
      if (sequence === '0001') {
        log('[fake-api] registerUser sequence 0001 -> id_number_already_registered');
        throw ApiError.business('id_number_already_registered');
      }
      if (sequence === '0003') {
        log('[fake-api] registerUser sequence 0003 -> network error');
        throw ApiError.network('Simulated no signal');
      }

      log('[fake-api] registerUser -> registered');
      registeredNames = registration.fullNames.replace(/\s+/g, ' ').trim();
      methods = [];
      return {
        userId: `fku_${randomChars(36, 8)}`,
        accessToken: `fkt_${randomChars(36, 8)}${randomChars(36, 8)}`,
        fullNames: registeredNames,
      };
    },

    async listMyDeposits(): Promise<DepositRecord[]> {
      await sleep(delayMs());
      const records: DepositRecord[] = [];
      for (const [id, destination] of sentTo) {
        const parts = decodeDepositId(id);
        if (!parts) continue;
        records.push({
          ...viewDeposit(id),
          valueCents: parts.payoutCents + FAKE_FLAT_FEE_CENTS,
          feeCents: FAKE_FLAT_FEE_CENTS,
          createdAt: parts.createdAt,
          destination,
        });
      }
      log(`[fake-api] listMyDeposits -> ${records.length} deposit(s)`);
      return records.reverse();
    },

    async listPayoutMethods(): Promise<PayoutMethod[]> {
      await sleep(delayMs());
      return listed();
    },

    async addPayoutMethod(input: NewPayoutMethod, makeDefault: boolean): Promise<PayoutMethod> {
      await sleep(delayMs());
      const id = `fkm_${randomChars(36, 8)}`;

      if (input.kind === 'account') {
        const digit = input.accountNumber.slice(-1);
        if (input.accountNumber.length < 7 || input.accountNumber.length > 11) {
          throw ApiError.business('invalid_account');
        }
        if (digit === '9') {
          log('[fake-api] addPayoutMethod account scenario 9 -> account_not_found');
          throw ApiError.business('account_not_found');
        }
        if (digit === '8') {
          log('[fake-api] addPayoutMethod account scenario 8 -> account_holder_mismatch');
          throw ApiError.business('account_holder_mismatch');
        }
        log(`[fake-api] addPayoutMethod account scenario ${digit} -> verified`);
        return save(
          {
            id,
            isDefault: false,
            kind: 'account',
            name: registeredNames,
            accountLast4: input.accountNumber.slice(-4),
            bankId: input.bankId,
          },
          makeDefault,
        );
      }

      const [numberPart, rawSuffix] = input.shapId.split('@');
      const digit = numberPart.slice(-1);
      const scripted: Record<string, () => never> = {
        '9': () => {
          throw ApiError.business('shapid_not_found');
        },
        '8': () => {
          throw ApiError.business('shapid_suspended');
        },
        '6': () => {
          throw ApiError.network('Simulated no signal');
        },
        '5': () => {
          throw ApiError.business('shapid_name_mismatch');
        },
      };
      if (digit === '7' && rawSuffix === undefined) {
        log('[fake-api] addPayoutMethod shapId scenario 7 -> shapid_ambiguous');
        throw ApiError.business('shapid_ambiguous');
      }
      if (scripted[digit]) {
        log(`[fake-api] addPayoutMethod shapId scenario ${digit} -> refused`);
        scripted[digit]();
      }
      const bankId = rawSuffix !== undefined && isBankId(rawSuffix) ? rawSuffix : 'capitec';
      log(`[fake-api] addPayoutMethod shapId scenario ${digit} -> added at ${bankId}`);
      return save(
        {
          id,
          isDefault: false,
          kind: 'shapId',
          shapId: input.shapId,
          shapName: maskedName(registeredNames),
          bankId,
        },
        makeDefault,
      );
    },

    async setDefaultPayoutMethod(methodId: string): Promise<PayoutMethod[]> {
      await sleep(delayMs());
      if (!methods.some((m) => m.id === methodId)) throw ApiError.business('payout_method_not_found');
      methods = methods.map((m) => ({ ...m, isDefault: m.id === methodId }));
      return listed();
    },

    async removePayoutMethod(methodId: string): Promise<PayoutMethod[]> {
      await sleep(delayMs());
      const removed = methods.find((m) => m.id === methodId);
      if (!removed) throw ApiError.business('payout_method_not_found');
      methods = methods.filter((m) => m.id !== methodId);
      if (removed.isDefault && methods.length > 0) {
        const newest = methods[methods.length - 1];
        methods = methods.map((m) => ({ ...m, isDefault: m.id === newest.id }));
      }
      return listed();
    },
  };
}

export const fakeApi: ApiClient = createFakeApi();
