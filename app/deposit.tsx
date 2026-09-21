import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { DestinationLine } from '../src/components/DestinationLine';
import { Screen } from '../src/components/Screen';
import { loadBeneficiary } from '../src/storage/beneficiary';
import type { StoredBeneficiary } from '../src/storage/beneficiaryRecord';

// PIN entry arrives in phase 4. For now this shows where money will go, so the setup screen and
// "Change" can be tried end to end.
export default function DepositScreen() {
  const [beneficiary, setBeneficiary] = useState<StoredBeneficiary | null>(null);

  // Runs again when we come back from "Change", so the line always shows what is saved.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadBeneficiary().then((saved) => {
        if (cancelled) return;
        if (saved) setBeneficiary(saved);
        else router.replace('/setup');
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <Screen>
      {beneficiary ? (
        <DestinationLine
          beneficiary={beneficiary}
          onChange={() =>
            router.push({ pathname: '/setup', params: { mode: 'change', returnTo: 'deposit' } })
          }
        />
      ) : null}
    </Screen>
  );
}
