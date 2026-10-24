/**
 * Signing this phone out.
 *
 * The demo case and the real one are the same: a phone must be able to
 * go back to knowing nothing, so the next launch starts at registering.
 * What matters is that NOTHING is left behind -- a phone that forgets
 * the history but keeps the access token is still signed in.
 */

// Must be named mock* : jest.mock factories are hoisted above the
// file, and only `mock`-prefixed names may be referenced from inside one.
const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => void mockStore.set(k, v)),
  deleteItemAsync: jest.fn(async (k: string) => void mockStore.delete(k)),
}));

import * as SecureStore from 'expo-secure-store';

import { ACTIVE_DEPOSIT_KEY } from './activeDepositRecord';
import { HISTORY_INDEX_KEY, historyEntryKey } from './historyRecord';
import { PAYOUT_METHODS_KEY } from './payoutMethodsRecord';
import { RETURNING_KEY } from './returning';
import { signOut } from './session';
import { USER_KEY } from './userRecord';

const DEPOSIT_IDS = ['d-1', 'd-2'];

function seedASignedInPhone() {
  mockStore.clear();
  mockStore.set(USER_KEY, '{"accessToken":"secret-token"}');
  mockStore.set(PAYOUT_METHODS_KEY, '[{"id":"pm-1"}]');
  mockStore.set(ACTIVE_DEPOSIT_KEY, '{"depositId":"d-1"}');
  // The index is a plain array of ids (serialiseHistoryIndex).
  mockStore.set(HISTORY_INDEX_KEY, JSON.stringify(DEPOSIT_IDS));
  for (const id of DEPOSIT_IDS) mockStore.set(historyEntryKey(id), `{"depositId":"${id}"}`);
}

beforeEach(() => {
  seedASignedInPhone();
  jest.clearAllMocks();
});

describe('signOut', () => {
  it('leaves nothing identifying behind', async () => {
    await signOut();
    // The returning marker is deliberately kept; everything that could
    // say who the person was is gone.
    expect([...mockStore.keys()].filter((k) => k !== RETURNING_KEY)).toEqual([]);
  });

  it('removes the access token, which is what being signed in means', async () => {
    await signOut();
    expect(mockStore.get(USER_KEY)).toBeUndefined();
  });

  it('removes every history entry, not just the index', async () => {
    // Dropping the index alone would orphan the entries: they would sit
    // in SecureStore unreachable, and a later user of this phone could
    // still read a previous person's deposits off the device.
    await signOut();
    for (const id of DEPOSIT_IDS) expect(mockStore.get(historyEntryKey(id))).toBeUndefined();
  });

  it('still forgets the token when another key refuses to clear', async () => {
    // A half-signed-out phone that keeps its token is the worst outcome,
    // so one failure must not abandon the rest.
    // mockImplementation, not ...Once: the first delete to run is not
    // necessarily the payout one, so a one-shot mock gets spent on an
    // unrelated key and nothing ever throws.
    (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (k: string) => {
      if (k === PAYOUT_METHODS_KEY) throw new Error('secure store unavailable');
      mockStore.delete(k);
    });
    await expect(signOut()).resolves.toBeUndefined();
    expect(mockStore.get(USER_KEY)).toBeUndefined();
  });

  it('keeps only the fact that someone once registered here', async () => {
    // Sign-out forgets WHO you are. This single boolean remembers only
    // THAT the app has been used on this phone, so the register screen
    // can call itself "Sign in" next time. It names nobody, so it is
    // not something sign-out promised to forget.
    mockStore.set(RETURNING_KEY, '1');
    await signOut();
    expect(mockStore.get(RETURNING_KEY)).toBe('1');
    expect(mockStore.get(USER_KEY)).toBeUndefined();
  });

  it('is safe on a phone that was never signed in', async () => {
    mockStore.clear();
    await expect(signOut()).resolves.toBeUndefined();
  });
});
