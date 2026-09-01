/** WCAG relative-luminance contrast maths, used to guarantee a scannable QR state. */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Minimum foreground/background contrast ratio allowed in the QR state. */
export const MIN_QR_CONTRAST = 7;

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function parseHexColor(value: string): Rgb | null {
  const match = HEX.exec(value.trim());
  if (!match) return null;
  let hex = match[1] as string;
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

export function toHexColor(rgb: Rgb): string {
  const part = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`;
}

export function relativeLuminance(rgb: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrastRatio(a: string, b: string): number {
  const rgbA = parseHexColor(a);
  const rgbB = parseHexColor(b);
  if (!rgbA || !rgbB) return 0;
  const lumA = relativeLuminance(rgbA);
  const lumB = relativeLuminance(rgbB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

function mix(rgb: Rgb, target: Rgb, amount: number): Rgb {
  return {
    r: rgb.r + (target.r - rgb.r) * amount,
    g: rgb.g + (target.g - rgb.g) * amount,
    b: rgb.b + (target.b - rgb.b) * amount,
  };
}

const BLACK: Rgb = { r: 0, g: 0, b: 0 };
const WHITE: Rgb = { r: 255, g: 255, b: 255 };

export interface ScanSafePair {
  foreground: string;
  background: string;
  ratio: number;
  /** True when the requested colours had to be adjusted to reach the floor. */
  adjusted: boolean;
}

/**
 * Return a foreground/background pair that is guaranteed to clear
 * {@link MIN_QR_CONTRAST}, keeping the requested hues as far as possible.
 *
 * The darker colour always becomes the foreground: inverted QR codes decode on
 * many readers but not on all of them, and "most readers" is not a product.
 */
export function toScanSafePair(foreground: string, background: string): ScanSafePair {
  const fgRgb = parseHexColor(foreground) ?? BLACK;
  const bgRgb = parseHexColor(background) ?? WHITE;

  // Ensure the foreground is the darker of the two.
  const fgIsDarker = relativeLuminance(fgRgb) <= relativeLuminance(bgRgb);
  let dark = fgIsDarker ? fgRgb : bgRgb;
  let light = fgIsDarker ? bgRgb : fgRgb;
  const swapped = !fgIsDarker;

  let adjusted = swapped;
  let ratio = contrastRatio(toHexColor(dark), toHexColor(light));

  // Walk both colours toward black and white until the floor is cleared. Sixty
  // steps of 6% converge on pure black over pure white (ratio 21), so the loop
  // always terminates having cleared the floor.
  for (let step = 0; step < 60 && ratio < MIN_QR_CONTRAST; step += 1) {
    dark = mix(dark, BLACK, 0.06);
    light = mix(light, WHITE, 0.06);
    ratio = contrastRatio(toHexColor(dark), toHexColor(light));
    adjusted = true;
  }

  return {
    foreground: toHexColor(dark),
    background: toHexColor(light),
    ratio,
    adjusted,
  };
}
