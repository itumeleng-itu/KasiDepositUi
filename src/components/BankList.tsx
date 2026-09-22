import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BANKS, type BankId } from '../domain/banks';
import { borderWidth, colors, fontFamily, radius, size, spacing, type } from '../theme';
import { Icon } from './Icon';
import { InlineError } from './InlineError';

interface BankListProps {
  label: string;
  selected: BankId | null;
  onSelect: (id: BankId) => void;
  error?: string | null;
}

/**
 * All banks as full-width rows, not a native dropdown (too small and fiddly on cheap phones).
 * Selected is a thick border, a tint and a check icon, never colour alone.
 */
export function BankList({ label, selected, onSelect, error }: BankListProps) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={styles.label}>{label}</Text>
      {BANKS.map((bank) => {
        const isSelected = bank.id === selected;
        return (
          <Pressable
            key={bank.id}
            onPress={() => onSelect(bank.id)}
            accessibilityRole="radio"
            accessibilityLabel={bank.name}
            accessibilityState={{ checked: isSelected, selected: isSelected }}
            style={({ pressed }) => [
              styles.row,
              isSelected ? styles.rowSelected : styles.rowIdle,
              pressed && styles.rowPressed,
            ]}
          >
            <Text style={[styles.name, isSelected && styles.nameSelected]}>{bank.name}</Text>
            {isSelected && <Icon name="check" color={colors.primary} />}
          </Pressable>
        );
      })}
      {error ? <InlineError message={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  label: { ...type.label, color: colors.ink },
  row: {
    minHeight: size.bankRow,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
  },
  rowIdle: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.line,
  },
  rowSelected: {
    backgroundColor: colors.primaryTint,
    borderWidth: borderWidth.thick,
    borderColor: colors.primary,
  },
  rowPressed: { backgroundColor: colors.primaryTint },
  name: { ...type.body, flex: 1, color: colors.ink },
  nameSelected: { fontFamily: fontFamily.bold, color: colors.primary },
});
