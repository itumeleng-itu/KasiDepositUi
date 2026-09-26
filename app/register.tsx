import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../src/components/Button';
import { Screen } from '../src/components/Screen';
import { TextField } from '../src/components/TextField';
import { register, setup } from '../src/copy';
import { normaliseName, validateFullNames } from '../src/domain/name';
import { parseSaId, SA_ID_LENGTH } from '../src/domain/saId';
import { parseShapId } from '../src/domain/shapId';
import { currentRegistration, startRegistration } from '../src/registrationSession';
import { colors, spacing, type } from '../src/theme';

type Field = 'fullNames' | 'idNumber' | 'number';

/**
 * First run: who the user is and where their money goes. Nothing is sent from here. Continue
 * hands the details (in memory) to the setup screen, which looks the PayShap number up and asks
 * "Is this you?" before registering — the same check a returning user gets when they change
 * their number.
 */
export default function RegisterScreen() {
  // Coming back from "Change my details" keeps what was typed.
  const [initial] = useState(currentRegistration);
  const [fullNames, setFullNames] = useState(initial?.fullNames ?? '');
  const [idNumber, setIdNumber] = useState(initial?.idNumber ?? '');
  const [number, setNumber] = useState(initial ? initial.shapId.replace(/^\+27/, '0') : '');
  const [touched, setTouched] = useState<Record<Field, boolean>>({
    fullNames: false,
    idNumber: false,
    number: false,
  });
  const idRef = useRef<TextInput>(null);
  const numberRef = useRef<TextInput>(null);

  const namesError = validateFullNames(fullNames);
  const id = parseSaId(idNumber);
  const shapId = parseShapId(number);
  const valid = namesError === null && id.ok && shapId.ok;

  const touch = (field: Field) => setTouched((t) => ({ ...t, [field]: true }));

  function onContinue() {
    // Anything still wrong is shown now, even in fields the user skipped.
    setTouched({ fullNames: true, idNumber: true, number: true });
    if (!valid || !id.ok || !shapId.ok) return;
    Keyboard.dismiss();
    startRegistration({ fullNames: normaliseName(fullNames), idNumber: id.idNumber, shapId: shapId.shapId });
    router.push({ pathname: '/setup', params: { mode: 'register' } });
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
        onChangeText={setFullNames}
        error={touched.fullNames && namesError ? register.fullNamesError[namesError] : null}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        autoCorrect={false}
        maxLength={120}
        returnKeyType="next"
        onSubmitEditing={() => idRef.current?.focus()}
        onBlur={() => touch('fullNames')}
      />

      <TextField
        inputRef={idRef}
        label={register.idNumberLabel}
        helper={register.idNumberHelper}
        value={idNumber}
        onChangeText={setIdNumber}
        error={touched.idNumber && !id.ok ? register.idNumberError[id.reason] : null}
        keyboardType="number-pad"
        autoComplete="off"
        autoCorrect={false}
        // Room for the spaces a paste may carry; they are stripped before checking.
        maxLength={SA_ID_LENGTH + 6}
        returnKeyType="next"
        onSubmitEditing={() => numberRef.current?.focus()}
        onBlur={() => touch('idNumber')}
      />

      <TextField
        inputRef={numberRef}
        label={register.numberLabel}
        helper={register.numberHelper}
        value={number}
        onChangeText={setNumber}
        error={touched.number && !shapId.ok ? setup.parseError[shapId.reason] : null}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        autoCorrect={false}
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={onContinue}
        onBlur={() => touch('number')}
      />

      <View style={styles.actions}>
        <Button label={register.continue} onPress={onContinue} disabled={!valid} />
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
