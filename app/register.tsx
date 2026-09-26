import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';

import { api } from '../src/api/client';
import { Button } from '../src/components/Button';
import { InlineError } from '../src/components/InlineError';
import { Screen } from '../src/components/Screen';
import { TextField } from '../src/components/TextField';
import { register } from '../src/copy';
import { normaliseName, validateFullNames } from '../src/domain/name';
import { parseSaId, SA_ID_LENGTH } from '../src/domain/saId';
import { describeError } from '../src/errorMessage';
import { tickHaptic } from '../src/haptics';
import { clearPayoutMethods } from '../src/storage/payoutMethods';
import { saveUser } from '../src/storage/user';
import { colors, spacing, type } from '../src/theme';

type Field = 'fullNames' | 'idNumber';

/**
 * First run: who the user is. Only names and the SA ID number — where they are paid comes next,
 * on its own screen, where they choose PayShap or a bank account. The ID number lives in this
 * screen's state until it is sent, once, and is never stored on the phone.
 */
export default function RegisterScreen() {
  const [fullNames, setFullNames] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [touched, setTouched] = useState<Record<Field, boolean>>({ fullNames: false, idNumber: false });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const idRef = useRef<TextInput>(null);

  const namesError = validateFullNames(fullNames);
  const id = parseSaId(idNumber);
  const valid = namesError === null && id.ok;

  const touch = (field: Field) => setTouched((t) => ({ ...t, [field]: true }));

  async function onContinue() {
    // Anything still wrong is shown now, even in a field the user skipped.
    setTouched({ fullNames: true, idNumber: true });
    if (!valid || !id.ok || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    Keyboard.dismiss();
    try {
      const user = await api.registerUser({ fullNames: normaliseName(fullNames), idNumber: id.idNumber });
      // A different person may have used this phone before: never show them the last one's accounts.
      await clearPayoutMethods();
      await saveUser({ ...user, registeredAt: Date.now() });
      tickHaptic();
      // Nothing to come back to: this screen held the ID number and must not stay mounted.
      if (router.canDismiss()) router.dismissAll();
      router.replace({ pathname: '/payout-methods/add', params: { next: 'deposit' } });
    } catch (caught) {
      setError(describeError(caught, { moneyMayHaveMoved: false }));
      sendingRef.current = false;
      setSending(false);
    }
  }

  return (
    <Screen>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {register.title}
        </Text>
        <Text style={styles.body}>{register.helper}</Text>
      </View>

      <TextField
        label={register.fullNamesLabel}
        helper={register.fullNamesHelper}
        value={fullNames}
        onChangeText={(text) => {
          setFullNames(text);
          setError(null);
        }}
        error={touched.fullNames && namesError ? register.fullNamesError[namesError] : null}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        autoCorrect={false}
        maxLength={120}
        returnKeyType="next"
        onSubmitEditing={() => idRef.current?.focus()}
        onBlur={() => touch('fullNames')}
        editable={!sending}
      />

      <TextField
        inputRef={idRef}
        label={register.idNumberLabel}
        helper={register.idNumberHelper}
        value={idNumber}
        onChangeText={(text) => {
          setIdNumber(text);
          setError(null);
        }}
        error={touched.idNumber && !id.ok ? register.idNumberError[id.reason] : null}
        keyboardType="number-pad"
        autoComplete="off"
        autoCorrect={false}
        // Room for the spaces a paste may carry; they are stripped before checking.
        maxLength={SA_ID_LENGTH + 6}
        returnKeyType="done"
        onSubmitEditing={onContinue}
        onBlur={() => touch('idNumber')}
        editable={!sending}
      />

      {error ? <InlineError message={error} /> : null}

      <View style={styles.actions}>
        <Button
          label={register.continue}
          loadingLabel={register.registering}
          onPress={onContinue}
          disabled={!valid}
          loading={sending}
        />
        {!valid ? (
          <Text style={styles.unmet} accessibilityLiveRegion="polite">
            {register.unmet}
          </Text>
        ) : null}
      </View>

      <Text style={styles.note}>{register.privacyNote}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.sm },
  title: { ...type.headline, color: colors.ink },
  body: { ...type.body, color: colors.inkMuted },
  actions: { gap: spacing.md },
  unmet: { ...type.label, color: colors.inkMuted, textAlign: 'center' },
  note: { ...type.body, color: colors.inkMuted },
});
