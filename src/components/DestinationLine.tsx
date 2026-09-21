import { StyleSheet, Text, View } from 'react-native';

import { deposit } from '../copy';
import { lastFour, maskAccountNumber } from '../domain/account';
import { bankName } from '../domain/banks';
import type { Beneficiary } from '../api/types';
import { colors, spacing, type } from '../theme';
import { Button } from './Button';

interface DestinationLineProps {
  beneficiary: Beneficiary;
  onChange: () => void;
}

/** "Paying into ••••4417 · Capitec" with a Change button. Never shows the full account number. */
export function DestinationLine({ beneficiary, onChange }: DestinationLineProps) {
  const bank = bankName(beneficiary.bankId);
  return (
    <View style={styles.row}>
      <Text
        style={styles.text}
        accessibilityLabel={deposit.payingIntoLabel(lastFour(beneficiary.accountNumber), bank)}
      >
        {deposit.payingInto(maskAccountNumber(beneficiary.accountNumber), bank)}
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
