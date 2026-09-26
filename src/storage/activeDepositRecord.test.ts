import {
  ACTIVE_DEPOSIT_KEY,
  ACTIVE_DEPOSIT_MAX_AGE_MS,
  parseActiveDeposit,
  serialiseActiveDeposit,
  type ActiveDeposit,
} from './activeDepositRecord';

const NOW = 1_800_000_000_000;

const shapIdDeposit: ActiveDeposit = {
  depositId: 'fkd_0_49500_abc_1A2B3C',
  reference: 'KD-1A2B3C',
  startedAt: NOW - 60_000,
  destination: { kind: 'shapId', shapId: '+27821234567', shapName: 'M. Mothiba', bankId: 'capitec' },
};

const accountDeposit: ActiveDeposit = {
  ...shapIdDeposit,
  destination: { kind: 'account', name: 'Thabo Mokoena', accountLast4: '4417', bankId: 'capitec' },
};

describe('active deposit record', () => {
  it('uses the v2 key', () => {
    expect(ACTIVE_DEPOSIT_KEY).toBe('kd.activeDeposit.v2');
  });

  it('round-trips a fresh record with a shapId destination', () => {
    expect(parseActiveDeposit(serialiseActiveDeposit(shapIdDeposit), NOW)).toEqual({
      kind: 'valid',
      deposit: shapIdDeposit,
    });
  });

  it('round-trips a fresh record with an account destination (the dormant branch)', () => {
    expect(parseActiveDeposit(serialiseActiveDeposit(accountDeposit), NOW)).toEqual({
      kind: 'valid',
      deposit: accountDeposit,
    });
  });

  it('is still valid just inside 24 hours', () => {
    const raw = serialiseActiveDeposit({ ...shapIdDeposit, startedAt: NOW - ACTIVE_DEPOSIT_MAX_AGE_MS });
    expect(parseActiveDeposit(raw, NOW).kind).toBe('valid');
  });

  it('is expired after 24 hours', () => {
    const raw = serialiseActiveDeposit({
      ...shapIdDeposit,
      startedAt: NOW - ACTIVE_DEPOSIT_MAX_AGE_MS - 1,
    });
    expect(parseActiveDeposit(raw, NOW)).toEqual({ kind: 'expired' });
  });

  it.each([
    ['corrupt JSON', '{"version":2'],
    ['a JSON array', '[]'],
    ['version 1 (the pre-migration shape)', JSON.stringify({ version: 1, ...shapIdDeposit, bankId: 'capitec', accountLast4: '4417' })],
    ['an unknown version', JSON.stringify({ version: 3, ...shapIdDeposit })],
    ['a missing depositId', JSON.stringify({ version: 2, ...shapIdDeposit, depositId: '' })],
    ['a missing reference', JSON.stringify({ version: 2, ...shapIdDeposit, reference: undefined })],
    ['a bad startedAt', JSON.stringify({ version: 2, ...shapIdDeposit, startedAt: 'now' })],
    ['a missing destination', JSON.stringify({ version: 2, ...shapIdDeposit, destination: undefined })],
    [
      'an invalid destination (an unknown bank)',
      JSON.stringify({ version: 2, ...shapIdDeposit, destination: { ...shapIdDeposit.destination, bankId: 'nope' } }),
    ],
    [
      'a tampered ShapID',
      JSON.stringify({ version: 2, ...shapIdDeposit, destination: { ...shapIdDeposit.destination, shapId: '+27000000000' } }),
    ],
  ])('treats %s as invalid', (_label, raw) => {
    expect(parseActiveDeposit(raw, NOW)).toEqual({ kind: 'invalid' });
  });
});
