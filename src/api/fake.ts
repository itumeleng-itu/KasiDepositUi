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
 *   8001010002087  sequence 0002  shapid_name_mismatch
 *   8001010003085  sequence 0003  network error (simulates no signal)
 *   any other valid adult ID (e.g. 8001015009087)  registered
 *
 * `listMyDeposits` returns the deposits created since the app started: the fake has no
 * database, so after a reload the app's own saved history is what the user sees.
 *
 * Logs never contain the PIN, the ShapID or the ID number: only the scenario digits.
 */
import { isBankId } from '../domain/banks';
import { calculatePayout, FAKE_FLAT_FEE_CENTS, MIN_VOUCHER_CENTS } from '../domain/fees';
import { parseSaId } from '../domain/saId';
import { formatRand, type Cents } from '../domain/money';
import { ApiError } from './errors';
import type { ApiClient } from './client';
import type {
  ClearingFailure,
  Deposit,
  DepositRecord,
  DepositStatus,
  Destination,
  RegisteredUser,
  Registration,
  ResolvedShapId,
  VoucherFailure,
  VoucherLookup,
} from './types';

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
  const sentTo = new Map<string, Destination>();

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
      destination: Destination,
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
      sentTo.set(id, destination);
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
      if (sequence === '0002') {
        log('[fake-api] registerUser sequence 0002 -> shapid_name_mismatch');
        throw ApiError.business('shapid_name_mismatch');
      }
      if (sequence === '0003') {
        log('[fake-api] registerUser sequence 0003 -> network error');
        throw ApiError.network('Simulated no signal');
      }

      log('[fake-api] registerUser -> registered');
      return {
        userId: `fku_${randomChars(36, 8)}`,
        accessToken: `fkt_${randomChars(36, 8)}${randomChars(36, 8)}`,
        fullNames: registration.fullNames.replace(/\s+/g, ' ').trim(),
      };
    },

    async listMyDeposits(): Promise<DepositRecord[]> {
      await sleep(delayMs());
      const records: DepositRecord[] = [];
      for (const [id, destination] of sentTo) {
        const parts = decodeDepositId(id);
        if (!parts) continue;
        const [, suffix] = destination.kind === 'shapId' ? destination.shapId.split('@') : [];
        records.push({
          ...viewDeposit(id),
          valueCents: parts.payoutCents + FAKE_FLAT_FEE_CENTS,
          feeCents: FAKE_FLAT_FEE_CENTS,
          createdAt: parts.createdAt,
          destination:
            destination.kind === 'shapId'
              ? {
                  kind: 'shapId',
                  shapId: destination.shapId,
                  shapName: 'M. Mothiba',
                  bankId: suffix !== undefined && isBankId(suffix) ? suffix : 'capitec',
                }
              : destination,
        });
      }
      log(`[fake-api] listMyDeposits -> ${records.length} deposit(s)`);
      return records.reverse();
    },
  };
}

export const fakeApi: ApiClient = createFakeApi();
