import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PayoutMethod } from '../api/types';
import { payout } from '../copy';
import { describeDestination } from '../domain/destination';
import { borderWidth, colors, fontFamily, opacity, radius, size, spacing, type } from '../theme';
import { Button } from './Button';
import { Icon } from './Icon';

interface PayoutMethodCardProps {
  method: PayoutMethod;
  onSelect: () => void;
  onRemove: () => void;
  disabled?: boolean;
}

/**
 * One place the user can be paid, as a card: what kind it is, whose it is, and where. The one
 * "Paying into" uses is marked like a selected bank row — a heavy border, a tint, a tick and
 * the words — never by colour alone. Tapping the card pays into it; Remove is its own button.
 */
export function PayoutMethodCard({ method, onSelect, onRemove, disabled = false }: PayoutMethodCardProps) {
  const { primary, secondary, spokenOneLine } = describeDestination(method);
  const kind = payout.kind[method.kind];
  const selected = method.isDefault;

  return (
    <View style={[styles.card, selected ? styles.cardSelected : styles.cardIdle]}>
      <Pressable
        onPress={disabled ? undefined : onSelect}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected, selected, disabled }}
        accessibilityLabel={payout.cardLabel(kind, primary, spokenOneLine, selected)}
        accessibilityHint={selected ? undefined : payout.cardHint}
        style={({ pressed }) => [styles.main, pressed && !disabled && styles.pressed]}
      >
        <View style={styles.top}>
          <Text style={styles.kind}>{kind}</Text>
          {selected ? (
            <View style={styles.badge}>
              <Icon name="check" color={colors.primary} size={size.iconSmall} />
              <Text style={styles.badgeText}>{payout.payingInto}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.primary}>{primary}</Text>
        <Text style={styles.secondary}>{secondary}</Text>
      </Pressable>
      <View style={styles.footer}>
        <Button
          variant="text"
          label={payout.remove}
          accessibilityLabel={payout.removeLabel(spokenOneLine)}
          onPress={onRemove}
          disabled={disabled}
        />
      </View>
    </View>
  );
}

interface PayoutOptionCardProps {
  title: string;
  body: string;
  onPress: () => void;
  disabled?: boolean;
}

/** A big, plain choice: "PayShap" or "Bank account", each with one line saying what it needs. */
export function PayoutOptionCard({ title, body, onPress, disabled = false }: PayoutOptionCardProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={payout.chooseLabel(title, body)}
      style={({ pressed }) => [styles.card, styles.cardIdle, styles.option, pressed && !disabled && styles.pressed]}
    >
      <Text style={styles.primary}>{title}</Text>
      <Text style={styles.secondary}>{body}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.control },
  cardIdle: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.line,
  },
  cardSelected: {
    backgroundColor: colors.primaryTint,
    borderWidth: borderWidth.thick,
    borderColor: colors.primary,
  },
  main: { minHeight: size.touch, gap: spacing.xs, padding: spacing.lg, paddingBottom: spacing.sm },
  option: { minHeight: size.touch, gap: spacing.xs, padding: spacing.lg },
  pressed: { opacity: opacity.pressed },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  kind: { ...type.label, color: colors.inkMuted },
  badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  badgeText: { ...type.label, fontFamily: fontFamily.bold, color: colors.primary },
  primary: { ...type.title, color: colors.ink },
  secondary: { ...type.body, color: colors.inkMuted },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.sm },
});
