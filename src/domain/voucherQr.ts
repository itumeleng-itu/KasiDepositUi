import { PIN_LENGTH } from './pin';

export type VoucherQrParse = { ok: true; pin: string } | { ok: false };

// scheme, host and query, each captured raw; case-folded and validated below rather than in
// the regex itself, so exactly what is and is not case-insensitive stays explicit and testable.
const QR_SHAPE = /^([a-z]+):\/\/([a-z]+)\?(.*)$/i;

/**
 * The till prints `kasideposit://redeem?pin=<16 digits>` next to the PIN. Only that exact
 * shape is accepted — scheme and host case-insensitively, everything else exactly — so the
 * scanner can't be pointed at an unrelated QR code or a bare number and mistake it for a
 * voucher. Pure string matching, no `URL` global: never throws, and behaves identically under
 * Jest and on-device.
 */
export function parseVoucherQr(text: string): VoucherQrParse {
  const match = QR_SHAPE.exec(text.trim());
  if (!match) return { ok: false };

  const [, scheme, host, query] = match;
  if (scheme.toLowerCase() !== 'kasideposit') return { ok: false };
  if (host.toLowerCase() !== 'redeem') return { ok: false };

  const pinMatch = new RegExp(`^pin=(\\d{${PIN_LENGTH}})$`).exec(query);
  return pinMatch ? { ok: true, pin: pinMatch[1] } : { ok: false };
}
