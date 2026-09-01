import { describe, expect, it } from 'vitest';
import {
  MIN_MODULE_CONTRAST,
  MIN_STRUCTURAL_CONTRAST,
  buildModuleRamp,
  moduleColorAt,
} from '../../src/themes/module-colors';
import { contrastRatio } from '../../src/themes/contrast';
import { THEME_IDS, getTheme, resolveQrColors } from '../../src/themes/themes';

describe('module mosaic colours', () => {
  it('every colour in every theme ramp clears its contrast floor', () => {
    for (const id of THEME_IDS) {
      const theme = getTheme(id);
      const { background } = resolveQrColors(theme);
      const ramp = buildModuleRamp(theme, background);
      expect(ramp.data.length).toBeGreaterThanOrEqual(3);
      expect(ramp.structural.length).toBeGreaterThanOrEqual(1);
      for (const color of ramp.data) {
        expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(MIN_MODULE_CONTRAST);
      }
      for (const color of ramp.structural) {
        expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(MIN_STRUCTURAL_CONTRAST);
      }
    }
  });

  it('assigns colours deterministically per module', () => {
    const theme = getTheme('sunset');
    const ramp = buildModuleRamp(theme, resolveQrColors(theme).background);
    expect(moduleColorAt(ramp, 42, 3, 7, false)).toBe(moduleColorAt(ramp, 42, 3, 7, false));
    // Different seeds may differ; different modules usually differ across a row.
    const row = Array.from({ length: 20 }, (_, i) => moduleColorAt(ramp, 42, 0, i, false));
    expect(new Set(row).size).toBeGreaterThan(1);
  });

  it('draws structural modules from the darker pool', () => {
    const theme = getTheme('nature');
    const { background } = resolveQrColors(theme);
    const ramp = buildModuleRamp(theme, background);
    const structural = moduleColorAt(ramp, 1, 0, 0, true);
    expect(ramp.structural).toContain(structural);
  });
});
