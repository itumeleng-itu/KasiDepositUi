import type { Deposit, DepositRecord } from '../api/types';
import {
  addToHistoryIndex,
  fromDepositRecord,
  HISTORY_INDEX_KEY,
  HISTORY_MAX_ENTRIES,
  historyEntryKey,
  mergeHistory,
  parseHistoryIndex,
  parseRedemption,
  serialiseHistoryIndex,
  serialiseRedemption,
  withLatestStatus,
  type Redemption,
} from './historyRecord';

const SENT_AT = 1_800_000_000_000;

const shapIdRedemption: Redemption = {
  depositId: 'fkd_0_49500_abc_1A2B3C',
  reference: 'KD-1A2B3C',
  sentAt: SENT_AT,
  valueCents: 50000,
  feeCents: 500,
  payoutCents: 49500,
  destination: { kind: 'shapId', shapId: '+27821234567', shapName: 'M. Mothiba', bankId: 'capitec' },
  status: 'submitted',
};

const accountRedemption: Redemption = {
  ...shapIdRedemption,
  destination: { kind: 'account', name: 'Thabo Mokoena', accountLast4: '4417', bankId: 'capitec' },
};

const failedRedemption: Redemption = {
  ...shapIdRedemption,
  status: 'failed',
  failureReason: 'bank_unavailable',
};

function withField(field: string, value: unknown): string {
  return JSON.stringify({ ...JSON.parse(serialiseRedemption(shapIdRedemption)), [field]: value });
}

describe('history record', () => {
  it('uses the v1 index key', () => {
    expect(HISTORY_INDEX_KEY).toBe('kd.history.v1');
  });

  it.each([
    ['a shapId destination', shapIdRedemption],
    ['an account destination', accountRedemption],
    ['a failure reason', failedRedemption],
  ])('round-trips a record with %s', (_, redemption) => {
    expect(parseRedemption(serialiseRedemption(redemption))).toEqual(redemption);
  });

  it('drops the saved-destination bookkeeping fields from the snapshot', () => {
    // What confirm.tsx actually passes: a saved-destination record, times and all.
    const withTimes: Redemption = {
      ...shapIdRedemption,
      destination: Object.assign({ resolvedAt: 1, savedAt: 2 }, shapIdRedemption.destination),
    };
    const stored = JSON.parse(serialiseRedemption(withTimes));
    expect(stored.destination).toEqual(shapIdRedemption.destination);
  });

  it.each([
    ['not JSON', '{'],
    ['not an object', '"x"'],
    ['the wrong version', withField('version', 2)],
    ['an empty deposit id', withField('depositId', '')],
    ['a missing reference', withField('reference', undefined)],
    ['a non-numeric sentAt', withField('sentAt', 'yesterday')],
    ['fractional cents', withField('payoutCents', 12.5)],
    ['negative cents', withField('feeCents', -1)],
    ['an unknown status', withField('status', 'lost')],
    ['an identity failure reason', withField('failureReason', 'shapid_not_found')],
    ['a broken destination', withField('destination', { kind: 'shapId', shapId: '123' })],
  ])('rejects %s', (_, raw) => {
    expect(parseRedemption(raw)).toBeNull();
  });
});

