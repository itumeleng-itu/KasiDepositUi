/**
 * In-memory fake backend for demos and tests. Every scenario is chosen by the PIN's last digit,
 * so any case can be reproduced on a phone without code changes (see TESTING.md).
 *
 *   0  R500 voucher    pending -> submitted (1.5 s) -> completed (3 s)
 *   1  error           voucher_already_redeemed
 *   2  R200 voucher    ... -> failed invalid_account (3 s)
 *   3  R1 000 voucher  ... -> failed insufficient_float (3 s)
 *   4  network error on lookup (simulates no signal)
 *   5  R50 voucher     submitted stays for 100 s, then completed
 *   6  R8 voucher      lookup works; too small to deposit
 *   7-9 error          voucher_not_found
 *
 * The scenario, payout and start time are encoded in the voucher token and deposit id, so
 * `getDepositStatus` keeps working after the app is killed and reopened (resume-after-close).
 * Idempotency and the "voucher already used" check are remembered in memory only, like a
 * real server's database would be for the life of this process.
 *
 * Logs never contain the PIN: only the scenario digit.
 */
import { calculatePayout, FAKE_FLAT_FEE_CENTS, MIN_VOUCHER_CENTS } from '../domain/fees';
import { formatRand, type Cents } from '../domain/money';
import { ApiError } from './errors';
import type { ApiClient } from './client';
import type { Beneficiary, Deposit, DepositStatus, FailureReason, VoucherLookup } from './types';

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
): { status: DepositStatus; failureReason?: FailureReason } {
  if (elapsedMs < SUBMITTED_AFTER_MS) return { status: 'pending' };

  switch (scenario) {
    case 2:
      return elapsedMs < COMPLETED_AFTER_MS
        ? { status: 'submitted' }
        : { status: 'failed', failureReason: 'invalid_account' };
    case 3:
      return elapsedMs < COMPLETED_AFTER_MS
        ? { status: 'submitted' }
        : { status: 'failed', failureReason: 'insufficient_float' };
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

    async createDeposit(
      voucherToken: string,
      _beneficiary: Beneficiary,
      idempotencyKey: string,
    ): Promise<Deposit> {
      await sleep(delayMs());

      // Idempotency first: the same key always returns the same deposit, even if the
      // beneficiary changed since. A real server does this to make double-pay impossible.
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
  };
}

export const fakeApi: ApiClient = createFakeApi();
