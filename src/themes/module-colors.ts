import { contrastRatio, parseHexColor, toHexColor } from './contrast';
import type { Rgb } from './contrast';
import { hashString } from '../voxel/rng';
import type { Theme } from './themes';

/**
 * Per-module colouring — the mosaic look.
 *
 * A scannable code does not have to be black on white: decoders binarize
 * luminance, so modules may vary in hue freely as long as every one of them is
 * decisively darker than the background. Each theme's voxel palette is
 * darkened, colour by colour, until it clears the floor below, giving a warm
 * mosaic (autumn oranges, neon violets, glacier blues) that still scans.
 *
 * The floors are deliberately above what binarizers need — and the e2e decode
 * matrix, which screenshots and decodes every theme, remains the actual gate.
 */
export const MIN_MODULE_CONTRAST = 5;

/** Finder and timing patterns drive detection, so they sit darker still. */
export const MIN_STRUCTURAL_CONTRAST = 6.5;

const BLACK: Rgb = { r: 0, g: 0, b: 0 };

function darkenUntil(hex: string, background: string, floor: number): string {
  let rgb = parseHexColor(hex) ?? BLACK;
  let out = toHexColor(rgb);
  for (let step = 0; step < 60 && contrastRatio(out, background) < floor; step += 1) {
    rgb = {
      r: rgb.r + (BLACK.r - rgb.r) * 0.06,
      g: rgb.g + (BLACK.g - rgb.g) * 0.06,
      b: rgb.b + (BLACK.b - rgb.b) * 0.06,
    };
    out = toHexColor(rgb);
  }
  return out;
}

export interface ModuleRamp {
  /** Colours for ordinary data modules. */
  data: string[];
  /** Darker colours reserved for finder and timing structure. */
  structural: string[];
}

/** Build the scan-safe module ramp for a theme against its light background. */
export function buildModuleRamp(theme: Theme, background: string): ModuleRamp {
  const bases = [...theme.voxels, theme.qr.foreground];
  const data: string[] = [];
  for (const base of bases) {
    const safe = darkenUntil(base, background, MIN_MODULE_CONTRAST);
    if (!data.includes(safe)) data.push(safe);
    const deeper = darkenUntil(safe, background, MIN_MODULE_CONTRAST + 1.5);
    if (!data.includes(deeper)) data.push(deeper);
  }
  const structural = bases
    .map((base) => darkenUntil(base, background, MIN_STRUCTURAL_CONTRAST))
    .filter((color, index, all) => all.indexOf(color) === index);
  return { data, structural };
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
