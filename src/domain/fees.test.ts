import { calculateFee, calculatePayout, isVoucherDepositable, MIN_VOUCHER_CENTS } from './fees';

describe('calculateFee', () => {
  it('takes a percentage in basis points', () => {
    expect(calculateFee(50000, 250)).toBe(1250);
    expect(calculateFee(1000, 250)).toBe(25);
    expect(calculateFee(50000, 0)).toBe(0);
  });

  it('rounds half up to a whole cent', () => {
    expect(calculateFee(12345, 250)).toBe(309); // 308.625
    expect(calculateFee(40500, 250)).toBe(1013); // 1012.5
    expect(calculateFee(1020, 250)).toBe(26); // 25.5
    expect(calculateFee(1010, 250)).toBe(25); // 25.25
  });
});

describe('calculatePayout', () => {
  it('subtracts the fee in integer cents', () => {
    expect(calculatePayout(50000, 1250)).toBe(48750);
    expect(calculatePayout(1000, 25)).toBe(975);
  });
});

describe('isVoucherDepositable', () => {
  it('rejects vouchers below the minimum', () => {
    expect(isVoucherDepositable(800, 500)).toBe(false);
    expect(isVoucherDepositable(MIN_VOUCHER_CENTS - 1, 0)).toBe(false);
  });

  it('accepts a voucher exactly at the minimum', () => {
    expect(isVoucherDepositable(MIN_VOUCHER_CENTS, 500)).toBe(true);
  });

  it('rejects a voucher that is not more than the fee', () => {
    expect(isVoucherDepositable(2000, 2000)).toBe(false);
    expect(isVoucherDepositable(2000, 2500)).toBe(false);
    expect(isVoucherDepositable(2000, 1999)).toBe(true);
  });
});
