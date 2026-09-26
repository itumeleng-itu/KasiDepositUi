import * as SecureStore from 'expo-secure-store';

import { parseUser, serialiseUser, USER_KEY, type UserSession } from './userRecord';

/**
 * Held in memory once read, so the HTTP client can attach the token to every request without
 * a SecureStore read each time. `undefined` means "not read yet"; `null` means "nobody".
 */
let cached: UserSession | null | undefined;

/** Who is registered on this phone, or null. An unreadable entry is removed. */
export async function loadUser(): Promise<UserSession | null> {
  if (cached !== undefined) return cached;
  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(USER_KEY);
  } catch {
    return null;
  }
  const parsed = raw === null ? null : parseUser(raw);
  if (raw !== null && parsed === null) await clearUser();
  cached = parsed;
  return parsed;
}

export async function saveUser(user: UserSession): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, serialiseUser(user));
  cached = user;
}

/** Never rejects: signing out locally must always work. */
export async function clearUser(): Promise<void> {
  cached = null;
  try {
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch {
    // The in-memory copy is gone either way; the app treats the user as signed out.
  }
}

/** The bearer token for API calls, or null if nobody is registered on this phone. */
export async function currentAccessToken(): Promise<string | null> {
  return (await loadUser())?.accessToken ?? null;
}
