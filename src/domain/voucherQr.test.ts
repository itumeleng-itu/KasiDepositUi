import { parseVoucherQr } from './voucherQr';

const PIN = '0754762219816030';

describe('parseVoucherQr: accepted', () => {
  it('the exact shape the till prints', () => {
    expect(parseVoucherQr(`kasideposit://redeem?pin=${PIN}`)).toEqual({ ok: true, pin: PIN });
  });

  it('leading zeros survive as a string, not a number', () => {
    const withLeadingZero = '0000000000000001';
    expect(parseVoucherQr(`kasideposit://redeem?pin=${withLeadingZero}`)).toEqual({
      ok: true,
      pin: withLeadingZero,
    });
  });

  it('an uppercase scheme', () => {
    expect(parseVoucherQr(`KASIDEPOSIT://redeem?pin=${PIN}`)).toEqual({ ok: true, pin: PIN });
  });

  it('an uppercase host', () => {
    expect(parseVoucherQr(`kasideposit://REDEEM?pin=${PIN}`)).toEqual({ ok: true, pin: PIN });
  });

  it('mixed-case scheme and host together', () => {
    expect(parseVoucherQr(`KasiDeposit://ReDeem?pin=${PIN}`)).toEqual({ ok: true, pin: PIN });
  });

  it('surrounding whitespace', () => {
    expect(parseVoucherQr(`  kasideposit://redeem?pin=${PIN}\n`)).toEqual({ ok: true, pin: PIN });
  });
});

describe('parseVoucherQr: rejected', () => {
  it.each([
    ['the wrong scheme', `https://redeem?pin=${PIN}`],
    ['the wrong host', `kasideposit://vend?pin=${PIN}`],
    ['a missing pin param entirely', 'kasideposit://redeem'],
    ['an empty query', 'kasideposit://redeem?'],
    ['a present but empty pin', 'kasideposit://redeem?pin='],
    ['a different query param', 'kasideposit://redeem?voucher=' + PIN],
    ['15 digits', `kasideposit://redeem?pin=${PIN.slice(0, 15)}`],
    ['17 digits', `kasideposit://redeem?pin=${PIN}9`],
    ['letters in the pin', 'kasideposit://redeem?pin=075476221981603A'],
    ['a space in the pin', 'kasideposit://redeem?pin=0754 762219816030'],
    ['an unrelated URL', 'https://example.com/redeem?pin=' + PIN],
    ['a bare 16-digit number, no scheme at all', PIN],
    ['extra junk appended after the pin', `kasideposit://redeem?pin=${PIN}&extra=1`],
    ['an empty string', ''],
    ['whitespace only', '   '],
  ])('rejects %s', (_label, text) => {
    expect(parseVoucherQr(text)).toEqual({ ok: false });
  });
});
