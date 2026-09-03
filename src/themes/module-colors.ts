import { contrastRatio, parseHexColor, toHexColor } from './contrast';
import type { Rgb } from './contrast';
import { hashString } from '../voxel/rng';
import type { Theme } from './themes';

/**
 * Per-module colouring — the mosaic look.
 *
 * A scannable code does not have to be black on white: decoders binarize
 * *luminance*, so modules may vary in hue freely. What they must not do is vary
 * in brightness.
 *
 * That distinction was learned the hard way. An earlier version enforced a
 * minimum contrast ratio per module and let brightness fall where it may, which
 * produced dark modules spanning luminance 0.011 to 0.386 while the gap from
 * the lightest dark module to the darkest light one was just 0.154 — the
 * variation *inside* the dark set was 2.4x the separation that defines dark
 * from light. Software decoders read that fine from a clean screenshot; a phone
 * camera, with glare and a local adaptive threshold, does not, and real codes
 * would not scan.
 *
 * So luminance is now pinned and only chroma varies. Every data module is
 * placed at {@link MODULE_LUMINANCE} and every structural module at
 * {@link STRUCTURAL_LUMINANCE}, with a jitter far too small to approach the
 * threshold. The mosaic survives — the colours differ in hue, not in weight.
 */

/** Relative luminance every ordinary data module is placed at. */
export const MODULE_LUMINANCE = 0.045;

/** Finder and timing patterns drive detection, so they sit a little deeper. */
export const STRUCTURAL_LUMINANCE = 0.026;

/** Deterministic wobble, small enough to keep the dark set tightly clustered. */
export const LUMINANCE_JITTER = 0.006;

/** Contrast floor the result is verified against, not built from. */
export const MIN_MODULE_CONTRAST = 7;

/** Structural modules clear a higher bar still. */
export const MIN_STRUCTURAL_CONTRAST = 9;

const BLACK: Rgb = { r: 0, g: 0, b: 0 };

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function toSrgb(linear: number): number {
  const clamped = Math.max(0, Math.min(1, linear));
  const encoded =
    clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(encoded * 255);
}

/**
 * Recolour to an exact relative luminance, keeping the hue.
 *
 * Luminance is linear in linear-light RGB, so scaling all three channels by the
 * same factor moves brightness to the target precisely while leaving the
 * channel ratios — the hue — untouched.
 */
export function withRelativeLuminance(hex: string, targetLuminance: number): string {
  const rgb = parseHexColor(hex) ?? BLACK;
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // A colour with no light in it has no hue to preserve; place it as neutral.
  if (luminance <= 1e-6) {
    const value = toSrgb(targetLuminance);
    return toHexColor({ r: value, g: value, b: value });
  }

  const scale = targetLuminance / luminance;
  return toHexColor({ r: toSrgb(r * scale), g: toSrgb(g * scale), b: toSrgb(b * scale) });
}

export interface ModuleRamp {
  /** Colours for ordinary data modules — one luminance, many hues. */
  data: string[];
  /** Deeper colours reserved for finder and timing structure. */
  structural: string[];
}

/**
 * Build the scan-safe module ramp for a theme.
 *
 * The background is no longer an input: colours are placed at an absolute
 * luminance rather than derived from a contrast ratio against the backdrop,
 * which is precisely what keeps the dark set tightly clustered. Callers still
 * verify the pair with {@link rampWorstContrast}.
 */
export function buildModuleRamp(theme: Theme): ModuleRamp {
  const bases = [...theme.voxels, theme.qr.foreground];
  const data: string[] = [];
  const structural: string[] = [];

  for (const [index, base] of bases.entries()) {
    // The jitter alternates either side of the target so the set stays centred.
    const wobble = (index % 2 === 0 ? 1 : -1) * LUMINANCE_JITTER * ((index % 3) / 2);
    const dataColor = withRelativeLuminance(base, MODULE_LUMINANCE + wobble);
    if (!data.includes(dataColor)) data.push(dataColor);
    const structuralColor = withRelativeLuminance(base, STRUCTURAL_LUMINANCE + wobble * 0.5);
    if (!structural.includes(structuralColor)) structural.push(structuralColor);
  }

  // A theme whose palette collapses to one hue still needs something to vary.
  if (data.length < 2) data.push(withRelativeLuminance('#404040', MODULE_LUMINANCE));
  if (structural.length < 1)
    structural.push(withRelativeLuminance('#303030', STRUCTURAL_LUMINANCE));

  return { data, structural };
}

/**
 * Widest luminance spread across a ramp — the number that decides scannability.
 *
 * Only the tests call it, to hold the mosaic inside the band that a binarizer
 * can still read. Keeping the measurement next to the thing it measures is
 * what stops the two drifting apart.
 */
export function rampLuminanceSpread(ramp: ModuleRamp): number {
  const all = [...ramp.data, ...ramp.structural].map((hex) => {
    const rgb = parseHexColor(hex) ?? BLACK;
    return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
  });
  return Math.max(...all) - Math.min(...all);
}

/** Worst contrast ratio in a ramp against its background. */
export function rampWorstContrast(ramp: ModuleRamp, background: string): number {
  return Math.min(
    ...[...ramp.data, ...ramp.structural].map((hex) => contrastRatio(hex, background)),
  );
}

/**
 * Deterministic colour for a module. The same URL, theme and module always
 * produce the same colour on every device, so shared links look identical and
 * renders are reproducible.
 */
export function moduleColorAt(
  ramp: ModuleRamp,
  seed: number,
  row: number,
  column: number,
  structural: boolean,
): string {
  const pool = structural ? ramp.structural : ramp.data;
  const hash = hashString(`${seed}:${row}:${column}`);
  return pool[hash % pool.length] ?? '#111111';
}
