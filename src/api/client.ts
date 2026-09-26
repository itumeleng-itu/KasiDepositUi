import { fakeApi } from './fake';
import { httpApi } from './http';
import type {
  Deposit,
  DepositRecord,
  Destination,
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
  /** Safe to retry with the same `idempotencyKey`: the server returns the same deposit. */
  createDeposit(
    voucherToken: string,
    destination: Destination,
    idempotencyKey: string,
  ): Promise<Deposit>;
  getDepositStatus(id: string): Promise<Deposit>;
  /**
   * Creates the user, or re-links this phone if the same person registers again with the same
   * details (a reinstall). The server verifies the ID with Home Affairs and checks the ShapID
   * belongs to the same person. Needs no session; every other call except `resolveShapId` does.
   */
  registerUser(registration: Registration): Promise<RegisteredUser>;
  /** The signed-in user's most recent deposits, newest first. */
  listMyDeposits(): Promise<DepositRecord[]>;
}

// Read as a literal so Expo can inline it at build time.
const useFakeApi = process.env.EXPO_PUBLIC_USE_FAKE_API === 'true';

export const api: ApiClient = useFakeApi ? fakeApi : httpApi;
