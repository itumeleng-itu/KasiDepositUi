import * as SecureStore from 'expo-secure-store';

import { api } from '../api/client';
import type { NewPayoutMethod, PayoutMethod } from '../api/types';
import {
  defaultMethod,
  LEGACY_DESTINATION_KEYS,
  PAYOUT_METHODS_KEY,
  parsePayoutMethods,
  serialisePayoutMethods,
} from './payoutMethodsRecord';

/** The phone's copy. Never rejects: trouble reading is an empty list. */
export async function loadPayoutMethods(): Promise<PayoutMethod[]> {
  for (const key of LEGACY_DESTINATION_KEYS) {
    SecureStore.deleteItemAsync(key).catch(() => {});
  }
  try {
    const raw = await SecureStore.getItemAsync(PAYOUT_METHODS_KEY);
    return raw === null ? [] : parsePayoutMethods(raw);
  } catch {
    return [];
  }
}

/** Where "Paying into" points, or null if the user has not added anywhere yet. */
export async function loadDefaultPayoutMethod(): Promise<PayoutMethod | null> {
  return defaultMethod(await loadPayoutMethods());
}

async function keep(methods: PayoutMethod[]): Promise<PayoutMethod[]> {
  try {
    await SecureStore.setItemAsync(PAYOUT_METHODS_KEY, serialisePayoutMethods(methods));
  } catch {
    // Shown either way; the next refresh saves it again.
  }
  return methods;
}

/**
 * The server's list, saved as the phone's copy. Rejects (with an ApiError) only if the server
 * could not be asked; callers keep showing the phone's copy then.
 */
export async function refreshPayoutMethods(): Promise<PayoutMethod[]> {
  return keep(await api.listPayoutMethods());
}

/** Checks and saves on the server, then refreshes the phone's copy. Rejects with an ApiError. */
export async function addPayoutMethod(method: NewPayoutMethod, makeDefault: boolean): Promise<PayoutMethod> {
  const added = await api.addPayoutMethod(method, makeDefault);
  try {
    await refreshPayoutMethods();
  } catch {
    // Added on the server; keep what we know and let the next refresh fill in the rest.
    const known = (await loadPayoutMethods()).filter((m) => m.id !== added.id);
    const others = added.isDefault ? known.map((m) => ({ ...m, isDefault: false })) : known;
    await keep([added, ...others]);
  }
  return added;
}

export async function setDefaultPayoutMethod(id: string): Promise<PayoutMethod[]> {
  return keep(await api.setDefaultPayoutMethod(id));
}

export async function removePayoutMethod(id: string): Promise<PayoutMethod[]> {
  return keep(await api.removePayoutMethod(id));
}

/** Signing out on this phone: the next user must not see these. Never rejects. */
export async function clearPayoutMethods(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PAYOUT_METHODS_KEY);
  } catch {
    // Nothing more to do.
  }
}
