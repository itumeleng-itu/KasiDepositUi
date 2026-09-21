import { ACCOUNT_GROUPING, ACCOUNT_INPUT_MAX, formatAccountNumber } from './account';
import { applyGroupedEdit } from './groupedDigits';

const edit = (prev: string, text: string) => applyGroupedEdit(prev, text, ACCOUNT_GROUPING);

describe('account grouping: caret positions', () => {
  it.each([
    [0, 0],
    [4, 4],
    [5, 6],
    [7, 8],
    [8, 10],
    [10, 12],
  ])('after %d digits the caret is at %d', (digits, caret) => {
    const text = formatAccountNumber('1234567890'.slice(0, digits));
    expect(ACCOUNT_GROUPING.caretForDigitIndex(digits)).toBe(caret);
    // The caret must land on the end of the text when typing at the end.
    expect(caret).toBe(text.length);
  });
});

describe('applyGroupedEdit with account numbers', () => {
  it('types at the end', () => {
    expect(edit('1234', '12345')).toEqual({ digits: '12345', caret: 6, pasteRejected: false });
    expect(edit('1234567', '12345678'.replace(/^(\d{4})(\d{3})(\d)$/, '$1 $2$3'))).toMatchObject({
      digits: '12345678',
      caret: 10,
    });
  });

  it('backspace over a separator deletes the digit before it', () => {
    // Shown "1234 567"; the space is deleted.
    expect(edit('1234567', '1234567')).toEqual({ digits: '123567', caret: 3, pasteRejected: false });
  });

  it('fixes a digit in the middle and keeps the caret', () => {
    // Shown "1234 567 890"; the 6 is replaced with 9.
    expect(edit('1234567890', '1234 597 890')).toEqual({
      digits: '1234597890',
      caret: 7,
      pasteRejected: false,
    });
  });

  it('accepts pasted text in any format', () => {
    expect(edit('', 'Acc no: 1234-567-890')).toMatchObject({ digits: '1234567890', pasteRejected: false });
  });

  it('accepts more than 11 digits so the too-long error can show', () => {
    expect(edit('', '123456789012').digits).toBe('123456789012');
  });

  it('rejects a paste past the input limit, leaving the field unchanged', () => {
    const tooLong = '1'.repeat(ACCOUNT_INPUT_MAX + 1);
    expect(edit('1234', tooLong)).toMatchObject({ digits: '1234', pasteRejected: true });
  });

  it('quietly ignores a typed digit past the input limit', () => {
    const full = '1'.repeat(ACCOUNT_INPUT_MAX);
    expect(edit(full, `${formatAccountNumber(full)}1`)).toMatchObject({
      digits: full,
      pasteRejected: false,
    });
  });
});
