/** Pure (no Expo imports) so the shape and version rules can be unit-tested. */

export const USER_KEY = 'kd.user.v1';
const VERSION = 1;

/**
 * Who is registered on this phone. Deliberately not here: the ID number. It is sent once, to
 * register, and a phone that is lost or shared must not give it away.
 */
export interface UserSession {
  userId: string;
  accessToken: string;
  fullNames: string;
  /** Epoch milliseconds. */
  registeredAt: number;
}

export function serialiseUser(user: UserSession): string {
  return JSON.stringify({ version: VERSION, ...user });
}

/** Returns null for anything that is not exactly a valid, current-version record. */
export function parseUser(raw: string): UserSession | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;

  if (record.version !== VERSION) return null;
  const { userId, accessToken, fullNames, registeredAt } = record;
  if (typeof userId !== 'string' || userId.length === 0) return null;
  if (typeof accessToken !== 'string' || accessToken.length === 0) return null;
  if (typeof fullNames !== 'string' || fullNames.length === 0) return null;
  if (typeof registeredAt !== 'number' || !Number.isFinite(registeredAt)) return null;
  return { userId, accessToken, fullNames, registeredAt };
}
