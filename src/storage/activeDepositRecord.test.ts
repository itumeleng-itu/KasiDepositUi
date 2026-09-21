import {
  ACTIVE_DEPOSIT_KEY,
  ACTIVE_DEPOSIT_MAX_AGE_MS,
  parseActiveDeposit,
  serialiseActiveDeposit,
  type ActiveDeposit,
} from './activeDepositRecord';

const NOW = 1_800_000_000_000;

const deposit: ActiveDeposit = {
  depositId: 'fkd_0_49500_abc_1A2B3C',
  reference: 'KD-1A2B3C',
  startedAt: NOW - 60_000,
  bankId: 'capitec',
  accountLast4: '4417',
};

describe('active deposit record', () => {
  it('uses the versioned key', () => {
    expect(ACTIVE_DEPOSIT_KEY).toBe('kd.activeDeposit.v1');
  });

  it('round-trips a fresh record', () => {
    expect(parseActiveDeposit(serialiseActiveDeposit(deposit), NOW)).toEqual({
      kind: 'valid',
      deposit,
    });
  });

  it('is still valid just inside 24 hours', () => {
    const raw = serialiseActiveDeposit({ ...deposit, startedAt: NOW - ACTIVE_DEPOSIT_MAX_AGE_MS });
    expect(parseActiveDeposit(raw, NOW).kind).toBe('valid');
  });

  it('is expired after 24 hours', () => {
    const raw = serialiseActiveDeposit({
      ...deposit,
      startedAt: NOW - ACTIVE_DEPOSIT_MAX_AGE_MS - 1,
    });
    expect(parseActiveDeposit(raw, NOW)).toEqual({ kind: 'expired' });
  });

  it.each([
    ['corrupt JSON', '{"version":1'],
    ['a JSON array', '[]'],
    ['an unknown version', JSON.stringify({ ...deposit, version: 2 })],
    ['a missing depositId', JSON.stringify({ version: 1, ...deposit, depositId: '' })],
    ['a missing reference', JSON.stringify({ version: 1, ...deposit, reference: undefined })],
    ['a bad startedAt', JSON.stringify({ version: 1, ...deposit, startedAt: 'now' })],
    ['an unknown bank', JSON.stringify({ version: 1, ...deposit, bankId: 'nope' })],
    ['a long account tail', JSON.stringify({ version: 1, ...deposit, accountLast4: '1234567890' })],
    ['a non-digit account tail', JSON.stringify({ version: 1, ...deposit, accountLast4: 'abcd' })],
  ])('treats %s as invalid', (_label, raw) => {
    expect(parseActiveDeposit(raw, NOW)).toEqual({ kind: 'invalid' });
  });
});
