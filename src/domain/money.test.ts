import { formatRand, spokenAmounts, spokenRand } from './money';

describe('spokenAmounts', () => {
  it('rewrites amounts inside a sentence', () => {
    expect(spokenAmounts('This voucher is too small to deposit. The minimum is R10.00.')).toBe(
      'This voucher is too small to deposit. The minimum is 10 rand.',
    );
    expect(spokenAmounts('You will get R495.50 and pay R5.00.')).toBe(
      'You will get 495 rand 50 cents and pay 5 rand.',
    );
  });

  it('handles the thousands separator', () => {
    expect(spokenAmounts('Paid R1 234.56')).toBe('Paid 1234 rand 56 cents');
    expect(spokenAmounts('R1 000 000.00')).toBe('1000000 rand');
  });

  it('leaves text without amounts alone', () => {
    expect(spokenAmounts('Your money is safe.')).toBe('Your money is safe.');
    expect(spokenAmounts('Reference: KD-7F3A9C')).toBe('Reference: KD-7F3A9C');
    expect(spokenAmounts('Paid into ••••4417 at Capitec.')).toBe('Paid into ••••4417 at Capitec.');
  });
});

describe('formatRand', () => {
  it.each([
    [0, 'R0.00'],
    [5, 'R0.05'],
    [99, 'R0.99'],
    [100, 'R1.00'],
    [50000, 'R500.00'],
    [123456, 'R1 234.56'],
    [100000000, 'R1 000 000.00'],
    [-500, '-R5.00'],
  ])('formats %d cents as %s', (cents, expected) => {
    expect(formatRand(cents)).toBe(expected);
  });

  it('rejects floats and non-finite numbers', () => {
    expect(() => formatRand(1.5)).toThrow(RangeError);
    expect(() => formatRand(NaN)).toThrow(RangeError);
    expect(() => formatRand(Infinity)).toThrow(RangeError);
  });
});

describe('spokenRand', () => {
  it('reads whole rand amounts without cents', () => {
    expect(spokenRand(49500)).toBe('495 rand');
    expect(spokenRand(0)).toBe('0 rand');
  });

  it('adds cents when present', () => {
    expect(spokenRand(49550)).toBe('495 rand 50 cents');
    expect(spokenRand(5)).toBe('0 rand 5 cents');
  });
});
