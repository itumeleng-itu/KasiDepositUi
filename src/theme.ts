import type { TextStyle } from 'react-native';

/**
 * Design tokens. Components use only these values: no inline magic numbers.
 *
 * Black, white and grey only. Because there is no red or green, state is carried by shape,
 * weight and words: an icon and a message for errors, a tick for done, a heavy border for
 * selected. Nothing depends on colour to be understood.
 *
 * Contrast (WCAG 2.x). Every pair the app draws is checked in theme.test.ts:
 *   ink on paper 21:1, on surface 19.3:1, on tint 17.6:1   muted ink on paper 6.7:1, on surface 6.1:1
 *   white on primary 21:1   white-on-disabled n/a: disabled text 5.5:1 on its fill
 *   field border (line) 4.5:1 on paper, 4.2:1 on surface (non-text needs 3:1)
 */
export const colors = {
  paper: '#FFFFFF',
  /** Fields, bank rows and quiet panels. */
  surface: '#F5F5F5',
  ink: '#000000',
  inkMuted: '#5C5C5C',
  primary: '#000000',
  onPrimary: '#FFFFFF',
  /** Selected row and pressed rows. */
  primaryTint: '#EBEBEB',
  /** Kept as tokens so a colour can be reintroduced in one place; today they are ink and grey. */
  success: '#000000',
  successTint: '#F5F5F5',
  error: '#000000',
  errorTint: '#F5F5F5',
  line: '#767676',
  disabled: '#E3E3E3',
  onDisabled: '#595959',
} as const;

/** 4-point scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Buttons are pills (half their height); inputs, rows and panels share one softer radius; chips
 * are tighter still.
 */
export const radius = {
  pill: 28,
  control: 16,
  chip: 6,
} as const;

export const size = {
  /** Minimum size of anything tappable. */
  touch: 48,
  /** Full-width primary buttons and bank rows. */
  button: 56,
  bankRow: 56,
  icon: 24,
  iconSmall: 18,
  stepIcon: 32,
  /** Widest a content column grows to on large screens. */
  contentMax: 480,
} as const;

export const borderWidth = {
  thin: 1,
  thick: 2,
} as const;

export const opacity = {
  pressed: 0.85,
} as const;

/** Milliseconds. Motion is minimal and skipped under reduce-motion. */
export const motion = {
  short: 150,
} as const;

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

/**
 * Type scale. Every style uses tabular figures so digits line up. Headings are heavier and set
 * slightly tight (about -0.02em, in points) for a confident, quiet look; body text is left alone
 * for legibility. `pin` is not in the base scale: the PIN must be at least 24 and is not
 * tracked, so that 16 digits still fit a 320 dp screen.
 */
export const type = {
  caption: { fontSize: 13, lineHeight: 18, fontVariant: tabular },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '500', fontVariant: tabular },
  body: { fontSize: 16, lineHeight: 24, fontVariant: tabular },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: -0.44, fontVariant: tabular },
  headline: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.56, fontVariant: tabular },
  pin: { fontSize: 24, lineHeight: 32, fontWeight: '600', fontVariant: tabular },
  amount: { fontSize: 40, lineHeight: 48, fontWeight: '700', letterSpacing: -0.8, fontVariant: tabular },
} as const satisfies Record<string, TextStyle>;

/**
 * The PIN text is capped at 1.0x font scaling: 19 characters at 24sp x 1.3 do not fit a
 * 320dp screen. It stays at 24sp, still larger than 130%-scaled body text.
 */
export const PIN_MAX_FONT_SCALE = 1;
