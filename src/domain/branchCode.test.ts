import { BRANCH_CODE_GROUPING, BRANCH_CODE_LENGTH, isCompleteBranchCode } from './branchCode';

describe('branch codes', () => {
  it('are six digits', () => {
    expect(BRANCH_CODE_LENGTH).toBe(6);
    expect(isCompleteBranchCode('470010')).toBe(true);
    expect(isCompleteBranchCode('47001')).toBe(false);
    expect(isCompleteBranchCode('4700100')).toBe(false);
    expect(isCompleteBranchCode('47001a')).toBe(false);
  });

  it('are shown ungrouped', () => {
    expect(BRANCH_CODE_GROUPING.format('470010')).toBe('470010');
    expect(BRANCH_CODE_GROUPING.caretForDigitIndex(3)).toBe(3);
  });
});
