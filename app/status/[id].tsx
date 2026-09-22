import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppState, BackHandler, StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/api/client';
import { isApiError } from '../../src/api/errors';
import type { Deposit } from '../../src/api/types';
import { Button } from '../../src/components/Button';
import { FadeIn } from '../../src/components/FadeIn';
import { Icon } from '../../src/components/Icon';
import { Screen } from '../../src/components/Screen';
import { StepIndicator } from '../../src/components/StepIndicator';
import { common, nextStatusAction, statusCopy, status } from '../../src/copy';
import { maskAccountNumber } from '../../src/domain/account';
import { bankName } from '../../src/domain/banks';
import { successHaptic } from '../../src/haptics';
import {
  createPoller,
  isTerminal,
  progressSteps,
  screenState,
  STILL_PROCESSING_AFTER_MS,
} from '../../src/polling';
import { clearActiveDeposit, loadActiveDeposit } from '../../src/storage/activeDeposit';
import { loadBeneficiary } from '../../src/storage/beneficiary';
import { colors, size, spacing, type } from '../../src/theme';

interface Origin {
  startedAt: number;
  reference: string | null;
  destination: { bankName: string; maskedAccount: string } | null;
}

/**
 * Where the user's money is, truthfully. It works when opened cold from the launcher with only
 * an id: the saved active-deposit record supplies the start time and destination, and the
 * server supplies everything else. Slow is never shown as failed.
 */
export default function StatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [offline, setOffline] = useState(false);
  const [slow, setSlow] = useState(false);

  // Where the money went and when we started. Falls back to the saved details, then to "now".
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadActiveDeposit(), loadBeneficiary()])
      .then(([active, saved]) => {
        if (cancelled) return;
        const mine = active && active.depositId === id ? active : null;
        const destination = mine
          ? { bankName: bankName(mine.bankId), maskedAccount: maskAccountNumber(mine.accountLast4) }
          : saved
            ? { bankName: bankName(saved.bankId), maskedAccount: maskAccountNumber(saved.accountNumber) }
            : null;
        const startedAt = mine ? mine.startedAt : Date.now();
        setSlow(Date.now() - startedAt >= STILL_PROCESSING_AFTER_MS);
        setOrigin({ startedAt, reference: mine ? mine.reference : null, destination });
      })
      .catch(() => {
        if (!cancelled) setOrigin({ startedAt: Date.now(), reference: null, destination: null });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const startedAt = origin?.startedAt ?? null;

  // Poll while the screen is open and the app is in the foreground.
  useEffect(() => {
    if (startedAt === null) return;

    const poller = createPoller({
      fetchDeposit: () => api.getDepositStatus(id),
      onDeposit: (latest) => {
        setDeposit(latest);
        setOffline(false);
        setSlow(Date.now() - startedAt >= STILL_PROCESSING_AFTER_MS);
      },
      onError: (error) => {
        // No connection is a small note; the status on screen stays as it was. Any other error
        // means the server did answer, so we are not offline, and we keep trying quietly.
        setOffline(isApiError(error) && error.kind === 'network');
        setSlow(Date.now() - startedAt >= STILL_PROCESSING_AFTER_MS);
      },
      startedAt,
    });

    if (AppState.currentState !== 'active') poller.pause();
    poller.start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') poller.resume();
      else poller.pause();
    });

    return () => {
      subscription.remove();
      poller.stop();
    };
  }, [id, startedAt]);

  const terminal = deposit !== null && isTerminal(deposit.status);

  // "Still processing" starts at 90 s even if no poll lands to tell us so.
  useEffect(() => {
    if (startedAt === null || slow || terminal) return;
    const remaining = Math.max(0, STILL_PROCESSING_AFTER_MS - (Date.now() - startedAt));
    const timer = setTimeout(() => setSlow(true), remaining);
    return () => clearTimeout(timer);
  }, [startedAt, slow, terminal]);

  // The user has now seen the outcome: forget the unfinished deposit, and mark success once.
  const finalStatus = terminal ? deposit.status : null;
  useEffect(() => {
    if (finalStatus === null) return;
    clearActiveDeposit();
    if (finalStatus === 'completed') successHaptic();
  }, [finalStatus]);

  // Android back always goes to the PIN screen, never to confirm.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/deposit');
      return true;
    });
    return () => subscription.remove();
  }, []);

  const state = screenState(deposit ? deposit.status : null, slow ? STILL_PROCESSING_AFTER_MS : 0);
  const text = useMemo(
    () =>
      statusCopy(state, {
        payoutCents: deposit ? deposit.payoutCents : 0,
        destination: origin ? origin.destination : null,
        failureReason: deposit?.failureReason,
      }),
    [state, deposit, origin],
  );

  if (origin === null) return <Screen>{null}</Screen>;

  const steps = progressSteps(deposit ? deposit.status : null);
  const reference = deposit ? deposit.reference : origin.reference;
  const failed = deposit?.status === 'failed';
  const action = nextStatusAction(deposit?.failureReason ?? 'unknown');

  return (
    <Screen>
      {/* No swipe-back on iOS either: back from here must not reach a live Send button. */}
      <Stack.Screen options={{ gestureEnabled: false }} />

      <FadeIn contentKey={state}>
        <View style={styles.message} accessibilityLiveRegion="polite">
          {state === 'completed' ? <Icon name="check" color={colors.success} size={size.stepIcon} /> : null}
          {failed ? <Icon name="alert" color={colors.error} size={size.stepIcon} /> : null}
          <Text accessibilityRole="header" accessibilityLabel={text.spokenHeadline} style={styles.headline}>
            {text.headline}
          </Text>
          <Text accessibilityLabel={text.spokenSupport} style={styles.support}>
            {text.support}
          </Text>
        </View>
      </FadeIn>

      {steps ? <StepIndicator steps={steps} /> : null}

      {offline ? (
        <Text style={styles.offline} accessibilityLiveRegion="polite">
          {common.noConnectionPolling}
        </Text>
      ) : null}

      {reference ? (
        <Text selectable style={styles.reference}>
          {status.reference(reference)}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {state === 'completed' ? (
          <Button label={status.makeAnother} onPress={() => router.replace('/deposit')} />
        ) : null}

        {failed ? (
          // A fresh PIN and lookup either way: the destination was already resolved before
          // Send, so none of these reasons means "change your destination" — there is nothing
          // to change. A fresh attempt is the only recovery path from here.
          <Button
            label={
              action === 'try_later'
                ? status.tryAgainLater
                : action === 'make_another'
                  ? status.makeAnother
                  : status.tryAgain
            }
            onPress={() => router.replace('/deposit')}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: { gap: spacing.md },
  headline: { ...type.headline, color: colors.ink },
  support: { ...type.body, color: colors.ink },
  offline: { ...type.label, color: colors.inkMuted },
  reference: { ...type.label, color: colors.inkMuted },
  actions: { gap: spacing.md },
});
