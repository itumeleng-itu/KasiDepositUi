import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { isApiError } from '../../src/api/errors';
import { BankList } from '../../src/components/BankList';
import { Button } from '../../src/components/Button';
import { DigitsField } from '../../src/components/DigitsField';
import { InlineError } from '../../src/components/InlineError';
import { Screen } from '../../src/components/Screen';
import { common, payout } from '../../src/copy';
import { ACCOUNT_GROUPING, normaliseAccountNumber, validateAccountNumber } from '../../src/domain/account';
import type { BankId } from '../../src/domain/banks';
import { describeError } from '../../src/errorMessage';
import { tickHaptic } from '../../src/haptics';
import { finishAdding } from '../../src/payoutNavigation';
import { addPayoutMethod } from '../../src/storage/payoutMethods';
import { loadUser } from '../../src/storage/user';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * Add a bank account. The holder is always the registered user — shown, not typed, so nobody can
 * enter someone else's name — and the server checks with the bank that the account belongs to
 * their ID number before saving it. The account number lives in this screen's state until it is
 * sent, once; afterwards the phone only ever knows its last four digits.
 */
export default function AddAccountScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [holder, setHolder] = useState<string | null>(null);
  const [bankId, setBankId] = useState<BankId | null>(null);
  const [digits, setDigits] = useState('');
  const [touched, setTouched] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offerPayShap, setOfferPayShap] = useState(false);
  const addingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadUser().then((user) => {
      if (cancelled) return;
      if (user) setHolder(user.fullNames);
      else router.replace('/register');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const accountError = validateAccountNumber(digits);
  const valid = bankId !== null && accountError === null;

  async function onAdd() {
    setTouched(true);
    if (!valid || bankId === null || addingRef.current) return;
    addingRef.current = true;
    setAdding(true);
    setError(null);
    setOfferPayShap(false);
    Keyboard.dismiss();
    try {
      await addPayoutMethod(
        { kind: 'account', bankId, accountNumber: normaliseAccountNumber(digits) },
        true,
      );
      tickHaptic();
      finishAdding(next);
    } catch (caught) {
      const reason = isApiError(caught) && caught.kind === 'business' ? caught.reason : undefined;
      setError(describeError(caught, { moneyMayHaveMoved: false }));
      setOfferPayShap(reason === 'account_holder_mismatch' || reason === 'accounts_unavailable');
      addingRef.current = false;
      setAdding(false);
    }
  }

  return (
    <Screen>
      <Button variant="text" align="start" label={common.back} onPress={() => router.back()} disabled={adding} />

      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {payout.addAccountTitle}
        </Text>
        <Text style={styles.body}>{payout.addAccountHelper}</Text>
      </View>

      <View
        style={styles.holder}
        accessible
        accessibilityLabel={holder ? `${payout.holderLabel}, ${holder}` : payout.holderLabel}
      >
        <Text style={styles.label}>{payout.holderLabel}</Text>
        <Text style={styles.holderName}>{holder ?? ' '}</Text>
      </View>

      <BankList
        label={payout.bankLabel}
        selected={bankId}
        onSelect={(bank) => {
          setBankId(bank);
          setError(null);
        }}
      />

      <DigitsField
        label={payout.accountLabel}
        digits={digits}
        grouping={ACCOUNT_GROUPING}
        onChangeDigits={(nextDigits) => {
          setDigits(nextDigits);
          setError(null);
          setOfferPayShap(false);
        }}
        error={touched && accountError ? payout.accountError[accountError] : null}
        onBlur={() => setTouched(true)}
        returnKeyType="done"
        onSubmitEditing={onAdd}
        editable={!adding}
      />

      {error ? <InlineError message={error} /> : null}

      <View style={styles.actions}>
        <Button
          label={payout.add}
          loadingLabel={payout.checkingAccount}
          onPress={onAdd}
          disabled={!valid}
          loading={adding}
        />
        {!valid ? (
          <Text style={styles.unmet} accessibilityLiveRegion="polite">
            {payout.accountUnmet}
          </Text>
        ) : null}
        {offerPayShap ? (
          <Button
            variant="secondary"
            label={payout.usePayShapInstead}
            onPress={() =>
              router.replace({ pathname: '/payout-methods/add-payshap', params: next ? { next } : {} })
            }
          />
        ) : null}
      </View>

      <Text style={styles.note}>{payout.accountPrivacy}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.sm },
  title: { ...type.headline, color: colors.ink },
  body: { ...type.body, color: colors.inkMuted },
  // Who the account belongs to, on a white card like a profile: shown, never typed.
  holder: {
    gap: spacing.xs,
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: radius.card,
    backgroundColor: colors.card,
  },
  label: { ...type.label, color: colors.onCardMuted, textAlign: 'center' },
  holderName: { ...type.title, color: colors.onCard, textAlign: 'center' },
  actions: { gap: spacing.md },
  unmet: { ...type.label, color: colors.inkMuted, textAlign: 'center' },
  note: { ...type.body, color: colors.inkMuted },
});
