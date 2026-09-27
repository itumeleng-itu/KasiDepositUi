import { Pressable, StyleSheet, Text, View } from 'react-native';

import { borderWidth, colors, opacity, size, spacing, type } from '../theme';
import { Icon } from './Icon';

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/**
 * A box and its sentence, tappable as one (the whole row is the target, at least 48 dp tall).
 * Ticked is a filled box with a tick, never colour alone, and screen readers hear it as a
 * checkbox that is checked or not.
 */
export function Checkbox({ label, checked, onChange, disabled = false }: CheckboxProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : () => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && !disabled && styles.pressed]}
    >
      <View style={[styles.box, checked ? styles.boxChecked : styles.boxIdle]}>
        {checked ? <Icon name="check" color={colors.onPrimary} size={size.iconSmall} /> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

// A checkbox is its own small shape: square-ish, not a pill like the chips.
const BOX = 24;
const BOX_RADIUS = 6;

const styles = StyleSheet.create({
  row: {
    minHeight: size.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: opacity.pressed },
  box: {
    width: BOX,
    height: BOX,
    borderRadius: BOX_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxIdle: { borderWidth: borderWidth.thick, borderColor: colors.line },
  boxChecked: { backgroundColor: colors.primary, borderWidth: borderWidth.thick, borderColor: colors.primary },
  label: { ...type.body, flex: 1, color: colors.ink },
});