describe('history entry keys', () => {
  it('only uses characters SecureStore accepts', () => {
    expect(historyEntryKey('fkd_0/49500+abc@1 A')).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it('keeps different ids apart, including ones that look like escapes', () => {
    const ids = ['a_b', 'a/b', 'a_2f_b', 'a-b', 'a.b'];
    expect(new Set(ids.map(historyEntryKey)).size).toBe(ids.length);
  });
});

describe('history index', () => {
  it('reads a missing or unreadable index as empty', () => {
    expect(parseHistoryIndex(null)).toEqual([]);
    expect(parseHistoryIndex('{')).toEqual([]);
    expect(parseHistoryIndex('{"a":1}')).toEqual([]);
  });

  it('keeps only non-empty string ids', () => {
    expect(parseHistoryIndex(JSON.stringify(['a', '', 3, null, 'b']))).toEqual(['a', 'b']);
  });

  it('round-trips', () => {
    expect(parseHistoryIndex(serialiseHistoryIndex(['b', 'a']))).toEqual(['b', 'a']);
  });

  it('puts the newest first', () => {
    expect(addToHistoryIndex(['b', 'a'], 'c')).toEqual({ ids: ['c', 'b', 'a'], evicted: [] });
  });

  it('moves an existing id to the front instead of duplicating it', () => {
    expect(addToHistoryIndex(['c', 'b', 'a'], 'a')).toEqual({ ids: ['a', 'c', 'b'], evicted: [] });
  });

  it('evicts the oldest past the cap', () => {
    const full = Array.from({ length: HISTORY_MAX_ENTRIES }, (_, i) => `d${i}`);
    const { ids, evicted } = addToHistoryIndex(full, 'new');
    expect(ids).toHaveLength(HISTORY_MAX_ENTRIES);
    expect(ids[0]).toBe('new');
    expect(evicted).toEqual([`d${HISTORY_MAX_ENTRIES - 1}`]);
  });
});

describe('withLatestStatus', () => {
  const deposit = (patch: Partial<Deposit>): Deposit => ({
    id: shapIdRedemption.depositId,
    reference: shapIdRedemption.reference,
    status: 'submitted',
    payoutCents: 49500,
    ...patch,
  });

  it('returns the same object when nothing visible changed', () => {
    expect(withLatestStatus(shapIdRedemption, deposit({}))).toBe(shapIdRedemption);
  });

  it('takes the new status', () => {
    expect(withLatestStatus(shapIdRedemption, deposit({ status: 'completed' })).status).toBe('completed');
  });

  it('takes a failure reason with a failed status', () => {
    const next = withLatestStatus(
      shapIdRedemption,
      deposit({ status: 'failed', failureReason: 'insufficient_float' }),
    );
    expect(next).toMatchObject({ status: 'failed', failureReason: 'insufficient_float' });
  });

  it('drops an old failure reason the server no longer reports', () => {
    const next = withLatestStatus(failedRedemption, deposit({ status: 'completed' }));
    expect(next).not.toHaveProperty('failureReason');
  });
});

describe('server history', () => {
  const record: DepositRecord = {
    id: 'dep-1',
    reference: 'KD-AAAAAA',
    status: 'failed',
    failureReason: 'bank_unavailable',
    payoutCents: 19500,
    valueCents: 20000,
    feeCents: 500,
    createdAt: SENT_AT,
    destination: shapIdRedemption.destination,
  };

  it('maps a server record to what the phone stores', () => {
    expect(fromDepositRecord(record)).toEqual({
      depositId: 'dep-1',
      reference: 'KD-AAAAAA',
      sentAt: SENT_AT,
      valueCents: 20000,
      feeCents: 500,
      payoutCents: 19500,
      destination: shapIdRedemption.destination,
      status: 'failed',
      failureReason: 'bank_unavailable',
    });
  });

  const at = (depositId: string, sentAt: number, status: Redemption['status'] = 'submitted') => ({
    ...shapIdRedemption,
    depositId,
    sentAt,
    status,
  });

  it('lets the server win for a deposit both know, and keeps phone-only ones', () => {
    const merged = mergeHistory([at('a', 1), at('b', 2)], [at('b', 2, 'completed'), at('c', 3)]);
    expect(merged.map((r) => [r.depositId, r.status])).toEqual([
      ['c', 'submitted'],
      ['b', 'completed'],
      ['a', 'submitted'],
    ]);
  });

  it('sorts newest first and trims to the cap', () => {
    const merged = mergeHistory([at('old', 1)], [at('new', 3), at('mid', 2)], 2);
    expect(merged.map((r) => r.depositId)).toEqual(['new', 'mid']);
  });
});
