import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { loadActiveDeposit } from '../src/storage/activeDeposit';
import { loadBeneficiary } from '../src/storage/beneficiary';
import { colors } from '../src/theme';

/**
 * Decides where to go and shows nothing but the background while it does (well under 100 ms).
 * An unfinished deposit wins, so a user who closed the app mid-deposit lands back on their money.
 */
export default function Launcher() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      let target: Href = '/setup';
      try {
        const active = await loadActiveDeposit();
        if (active) {
          target = { pathname: '/status/[id]', params: { id: active.depositId } };
        } else if (await loadBeneficiary()) {
          target = '/deposit';
        }
      } catch {
        // Storage trouble: fall through to setup rather than leaving a blank screen.
      }
      if (!cancelled) router.replace(target);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return <View style={styles.blank} />;
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.paper },
});
