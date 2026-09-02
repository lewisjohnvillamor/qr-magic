import { describe, expect, it } from 'vitest';
import {
  MIN_QR_CONTRAST,
  contrastRatio,
  parseHexColor,
  relativeLuminance,
  toScanSafePair,
} from '../../src/themes/contrast';
import {
  DEFAULT_THEME,
  THEME_IDS,
  THEMES,
  getTheme,
  resolveQrColors,
} from '../../src/themes/themes';

describe('contrast', () => {
  it('parses 3- and 6-digit hex colours', () => {
    expect(parseHexColor('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHexColor('112233')).toEqual({ r: 17, g: 34, b: 51 });
    expect(parseHexColor('nope')).toBeNull();
  });

  it('computes the known black/white contrast ratio', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 4);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 6);
  });

  it('leaves an already-safe pair alone', () => {
    const pair = toScanSafePair('#111111', '#f7f4ec');
    expect(pair.adjusted).toBe(false);
    expect(pair.foreground).toBe('#111111');
    expect(pair.ratio).toBeGreaterThanOrEqual(MIN_QR_CONTRAST);
  });

  it('lifts a low-contrast pair above the floor', () => {
    const pair = toScanSafePair('#888888', '#999999');
    expect(pair.adjusted).toBe(true);
    expect(pair.ratio).toBeGreaterThanOrEqual(MIN_QR_CONTRAST);
  });

  it('always puts the darker colour in the foreground', () => {
    const pair = toScanSafePair('#ffffff', '#000000');
    expect(relativeLuminance(parseHexColor(pair.foreground)!)).toBeLessThan(
      relativeLuminance(parseHexColor(pair.background)!),
    );
  });

  it('reaches the floor for every pair of extremes', () => {
    for (const a of ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#7f7f7f']) {
      for (const b of ['#000000', '#ffffff', '#123456', '#fedcba', '#808080']) {
        expect(toScanSafePair(a, b).ratio).toBeGreaterThanOrEqual(MIN_QR_CONTRAST);
      }
    }
  });
});

describe('themes', () => {
  it('ships every declared theme', () => {
    for (const id of THEME_IDS) expect(THEMES[id].id).toBe(id);
  });

  it('produces a scan-safe QR pair for every theme', () => {
    for (const id of THEME_IDS) {
      const pair = resolveQrColors(getTheme(id));
      expect(pair.ratio).toBeGreaterThanOrEqual(MIN_QR_CONTRAST);
    }
  });

  it('falls back to the default for a theme that no longer exists', () => {
    // "brand" was a theme until it became a sculpture. Links written back then
    // must still open rather than landing on an undefined palette.
    expect(getTheme('brand' as never)).toBe(getTheme(DEFAULT_THEME));
  });
});
