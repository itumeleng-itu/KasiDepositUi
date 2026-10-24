import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps, type TextStyle } from 'react-native';

import { borderWidth, colors, radius, size, spacing, type } from '../theme';
import { InlineError } from './InlineError';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Shown under the field with an icon, so the state is not colour alone. */
  error?: string | null;
  helper?: string;
  // ComponentRef, not Ref<TextInput>: from React Native 0.88 the exported
  // TextInput is the component, whose instance type is separate. Ref<TextInput>
  // now means "a ref to the component function", which is not what a caller holds.
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
  /** Overrides for the input text, e.g. the larger PIN style. */
  inputStyle?: TextStyle;
  /** Keep the label for screen readers but do not draw it (the screen's heading already says it). */
  hideLabel?: boolean;
  /** Optional control rendered inside the input border, e.g. a password visibility toggle. */
  rightAccessory?: ReactNode;
}

export function TextField({
  label,
  error,
  helper,
  inputRef,
  inputStyle,
  hideLabel = false,
  rightAccessory,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const input = (
    <TextInput
      ref={inputRef}
      accessibilityLabel={label}
      accessibilityHint={error ?? helper}
      placeholderTextColor={colors.inkMuted}
      {...inputProps}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        styles.input,
        rightAccessory ? styles.inputWithAccessory : null,
        !rightAccessory && error ? styles.inputError : !rightAccessory && focused ? styles.inputFocused : null,
        inputStyle,
      ]}
    />
  );

  return (
    <View style={styles.field}>
      {hideLabel ? null : <Text style={styles.label}>{label}</Text>}
      {rightAccessory ? (
        <View
          style={[
            styles.inputRow,
            error ? styles.inputError : focused ? styles.inputFocused : null,
          ]}
        >
          {input}
          {rightAccessory}
        </View>
      ) : input}
      {error ? <InlineError message={error} /> : helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { ...type.label, color: colors.ink },
  input: {
    ...type.body,
    minHeight: size.button,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    borderWidth: borderWidth.thin,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  inputRow: {
    minHeight: size.button,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    borderRadius: radius.control,
    borderWidth: borderWidth.thin,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  inputWithAccessory: {
    flex: 1,
    minHeight: size.button - borderWidth.thin * 2,
    paddingHorizontal: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  // The focus ring has to be visible against paper, so it is the accent.
  inputFocused: { borderWidth: borderWidth.thick, borderColor: colors.accent },
  inputError: { borderWidth: borderWidth.thick, borderColor: colors.error },
  helper: { ...type.caption, color: colors.inkMuted },
});
