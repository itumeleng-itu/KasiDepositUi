import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type TextInput } from 'react-native';

import { BankList } from '../src/components/BankList';
import { Button } from '../src/components/Button';
import { DigitsField } from '../src/components/DigitsField';
import { InlineError } from '../src/components/InlineError';
import { Screen } from '../src/components/Screen';
import { TextField } from '../src/components/TextField';
import { setup } from '../src/copy';
import { ACCOUNT_GROUPING, validateAccountNumber } from '../src/domain/account';
import type { BankId } from '../src/domain/banks';
import { normaliseName, validateName } from '../src/domain/name';
import { tickHaptic } from '../src/haptics';
import { loadBeneficiary, saveBeneficiary } from '../src/storage/beneficiary';
import { colors, spacing, type } from '../src/theme';

type Field = 'name' | 'bank' | 'account' | 'confirm';

/**
 * First run, and "Change details" (?mode=change&returnTo=deposit|confirm).
 * Errors appear only for fields the user has already left, never on an untouched form.
 */
export default function SetupScreen() {
  const params = useLocalSearchParams<{ mode?: string; returnTo?: string }>();
  const isChange = params.mode === 'change';
  const returnTo = params.returnTo === 'confirm' ? '/confirm' : '/deposit';

  const [ready, setReady] = useState(!isChange);
  const [name, setName] = useState('');
  const [bankId, setBankId] = useState<BankId | null>(null);
  const [account, setAccount] = useState('');
  const [confirmAccount, setConfirmAccount] = useState('');
  const [touched, setTouched] = useState<Record<Field, boolean>>({
    name: false,
    bank: false,
    account: false,
    confirm: false,
  });
  const [accountTooLong, setAccountTooLong] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const savingRef = useRef(false);

  const accountRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // Change mode starts from what is saved.
  useEffect(() => {
    if (!isChange) return;
    let cancelled = false;
    loadBeneficiary().then((saved) => {
      if (cancelled) return;
      if (saved) {
        setName(saved.name);
        setBankId(saved.bankId);
        setAccount(saved.accountNumber);
        setConfirmAccount(saved.accountNumber);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isChange]);

  const touch = (field: Field) => setTouched((prev) => ({ ...prev, [field]: true }));

  const nameError = validateName(name);
  const accountError = validateAccountNumber(account);
  const confirmError =
    confirmAccount.length === 0 ? 'required' : confirmAccount !== account ? 'mismatch' : null;

  const valid = nameError === null && bankId !== null && accountError === null && confirmError === null;

  const unmet =
    nameError !== null
      ? setup.unmet.name
      : bankId === null
        ? setup.unmet.bank
        : accountError !== null
          ? setup.unmet.account
          : confirmError !== null
            ? setup.unmet.confirm
            : null;

  const nameMessage = touched.name && nameError ? setup.nameError[nameError] : null;
  const bankMessage = touched.bank && bankId === null ? setup.bankError : null;
  const accountMessage = accountTooLong
    ? setup.accountError.too_long
    : touched.account && accountError
      ? setup.accountError[accountError]
      : null;
  const confirmMessage = !touched.confirm
    ? null
    : confirmError === 'required'
      ? setup.confirmRequired
      : confirmError === 'mismatch'
        ? setup.confirmMismatch
        : null;

  function leave() {
    if (!isChange) {
      router.replace('/deposit');
    } else if (router.canGoBack()) {
      router.back(); // the screen underneath refreshes its details when it regains focus
    } else {
      router.replace(returnTo);
    }
  }

  async function onSave() {
    if (!valid || bankId === null || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveFailed(false);
    try {
      await saveBeneficiary({ name: normaliseName(name), accountNumber: account, bankId });
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

  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        {isChange ? setup.titleChange : setup.titleFirstRun}
      </Text>
      <Text style={styles.body}>{setup.intro}</Text>

      <TextField
        label={setup.nameLabel}
        value={name}
        onChangeText={setName}
        error={nameMessage}
        textContentType="name"
        autoCapitalize="words"
        autoComplete="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => accountRef.current?.focus()}
        onBlur={() => {
          setName(normaliseName(name));
          touch('name');
        }}
      />

      <BankList
        label={setup.bankLabel}
        selected={bankId}
        onSelect={(id) => {
          setBankId(id);
          touch('bank');
        }}
        error={bankMessage}
      />

      <DigitsField
        label={setup.accountLabel}
        inputRef={accountRef}
        digits={account}
        grouping={ACCOUNT_GROUPING}
        onChangeDigits={(digits) => {
          setAccount(digits);
          setAccountTooLong(false);
        }}
        onPasteRejected={() => setAccountTooLong(true)}
        error={accountMessage}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => confirmRef.current?.focus()}
        onFocus={() => touch('bank')}
        onBlur={() => touch('account')}
      />

      <DigitsField
        label={setup.confirmAccountLabel}
        inputRef={confirmRef}
        digits={confirmAccount}
        grouping={ACCOUNT_GROUPING}
        onChangeDigits={setConfirmAccount}
        error={confirmMessage}
        returnKeyType="done"
        onBlur={() => touch('confirm')}
      />

      <View style={styles.actions}>
        <Button
          label={setup.save}
          loadingLabel={setup.saving}
          onPress={onSave}
          disabled={!valid}
          loading={saving}
        />
        {!valid && unmet ? (
          <Text style={styles.unmet} accessibilityLiveRegion="polite">
            {unmet}
          </Text>
        ) : null}
        {saveFailed ? <InlineError message={setup.saveFailed} /> : null}
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
});
