import { DESTINATION_KEY, parseDestination, serialiseDestination } from './destinationRecord';

const shapIdDestination = {
  kind: 'shapId' as const,
  shapId: '+27821234567',
  shapName: 'M. Mothiba',
  bankId: 'capitec' as const,
};

const accountDestination = {
  kind: 'account' as const,
  name: 'Thabo Mokoena',
  accountNumber: '1234564417',
  bankId: 'capitec' as const,
};

const RESOLVED_AT = 1_758_499_200_000;
const SAVED_AT = 1_758_499_200_000;

function shapIdRecord(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 2,
    ...shapIdDestination,
    resolvedAt: RESOLVED_AT,
    savedAt: SAVED_AT,
    ...overrides,
  });
}

describe('destination storage record', () => {
  it('uses the v2 key', () => {
    expect(DESTINATION_KEY).toBe('kd.destination.v2');
  });

  it('round-trips a shapId destination, matching the brief’s example JSON', () => {
    const raw = serialiseDestination(shapIdDestination, RESOLVED_AT, SAVED_AT);
    expect(JSON.parse(raw)).toEqual({
      version: 2,
      kind: 'shapId',
      shapId: '+27821234567',
      shapName: 'M. Mothiba',
      bankId: 'capitec',
      resolvedAt: RESOLVED_AT,
      savedAt: SAVED_AT,
    });
    expect(parseDestination(raw)).toEqual({ ...shapIdDestination, resolvedAt: RESOLVED_AT, savedAt: SAVED_AT });
  });

  it('round-trips an account destination (the dormant branch)', () => {
    const raw = serialiseDestination(accountDestination, RESOLVED_AT, SAVED_AT);
    expect(parseDestination(raw)).toEqual({
      ...accountDestination,
      resolvedAt: RESOLVED_AT,
      savedAt: SAVED_AT,
    });
  });

  it('drops fields it does not know about', () => {
    expect(parseDestination(shapIdRecord({ extra: 'x' }))).toEqual({
      ...shapIdDestination,
      resolvedAt: RESOLVED_AT,
      savedAt: SAVED_AT,
    });
  });

  it.each([
    ['version 1 (the pre-migration shape)', JSON.stringify({ version: 1, ...accountDestination, savedAt: 1 })],
    ['an unknown version', shapIdRecord({ version: 3 })],
    ['a missing version', JSON.stringify({ ...shapIdDestination, resolvedAt: 1, savedAt: 1 })],
    ['corrupt JSON', '{"version":2,"kind":'],
    ['an empty string', ''],
    ['a JSON array', '[]'],
    ['JSON null', 'null'],
    ['a JSON string', '"hello"'],
    ['an unrecognised kind', shapIdRecord({ kind: 'crypto' })],
    ['a tampered ShapID', shapIdRecord({ shapId: '+27000000000' })],
    ['an unknown bank', shapIdRecord({ bankId: 'not_a_bank' })],
    ['a missing resolvedAt', shapIdRecord({ resolvedAt: undefined })],
    ['a non-finite resolvedAt', shapIdRecord({ resolvedAt: 'yesterday' })],
    ['a missing savedAt', shapIdRecord({ savedAt: undefined })],
  ])('rejects %s', (_label, raw) => {
    expect(parseDestination(raw)).toBeNull();
  });
});
