import type { TextStyle } from 'react-native';

/**
 * Design tokens. Components use only these values — no inline magic numbers.
 *
 * Contrast (WCAG 2.x), measured against `paper` unless stated:
 *   ink        16.2:1   inkMuted    6.5:1   primary     8.3:1 (white on primary 8.8:1)
 *   success     6.6:1   error       6.2:1   line        3.25:1 (non-text needs 3:1)
 *   white on disabled 5.3:1   error on errorTint 5.6:1   success on successTint 6.1:1
 */
export const colors = {
  paper: '#FAF8F3',
  surface: '#FFFFFF',
  ink: '#1B1B1B',
  inkMuted: '#5A5A5A',
  primary: '#124A8C',
  onPrimary: '#FFFFFF',
  primaryTint: '#E6EEF7',
  success: '#17663A',
  successTint: '#E4F2E9',
  error: '#B3261E',
  errorTint: '#FBEAE8',
  line: '#8A8A8A',
  disabled: '#6B6B6B',
  onDisabled: '#FFFFFF',
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

/** One radius for inputs and buttons, a smaller one for chips. */
export const radius = {
  control: 12,
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
 * Type scale (system font). Every style uses tabular figures so digits line up.
 * `pin` is not in the base scale: §2.3 requires the PIN to be at least 24.
 */
export const type = {
  caption: { fontSize: 13, lineHeight: 18, fontVariant: tabular },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600', fontVariant: tabular },
  body: { fontSize: 16, lineHeight: 22, fontVariant: tabular },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', fontVariant: tabular },
  headline: { fontSize: 28, lineHeight: 34, fontWeight: '700', fontVariant: tabular },
  pin: { fontSize: 24, lineHeight: 32, fontWeight: '600', fontVariant: tabular },
  amount: { fontSize: 40, lineHeight: 48, fontWeight: '700', fontVariant: tabular },
} as const satisfies Record<string, TextStyle>;

/**
 * The PIN text is capped at 1.0x font scaling: 19 characters at 24sp x 1.3 do not fit a
 * 320dp screen. It stays at 24sp, still larger than 130%-scaled body text.
 */
export const PIN_MAX_FONT_SCALE = 1;
