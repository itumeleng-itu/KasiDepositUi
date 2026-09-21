import { BENEFICIARY_KEY, parseBeneficiary, serialiseBeneficiary } from './beneficiaryRecord';

const details = { name: 'Thabo Mokoena', accountNumber: '1234564417', bankId: 'capitec' } as const;

function record(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ version: 1, ...details, savedAt: 1_700_000_000_000, ...overrides });
}

describe('beneficiary storage record', () => {
  it('uses the versioned key', () => {
    expect(BENEFICIARY_KEY).toBe('kd.beneficiary.v1');
  });

  it('round-trips a valid record', () => {
    const parsed = parseBeneficiary(serialiseBeneficiary(details, 1_700_000_000_000));
    expect(parsed).toEqual({ ...details, savedAt: 1_700_000_000_000 });
  });

  it('serialises as version 1 with digits-only account number', () => {
    expect(JSON.parse(serialiseBeneficiary(details, 5))).toEqual({
      version: 1,
      name: 'Thabo Mokoena',
      accountNumber: '1234564417',
      bankId: 'capitec',
      savedAt: 5,
    });
  });

  it('drops fields it does not know about', () => {
    expect(parseBeneficiary(record({ extra: 'x' }))).toEqual({
      ...details,
      savedAt: 1_700_000_000_000,
    });
  });

  it.each([
    ['an unknown version', record({ version: 2 })],
    ['a missing version', JSON.stringify({ ...details, savedAt: 1 })],
    ['corrupt JSON', '{"version":1,"name":'],
    ['an empty string', ''],
    ['a JSON array', '[]'],
    ['JSON null', 'null'],
    ['a JSON string', '"hello"'],
    ['an invalid name', record({ name: 'X' })],
    ['a non-string name', record({ name: 42 })],
    ['a non-digit account number', record({ accountNumber: '1234 567 890' })],
    ['a too-short account number', record({ accountNumber: '12345' })],
    ['a numeric account number', record({ accountNumber: 1234564417 })],
    ['an unknown bank', record({ bankId: 'first_national_of_nowhere' })],
    ['a missing savedAt', record({ savedAt: undefined })],
    ['a non-finite savedAt', record({ savedAt: 'yesterday' })],
  ])('rejects %s', (_label, raw) => {
    expect(parseBeneficiary(raw)).toBeNull();
  });
});
