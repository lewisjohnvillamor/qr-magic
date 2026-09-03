/** Device-appropriate quality tiers (spec §15). */

export const QUALITY_LEVELS = ['high', 'medium', 'low'] as const;
export type QualityLevel = (typeof QUALITY_LEVELS)[number];

export interface QualityProfile {
  level: QualityLevel;
  /** Upper bound on device pixel ratio. */
  maxDpr: number;
  /** Target decorative voxel count for the sculpture. */
  sculptureCount: number;
  shadows: boolean;
  particles: number;
  antialias: boolean;
}

export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  high: {
    level: 'high',
    maxDpr: 2,
    sculptureCount: 1400,
    shadows: true,
    particles: 260,
    antialias: true,
  },
  medium: {
    level: 'medium',
    maxDpr: 1.75,
    sculptureCount: 900,
    shadows: false,
    particles: 120,
    antialias: true,
  },
  low: {
    level: 'low',
    maxDpr: 1.5,
    sculptureCount: 520,
    shadows: false,
    particles: 0,
    antialias: false,
  },
};

export interface DeviceHints {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  maxTouchPoints?: number;
  viewportWidth?: number;
  reducedMotion?: boolean;
}

/**
 * Pick a starting quality tier from cheap, synchronous signals. The runtime
 * monitor can still step this down once real frame times are known.
 */
export function detectQualityLevel(hints: DeviceHints = {}): QualityLevel {
  const cores = hints.hardwareConcurrency ?? 4;
  const memory = hints.deviceMemory ?? 4;
  const touch = (hints.maxTouchPoints ?? 0) > 0;
  const width = hints.viewportWidth ?? 1280;

  if (hints.reducedMotion) return 'medium';
  if (memory <= 2 || cores <= 2) return 'low';
  if (touch && width < 480) return 'low';
  if (touch || cores <= 4 || memory <= 4) return 'medium';
  return 'high';
}

export function readDeviceHints(): DeviceHints {
  if (typeof window === 'undefined') return {};
  const nav = window.navigator as Navigator & { deviceMemory?: number };
  return {
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    maxTouchPoints: nav.maxTouchPoints,
    viewportWidth: window.innerWidth,
  };
}

/** True when the browser can actually create a WebGL2/WebGL context. */
export function detectWebglSupport(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const context =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl');
    return context !== null;
  } catch {
    return false;
  }
}
