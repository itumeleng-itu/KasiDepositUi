import * as SecureStore from 'expo-secure-store';

import { api } from '../api/client';
import type { Deposit } from '../api/types';
import {
  addToHistoryIndex,
  fromDepositRecord,
  HISTORY_INDEX_KEY,
  historyEntryKey,
  mergeHistory,
  parseHistoryIndex,
  parseRedemption,
  serialiseHistoryIndex,
  serialiseRedemption,
  withLatestStatus,
  type Redemption,
} from './historyRecord';

async function readIndex(): Promise<string[]> {
  return parseHistoryIndex(await SecureStore.getItemAsync(HISTORY_INDEX_KEY));
}

/** One redemption, or null if it is missing or unreadable. Never rejects. */
export async function loadRedemption(depositId: string): Promise<Redemption | null> {
  try {
    const raw = await SecureStore.getItemAsync(historyEntryKey(depositId));
    const parsed = raw === null ? null : parseRedemption(raw);
    // The id is checked too, so an entry can never be shown under another deposit's id.
    return parsed && parsed.depositId === depositId ? parsed : null;
  } catch {
    return null;
  }
}

/** Newest first. Entries that can't be read are skipped. Never rejects. */
export async function loadHistory(): Promise<Redemption[]> {
  let ids: string[];
  try {
    ids = await readIndex();
  } catch {
    return [];
  }
  const found = await Promise.all(ids.map(loadRedemption));
  return found.filter((r): r is Redemption => r !== null);
}

/**
 * Called once Send succeeds. The entry is written before the index, so the index never points
 * at something that isn't there yet.
 */
export async function recordRedemption(redemption: Redemption): Promise<void> {
  await SecureStore.setItemAsync(
    historyEntryKey(redemption.depositId),
    serialiseRedemption(redemption),
  );
  const { ids, evicted } = addToHistoryIndex(await readIndex(), redemption.depositId);
  await SecureStore.setItemAsync(HISTORY_INDEX_KEY, serialiseHistoryIndex(ids));
  await Promise.all(
    evicted.map((id) => SecureStore.deleteItemAsync(historyEntryKey(id)).catch(() => {})),
  );
}

/**
 * Stores the server's latest status on a saved redemption, if there is one. Never rejects:
 * history is a convenience and must not get in the way of showing a result.
 */
export async function updateRedemptionStatus(latest: Deposit): Promise<Redemption | null> {
  const saved = await loadRedemption(latest.id);
  if (!saved) return null;
  const next = withLatestStatus(saved, latest);
  if (next === saved) return saved;
  try {
    await SecureStore.setItemAsync(historyEntryKey(next.depositId), serialiseRedemption(next));
  } catch {
    // Shown correctly now either way; the next status check will try to save it again.
  }
  return next;
}

/**
 * Replaces the saved history with `list` (newest first), removing entries that fell out. Only
 * entries that changed since `saved` are written: each secure-store write is slow.
 */
async function saveHistory(list: readonly Redemption[], saved: readonly Redemption[]): Promise<void> {
  const previous = await readIndex();
  const before = new Map(saved.map((r) => [r.depositId, serialiseRedemption(r)]));
  await Promise.all(
    list.map((r) => {
      const next = serialiseRedemption(r);
      if (before.get(r.depositId) === next) return Promise.resolve();
      return SecureStore.setItemAsync(historyEntryKey(r.depositId), next);
    }),
  );
  const ids = list.map((r) => r.depositId);
  await SecureStore.setItemAsync(HISTORY_INDEX_KEY, serialiseHistoryIndex(ids));
  const kept = new Set(ids);
  await Promise.all(
    previous
      .filter((id) => !kept.has(id))
      .map((id) => SecureStore.deleteItemAsync(historyEntryKey(id)).catch(() => {})),
  );
}

export interface HistoryResult {
  items: Redemption[];
  /** True when the server couldn't be asked, so this is only what the phone had saved. */
  fromPhoneOnly: boolean;
}

/**
 * The user's history: the server's list merged into what this phone saved, and saved back so
 * details open offline and the list survives a reinstall once registered again. Never
 * rejects: without a connection it is the phone's copy, marked as such.
 *
 * Pass `local` when the screen has already loaded it (to show it straight away), so it is not
 * read twice. Saving back happens in the background: the merged list is returned without
 * waiting for the phone's storage.
 */
export async function syncHistory(local?: Redemption[]): Promise<HistoryResult> {
  const saved = local ?? (await loadHistory());
  let server: Redemption[];
  try {
    server = (await api.listMyDeposits()).map(fromDepositRecord);
  } catch {
    return { items: saved, fromPhoneOnly: true };
  }
  const items = mergeHistory(saved, server);
  saveHistory(items, saved).catch(() => {
    // Shown either way; the next visit merges again.
  });
  return { items, fromPhoneOnly: false };
}
