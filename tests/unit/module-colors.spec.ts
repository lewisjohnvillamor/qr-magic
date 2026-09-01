import { describe, expect, it } from 'vitest';
import {
  LUMINANCE_JITTER,
  MIN_MODULE_CONTRAST,
  MIN_STRUCTURAL_CONTRAST,
  MODULE_LUMINANCE,
  STRUCTURAL_LUMINANCE,
  buildModuleRamp,
  moduleColorAt,
  rampLuminanceSpread,
  rampWorstContrast,
  withRelativeLuminance,
} from '../../src/themes/module-colors';
import { contrastRatio, parseHexColor, relativeLuminance } from '../../src/themes/contrast';
import { THEME_IDS, getTheme, resolveQrColors } from '../../src/themes/themes';

describe('withRelativeLuminance', () => {
  it('hits the requested luminance exactly', () => {
    for (const hex of ['#7b3ff2', '#3f6b3a', '#ff8a4c', '#9fc7f0', '#ffffff']) {
      const out = withRelativeLuminance(hex, 0.045);
      expect(relativeLuminance(parseHexColor(out)!)).toBeCloseTo(0.045, 3);
    }
  });

  it('keeps the hue while moving the brightness', () => {
    // Scaling linear-light channels uniformly preserves their ratios.
    const out = parseHexColor(withRelativeLuminance('#7b3ff2', 0.045))!;
    expect(out.b).toBeGreaterThan(out.r);
    expect(out.r).toBeGreaterThan(out.g);
  });

  it('places pure black as a neutral at the target rather than dividing by zero', () => {
    const out = withRelativeLuminance('#000000', 0.045);
    expect(relativeLuminance(parseHexColor(out)!)).toBeCloseTo(0.045, 3);
  });
});

describe('module mosaic colours', () => {
  /**
   * The property that actually decides whether a phone can read the code.
   *
   * A binarizer thresholds luminance locally. If the dark modules vary among
   * themselves by anything approaching their distance from the background, the
   * lightest of them lands near the threshold and reads as light under glare.
   * An earlier build had a spread of 0.375 against a gap of 0.154 and did not
   * scan on real devices.
   */
  it('keeps every module tightly clustered in luminance', () => {
    for (const id of THEME_IDS) {
      const ramp = buildModuleRamp(getTheme(id));
      const spread = rampLuminanceSpread(ramp);
      const background = relativeLuminance(
        parseHexColor(resolveQrColors(getTheme(id)).background)!,
      );
      const gap = background - (MODULE_LUMINANCE + LUMINANCE_JITTER);
      expect(spread, `${id} spread`).toBeLessThanOrEqual(MODULE_LUMINANCE);
      // The decisive ratio: variation inside the dark set must be a small
      // fraction of the dark-to-light separation, not a multiple of it.
      expect(spread / gap, `${id} spread/gap`).toBeLessThan(0.1);
    }
  });

  it('still clears the contrast floors it is verified against', () => {
    for (const id of THEME_IDS) {
      const theme = getTheme(id);
      const { background } = resolveQrColors(theme);
      const ramp = buildModuleRamp(theme);
      expect(rampWorstContrast(ramp, background)).toBeGreaterThanOrEqual(MIN_MODULE_CONTRAST);
      for (const color of ramp.structural) {
        expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(MIN_STRUCTURAL_CONTRAST);
      }
    }
  });

  it('keeps structural modules deeper than data modules', () => {
    expect(STRUCTURAL_LUMINANCE).toBeLessThan(MODULE_LUMINANCE);
  });

  it('still varies: a mosaic needs more than one colour', () => {
    for (const id of THEME_IDS) {
      expect(buildModuleRamp(getTheme(id)).data.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('assigns colours deterministically per module', () => {
    const ramp = buildModuleRamp(getTheme('sunset'));
    expect(moduleColorAt(ramp, 42, 3, 7, false)).toBe(moduleColorAt(ramp, 42, 3, 7, false));
    const row = Array.from({ length: 20 }, (_, i) => moduleColorAt(ramp, 42, 0, i, false));
    expect(new Set(row).size).toBeGreaterThan(1);
  });

  it('draws structural modules from the deeper pool', () => {
    const ramp = buildModuleRamp(getTheme('nature'));
    expect(ramp.structural).toContain(moduleColorAt(ramp, 1, 0, 0, true));
  });

  it('leaves the solid pair stronger still, for the 2D fallback', () => {
    for (const id of THEME_IDS) {
      expect(resolveQrColors(getTheme(id)).ratio).toBeGreaterThanOrEqual(12);
    }
  });
});
