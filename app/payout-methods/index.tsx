import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import type { PayoutMethod } from '../../src/api/types';
import { Button } from '../../src/components/Button';
import { InlineError } from '../../src/components/InlineError';
import { PayoutMethodCard } from '../../src/components/PayoutMethodCard';
import { Screen } from '../../src/components/Screen';
import { common, payout } from '../../src/copy';
import { describeDestination } from '../../src/domain/destination';
import { tickHaptic } from '../../src/haptics';
import {
  loadPayoutMethods,
  refreshPayoutMethods,
  removePayoutMethod,
  setDefaultPayoutMethod,
} from '../../src/storage/payoutMethods';
import { colors, spacing, type } from '../../src/theme';

/**
 * "Where your money goes": every PayShap number and bank account the user has added, as cards.
 * Tapping one pays into it from now on and goes back to where the user came from (the PIN or
 * confirm screen, whose "Paying into" line then shows it). The phone's copy shows at once; the
 * server's list replaces it when it answers.
 */
export default function PayoutMethodsScreen() {
  const [methods, setMethods] = useState<PayoutMethod[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  // Runs again when we come back from adding one.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadPayoutMethods().then((saved) => {
        if (!cancelled) setMethods((current) => current ?? saved);
      });
      refreshPayoutMethods()
        .then((fresh) => {
          if (cancelled) return;
          setMethods(fresh);
          setOffline(false);
        })
        .catch(() => {
          if (!cancelled) setOffline(true);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  async function change(action: () => Promise<PayoutMethod[]>): Promise<boolean> {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      setMethods(await action());
      return true;
    } catch {
      setError(payout.changeFailed);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function onSelect(method: PayoutMethod) {
    if (!method.isDefault && !(await change(() => setDefaultPayoutMethod(method.id)))) return;
    tickHaptic();
    if (router.canGoBack()) router.back();
    else router.replace('/deposit');
  }

  function onRemove(method: PayoutMethod) {
    Alert.alert(payout.removeTitle, payout.removeBody(describeDestination(method).oneLine), [
      { text: common.cancel, style: 'cancel' },
      { text: payout.remove, style: 'destructive', onPress: () => change(() => removePayoutMethod(method.id)) },
    ]);
  }

  return (
    <Screen>
      <Button variant="text" align="start" label={common.back} onPress={() => router.back()} />

      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {payout.listTitle}
        </Text>
        {methods && methods.length > 1 ? <Text style={styles.body}>{payout.listHelper}</Text> : null}
      </View>

      {offline ? (
        <Text style={styles.note} accessibilityLiveRegion="polite">
          {payout.offline}
        </Text>
      ) : null}
      {error ? <InlineError message={error} /> : null}

      {methods !== null && methods.length === 0 ? <Text style={styles.body}>{payout.empty}</Text> : null}

      {methods && methods.length > 0 ? (
        <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel={payout.listTitle}>
          {methods.map((method) => (
            <PayoutMethodCard
              key={method.id}
              method={method}
              onSelect={() => onSelect(method)}
              onRemove={() => onRemove(method)}
              disabled={busy}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          variant="secondary"
          label={payout.addPayShap}
          onPress={() => router.push('/payout-methods/add-payshap')}
          disabled={busy}
        />
        <Button
          variant="secondary"
          label={payout.addAccount}
          onPress={() => router.push('/payout-methods/add-account')}
          disabled={busy}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.sm },
  title: { ...type.headline, color: colors.ink },
  body: { ...type.body, color: colors.inkMuted },
  note: { ...type.label, color: colors.inkMuted },
  list: { gap: spacing.md },
  actions: { gap: spacing.md },
});
