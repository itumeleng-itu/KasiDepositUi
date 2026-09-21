import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Small wrappers so screens never deal with platform differences or rejections. Android uses
 * the system haptic constants (Expo advises against the raw vibrator); iOS uses the taptic engine.
 * Feedback is a nicety: any failure is swallowed.
 */
function run(action: () => Promise<void>): void {
  try {
    action().catch(() => {});
  } catch {
    // A synchronous failure (module missing on an odd device) is ignored the same way.
  }
}

/** A light tick for a tap that commits something (Save, Send). */
export function tickHaptic(): void {
  run(() =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Keyboard_Tap)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  );
}

export function successHaptic(): void {
  run(() =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );
}
