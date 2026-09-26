import { borderWidth, colors, fontFamily, size, spacing, type } from './theme';

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('palette', () => {
  it('has one accent: primary and success are the same green', () => {
    expect(colors.success).toBe(colors.primary);
    expect(colors.successTint).toBe(colors.primaryTint);
  });

  it('is dark: the background is darker than every panel drawn on it', () => {
    for (const panel of [colors.surface, colors.primaryTint, colors.disabled, colors.card]) {
      expect(luminance(colors.paper)).toBeLessThan(luminance(panel));
    }
  });
});

describe('colour contrast', () => {
  // Every pair the app actually draws text in. Body text needs 4.5:1 (WCAG AA).
  it.each([
    ['ink on paper', colors.ink, colors.paper],
    ['ink on surface', colors.ink, colors.surface],
    ['ink on primary tint', colors.ink, colors.primaryTint],
    ['muted ink on paper', colors.inkMuted, colors.paper],
    ['muted ink on surface', colors.inkMuted, colors.surface],
    ['dark on primary button', colors.onPrimary, colors.primary],
    ['white on disabled button', colors.onDisabled, colors.disabled],
    ['primary on paper (text buttons)', colors.primary, colors.paper],
    ['primary on surface (secondary button)', colors.primary, colors.surface],
    ['primary on primary tint (selected bank)', colors.primary, colors.primaryTint],
    ['success on paper', colors.success, colors.paper],
    ['success on success tint', colors.success, colors.successTint],
    ['error on paper', colors.error, colors.paper],
    ['error on surface', colors.error, colors.surface],
    ['error on error tint', colors.error, colors.errorTint],
    ['ink on hero card', colors.onCard, colors.card],
    ['muted ink on hero card', colors.onCardMuted, colors.card],
    ['ink on disabled fill', colors.ink, colors.disabled],
  ])('%s meets 4.5:1', (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  // Borders and icons are non-text: 3:1.
  it.each([
    ['field border on paper', colors.line, colors.paper],
    ['field border on surface', colors.line, colors.surface],
    ['selected bank border on tint', colors.primary, colors.primaryTint],
  ])('%s meets 3:1', (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(3);
  });
});

describe('sizes and spacing', () => {
  it('touch targets are at least 48 dp and buttons and bank rows at least 56 dp', () => {
    expect(size.touch).toBeGreaterThanOrEqual(48);
    expect(size.button).toBeGreaterThanOrEqual(56);
    expect(size.bankRow).toBeGreaterThanOrEqual(56);
  });

  it('spacing follows the 4-point scale from the brief', () => {
    expect(Object.values(spacing)).toEqual([4, 8, 12, 16, 24, 32, 48]);
  });

  it('type scale matches the brief', () => {
    expect(type.caption.fontSize).toBe(13);
    expect(type.body.fontSize).toBe(16);
    expect(type.label.fontSize).toBe(15);
    expect(type.title.fontSize).toBe(22);
    expect(type.headline.fontSize).toBe(28);
    expect(type.amount.fontSize).toBe(40);
    // The PIN must be at least 24 (§2.3).
    expect(type.pin.fontSize).toBeGreaterThanOrEqual(24);
  });

  it('every text style uses tabular figures', () => {
    for (const style of Object.values(type)) {
      expect(style.fontVariant).toEqual(['tabular-nums']);
    }
  });

  it('every text style names one of the four loaded Inter weights', () => {
    const loaded = Object.values(fontFamily);
    for (const style of Object.values(type)) {
      expect(loaded).toContain(style.fontFamily);
    }
  });

  it('the four weights are Inter and distinct', () => {
    const families = Object.values(fontFamily);
    expect(new Set(families).size).toBe(families.length);
    for (const family of families) expect(family.startsWith('Inter_')).toBe(true);
  });

  it('borders are 1 and 2 dp', () => {
    expect([borderWidth.thin, borderWidth.thick]).toEqual([1, 2]);
  });
});
