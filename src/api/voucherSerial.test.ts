import { parseDepositHistory } from './wire';
import { fromDepositRecord, parseRedemption, serialiseRedemption } from '../storage/historyRecord';

/**
 * The slip's serial, carried from the server to the phone.
 *
 * Her deposit and the piece of paper she was handed at the shop share no
 * other visible identifier: the app never saw the serial (it only had a
 * PIN) and the till masks PINs. Without this, neither she nor a cashier
 * can match one to the other when a deposit needs chasing up.
 */

function wireRecord(extra: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    reference: 'KD-W7KGC6',
    status: 'completed',
    payout_cents: 48750,
    value_cents: 50000,
    fee_cents: 1250,
    failure_reason: null,
    created_at: '2026-10-24T08:59:27+02:00',
    destination: { kind: 'shap_id', shap_id: '+27821234560', shap_name: 'T. Mokoena', bank: 'CAPITEC' },
    ...extra,
  };
}

describe('the voucher serial reaching the phone', () => {
  it('is read from the server history', () => {
    const [record] = parseDepositHistory({
      deposits: [wireRecord({ voucher_serial: '20261024703564644059' })],
    });
    expect(record.voucherSerial).toBe('20261024703564644059');
  });

  it('is absent, not invented, when the server does not send one', () => {
    const [record] = parseDepositHistory({ deposits: [wireRecord()] });
    expect(record.voucherSerial).toBeUndefined();
  });

  it('treats null or empty as absent rather than showing a blank row', () => {
    for (const value of [null, '', 42]) {
      const [record] = parseDepositHistory({ deposits: [wireRecord({ voucher_serial: value })] });
      expect(record.voucherSerial).toBeUndefined();
    }
  });

  it('never drops a whole deposit over a bad serial', () => {
    // One odd field must not hide a real deposit from her history.
    const records = parseDepositHistory({ deposits: [wireRecord({ voucher_serial: { oops: true } })] });
    expect(records).toHaveLength(1);
    expect(records[0].reference).toBe('KD-W7KGC6');
  });

  it('survives the trip through the phone store', () => {
    const [record] = parseDepositHistory({
      deposits: [wireRecord({ voucher_serial: '20261024703564644059' })],
    });
    const saved = serialiseRedemption(fromDepositRecord(record));
    expect(parseRedemption(saved)?.voucherSerial).toBe('20261024703564644059');
  });

  it('still reads a record saved before serials existed', () => {
    // No version bump, so an older entry must parse rather than vanish.
    const [record] = parseDepositHistory({ deposits: [wireRecord()] });
    const saved = serialiseRedemption(fromDepositRecord(record));
    expect(JSON.parse(saved).voucherSerial).toBeUndefined();
    const back = parseRedemption(saved);
    expect(back).not.toBeNull();
    expect(back?.reference).toBe('KD-W7KGC6');
    expect(back?.voucherSerial).toBeUndefined();
  });
});
