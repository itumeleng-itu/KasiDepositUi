import { fakeApi } from './fake';
import { httpApi } from './http';
import type {
  Deposit,
  DepositRecord,
  NewPayoutMethod,
  PayoutMethod,
  RegisteredUser,
  Registration,
  ResolvedShapId,
  VoucherLookup,
} from './types';

/**
 * The only thing screens talk to. Every method rejects with an `ApiError`
 * (kind 'business' or 'network'); nothing else is meant to escape.
 */
export interface ApiClient {
  /** The PIN is sent once, here. After this only `voucherToken` is used. */
  lookupVoucher(pin: string): Promise<VoucherLookup>;
  /**
   * Phase 1 (identity): looks the ShapID up in the proxy directory. Nothing is reserved and
   * nothing can be lost yet, so a failure here is an `IdentityFailure`, never a clearing one.
   */
  resolveShapId(shapId: string): Promise<ResolvedShapId>;
  /**
   * Pays the voucher into one of the user's saved payout methods. Safe to retry with the same
   * `idempotencyKey`: the server returns the same deposit.
   */
  createDeposit(voucherToken: string, payoutMethodId: string, idempotencyKey: string): Promise<Deposit>;
  getDepositStatus(id: string): Promise<Deposit>;
  /**
   * Creates the user, or re-links this phone if the same person registers again with the same
   * details (a reinstall). Needs no session; every other call except `resolveShapId` does.
   */
  registerUser(registration: Registration): Promise<RegisteredUser>;
  /** Default first, then newest. */
  listPayoutMethods(): Promise<PayoutMethod[]>;
  /**
   * Checks and saves a payout method: a PayShap number must be registered in the user's own name
   * (else `shapid_name_mismatch`, or the directory's own reasons); an account must belong to the
   * user's ID number. Adding one that is already saved returns it. The first becomes the default.
   */
  addPayoutMethod(method: NewPayoutMethod, makeDefault: boolean): Promise<PayoutMethod>;
  /** Both return the whole list afterwards, so the phone's copy can simply be replaced. */
  setDefaultPayoutMethod(id: string): Promise<PayoutMethod[]>;
  removePayoutMethod(id: string): Promise<PayoutMethod[]>;
  /** The signed-in user's most recent deposits, newest first. */
  listMyDeposits(): Promise<DepositRecord[]>;
}

// Read as a literal so Expo can inline it at build time.
const useFakeApi = process.env.EXPO_PUBLIC_USE_FAKE_API === 'true';

export const api: ApiClient = useFakeApi ? fakeApi : httpApi;
