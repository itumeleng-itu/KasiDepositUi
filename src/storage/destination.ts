import * as SecureStore from 'expo-secure-store';

import type { StoredDestination } from '../domain/destination';
import {
  DESTINATION_KEY,
  parseDestination,
  serialiseDestination,
  type StoredDestinationRecord,
} from './destinationRecord';

/** The pre-migration key. No migration: if it's there, it's simply removed. There are no users. */
const LEGACY_BENEFICIARY_KEY = 'kd.beneficiary.v1';

/**
 * Saved destination, or null if there is none we can use.
 *
 * A record that is present but wrong (bad shape, unknown version, corrupt JSON) is deleted, so
 * the user is asked again. A read that throws is different: that is the device's keystore
 * misbehaving, and the data may be fine, so we do not delete anything.
 */
export async function loadDestination(): Promise<StoredDestinationRecord | null> {
  try {
    await SecureStore.deleteItemAsync(LEGACY_BENEFICIARY_KEY);
  } catch {
    // No legacy entry, or the keystore is having trouble; either way, nothing more to do here.
  }

  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(DESTINATION_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  const parsed = parseDestination(raw);
  if (parsed === null) {
    try {
      await SecureStore.deleteItemAsync(DESTINATION_KEY);
    } catch {
      // Nothing more to do; setup will overwrite it.
    }
  }
  return parsed;
}

/** Rejects if the device could not store the destination; the caller tells the user. */
export async function saveDestination(destination: StoredDestination, resolvedAt: number): Promise<void> {
  await SecureStore.setItemAsync(DESTINATION_KEY, serialiseDestination(destination, resolvedAt, Date.now()));
}
