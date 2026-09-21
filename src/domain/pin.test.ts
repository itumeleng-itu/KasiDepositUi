import { applyPinEdit, caretForDigitIndex, formatPin, normalisePin } from './pin';

describe('formatPin', () => {
  it('groups by four with no trailing space', () => {
    expect(formatPin('')).toBe('');
    expect(formatPin('1234')).toBe('1234');
    expect(formatPin('12345')).toBe('1234 5');
    expect(formatPin('1234567890123456')).toBe('1234 5678 9012 3456');
  });
});

describe('normalisePin (paste)', () => {
  const pin = '1234567890123456';

  it.each([
    ['plain digits', pin],
    ['spaced', '1234 5678 9012 3456'],
    ['dashed', '1234-5678-9012-3456'],
    ['line breaks', '1234\n5678\n9012\n3456'],
    ['surrounding text', 'PIN: 1234 5678 9012 3456 thanks'],
  ])('accepts %s', (_name, text) => {
    expect(normalisePin(text)).toEqual({ ok: true, pin });
  });

  it('rejects more than 16 digits and takes none', () => {
    expect(normalisePin('12345678901234567')).toEqual({ ok: false, reason: 'too_many' });
  });

  it('rejects fewer than 16 digits', () => {
    expect(normalisePin('1234 5678')).toEqual({ ok: false, reason: 'too_few' });
    expect(normalisePin('')).toEqual({ ok: false, reason: 'too_few' });
  });
});

describe('caretForDigitIndex', () => {
  it('skips the separators', () => {
    expect(caretForDigitIndex(0)).toBe(0);
    expect(caretForDigitIndex(4)).toBe(4);
    expect(caretForDigitIndex(5)).toBe(6);
    expect(caretForDigitIndex(8)).toBe(9);
    expect(caretForDigitIndex(16)).toBe(19);
  });
});

describe('applyPinEdit', () => {
  it('types a digit at the end', () => {
    expect(applyPinEdit('123', '1234')).toEqual({ digits: '1234', caret: 4, pasteRejected: false });
  });

  it('puts the caret after the separator when a digit starts a new group', () => {
    expect(applyPinEdit('1234', '12345')).toEqual({ digits: '12345', caret: 6, pasteRejected: false });
  });

  it('backspaces one digit only', () => {
    expect(applyPinEdit('12345', '1234 ')).toMatchObject({ digits: '1234', caret: 4 });
    expect(applyPinEdit('123456789', '1234 5678 ')).toMatchObject({ digits: '12345678' });
  });

  it('backspace over a group separator deletes the digit before it', () => {
    // Shown "1234 5678"; the user deletes the space.
    expect(applyPinEdit('12345678', '12345678')).toEqual({
      digits: '1235678',
      caret: 3,
      pasteRejected: false,
    });
  });

  it('fixes a digit in the middle without clearing the rest', () => {
    // Shown "1234 5678"; the 3 is replaced with 9.
    expect(applyPinEdit('12345678', '1294 5678')).toEqual({
      digits: '12945678',
      caret: 3,
      pasteRejected: false,
    });
  });

  it('inserts a digit in the middle and keeps the caret after it', () => {
    // Shown "1234 5678"; a 9 is typed after the 2.
    expect(applyPinEdit('12345678', '12934 5678')).toEqual({
      digits: '129345678',
      caret: 3,
      pasteRejected: false,
    });
  });

  it('accepts a full paste in any format', () => {
    expect(applyPinEdit('', '1234-5678-9012-3456')).toEqual({
      digits: '1234567890123456',
      caret: 19,
      pasteRejected: false,
    });
  });

  it('rejects a paste that would exceed 16 digits and keeps what was there', () => {
    expect(applyPinEdit('1234', '1234 5678 9012 3456 78')).toEqual({
      digits: '1234',
      caret: 4,
      pasteRejected: true,
    });
  });

  it('quietly ignores a 17th typed digit', () => {
    expect(applyPinEdit('1234567890123456', '1234 5678 9012 3456 7')).toEqual({
      digits: '1234567890123456',
      caret: 19,
      pasteRejected: false,
    });
  });

  it('handles clearing the field', () => {
    expect(applyPinEdit('12345678', '')).toEqual({ digits: '', caret: 0, pasteRejected: false });
  });
});
