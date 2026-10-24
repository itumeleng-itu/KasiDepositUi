import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { colors, size as sizes } from '../theme';

/**
 * One icon.
 *
 * These were drawn from plain Views so that no icon font was needed. That
 * held while there were three of them and they were all strokes; it does
 * not hold for a bank, a phone or a camera, and hand-drawn glyphs next to
 * real typography are what make an app look unfinished. Material Icons
 * ships with Expo, is already pinned by the SDK, and is one font file.
 *
 * `name` stays our own vocabulary rather than the font's, so the screens
 * read in our terms and a change of icon set is one map, not a sweep.
 * The three original names still work.
 */
export type IconName =
  | 'check'
  | 'cross'
  | 'alert'
  | 'back'
  | 'forward'
  | 'camera'
  | 'bank'
  | 'phone'
  | 'clock'
  | 'shield'
  | 'receipt'
  | 'add'
  | 'info'
  | 'eye'
  | 'eyeOff';

const GLYPH: Record<IconName, React.ComponentProps<typeof MaterialIcons>['name']> = {
  check: 'check',
  cross: 'close',
  alert: 'error-outline',
  back: 'arrow-back',
  forward: 'chevron-right',
  camera: 'photo-camera',
  bank: 'account-balance',
  phone: 'smartphone',
  clock: 'schedule',
  shield: 'lock-outline',
  receipt: 'receipt-long',
  add: 'add',
  info: 'info-outline',
  eye: 'visibility',
  eyeOff: 'visibility-off',
};

interface IconProps {
  name: IconName;
  color?: string;
  size?: number;
}

/**
 * Decorative by default: the text beside an icon carries the meaning, so
 * screen readers skip it rather than announcing it twice.
 */
export function Icon({ name, color = colors.ink, size = sizes.icon }: IconProps) {
  return (
    <MaterialIcons
      name={GLYPH[name]}
      size={size}
      color={color}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    />
  );
}
