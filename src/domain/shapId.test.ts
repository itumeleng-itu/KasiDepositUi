import { bankSuffixOf, displayShapId, maskedShapId, parseShapId, withBankSuffix } from './shapId';

const E164 = '+27821234567';
const E164_FNB = '+27821234567@fnb';

describe('parseShapId: accepted formats (every row of the table)', () => {
  it.each([
    ['0821234567', E164, null],
    ['082 123 4567', E164, null],
    ['082-123-4567', E164, null],
    ['(082) 123 4567', E164, null],
    ['+27821234567', E164, null],
    ['+27 82 123 4567', E164, null],
    ['27821234567', E164, null],
    ['0821234567@fnb', E164_FNB, 'fnb'],
    ['+27821234567@FNB', E164_FNB, 'fnb'],
  ] as const)('%s -> %s', (input, shapId, bank) => {
    expect(parseShapId(input)).toEqual({ ok: true, shapId, bank });
  });
});

describe('parseShapId: rejections', () => {
  it('empty input', () => {
    expect(parseShapId('')).toEqual({ ok: false, reason: 'empty' });
  });

  it('whitespace only', () => {
    expect(parseShapId('   ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('9 digits: too short', () => {
    expect(parseShapId('082123456')).toEqual({ ok: false, reason: 'format' });
  });

  it('11 digits in local form: too long', () => {
    expect(parseShapId('08212345678')).toEqual({ ok: false, reason: 'format' });
  });

  it('0211234567: a landline prefix', () => {
    expect(parseShapId('0211234567')).toEqual({ ok: false, reason: 'format' });
  });

  it('0911234567: a non-mobile prefix', () => {
    expect(parseShapId('0911234567')).toEqual({ ok: false, reason: 'format' });
  });

  it('letters mixed in', () => {
    expect(parseShapId('08212a4567')).toEqual({ ok: false, reason: 'format' });
  });

  it('+2782123456789: too long', () => {
    expect(parseShapId('+2782123456789')).toEqual({ ok: false, reason: 'format' });
  });

  it('082123456@: the number itself is already too short', () => {
    expect(parseShapId('082123456@')).toEqual({ ok: false, reason: 'format' });
  });

  it('0821234567@: an empty suffix is not a recognised bank', () => {
    expect(parseShapId('0821234567@')).toEqual({ ok: false, reason: 'unknown_bank' });
  });

  it('0821234567@notabank: an unrecognised suffix', () => {
    expect(parseShapId('0821234567@notabank')).toEqual({ ok: false, reason: 'unknown_bank' });
  });

  it('0821234567@@fnb: two @ is invalid regardless of what they surround', () => {
    expect(parseShapId('0821234567@@fnb')).toEqual({ ok: false, reason: 'format' });
  });

  it('+27 (0)82 123 4567: the redundant trunk zero is rejected, never silently repaired', () => {
    expect(parseShapId('+27 (0)82 123 4567')).toEqual({ ok: false, reason: 'format' });
  });
});

describe('parseShapId: characters that get through from a paste', () => {
  it('a zero-width space', () => {
    expect(parseShapId('082​1234567')).toEqual({ ok: true, shapId: E164, bank: null });
  });

  it('a non-breaking space', () => {
    expect(parseShapId('082 123 4567')).toEqual({ ok: true, shapId: E164, bank: null });
  });
});

describe('displayShapId', () => {
  it('renders local, grouped', () => {
    expect(displayShapId(E164)).toBe('082 123 4567');
  });

  it('drops an @suffix', () => {
    expect(displayShapId(E164_FNB)).toBe('082 123 4567');
  });
});

describe('maskedShapId', () => {
  it('shows only the last 4 digits', () => {
    expect(maskedShapId(E164)).toBe('••• ••• 4567');
    expect(maskedShapId(E164_FNB)).toBe('••• ••• 4567');
  });
});

describe('bankSuffixOf', () => {
  it('reads a valid suffix', () => {
    expect(bankSuffixOf(E164_FNB)).toBe('fnb');
  });

  it('is null with no suffix, or one that is not a known bank', () => {
    expect(bankSuffixOf(E164)).toBeNull();
    expect(bankSuffixOf(`${E164}@notabank`)).toBeNull();
  });
});

describe('withBankSuffix', () => {
  it('adds a suffix to an unqualified ShapID', () => {
    expect(withBankSuffix(E164, 'capitec')).toBe('+27821234567@capitec');
  });

  it('replaces an existing suffix rather than appending a second one', () => {
    expect(withBankSuffix(E164_FNB, 'capitec')).toBe('+27821234567@capitec');
  });
});
