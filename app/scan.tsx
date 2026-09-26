import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../src/components/Button';
import { InlineError } from '../src/components/InlineError';
import { Screen } from '../src/components/Screen';
import { deposit, scan } from '../src/copy';
import { parseVoucherQr } from '../src/domain/voucherQr';
import { attemptVoucherLookup } from '../src/voucherLookup';
import { colors, radius, spacing, type } from '../src/theme';

/**
 * Opened from the PIN screen's "Scan voucher QR" button. A scan never sends money by itself:
 * a valid one does exactly what typing a PIN and tapping Continue does — look it up, then show
 * confirm — via the same attemptVoucherLookup() the manual path uses (app/deposit.tsx). Android
 * back needs no special handling: the PIN screen is already this screen's stack parent.
 */
export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  // Guards onBarcodeScanned, which fires many times a second: acts on the first valid scan
  // only. Stays true for the whole lookup, so backgrounding mid-scan cannot fire a second one —
  // the same pattern as the ref guards on Send and the other one-shot async actions.
  const handledRef = useRef(false);
  const askedRef = useRef(false);
  const insets = useSafeAreaInsets();

  // Ask on first open, exactly once, however many times this effect itself re-runs.
  useEffect(() => {
    if (permission?.status === 'undetermined' && !askedRef.current) {
      askedRef.current = true;
      requestPermission();
    }
  }, [permission, requestPermission]);

  function onBarcodeScanned({ data }: { data: string }) {
    if (handledRef.current) return;
    const parsed = parseVoucherQr(data);
    if (!parsed.ok) {
      // A fixed string set repeatedly is not a re-render storm: React skips identical state.
      setMessage(scan.invalidQr);
      return;
    }
    handledRef.current = true;
    setMessage(null);
    setChecking(true);
    AccessibilityInfo.announceForAccessibility(scan.voucherFoundAnnouncement);
    attemptVoucherLookup(parsed.pin).then((result) => {
      if (result.ok) {
        router.replace('/confirm');
        return;
      }
      if (result.mustRegister) {
        if (router.canDismiss()) router.dismissAll();
        router.replace('/register');
        return;
      }
      // Same failure, same message as a typed PIN; the camera resumes so a different voucher
      // can be tried without leaving this screen.
      setMessage(result.message);
      setChecking(false);
      handledRef.current = false;
    });
  }

  if (!permission || permission.status === 'undetermined') {
    return <View style={styles.blank} />;
  }

  if (!permission.granted) {
    return (
      <Screen>
        <Text accessibilityRole="header" style={styles.deniedTitle}>
          {scan.permission.deniedTitle}
        </Text>
        <Text style={styles.deniedBody}>
          {permission.canAskAgain ? scan.permission.deniedBody : scan.permission.permanentlyDeniedBody}
        </Text>
        <View style={styles.actions}>
          {permission.canAskAgain ? (
            <Button label={scan.permission.tryAgain} onPress={() => requestPermission()} />
          ) : (
            <Button label={scan.permission.openSettings} onPress={() => Linking.openSettings()} />
          )}
          <Button variant="text" label={scan.typePinInstead} onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView
        style={styles.fill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={onBarcodeScanned}
      />
      {/* A bottom sheet in the app's own dark paper, so the normal text and Button styling
          apply unchanged. */}
      <View style={[styles.panel, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.instruction}>{scan.instruction}</Text>
        {checking ? (
          <Text style={styles.checking} accessibilityLiveRegion="polite">
            {deposit.checking}
          </Text>
        ) : message ? (
          <InlineError message={message} />
        ) : null}
        <Button
          variant="text"
          label={scan.typePinInstead}
          onPress={() => router.back()}
          disabled={checking}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.paper },
  fill: { flex: 1 },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  instruction: { ...type.body, color: colors.ink, textAlign: 'center' },
  checking: { ...type.label, color: colors.inkMuted, textAlign: 'center' },
  deniedTitle: { ...type.headline, color: colors.ink },
  deniedBody: { ...type.body, color: colors.inkMuted },
  actions: { gap: spacing.md },
});
