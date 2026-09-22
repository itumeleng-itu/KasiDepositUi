import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { api } from '../src/api/client';
import { Button } from '../src/components/Button';
import { DestinationLine } from '../src/components/DestinationLine';
import { DigitsField } from '../src/components/DigitsField';
import { Screen } from '../src/components/Screen';
import { deposit } from '../src/copy';
import { PIN_GROUPING, PIN_LENGTH } from '../src/domain/pin';
import { describeError } from '../src/errorMessage';
import { loadBeneficiary } from '../src/storage/beneficiary';
import type { StoredBeneficiary } from '../src/storage/beneficiaryRecord';
import { colors, PIN_MAX_FONT_SCALE, spacing, type } from '../src/theme';
import { startVoucherSession } from '../src/voucherSession';

/**
 * The screen a returning user sees every time. The PIN lives only in this component's state:
 * it is never stored, logged or passed to another screen. After the lookup only the server's
 * opaque voucher token moves on.
 */
export default function DepositScreen() {
  const [beneficiary, setBeneficiary] = useState<StoredBeneficiary | null>(null);
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const busyRef = useRef(false);

  // Runs again when we come back from "Change", so the line always shows what is saved.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadBeneficiary().then((saved) => {
        if (cancelled) return;
        if (saved) setBeneficiary(saved);
        else router.replace('/setup');
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
    try {
      const lookup = await api.lookupVoucher(digits);
      startVoucherSession(lookup);
      router.push('/confirm');
    } catch (caught) {
      // The PIN stays in the field so the user can check it against the slip.
      setError(describeError(caught, { moneyMayHaveMoved: false }));
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }

  return (
    <Screen>
      {beneficiary ? (
        <DestinationLine
          beneficiary={beneficiary}
          onChange={() =>
            router.push({ pathname: '/setup', params: { mode: 'change', returnTo: 'deposit' } })
          }
        />
      ) : null}

      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {deposit.heading}
        </Text>
        <Text style={styles.helper}>{deposit.helper}</Text>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.sm },
  title: { ...type.headline, color: colors.ink },
  helper: { ...type.body, color: colors.inkMuted },
  pin: { gap: spacing.sm },
  // Tighter side padding so 16 digits and three gaps fit a 320 dp screen at 24 sp.
  pinText: { ...type.pin, paddingHorizontal: spacing.md },
  counter: { ...type.label, color: colors.inkMuted },
});
