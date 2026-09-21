import * as SecureStore from 'expo-secure-store';

import type { Beneficiary } from '../api/types';
import {
  BENEFICIARY_KEY,
  parseBeneficiary,
  serialiseBeneficiary,
  type StoredBeneficiary,
} from './beneficiaryRecord';

/**
 * Saved banking details, or null if there are none we can use.
 *
 * A record that is present but wrong (bad shape, unknown version, corrupt JSON) is deleted, so
 * the user is asked again. A read that throws is different: that is the device's keystore
 * misbehaving, and the data may be fine, so we do not delete anything.
 */
export async function loadBeneficiary(): Promise<StoredBeneficiary | null> {
  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(BENEFICIARY_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  const parsed = parseBeneficiary(raw);
  if (parsed === null) {
    try {
      await SecureStore.deleteItemAsync(BENEFICIARY_KEY);
    } catch {
      // Nothing more to do; setup will overwrite it.
    }
  }
  return parsed;
}

/** Rejects if the device could not store the details; the caller tells the user. */
export async function saveBeneficiary(beneficiary: Beneficiary): Promise<void> {
  await SecureStore.setItemAsync(BENEFICIARY_KEY, serialiseBeneficiary(beneficiary, Date.now()));
}
