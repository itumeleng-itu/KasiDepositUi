/**
 * The voucher currently being deposited, held in memory only. It carries the lookup result from
 * the PIN screen to the confirm screen and owns the idempotency key.
 *
 * The PIN is never in here (only the server's opaque `voucherToken`), and nothing here is
 * written to disk. A new lookup starts a new session, and with it a new idempotency key; every
 * retry of the same voucher reuses the key, so a retry can never pay twice.
 *
 * Pure (no Expo imports): the key generator is passed in so this can be unit-tested.
 */
import type { VoucherLookup } from './api/types';

export interface VoucherSession {
  readonly lookup: VoucherLookup;
  idempotencyKey: string | null;
}

let current: VoucherSession | null = null;

export function startVoucherSession(lookup: VoucherLookup): VoucherSession {
  current = { lookup, idempotencyKey: null };
  return current;
}

export function currentVoucherSession(): VoucherSession | null {
  return current;
}

export function clearVoucherSession(): void {
  current = null;
}

/**
 * The key for this voucher. Made on first use (the first tap of Send) and then always the same,
 * so call it before the first request and reuse the result for every retry.
 */
export function ensureIdempotencyKey(session: VoucherSession, generate: () => string): string {
  if (session.idempotencyKey === null) session.idempotencyKey = generate();
  return session.idempotencyKey;
}
