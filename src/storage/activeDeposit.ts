import * as SecureStore from 'expo-secure-store';

import {
  ACTIVE_DEPOSIT_KEY,
  parseActiveDeposit,
  serialiseActiveDeposit,
  type ActiveDeposit,
} from './activeDepositRecord';

/** The unfinished deposit to resume, or null. Stale or unreadable entries are removed. */
export async function loadActiveDeposit(now: number = Date.now()): Promise<ActiveDeposit | null> {
  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(ACTIVE_DEPOSIT_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  const parsed = parseActiveDeposit(raw, now);
  if (parsed.kind === 'valid') return parsed.deposit;

  await clearActiveDeposit();
  return null;
}

export async function saveActiveDeposit(deposit: ActiveDeposit): Promise<void> {
  await SecureStore.setItemAsync(ACTIVE_DEPOSIT_KEY, serialiseActiveDeposit(deposit));
}

/** Never rejects: failing to clear must not get in the way of showing the user their result. */
export async function clearActiveDeposit(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ACTIVE_DEPOSIT_KEY);
  } catch {
    // Ignored: an old entry is discarded by the 24 hour rule anyway.
  }
}
