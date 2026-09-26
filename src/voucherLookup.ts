import { api } from './api/client';
import { isApiError } from './api/errors';
import { describeError } from './errorMessage';
import { clearUser } from './storage/user';
import { startVoucherSession } from './voucherSession';

export type VoucherLookupAttempt =
  | { ok: true }
  /** `mustRegister`: the server no longer knows this phone; the screen should go to /register. */
  | { ok: false; message: string; mustRegister: boolean };

/**
 * Looks a voucher up and, on success, starts the in-memory session confirm.tsx reads from.
 * Shared by manual PIN entry (app/deposit.tsx) and a scanned QR (app/scan.tsx), so there is
 * exactly one lookup path regardless of how the PIN was entered — neither screen talks to the
 * API or `voucherSession` directly. The PIN passed in never leaves this call: only the
 * server's opaque voucher token is kept, in the session.
 */
export async function attemptVoucherLookup(pin: string): Promise<VoucherLookupAttempt> {
  try {
    const lookup = await api.lookupVoucher(pin);
    startVoucherSession(lookup);
    return { ok: true };
  } catch (caught) {
    const mustRegister =
      isApiError(caught) && caught.kind === 'business' && caught.reason === 'not_registered';
    if (mustRegister) await clearUser();
    // Nothing has moved yet: a lookup always precedes any deposit, so this never reassures.
    return { ok: false, message: describeError(caught, { moneyMayHaveMoved: false }), mustRegister };
  }
}
