import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';

import { api } from '../src/api/client';
import { isApiError } from '../src/api/errors';
import { BankList } from '../src/components/BankList';
import { Button } from '../src/components/Button';
import { InlineError } from '../src/components/InlineError';
import { Screen } from '../src/components/Screen';
import { TextField } from '../src/components/TextField';
import { setup } from '../src/copy';
import type { BankId } from '../src/domain/banks';
import { bankName } from '../src/domain/banks';
import { displayShapId, parseShapId, withBankSuffix } from '../src/domain/shapId';
import { describeError } from '../src/errorMessage';
import { tickHaptic } from '../src/haptics';
import { loadDestination, saveDestination } from '../src/storage/destination';
import { colors, spacing, type } from '../src/theme';

/** What is being confirmed after a successful resolveShapId, before the user says Yes or No. */
interface Resolved {
  shapId: string;
  shapName: string;
  bankId: BankId;
}

/**
 * First run, and "Change details" (?mode=change&returnTo=deposit|confirm). One field: the
 * cellphone number is looked up on PayShap and the user confirms the name that comes back
 * before anything is saved — never the other way around.
 */
export default function SetupScreen() {
  const params = useLocalSearchParams<{ mode?: string; returnTo?: string }>();
  const isChange = params.mode === 'change';
  const returnTo = params.returnTo === 'confirm' ? '/confirm' : '/deposit';

  const [ready, setReady] = useState(!isChange);
  const [rawInput, setRawInput] = useState('');
  const [touched, setTouched] = useState(false);

  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  // The unqualified number a shapid_ambiguous came back for, so a bank choice can be attached to
  // the number the user actually typed rather than to whatever is in the field by then.
  const [ambiguousBase, setAmbiguousBase] = useState<string | null>(null);
  const resolvingRef = useRef(false);

  const [confirming, setConfirming] = useState<Resolved | null>(null);
  const confirmingRef = useRef<Resolved | null>(null);
  confirmingRef.current = confirming;
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const savingRef = useRef(false);

  // Change mode starts from what is saved. A destination of the dormant 'account' kind cannot
  // be prefilled into this field; the form is simply left blank rather than shown wrong.
  useEffect(() => {
    if (!isChange) return;
    let cancelled = false;
    loadDestination().then((saved) => {
      if (cancelled) return;
      if (saved?.kind === 'shapId') setRawInput(displayShapId(saved.shapId));
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isChange]);

  // Back on the confirmation panel is a choice, not a dismissal: it behaves as "No". Reads the
  // ref rather than `confirming` so the listener is registered once, not re-subscribed on every
  // state change.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!confirmingRef.current) return false;
      setConfirming(null);
      return true;
    });
    return () => subscription.remove();
  }, []);

  const parsed = parseShapId(rawInput);
  const valid = parsed.ok;
  const fieldError = touched && !parsed.ok ? setup.parseError[parsed.reason] : resolveError;
  const unmet = !valid && !parsed.ok ? setup.unmet[parsed.reason] : null;

  function leave() {
    if (!isChange) {
      router.replace('/deposit');
    } else if (router.canGoBack()) {
      router.back(); // the screen underneath refreshes its details when it regains focus
    } else {
      router.replace(returnTo);
    }
  }

  async function attemptResolve(shapId: string) {
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    setResolving(true);
    setResolveError(null);
    try {
      const resolved = await api.resolveShapId(shapId);
      setConfirming({ shapId, shapName: resolved.shapName, bankId: resolved.bankId });
      setAmbiguousBase(null);
    } catch (caught) {
      setResolveError(describeError(caught, { moneyMayHaveMoved: false }));
      // A genuine recovery path, not a dead end: remember the number so a bank choice attaches
      // to it, and reveal the picker.
      setAmbiguousBase(
        isApiError(caught) && caught.kind === 'business' && caught.reason === 'shapid_ambiguous'
          ? shapId
          : null,
      );
    } finally {
      resolvingRef.current = false;
      setResolving(false);
    }
  }

  function onContinue() {
    if (!parsed.ok || resolvingRef.current) return;
    attemptResolve(parsed.shapId);
  }

  function onConfirmNo() {
    // Returns to the form with the number still in the field, ready to edit.
    setConfirming(null);
  }

  async function onConfirmYes() {
    if (!confirming || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveFailed(false);
    try {
      await saveDestination(
        { kind: 'shapId', shapId: confirming.shapId, shapName: confirming.shapName, bankId: confirming.bankId },
        Date.now(),
      );
      tickHaptic();
      leave();
    } catch {
      savingRef.current = false;
      setSaving(false);
      setSaveFailed(true);
    }
  }

  function onCancel() {
    if (router.canGoBack()) router.back();
    else router.replace(returnTo);
  }

  if (!ready) return <View style={styles.blank} />;

  if (confirming) {
    return (
      <Screen>
        <Text accessibilityRole="header" style={styles.title}>
          {setup.confirmTitle}
        </Text>
        <View style={styles.confirmBlock}>
          <Text style={styles.confirmName}>{confirming.shapName}</Text>
          <Text style={styles.confirmBank}>{bankName(confirming.bankId)}</Text>
        </View>
        <View style={styles.actions}>
          <Button
            label={setup.confirmYes}
            loadingLabel={setup.saving}
            onPress={onConfirmYes}
            loading={saving}
          />
          <Button variant="secondary" label={setup.confirmNo} onPress={onConfirmNo} disabled={saving} />
        </View>
        {saveFailed ? <InlineError message={setup.saveFailed} /> : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        {isChange ? setup.titleChange : setup.titleFirstRun}
      </Text>
      <Text style={styles.body}>{setup.helper}</Text>

      <TextField
        label={setup.numberLabel}
        value={rawInput}
        onChangeText={(text) => {
          setRawInput(text);
          setResolveError(null);
          setAmbiguousBase(null);
        }}
        error={fieldError}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        autoCorrect={false}
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={onContinue}
        onBlur={() => setTouched(true)}
      />

      {ambiguousBase ? (
        <BankList
          label={setup.bankPickerLabel}
          selected={null}
          onSelect={(bank) => attemptResolve(withBankSuffix(ambiguousBase, bank))}
        />
      ) : null}

      <View style={styles.actions}>
        <Button
          label={setup.continue}
          loadingLabel={setup.checking}
          onPress={onContinue}
          disabled={!valid}
          loading={resolving}
        />
        {!valid && unmet ? (
          <Text style={styles.unmet} accessibilityLiveRegion="polite">
            {unmet}
          </Text>
        ) : null}
        {isChange ? <Button variant="secondary" label={setup.cancel} onPress={onCancel} /> : null}
      </View>

      <Text style={styles.note}>{setup.privacyNote}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.paper },
  title: { ...type.headline, color: colors.ink },
  body: { ...type.body, color: colors.inkMuted },
  actions: { gap: spacing.md },
  unmet: { ...type.label, color: colors.inkMuted, textAlign: 'center' },
  note: { ...type.body, color: colors.inkMuted },
  confirmBlock: { gap: spacing.xs },
  confirmName: { ...type.title, color: colors.ink },
  confirmBank: { ...type.body, color: colors.inkMuted },
});
