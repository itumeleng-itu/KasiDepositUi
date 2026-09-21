import { useState, type Ref } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps, type TextStyle } from 'react-native';

import { borderWidth, colors, radius, size, spacing, type } from '../theme';
import { InlineError } from './InlineError';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Shown under the field with an icon, so the state is not colour alone. */
  error?: string | null;
  helper?: string;
  inputRef?: Ref<TextInput>;
  /** Overrides for the input text, e.g. the larger PIN style. */
  inputStyle?: TextStyle;
  /** Keep the label for screen readers but do not draw it (the screen's heading already says it). */
  hideLabel?: boolean;
}

export function TextField({
  label,
  error,
  helper,
  inputRef,
  inputStyle,
  hideLabel = false,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      {hideLabel ? null : <Text style={styles.label}>{label}</Text>}
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
          error ? styles.inputError : focused ? styles.inputFocused : null,
          inputStyle,
        ]}
      />
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
  inputFocused: { borderWidth: borderWidth.thick, borderColor: colors.primary },
  inputError: { borderWidth: borderWidth.thick, borderColor: colors.error },
  helper: { ...type.caption, color: colors.inkMuted },
});
