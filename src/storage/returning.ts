import * as SecureStore from 'expo-secure-store';

const RETURNING_KEY = 'kd.registeredBefore.v1';

/**
 * Whether anyone has ever registered on this phone.
 *
 * One screen does both jobs: registering and signing back in are the
 * same form, because entering the same names and ID number is how the
 * backend recognises a returning person. Without this, that screen can
 * only ever say "Register", which is wrong for someone who has been
 * here before and is simply signing in again.
 *
 * Deliberately NOT cleared by `signOut`. That is the point: sign-out
 * forgets who you are, and this remembers only that somebody once used
 * the app here. It is a single boolean — no name, no number, nothing
 * that identifies anyone — so it says nothing sign-out promised to
 * forget. Reinstalling the app clears it, as it clears everything.
 */
export async function markRegisteredBefore(): Promise<void> {
  try {
    await SecureStore.setItemAsync(RETURNING_KEY, '1');
  } catch {
    // Only costs a slightly wrong title next time.
  }
}

export async function hasRegisteredBefore(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(RETURNING_KEY)) === '1';
  } catch {
    // Unreadable storage means we cannot claim they have been here.
    return false;
  }
}

export { RETURNING_KEY };
