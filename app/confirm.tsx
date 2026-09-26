import { randomUUID } from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';

import { api } from '../src/api/client';
import type { PayoutMethod } from '../src/api/types';
import { Button } from '../src/components/Button';
import { InlineError } from '../src/components/InlineError';
import { Screen } from '../src/components/Screen';
import { common, confirm } from '../src/copy';
import { describeDestination } from '../src/domain/destination';
import { isVoucherDepositable } from '../src/domain/fees';
import { formatRand, spokenRand } from '../src/domain/money';
import { describeError } from '../src/errorMessage';
import { tickHaptic } from '../src/haptics';
import { saveActiveDeposit } from '../src/storage/activeDeposit';
import { recordRedemption } from '../src/storage/history';
import { loadDefaultPayoutMethod } from '../src/storage/payoutMethods';
import { colors, radius, spacing, type } from '../src/theme';
import {
  clearVoucherSession,
  currentVoucherSession,
  ensureIdempotencyKey,
} from '../src/voucherSession';

/**
 * The last check before money leaves. Payouts cannot be reversed, so the amount the user will
 * receive is the biggest thing here and is repeated in the Send button.
 */
export default function ConfirmScreen() {
  const [session] = useState(currentVoucherSession);
  const [destination, setDestination] = useState<PayoutMethod | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendingRef = useRef(false);

  // No voucher in memory (the app was reloaded): there is nothing to confirm.
  useEffect(() => {
    if (!session) router.replace('/deposit');
  }, [session]);

  // Runs again when we come back from "These aren't my details".
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadDefaultPayoutMethod().then((saved) => {
        if (cancelled) return;
        if (saved) setDestination(saved);
        else router.replace('/payout-methods/add');
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Leaving mid-request would strand a deposit that may already exist. Back waits for the result.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => sendingRef.current);
    return () => subscription.remove();
  }, []);

  if (!session || !destination) return <Screen>{null}</Screen>;

  const { valueCents, feeCents, payoutCents } = session.lookup;
  const depositable = isVoucherDepositable(valueCents, feeCents);
  const { primary, secondary, spokenOneLine } = describeDestination(destination);

  async function onSend() {
    if (!session || !destination || !depositable || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    tickHaptic();

    try {
      // Made before the first request and reused by every retry of this voucher, so a slow
      // network, a double tap or a retry can never pay twice.
      const idempotencyKey = ensureIdempotencyKey(session, randomUUID);

      const created = await api.createDeposit(session.lookup.voucherToken, destination.id, idempotencyKey);

      const sentAt = Date.now();
      try {
        // Lets the launcher reopen the status screen if the app is closed now. Snapshots the
        // destination as it was at Send time, so status is correct even if it changes later.
        await saveActiveDeposit({
          depositId: created.id,
          reference: created.reference,
          startedAt: sentAt,
          destination,
        });
      } catch {
        // The deposit exists either way; resume-after-close is a nicety.
      }

      try {
        // The receipt for "Your deposits": what the user confirmed, as they confirmed it.
        await recordRedemption({
          depositId: created.id,
          reference: created.reference,
          sentAt,
          valueCents,
          feeCents,
          payoutCents: created.payoutCents,
          destination,
          status: created.status,
          ...(created.failureReason !== undefined ? { failureReason: created.failureReason } : {}),
        });
      } catch {
        // Same: history is a nicety and must never stand between the user and their status.
      }

      clearVoucherSession();
      // Clear the stack first so back from status can never land on a live Send button.
      if (router.canDismiss()) router.dismissAll();
      router.replace({ pathname: '/status/[id]', params: { id: created.id } });
    } catch (caught) {
      setError(describeError(caught, { moneyMayHaveMoved: true }));
      sendingRef.current = false;
      setSending(false);
    }
  }

  return (
    <Screen>
      <Button
        variant="text"
        align="start"
        label={common.back}
        onPress={() => router.back()}
        disabled={sending}
      />

      <Text accessibilityRole="header" style={styles.title}>
        {confirm.title}
      </Text>

      <View style={styles.rows}>
        <View
          style={styles.row}
          accessible
          accessibilityLabel={`${confirm.voucherValue}, ${spokenRand(valueCents)}`}
        >
          <Text style={styles.rowLabel}>{confirm.voucherValue}</Text>
          <Text style={styles.rowValue}>{formatRand(valueCents)}</Text>
        </View>

        <View style={styles.row} accessible accessibilityLabel={confirm.feeLabel(feeCents)}>
          <Text style={styles.rowLabel}>{confirm.fee}</Text>
          <Text style={styles.rowValue}>{confirm.feeDisplay(feeCents)}</Text>
        </View>

        <View
          style={styles.receive}
          accessible
          accessibilityLabel={`${confirm.youReceive}, ${spokenRand(payoutCents)}`}
        >
          <Text style={styles.receiveLabel}>{confirm.youReceive}</Text>
          <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
            {formatRand(payoutCents)}
          </Text>
        </View>

        <View
          style={styles.paidInto}
          accessible
          accessibilityLabel={confirm.paidIntoSpoken(primary, spokenOneLine)}
        >
          <Text style={styles.rowLabel}>{confirm.paidInto}</Text>
          <Text style={styles.holder}>{primary}</Text>
          <Text style={styles.rowValue}>{secondary}</Text>
        </View>
      </View>

      {depositable ? (
        <Text style={styles.note}>{confirm.note}</Text>
      ) : (
        <InlineError message={confirm.tooSmall} />
      )}
      {error ? <InlineError message={error} /> : null}

      <View style={styles.actions}>
        <Button
          label={depositable ? confirm.send(payoutCents) : confirm.cannotSend}
          accessibilityLabel={depositable ? confirm.sendLabel(payoutCents) : undefined}
          loadingLabel={confirm.sending}
          onPress={onSend}
          disabled={!depositable}
          loading={sending}
        />
        <Button
          variant="text"
          label={confirm.notMyDetails}
          onPress={() => router.push('/payout-methods')}
          disabled={sending}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.title, color: colors.ink },
  rows: { gap: spacing.xl },
  row: { gap: spacing.xs },
  rowLabel: { ...type.label, color: colors.inkMuted },
  rowValue: { ...type.body, color: colors.ink },
  // The one loud thing on the screen: a white card, like a balance.
  receive: {
    gap: spacing.xs,
    padding: spacing.xl,
    borderRadius: radius.card,
    backgroundColor: colors.card,
  },
  receiveLabel: { ...type.label, color: colors.onCardMuted },
  amount: { ...type.amount, color: colors.onCard },
  paidInto: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
  },
  holder: { ...type.title, color: colors.ink },
  note: { ...type.body, color: colors.ink },
  actions: { gap: spacing.md },
});
