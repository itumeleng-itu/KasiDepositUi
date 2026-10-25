import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { isApiError } from '../../src/api/errors';
import type { PayoutMethod } from '../../src/api/types';
import { BankList } from '../../src/components/BankList';
import { Button } from '../../src/components/Button';
import { Icon } from '../../src/components/Icon';
import { InlineError } from '../../src/components/InlineError';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { common, payout } from '../../src/copy';
import { describeDestination } from '../../src/domain/destination';
import { parseShapId, withBankSuffix } from '../../src/domain/shapId';
import { describeError } from '../../src/errorMessage';
import { tickHaptic } from '../../src/haptics';
import { finishAdding } from '../../src/payoutNavigation';
import { addPayoutMethod } from '../../src/storage/payoutMethods';
import { borderWidth, colors, radius, size, spacing, type } from '../../src/theme';

/**
 * Use a PayShap number the user already set up in their banking app (the app cannot set anyone
 * up for PayShap). One field; the server looks the number up in the PayShap directory and
 * only saves it if it is registered there in this user's own name. If it isn't set up for
 * PayShap, or is someone else's, the user is offered a bank account instead — never a dead end.
 * A number registered at more than one bank shows the bank picker, as before.
 *
 * When it checks out, the screen says so — "Found on PayShap", with the name and bank the
 * directory holds for the number — and waits for the user to continue, so they see whose
 * account the money will go to before they ever enter a PIN.
 */
export default function AddPayShapScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [rawInput, setRawInput] = useState('');
  const [touched, setTouched] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Offer the other way to get paid: set when the number can't be used at all.
  const [offerAccount, setOfferAccount] = useState(false);
  // The number a shapid_ambiguous came back for, so a bank choice attaches to what was typed.
  const [ambiguousBase, setAmbiguousBase] = useState<string | null>(null);
  const addingRef = useRef(false);
  // The saved method once the directory confirmed it: shown until the user continues.
  const [found, setFound] = useState<PayoutMethod | null>(null);

  const parsed = parseShapId(rawInput);
  const fieldError = touched && !parsed.ok ? payout.parseError[parsed.reason] : null;
  const unmet = !parsed.ok ? payout.unmet[parsed.reason] : null;

  async function attempt(shapId: string) {
    if (addingRef.current) return;
    addingRef.current = true;
    setAdding(true);
    setError(null);
    setOfferAccount(false);
    Keyboard.dismiss();
    try {
      const method = await addPayoutMethod({ kind: 'shapId', shapId }, true);
      tickHaptic();
      setFound(method);
      addingRef.current = false;
      setAdding(false);
    } catch (caught) {
      const reason = isApiError(caught) && caught.kind === 'business' ? caught.reason : undefined;
      setError(describeError(caught, { moneyMayHaveMoved: false }));
      setAmbiguousBase(reason === 'shapid_ambiguous' ? shapId : null);
      setOfferAccount(
        reason === 'shapid_not_found' ||
          reason === 'shapid_suspended' ||
          reason === 'shapid_name_mismatch' ||
          reason === 'shapid_already_linked',
      );
      addingRef.current = false;
      setAdding(false);
    }
  }

  function onAdd() {
    setTouched(true);
    if (parsed.ok) attempt(parsed.shapId);
  }

  if (found) {
    const { primary, oneLine, spokenOneLine } = describeDestination(found);
    return (
      <Screen>
        <View style={styles.heading}>
          <View style={styles.foundTitleRow}>
            <Icon name="check" color={colors.success} size={size.icon} />
            <Text accessibilityRole="header" style={styles.title}>
              {payout.foundTitle}
            </Text>
          </View>
          <Text style={styles.body}>{payout.foundBody}</Text>
        </View>
        <View
          style={styles.foundCard}
          accessible
          accessibilityLabel={`${payout.kind.shapId}, ${primary}, ${spokenOneLine}`}
        >
          <Text style={styles.foundKind}>{payout.kind.shapId}</Text>
          <Text style={styles.foundName}>{primary}</Text>
          <Text style={styles.body}>{oneLine}</Text>
        </View>
        <View style={styles.actions}>
          <Button
            label={next === 'deposit' ? payout.continueToDeposit : payout.done}
            onPress={() => finishAdding(next)}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Button variant="text" align="start" label={common.back} onPress={() => router.back()} disabled={adding} />

      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {payout.addPayShapTitle}
        </Text>
        <Text style={styles.body}>{payout.addPayShapHelper}</Text>
      </View>

      <TextField
        label={payout.numberLabel}
        value={rawInput}
        onChangeText={(text) => {
          setRawInput(text);
          setError(null);
          setOfferAccount(false);
          setAmbiguousBase(null);
        }}
        error={fieldError}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        autoCorrect={false}
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={onAdd}
        onBlur={() => setTouched(true)}
        editable={!adding}
      />

      {error ? <InlineError message={error} /> : null}

      {ambiguousBase ? (
        <BankList
          label={payout.bankPickerLabel}
          selected={null}
          onSelect={(bank) => attempt(withBankSuffix(ambiguousBase, bank))}
        />
      ) : null}

      <View style={styles.actions}>
        {offerAccount ? (
          // This number can't be used, and registering it on PayShap happens in the user's
          // banking app, not here: the only way forward from us is a bank account. Editing the
          // number brings Add back.
          <Button
            label={payout.useAccountInstead}
            onPress={() =>
              router.replace({ pathname: '/payout-methods/add-account', params: next ? { next } : {} })
            }
          />
        ) : (
          <>
            <Button
              label={payout.add}
              loadingLabel={payout.checkingPayShap}
              onPress={onAdd}
              disabled={!parsed.ok}
              loading={adding}
            />
            {!parsed.ok && unmet ? (
              <Text style={styles.unmet} accessibilityLiveRegion="polite">
                {unmet}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.sm },
  title: { ...type.headline, color: colors.ink },
  body: { ...type.body, color: colors.inkMuted },
  actions: { gap: spacing.md },
  unmet: { ...type.label, color: colors.inkMuted, textAlign: 'center' },
  foundTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  foundCard: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: borderWidth.thick,
    borderColor: colors.success,
    backgroundColor: colors.successTint,
  },
  foundKind: { ...type.label, color: colors.inkMuted },
  foundName: { ...type.headline, color: colors.ink },
});
