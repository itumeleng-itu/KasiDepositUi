import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/api/client';
import { Button } from '../../src/components/Button';
import { Icon } from '../../src/components/Icon';
import { Screen } from '../../src/components/Screen';
import { common, confirm, formatSentAt, history, statusCopy } from '../../src/copy';
import { bankName } from '../../src/domain/banks';
import { describeDestination, maskedIdentifier } from '../../src/domain/destination';
import { formatRand, spokenRand } from '../../src/domain/money';
import { isTerminal } from '../../src/polling';
import { loadRedemption, updateRedemptionStatus } from '../../src/storage/history';
import type { Redemption } from '../../src/storage/historyRecord';
import { colors, radius, size, spacing, type } from '../../src/theme';

type Loaded = { kind: 'loading' } | { kind: 'missing' } | { kind: 'found'; item: Redemption };

/**
 * One past deposit, as it was sent. Everything shown comes from this phone; if the deposit had
 * not finished when last seen, the server is asked once for its latest status.
 */
export default function RedemptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const item = await loadRedemption(id);
      if (cancelled) return;
      if (!item) {
        setLoaded({ kind: 'missing' });
        return;
      }
      setLoaded({ kind: 'found', item });
      if (isTerminal(item.status)) return;

      setRefreshing(true);
      try {
        const latest = await api.getDepositStatus(id);
        const updated = await updateRedemptionStatus(latest);
        if (!cancelled && updated) setLoaded({ kind: 'found', item: updated });
      } catch {
        // Offline or the server is unsure: the saved status is still the best we have.
      }
      if (!cancelled) setRefreshing(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const back = <Button variant="text" align="start" label={common.back} onPress={() => router.back()} />;

  if (loaded.kind === 'loading') return <Screen>{back}</Screen>;

  if (loaded.kind === 'missing') {
    return (
      <Screen>
        {back}
        <Text style={styles.support}>{history.notFound}</Text>
      </Screen>
    );
  }

  const { item } = loaded;
  const { primary, secondary, spokenOneLine } = describeDestination(item.destination);
  const text = statusCopy(item.status, {
    payoutCents: item.payoutCents,
    destination: {
      bankName: bankName(item.destination.bankId),
      maskedAccount: maskedIdentifier(item.destination),
    },
    failureReason: item.failureReason,
  });
  const when = formatSentAt(item.sentAt);

  return (
    <Screen>
      {back}

      <Text style={styles.eyebrow}>{history.detailTitle}</Text>

      <View style={styles.message}>
        {item.status === 'completed' ? (
          <Icon name="check" color={colors.success} size={size.stepIcon} />
        ) : null}
        {item.status === 'failed' ? <Icon name="alert" color={colors.error} size={size.stepIcon} /> : null}
        <Text accessibilityRole="header" accessibilityLabel={text.spokenHeadline} style={styles.headline}>
          {text.headline}
        </Text>
        <Text accessibilityLabel={text.spokenSupport} style={styles.support}>
          {text.support}
        </Text>
        {refreshing ? (
          <Text style={styles.muted} accessibilityLiveRegion="polite">
            {history.checking}
          </Text>
        ) : null}
      </View>

      <View style={styles.rows}>
        <View
          style={styles.receive}
          accessible
          accessibilityLabel={`${history.received}, ${spokenRand(item.payoutCents)}`}
        >
          <Text style={styles.receiveLabel}>{history.received}</Text>
          <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
            {formatRand(item.payoutCents)}
          </Text>
        </View>

        <View
          style={styles.row}
          accessible
          accessibilityLabel={`${confirm.voucherValue}, ${spokenRand(item.valueCents)}`}
        >
          <Text style={styles.rowLabel}>{confirm.voucherValue}</Text>
          <Text style={styles.rowValue}>{formatRand(item.valueCents)}</Text>
        </View>

        <View style={styles.row} accessible accessibilityLabel={confirm.feeLabel(item.feeCents)}>
          <Text style={styles.rowLabel}>{confirm.fee}</Text>
          <Text style={styles.rowValue}>{confirm.feeDisplay(item.feeCents)}</Text>
        </View>

        <View
          style={styles.row}
          accessible
          accessibilityLabel={confirm.paidIntoSpoken(primary, spokenOneLine)}
        >
          <Text style={styles.rowLabel}>{confirm.paidInto}</Text>
          <Text style={styles.holder}>{primary}</Text>
          <Text style={styles.rowValue}>{secondary}</Text>
        </View>

        <View style={styles.row} accessible accessibilityLabel={`${history.sent}, ${when}`}>
          <Text style={styles.rowLabel}>{history.sent}</Text>
          <Text style={styles.rowValue}>{when}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>{history.reference}</Text>
          <Text selectable style={styles.rowValue}>
            {item.reference}
          </Text>
        </View>
      </View>

      {!isTerminal(item.status) ? (
        <Button
          variant="secondary"
          label={history.viewStatus}
          onPress={() => router.push({ pathname: '/status/[id]', params: { id: item.depositId } })}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.label, color: colors.inkMuted },
  message: { gap: spacing.md },
  headline: { ...type.headline, color: colors.ink },
  support: { ...type.body, color: colors.ink },
  muted: { ...type.label, color: colors.inkMuted },
  rows: { gap: spacing.xl },
  row: { gap: spacing.xs },
  rowLabel: { ...type.label, color: colors.inkMuted },
  rowValue: { ...type.body, color: colors.ink },
  holder: { ...type.title, color: colors.ink },
  // The one loud thing on the screen: a white card, like a balance.
  receive: {
    gap: spacing.xs,
    padding: spacing.xl,
    borderRadius: radius.card,
    backgroundColor: colors.card,
  },
  receiveLabel: { ...type.label, color: colors.onCardMuted },
  amount: { ...type.amount, color: colors.onCard },
});
