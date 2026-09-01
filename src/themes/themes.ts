import { toScanSafePair } from './contrast';

export const THEME_IDS = ['nature', 'cyber', 'crystal', 'sunset', 'snow', 'brand'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export type ParticleKind = 'pollen' | 'grid' | 'shimmer' | 'fog' | 'snow' | 'none';

export interface Theme {
  id: ThemeId;
  label: string;
  /** One-line description used in the picker and read by screen readers. */
  hint: string;
  /** Backdrop gradient stops, top to bottom. */
  backdrop: [string, string];
  /** Voxel palette; instances pick a colour by index for subtle variation. */
  voxels: [string, string, string, string];
  /** Interface accent. */
  accent: string;
  /** Interface text on the backdrop. */
  ink: string;
  /** Ambient / key light tints. */
  lights: { ambient: string; key: string; rim: string };
  /** Fog distances, expressed as fractions of the current viewing distance. */
  fog: { color: string; near: number; far: number };
  particles: ParticleKind;
  /** Requested QR colours; always passed through the contrast guarantee. */
  qr: { foreground: string; background: string };
}

const THEME_LIST: Theme[] = [
  {
    id: 'nature',
    label: 'Nature',
    hint: 'Green canopy, warm cream light and drifting pollen',
    backdrop: ['#e9efd9', '#c3d3ab'],
    voxels: ['#3f6b3a', '#5e8f4a', '#8fae5d', '#6b4b32'],
    accent: '#2f5a2b',
    ink: '#1b2a18',
    lights: { ambient: '#e6f0d5', key: '#fff6e0', rim: '#9ecf7a' },
    fog: { color: '#dce7c6', near: 0.55, far: 2.2 },
    particles: 'pollen',
    qr: { foreground: '#16240f', background: '#f6f7ec' },
  },
  {
    id: 'cyber',
    label: 'Cyber',
    hint: 'Deep black, violet grid glow and cyan pulses',
    backdrop: ['#08060f', '#150c24'],
    voxels: ['#7b3ff2', '#a86bff', '#22d3ee', '#0f172a'],
    accent: '#22d3ee',
    ink: '#e8e6ff',
    lights: { ambient: '#2a1b4d', key: '#c4b5fd', rim: '#22d3ee' },
    fog: { color: '#0a0714', near: 0.5, far: 2.1 },
    particles: 'grid',
    qr: { foreground: '#07040d', background: '#e6faff' },
  },
  {
    id: 'crystal',
    label: 'Crystal',
    hint: 'White light, glacier blue and lavender refraction',
    backdrop: ['#f4f7ff', '#d5def5'],
    voxels: ['#9fc7f0', '#c7b9f2', '#e8f1ff', '#6f93c9'],
    accent: '#4d6fb0',
    ink: '#1c2440',
    lights: { ambient: '#eef3ff', key: '#ffffff', rim: '#b7c8ff' },
    fog: { color: '#e6ecfb', near: 0.55, far: 2.3 },
    particles: 'shimmer',
    qr: { foreground: '#141a2e', background: '#f8faff' },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    hint: 'Orange horizon, rose haze and deep purple shadow',
    backdrop: ['#2a1230', '#7b2d4d'],
    voxels: ['#ff8a4c', '#ff5f7e', '#c1499a', '#5a2064'],
    accent: '#ffb27a',
    ink: '#ffeede',
    lights: { ambient: '#4a1f45', key: '#ffd0a1', rim: '#ff6b95' },
    fog: { color: '#3a1636', near: 0.5, far: 2.15 },
    particles: 'fog',
    qr: { foreground: '#2a0f1e', background: '#fff3e6' },
  },
  {
    id: 'snow',
    label: 'Snow',
    hint: 'Pale blue dusk, cool grey and slow falling snow',
    backdrop: ['#dfe7ee', '#b9c6d4'],
    voxels: ['#ffffff', '#dbe4ee', '#9fb1c4', '#6b7e93'],
    accent: '#3f5972',
    ink: '#17222e',
    lights: { ambient: '#eaf1f7', key: '#ffffff', rim: '#a8c2dd' },
    fog: { color: '#d3dde7', near: 0.55, far: 2.2 },
    particles: 'snow',
    qr: { foreground: '#101a24', background: '#fbfdff' },
  },
  {
    id: 'brand',
    label: 'Brand',
    hint: 'Your two colours on a neutral studio backdrop',
    backdrop: ['#f5f5f4', '#e2e2e0'],
    voxels: ['#111111', '#333333', '#555555', '#777777'],
    accent: '#111111',
    ink: '#121212',
    lights: { ambient: '#f2f2f2', key: '#ffffff', rim: '#d8d8d8' },
    fog: { color: '#eeeeec', near: 0.6, far: 2.4 },
    particles: 'none',
    qr: { foreground: '#111111', background: '#f7f4ec' },
  },
];

export const THEMES: Readonly<Record<ThemeId, Theme>> = Object.fromEntries(
  THEME_LIST.map((theme) => [theme.id, theme]),
) as Record<ThemeId, Theme>;

export const DEFAULT_THEME: ThemeId = 'nature';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

export function getTheme(id: ThemeId): Theme {
  return THEMES[id] ?? THEMES[DEFAULT_THEME];
}

/**
 * Resolve the colours the QR state will actually use.
 *
 * The `brand` theme takes the user's colours; every theme's result is passed
 * through the contrast guarantee, so no configuration can produce an
 * unscannable code.
 */
export function resolveQrColors(
  theme: Theme,
  brand?: { foreground?: string; background?: string },
) {
  const requested =
    theme.id === 'brand'
      ? {
          foreground: brand?.foreground ?? theme.qr.foreground,
          background: brand?.background ?? theme.qr.background,
        }
      : theme.qr;
  return toScanSafePair(requested.foreground, requested.background);
}
