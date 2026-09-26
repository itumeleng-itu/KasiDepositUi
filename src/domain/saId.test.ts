import { groupSaId, hasValidSaIdChecksum, normaliseSaId, parseSaId } from './saId';

// A fixed "today" so the age rule is testable: 26 September 2026.
const NOW = new Date(Date.UTC(2026, 8, 26, 12));

describe('parseSaId', () => {
  it.each([
    ['a 1980 birth date', '8001015009087', { year: 1980, month: 1, day: 1 }],
    ['a permanent resident', '7506150123080', { year: 1975, month: 6, day: 15 }],
    ['29 February in a leap year', '0002295001081', { year: 2000, month: 2, day: 29 }],
    ['an 18th birthday today', '0809265001085', { year: 2008, month: 9, day: 26 }],
  ])('accepts %s', (_, id, dateOfBirth) => {
    expect(parseSaId(id, NOW)).toEqual({ ok: true, idNumber: id, dateOfBirth });
  });

  it('accepts spaces and hyphens from a paste', () => {
    expect(parseSaId(' 800101 5009-08 7 ', NOW)).toMatchObject({ ok: true, idNumber: '8001015009087' });
  });

  it.each([
    ['empty', '', 'empty'],
    ['only spaces', '   ', 'empty'],
    ['letters', '80010150090A7', 'digits'],
    ['too short', '800101500908', 'length'],
    ['too long', '80010150090871', 'length'],
    ['31 February', '9902315001089', 'birth_date'],
    ['month 13', '8013015009087', 'birth_date'],
    ['citizenship digit 3', '8001015009384', 'citizenship'],
    ['a wrong check digit', '8001015009088', 'checksum'],
    ['a 17-year-old (18 tomorrow)', '0809275001083', 'under_age'],
  ])('rejects %s', (_, id, reason) => {
    expect(parseSaId(id, NOW)).toEqual({ ok: false, reason });
  });
});

describe('SA ID helpers', () => {
  it('checks the Luhn digit', () => {
    expect(hasValidSaIdChecksum('8001015009087')).toBe(true);
    expect(hasValidSaIdChecksum('8001015009086')).toBe(false);
  });

  it('strips filler', () => {
    expect(normaliseSaId('800101 5009-087')).toBe('8001015009087');
  });

  it('groups as printed on the ID', () => {
    expect(groupSaId('8001015009087')).toBe('800101 5009 08 7');
    expect(groupSaId('80010')).toBe('80010');
  });
});
