import type { TextStyle } from 'react-native';

/**
 * Design tokens. Components use only these values: no inline magic numbers.
 *
 * A dark, near-black canvas with one mint-green accent for the main action, selection and
 * success; the loudest number on a screen sits on a white card. Colour is never the only
 * signal: errors still carry an icon and words, done still carries a tick, selected still
 * carries a heavy border and a check.
 *
 * Contrast (WCAG 2.x). Every pair the app draws is checked in theme.test.ts:
 *   ink on paper 19.1:1, on surface 16.6:1, on tint 13.1:1   muted ink on paper 8.4:1, on surface 7.3:1
 *   dark on primary 10.6:1   primary on paper 10.6:1   error on paper 8.7:1
 *   ink on card 19.1:1, muted 6.2:1   disabled text 5.2:1 on its fill
 *   field border (line) 3.9:1 on paper, 3.4:1 on surface (non-text needs 3:1)
 */
export const colors = {
  /** The screen background. */
  paper: '#0E100E',
  /** Fields, bank rows, history rows and quiet panels. */
  surface: '#1C1F1C',
  ink: '#FFFFFF',
  inkMuted: '#A7ADA7',
  /** Mint green: primary buttons, links, focus, selection. */
  primary: '#86D38A',
  onPrimary: '#0E100E',
  /** Selected row and pressed rows. */
  primaryTint: '#233524',
  success: '#86D38A',
  successTint: '#233524',
  error: '#FF8F87',
  errorTint: '#3A2220',
  line: '#6B726B',
  disabled: '#2A2E2A',
  onDisabled: '#9AA09A',
  /** The white hero card that holds the one big amount on a screen. */
  card: '#FFFFFF',
  onCard: '#0E100E',
  onCardMuted: '#5C635C',
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
 * Buttons and chips are pills; hero cards are as round as the buttons; inputs, rows and panels
 * share one slightly softer radius.
 */
export const radius = {
  pill: 28,
  /** Hero cards and the scan panel. */
  card: 28,
  control: 20,
  chip: 999,
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
 * Inter, loaded in app/_layout.tsx. React Native applies a custom font's own weight, so every
 * style below names the family for its weight directly rather than using `fontWeight` (which
 * Android ignores on a non-system font). `fontFamily` is undefined until the fonts have loaded;
 * RootLayout does not render the app until then, so no screen sees the system-font fallback.
 */
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/**
 * Type scale. Every style uses tabular figures so digits line up. Headings are heavier and set
 * slightly tight (about -0.02em, in points) for a confident, quiet look; body text is left alone
 * for legibility. `pin` is not in the base scale: the PIN must be at least 24 and is not
 * tracked, so that 16 digits still fit a 320 dp screen.
 */
export const type = {
  caption: { fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular, fontVariant: tabular },
  label: { fontSize: 15, lineHeight: 20, fontFamily: fontFamily.medium, fontVariant: tabular },
  body: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.regular, fontVariant: tabular },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fontFamily.semibold,
    letterSpacing: -0.44,
    fontVariant: tabular,
  },
  headline: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: fontFamily.bold,
    letterSpacing: -0.56,
    fontVariant: tabular,
  },
  pin: { fontSize: 24, lineHeight: 32, fontFamily: fontFamily.semibold, fontVariant: tabular },
  amount: {
    fontSize: 40,
    lineHeight: 48,
    fontFamily: fontFamily.bold,
    letterSpacing: -0.8,
    fontVariant: tabular,
  },
} as const satisfies Record<string, TextStyle>;

/**
 * The PIN text is capped at 1.0x font scaling: 19 characters at 24sp x 1.3 do not fit a
 * 320dp screen. It stays at 24sp, still larger than 130%-scaled body text.
 */
export const PIN_MAX_FONT_SCALE = 1;
