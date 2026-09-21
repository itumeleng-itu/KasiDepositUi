import { StyleSheet, Text, View } from 'react-native';

import { colors, size, spacing, type } from '../theme';
import { Icon } from './Icon';

/** An error line: an icon and words, so it never relies on red alone. Announced when it appears. */
export function InlineError({ message }: { message: string }) {
  return (
    <View style={styles.row} accessibilityLiveRegion="polite">
      <Icon name="alert" color={colors.error} size={size.iconSmall} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  text: { ...type.label, flex: 1, color: colors.error },
});
