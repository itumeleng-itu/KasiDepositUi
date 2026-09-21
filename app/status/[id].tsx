import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { api } from '../../src/api/client';
import type { Deposit } from '../../src/api/types';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { statusCopy, status as statusText } from '../../src/copy';
import { maskAccountNumber } from '../../src/domain/account';
import { bankName } from '../../src/domain/banks';
import { clearActiveDeposit, loadActiveDeposit } from '../../src/storage/activeDeposit';
import { colors, spacing, type } from '../../src/theme';

// TEMPORARY stand-in until phase 5 (polling, progress steps, every state). It shows the current
// status once, and gives a way out so a saved deposit cannot trap the launcher on this screen.
export default function StatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [where, setWhere] = useState<{ bank: string; masked: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getDepositStatus(id), loadActiveDeposit()])
      .then(([found, active]) => {
        if (cancelled) return;
        setDeposit(found);
        if (active) {
          setWhere({ bank: bankName(active.bankId), masked: maskAccountNumber(active.accountLast4) });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  const copy = deposit
    ? statusCopy(deposit.status, {
        payoutCents: deposit.payoutCents,
        bankName: where?.bank ?? '',
        maskedAccount: where?.masked ?? '',
        failureReason: deposit.failureReason,
      })
    : null;

  async function makeAnother() {
    await clearActiveDeposit();
    router.replace('/deposit');
  }

  return (
    <Screen>
      {copy && deposit ? (
        <>
          <Text accessibilityRole="header" style={styles.title}>
            {copy.headline}
          </Text>
          <Text style={styles.body}>{copy.support}</Text>
          <Text style={styles.body}>{statusText.reference(deposit.reference)}</Text>
        </>
      ) : null}
      <Button label={statusText.makeAnother} onPress={makeAnother} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.headline, color: colors.ink },
  body: { ...type.body, color: colors.inkMuted, marginBottom: spacing.sm },
});
