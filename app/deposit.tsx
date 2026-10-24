import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';

import type { PayoutMethod } from '../src/api/types';
import { Button } from '../src/components/Button';
import { DestinationLine } from '../src/components/DestinationLine';
import { DigitsField } from '../src/components/DigitsField';
import { Icon } from '../src/components/Icon';
import { Screen } from '../src/components/Screen';
import { deposit } from '../src/copy';
import { PIN_GROUPING, PIN_LENGTH } from '../src/domain/pin';
import { loadDefaultPayoutMethod } from '../src/storage/payoutMethods';
import { colors, PIN_MAX_FONT_SCALE, size, spacing, type } from '../src/theme';
import { attemptVoucherLookup } from '../src/voucherLookup';

/**
 * The screen a returning user sees every time. The PIN lives only in this component's state:
 * it is never stored, logged or passed to another screen. After the lookup only the server's
 * opaque voucher token moves on.
 */
export default function DepositScreen() {
  const [destination, setDestination] = useState<PayoutMethod | null>(null);
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const busyRef = useRef(false);

  // Runs again when we come back from "Change", so the line always shows what is saved.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadDefaultPayoutMethod().then((saved) => {
        if (cancelled) return;
        if (saved) setDestination(saved);
        else router.replace({ pathname: '/payout-methods/add', params: { next: 'deposit' } });
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const complete = digits.length === PIN_LENGTH;

  async function onContinue() {
    if (!complete || busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    setError(null);
    Keyboard.dismiss();
    // The PIN stays in the field on failure, so the user can check it against the slip.
    const result = await attemptVoucherLookup(digits);
    if (result.ok) router.push('/confirm');
    else if (result.mustRegister) router.replace('/register');
    else setError(result.message);
    busyRef.current = false;
    setLoading(false);
  }

  return (
    <Screen>
      {destination ? (
        <DestinationLine
          destination={destination}
          onChange={() => router.push('/payout-methods')}
        />
      ) : null}

      <View style={styles.headingRow}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>
            {deposit.heading}
          </Text>
          <Text style={styles.helper}>{deposit.helper}</Text>
        </View>
        {/* An icon, so it stops competing with the two real actions --
            but it still needs a name of its own, because an icon alone
            tells a screen reader nothing. */}
        <Pressable
          onPress={() => router.push('/privacy')}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={deposit.privacyButton}
          hitSlop={spacing.sm}
          style={styles.privacy}
        >
          <Icon name="shield" color={colors.inkMuted} />
        </Pressable>
      </View>

      <View style={styles.pin}>
        <DigitsField
          label={deposit.pinLabelWithCount(digits.length)}
          hideLabel
          digits={digits}
          grouping={PIN_GROUPING}
          onChangeDigits={(next) => {
            setDigits(next);
            setError(null);
          }}
          onPasteRejected={() => setError(deposit.pasteTooLong)}
          error={error}
          inputStyle={styles.pinText}
          maxFontSizeMultiplier={PIN_MAX_FONT_SCALE}
          returnKeyType="done"
          onSubmitEditing={onContinue}
        />
        <Text style={styles.counter}>{deposit.counter(digits.length)}</Text>
      </View>

      <Button
        label={deposit.continue}
        loadingLabel={deposit.checking}
        onPress={onContinue}
        disabled={!complete}
        loading={loading}
      />

      {/* Two ways on from here, side by side: they are alternatives to
          each other, and stacking them read as a list of three equal
          things with the privacy link. Each half is flex:1 so the row
          splits evenly whatever the label length. */}
      <View style={styles.row}>
        <View style={styles.half}>
          <Button
            variant="secondary"
            label={deposit.scanButton}
            onPress={() => router.push('/scan')}
            disabled={loading}
          />
        </View>
        <View style={styles.half}>
          <Button
            variant="secondary"
            label={deposit.historyButton}
            onPress={() => router.push('/history')}
            disabled={loading}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  heading: { flex: 1, gap: spacing.sm },
  // 48dp so the icon is still a full touch target.
  privacy: {
    width: size.touch,
    height: size.touch,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -spacing.md,
    marginRight: -spacing.md,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  title: { ...type.headline, color: colors.ink },
  helper: { ...type.body, color: colors.inkMuted },
  pin: { gap: spacing.sm },
  // Tighter side padding so 16 digits and three gaps fit a 320 dp screen at 24 sp.
  pinText: { ...type.pin, paddingHorizontal: spacing.md },
  counter: { ...type.label, color: colors.inkMuted },
});
