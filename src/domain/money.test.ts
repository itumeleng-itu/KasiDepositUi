import { formatRand, spokenRand } from './money';

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
