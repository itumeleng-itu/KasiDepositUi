import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { PayoutOptionCard } from '../../src/components/PayoutMethodCard';
import { Screen } from '../../src/components/Screen';
import { common, payout } from '../../src/copy';
import { refreshPayoutMethods } from '../../src/storage/payoutMethods';
import { colors, spacing, type } from '../../src/theme';

/**
 * "How do you want to get paid?" — PayShap or a bank account, the user's choice. Nothing is
 * assumed: each is checked when it is added, and either add screen offers the other one if its
 * check fails.
 *
 * `next=deposit` is the first run, straight after registering: finishing an add goes to the PIN
 * screen. Someone who registered again on a new phone may already have methods on the server:
 * then there is nothing to choose, and they go straight on.
 */
export default function ChoosePayoutMethodScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const firstRun = next === 'deposit';

  useEffect(() => {
    if (!firstRun) return;
    let cancelled = false;
    refreshPayoutMethods()
      .then((methods) => {
        if (!cancelled && methods.length > 0) router.replace('/deposit');
      })
      .catch(() => {
        // Offline: they can still add one; the add screens report the connection themselves.
      });
    return () => {
      cancelled = true;
    };
  }, [firstRun]);

  const params = firstRun ? { next: 'deposit' } : {};

  return (
    <Screen>
      {firstRun ? null : (
        <Button variant="text" align="start" label={common.back} onPress={() => router.back()} />
      )}

      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {payout.chooseTitle}
        </Text>
        <Text style={styles.body}>{payout.chooseHelper}</Text>
      </View>

      <View style={styles.options}>
        <PayoutOptionCard
          title={payout.payShapTitle}
          body={payout.payShapBody}
          onPress={() => router.push({ pathname: '/payout-methods/add-payshap', params })}
        />
        <PayoutOptionCard
          title={payout.accountTitle}
          body={payout.accountBody}
          onPress={() => router.push({ pathname: '/payout-methods/add-account', params })}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.sm },
  title: { ...type.headline, color: colors.ink },
  body: { ...type.body, color: colors.inkMuted },
  options: { gap: spacing.md },
});
