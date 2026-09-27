import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { common, formatSentAt, history } from '../../src/copy';
import { describeDestination } from '../../src/domain/destination';
import { formatRand } from '../../src/domain/money';
import { loadHistory, syncHistory } from '../../src/storage/history';
import type { Redemption } from '../../src/storage/historyRecord';
import { borderWidth, colors, opacity, radius, size, spacing, type } from '../../src/theme';

/**
 * The user's deposits, newest first: the server's list merged with what this phone saved, so
 * it works offline and survives a reinstall. Each row opens the details.
 */
export default function HistoryScreen() {
  const [items, setItems] = useState<Redemption[] | null>(null);
  const [phoneOnly, setPhoneOnly] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // What this phone saved shows at once; the server's list is merged in when it arrives. Runs
  // again when we come back from a detail screen, which may have refreshed a status.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setSyncing(true);
      loadHistory()
        .then((local) => {
          if (cancelled) return null;
          // An empty phone copy waits for the server rather than flashing "no deposits yet".
          if (local.length > 0) setItems(local);
          return syncHistory(local);
        })
        .then((result) => {
          if (cancelled || result === null) return;
          setItems(result.items);
          setPhoneOnly(result.fromPhoneOnly);
          setSyncing(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <Screen>
      <Button variant="text" align="start" label={common.back} onPress={() => router.back()} />

      <Text accessibilityRole="header" style={styles.title}>
        {history.title}
      </Text>

      {syncing ? (
        <Text style={styles.note} accessibilityLiveRegion="polite">
          {history.syncing}
        </Text>
      ) : null}

      {phoneOnly ? (
        <Text style={styles.note} accessibilityLiveRegion="polite">
          {history.phoneOnly}
        </Text>
      ) : null}

      {items !== null && items.length === 0 ? <Text style={styles.empty}>{history.empty}</Text> : null}

      {items !== null && items.length > 0 ? (
        <>
          <View style={styles.list}>
            {items.map((item) => (
              <HistoryRow key={item.depositId} item={item} />
            ))}
          </View>
          <Text style={styles.note}>{history.note}</Text>
        </>
      ) : null}
    </Screen>
  );
}

function HistoryRow({ item }: { item: Redemption }) {
  const { oneLine, spokenOneLine } = describeDestination(item.destination);
  const when = formatSentAt(item.sentAt);
  const statusLabel = history.statusLabel[item.status];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={history.rowLabel(item.payoutCents, statusLabel, spokenOneLine, when)}
      accessibilityHint={history.rowHint}
      onPress={() => router.push({ pathname: '/history/[id]', params: { id: item.depositId } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowTop}>
        <Text style={styles.amount}>{formatRand(item.payoutCents)}</Text>
        <Text
          style={[
            styles.status,
            item.status === 'completed' && styles.statusDone,
            item.status === 'failed' && styles.statusFailed,
          ]}
        >
          {statusLabel}
        </Text>
      </View>
      <Text style={styles.detail} numberOfLines={1}>
        {oneLine}
      </Text>
      <Text style={styles.detail}>{when}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { ...type.headline, color: colors.ink },
  empty: { ...type.body, color: colors.inkMuted },
  list: { gap: spacing.md },
  row: {
    minHeight: size.touch,
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.primaryTint, opacity: opacity.pressed },
  rowTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  amount: { ...type.title, color: colors.ink },
  // A pill chip. Paid is filled green; Not sent is outlined in the error colour, so the two
  // differ by shape and words as well as colour.
  status: {
    ...type.label,
    color: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.chip,
    overflow: 'hidden',
    backgroundColor: colors.paper,
  },
  statusDone: { color: colors.onPrimary, backgroundColor: colors.primary },
  statusFailed: {
    color: colors.error,
    backgroundColor: colors.errorTint,
    borderWidth: borderWidth.thin,
    borderColor: colors.error,
  },
  detail: { ...type.caption, color: colors.inkMuted },
  note: { ...type.caption, color: colors.inkMuted },
});
