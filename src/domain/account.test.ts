import {
  accountNumbersMatch,
  formatAccountNumber,
  maskAccountNumber,
  normaliseAccountNumber,
  validateAccountNumber,
} from './account';

describe('normaliseAccountNumber', () => {
  it('strips every non-digit', () => {
    expect(normaliseAccountNumber('1234 567-890')).toBe('1234567890');
    expect(normaliseAccountNumber('Acc: 12 34\n567 890.')).toBe('1234567890');
    expect(normaliseAccountNumber('abc')).toBe('');
  });
});

describe('validateAccountNumber', () => {
  it.each([
    ['', 'required'],
    ['abc', 'required'],
    ['123456', 'too_short'],
    ['1234567', null],
    ['12345678901', null],
    ['123456789012', 'too_long'],
    ['1234 567 890', null],
  ])('validates %j -> %s', (input, expected) => {
    expect(validateAccountNumber(input)).toBe(expected);
  });
});

describe('validateAccountNumber with a bank', () => {
  it.each([
    ['1234567890', 'capitec', null],
    ['123456789', 'capitec', 'wrong_length'],
    ['12345678901', 'capitec', 'wrong_length'],
    ['12345678901', 'fnb', null],
    ['1234567890', 'fnb', 'wrong_length'],
    ['123456789', 'standard_bank', null],
    ['1234567890', 'standard_bank', 'wrong_length'],
    ['12345678901', 'standard_bank', null],
    ['12345678', 'absa', null],
    ['1234567', 'absa', 'wrong_length'],
    ['1234567890', 'nedbank', null],
    ['', 'capitec', 'required'],
    // No length on record for this bank: the general 7 to 11 rule applies.
    ['1234567', 'tymebank', null],
    ['123456', 'tymebank', 'too_short'],
  ] as const)('%j at %s -> %s', (input, bank, expected) => {
    expect(validateAccountNumber(input, bank)).toBe(expected);
  });
});

describe('formatAccountNumber', () => {
  it('groups four then threes', () => {
    expect(formatAccountNumber('')).toBe('');
    expect(formatAccountNumber('1234')).toBe('1234');
    expect(formatAccountNumber('1234567')).toBe('1234 567');
    expect(formatAccountNumber('1234567890')).toBe('1234 567 890');
  });
});

describe('maskAccountNumber', () => {
  it('shows only the last four digits', () => {
    expect(maskAccountNumber('1234564417')).toBe('••••4417');
  });
});

describe('accountNumbersMatch', () => {
  it('compares digits only, exactly', () => {
    expect(accountNumbersMatch('1234 567', '1234567')).toBe(true);
    expect(accountNumbersMatch('1234567', '1234568')).toBe(false);
  });
});
