/**
 * The phone's copy of the payout methods when secure storage will not keep it.
 *
 * Some emulators and locked-down phones refuse secure-storage writes. The
 * server's list must still be what the app uses for the rest of the session,
 * or "How do you want to get paid?" and the PIN screen disagree and bounce the
 * user between them.
 */

const mockStore = new Map<string, string>();
let mockWritesFail = false;

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    if (mockWritesFail) throw new Error('keystore unavailable');
    mockStore.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k: string) => void mockStore.delete(k)),
}));

const mockList = jest.fn();
jest.mock('../api/client', () => ({ api: { listPayoutMethods: () => mockList() } }));

import type { PayoutMethod } from '../api/types';
import {
  clearPayoutMethods,
  loadDefaultPayoutMethod,
  loadPayoutMethods,
  refreshPayoutMethods,
} from './payoutMethods';

const SERVER_METHOD: PayoutMethod = {
  id: 'pm-1',
  isDefault: true,
  kind: 'shapId',
  shapId: '+27820000003',
  shapName: 'I. Tjale',
  bankId: 'capitec',
};

beforeEach(async () => {
  mockStore.clear();
  mockWritesFail = false;
  mockList.mockReset();
  await clearPayoutMethods();
});

it('uses the server list for the session even when the phone cannot save it', async () => {
  mockWritesFail = true;
  mockList.mockResolvedValue([SERVER_METHOD]);

  await refreshPayoutMethods();

  expect(mockStore.size).toBe(0); // nothing was saved...
  expect(await loadDefaultPayoutMethod()).toEqual(SERVER_METHOD); // ...and the PIN screen still sees it
});

it('still saves the copy when the phone can', async () => {
  mockList.mockResolvedValue([SERVER_METHOD]);
  await refreshPayoutMethods();
  expect(mockStore.size).toBe(1);
  expect(await loadPayoutMethods()).toEqual([SERVER_METHOD]);
});

it('forgets everything on sign-out, in memory too', async () => {
  mockList.mockResolvedValue([SERVER_METHOD]);
  await refreshPayoutMethods();
  await clearPayoutMethods();
  expect(await loadDefaultPayoutMethod()).toBeNull();
});
