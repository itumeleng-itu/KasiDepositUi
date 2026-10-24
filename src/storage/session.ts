import { clearActiveDeposit } from './activeDeposit';
import { clearHistory } from './history';
import { clearPayoutMethods } from './payoutMethods';
import { markRegisteredBefore } from './returning';
import { clearUser, loadUser } from './user';

/**
 * Forget this phone.
 *
 * Everything the app keeps locally goes: the access token, the saved
 * payout methods, any deposit still in flight, and the deposit history.
 * The next launch finds nothing and starts at registering, which is
 * where a first-time user starts.
 *
 * What this is NOT is closing the account. The user, their deposits and
 * their payout methods belong to the server, and entering the same
 * names and ID number again signs this phone back in and brings them
 * back — the backend recognises a returning person, revokes the old
 * sessions and issues a fresh token. So registering is also how you log
 * in, and signing out costs the user nothing but the typing.
 *
 * Every step is allowed to fail on its own. A phone that cannot delete
 * one key must still forget the rest, because a half-signed-out phone
 * that still holds a token is the worst of the three outcomes.
 */
export async function signOut(): Promise<void> {
  // Before anything is cleared: this is the last moment we can know
  // somebody was signed in here. Registration also marks it, but a
  // phone registered before that existed has no marker, and without
  // this it would be greeted with "Register" forever.
  if (await loadUser().catch(() => null)) {
    await markRegisteredBefore();
  }

  await Promise.all([
    clearUser().catch(() => {}),
    clearPayoutMethods().catch(() => {}),
    clearActiveDeposit().catch(() => {}),
    clearHistory().catch(() => {}),
  ]);
}
