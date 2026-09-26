import { StyleSheet, Text, View } from 'react-native';

import { deposit } from '../copy';
import { describeDestination, type StoredDestination } from '../domain/destination';
import { colors, spacing, type } from '../theme';
import { Button } from './Button';

interface DestinationLineProps {
  destination: StoredDestination;
  onChange: () => void;
}

/**
 * "Paying into 082 123 4567 · Capitec" or "Paying into ••••4417 · Capitec", with a Change
 * button. Never shows the full account number, and never branches on which kind of destination
 * it is — describeDestination() already decided how to render either one.
 */
export function DestinationLine({ destination, onChange }: DestinationLineProps) {
  const { oneLine, spokenOneLine } = describeDestination(destination);
  return (
    <View style={styles.row}>
      <Text style={styles.text} accessibilityLabel={deposit.payingIntoLabel(spokenOneLine)}>
        {deposit.payingInto(oneLine)}
      </Text>
      <Button
        variant="text"
        label={deposit.change}
        accessibilityLabel={deposit.changeLabel}
        onPress={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  text: { ...type.label, flexShrink: 1, color: colors.inkMuted },
});
