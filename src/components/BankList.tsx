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
  /** Which banks to show, in order. Every bank when left out. */
  bankIds?: readonly BankId[];
  /** Adds a last row for any other bank, e.g. "Other bank". */
  other?: { label: string; selected: boolean; onSelect: () => void };
}

/**
 * All banks as full-width rows, not a native dropdown (too small and fiddly on cheap phones).
 * Selected is a thick border, a tint and a check icon, never colour alone.
 */
export function BankList({ label, selected, onSelect, error, bankIds, other }: BankListProps) {
  const banks = bankIds ? BANKS.filter((bank) => bankIds.includes(bank.id)) : BANKS;
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={styles.label}>{label}</Text>
      {banks.map((bank) => (
        <BankRow
          key={bank.id}
          name={bank.name}
          selected={bank.id === selected && !other?.selected}
          onPress={() => onSelect(bank.id)}
        />
      ))}
      {other ? <BankRow name={other.label} selected={other.selected} onPress={other.onSelect} /> : null}
      {error ? <InlineError message={error} /> : null}
    </View>
  );
}

function BankRow({ name, selected, onPress }: { name: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={name}
      accessibilityState={{ checked: selected, selected }}
      style={({ pressed }) => [
        styles.row,
        selected ? styles.rowSelected : styles.rowIdle,
        pressed && styles.rowPressed,
      ]}
    >
      <Text style={[styles.name, selected && styles.nameSelected]}>{name}</Text>
      {selected && <Icon name="check" color={colors.primary} />}
    </Pressable>
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
