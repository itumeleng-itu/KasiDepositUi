import { parseUser, serialiseUser, USER_KEY, type UserSession } from './userRecord';

const user: UserSession = {
  userId: 'u-1',
  accessToken: 'token-abc',
  fullNames: 'Thabo Mokoena',
  registeredAt: 1_800_000_000_000,
};

function withField(field: string, value: unknown): string {
  return JSON.stringify({ ...JSON.parse(serialiseUser(user)), [field]: value });
}

describe('user record', () => {
  it('uses the v1 key', () => {
    expect(USER_KEY).toBe('kd.user.v1');
  });

  it('round-trips', () => {
    expect(parseUser(serialiseUser(user))).toEqual(user);
  });

  it('never stores an ID number, even if one is passed in', () => {
    const stored = serialiseUser({ ...user, idNumber: '8001015009087' } as UserSession);
    expect(parseUser(stored)).toEqual(user);
  });

  it.each([
    ['not JSON', '{'],
    ['the wrong version', withField('version', 2)],
    ['an empty token', withField('accessToken', '')],
    ['a missing user id', withField('userId', undefined)],
    ['empty names', withField('fullNames', '')],
    ['a non-numeric time', withField('registeredAt', 'now')],
  ])('rejects %s', (_, raw) => {
    expect(parseUser(raw)).toBeNull();
  });
});
