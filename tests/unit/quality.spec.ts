import { describe, expect, it } from 'vitest';
import { QUALITY_LEVELS, QUALITY_PROFILES, detectQualityLevel } from '../../src/lib/quality';

describe('quality tiers', () => {
  it('defines a profile for every level', () => {
    for (const level of QUALITY_LEVELS) {
      const profile = QUALITY_PROFILES[level];
      expect(profile.level).toBe(level);
      expect(profile.maxDpr).toBeLessThanOrEqual(2);
      expect(profile.sculptureCount).toBeGreaterThan(0);
    }
  });

  it('orders the tiers by cost', () => {
    expect(QUALITY_PROFILES.high.sculptureCount).toBeGreaterThan(
      QUALITY_PROFILES.medium.sculptureCount,
    );
    expect(QUALITY_PROFILES.medium.sculptureCount).toBeGreaterThan(
      QUALITY_PROFILES.low.sculptureCount,
    );
    expect(QUALITY_PROFILES.low.shadows).toBe(false);
    expect(QUALITY_PROFILES.low.particles).toBe(0);
  });

  it('picks high only for a capable desktop', () => {
    expect(
      detectQualityLevel({ hardwareConcurrency: 12, deviceMemory: 16, maxTouchPoints: 0 }),
    ).toBe('high');
  });

  it('steps down for small touch devices and weak hardware', () => {
    expect(
      detectQualityLevel({
        hardwareConcurrency: 8,
        deviceMemory: 8,
        maxTouchPoints: 5,
        viewportWidth: 390,
      }),
    ).toBe('low');
    expect(detectQualityLevel({ hardwareConcurrency: 2, deviceMemory: 8 })).toBe('low');
    expect(
      detectQualityLevel({
        hardwareConcurrency: 8,
        deviceMemory: 8,
        maxTouchPoints: 5,
        viewportWidth: 820,
      }),
    ).toBe('medium');
  });

  it('never asks a reduced-motion user for the heaviest tier', () => {
    expect(
      detectQualityLevel({ hardwareConcurrency: 16, deviceMemory: 32, reducedMotion: true }),
    ).toBe('medium');
  });
});
