import { calculatePayout, isVoucherDepositable, MIN_VOUCHER_CENTS } from './fees';

describe('calculatePayout', () => {
  it('subtracts the fee in integer cents', () => {
    expect(calculatePayout(50000, 500)).toBe(49500);
    expect(calculatePayout(1000, 500)).toBe(500);
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
