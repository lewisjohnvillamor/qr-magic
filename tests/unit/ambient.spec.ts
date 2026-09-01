import { describe, expect, it } from 'vitest';
import { AMBIENT_THEMES, playAmbient, stopAmbient } from '../../src/lib/ambient';
import { THEME_IDS } from '../../src/themes/themes';

describe('ambient soundscapes', () => {
  it('defines a loop for every theme', () => {
    for (const id of THEME_IDS) {
      expect(AMBIENT_THEMES[id]).toBeDefined();
    }
  });

  it('keeps every level in background territory', () => {
    for (const id of THEME_IDS) {
      const config = AMBIENT_THEMES[id];
      // These are ambience, not music: nothing louder than a murmur.
      expect(config.padGain).toBeGreaterThan(0);
      expect(config.padGain).toBeLessThanOrEqual(0.05);
      expect(config.noiseGain).toBeLessThanOrEqual(0.03);
      expect(config.accentGain).toBeLessThanOrEqual(0.05);
      expect(config.chord.length).toBeGreaterThanOrEqual(3);
      expect(config.scale.length).toBeGreaterThanOrEqual(3);
      for (const frequency of [...config.chord, ...config.scale]) {
        expect(frequency).toBeGreaterThan(20);
        expect(frequency).toBeLessThan(4200);
      }
    }
  });

  it('is a no-op where WebAudio does not exist', () => {
    // jsdom has no AudioContext; the engine must degrade to silence, not throw.
    expect(() => playAmbient('nature')).not.toThrow();
    expect(() => stopAmbient()).not.toThrow();
  });
});
