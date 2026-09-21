import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { borderWidth, colors, opacity, radius, size, spacing, type } from '../theme';

type Variant = 'primary' | 'secondary' | 'text';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  /** Shows a spinner on the button itself and ignores further taps. */
  loading?: boolean;
  /** Text shown while loading, e.g. "Saving". Falls back to `label`. */
  loadingLabel?: string;
  /** Text buttons only: sit at the start of the row (Back) rather than centred. */
  align?: 'start' | 'center';
  /** Read by screen readers instead of `label`, e.g. "Send 495 rand". */
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  loadingLabel,
  align = 'center',
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const inactive = disabled || loading;
  const shownLabel = loading && loadingLabel ? loadingLabel : label;
  const textColor = labelColor(variant, disabled);

  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? shownLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variant === 'text' ? styles.textVariant : styles.filled,
        variant === 'text' && align === 'start' && styles.alignStart,
        variant === 'primary' && (disabled ? styles.primaryDisabled : styles.primary),
        variant === 'secondary' && (disabled ? styles.secondaryDisabled : styles.secondary),
        pressed && !inactive && styles.pressed,
      ]}
    >
      <View style={styles.content}>
        {loading && <ActivityIndicator color={textColor} />}
        <Text style={[styles.label, { color: textColor }]}>{shownLabel}</Text>
      </View>
    </Pressable>
  );
}

function labelColor(variant: Variant, disabled: boolean): string {
  if (variant === 'primary') return disabled ? colors.onDisabled : colors.onPrimary;
  return disabled ? colors.inkMuted : colors.primary;
}

const styles = StyleSheet.create({
  base: {
    minHeight: size.touch,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  // Full width and 56 tall: primary and secondary buttons.
  filled: {
    minHeight: size.button,
    alignSelf: 'stretch',
    borderRadius: radius.control,
  },
  textVariant: { alignSelf: 'center' },
  alignStart: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  primary: { backgroundColor: colors.primary },
  primaryDisabled: { backgroundColor: colors.disabled },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thick,
    borderColor: colors.primary,
  },
  secondaryDisabled: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thick,
    borderColor: colors.line,
  },
  pressed: { opacity: opacity.pressed },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  label: { ...type.body, fontWeight: '700', textAlign: 'center' },
});
