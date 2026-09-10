import { readImageFile } from '../lib/image-file';

export { IMAGE_ACCEPT as LOGO_ACCEPT, MAX_IMAGE_BYTES as MAX_LOGO_BYTES } from '../lib/image-file';

/**
 * The logo in the middle of a code.
 *
 * Putting a picture over a QR code means deleting modules, and the only reason
 * that works at all is error correction: level H can lose 30% of the code and
 * still decode. This module exists to keep that trade explicit and bounded
 * rather than trusting whatever the user drops in.
 *
 * The area is capped — {@link MAX_LOGO_RATIO} of the code's width, so at most
 * about 5% of its area against a 30% budget, leaving the rest of the margin for
 * the camera, the screen and the glare.
 */

/** Longest side of the stored logo, in pixels. */
export const LOGO_MAX_PIXELS = 512;

/** Default width of the logo box, as a fraction of the code's width. */
export const LOGO_RATIO = 0.16;

/**
 * Hard cap on the logo box.
 *
 * At 0.22 the covered area is 4.8% of the code — comfortably inside level H's
 * 30% budget even after the quiet ring around the logo is counted.
 */
export const MAX_LOGO_RATIO = 0.22;

export type LogoResult = { ok: true; dataUrl: string } | { ok: false; message: string };

/** Accept a picked file and return a small, self-contained PNG data URL. */
export async function readLogoFile(file: File): Promise<LogoResult> {
  const read = await readImageFile(file, LOGO_MAX_PIXELS);
  if (!read.ok) return read;
  try {
    return { ok: true, dataUrl: read.canvas.toDataURL('image/png') };
  } catch {
    return { ok: false, message: 'That image could not be used here.' };
  }
}

/**
 * Width of the logo box in whole modules, always odd so it sits centred on the
 * matrix rather than half a module off it.
 */
export function logoModuleSpan(matrixSize: number, ratio = LOGO_RATIO): number {
  const capped = Math.min(Math.max(ratio, 0), MAX_LOGO_RATIO);
  const raw = Math.round(matrixSize * capped);
  const odd = raw % 2 === 0 ? raw - 1 : raw;
  // Never smaller than 3 modules (a logo you cannot see is not a feature) and
  // never past the cap, whatever rounding did.
  return Math.max(3, Math.min(odd, Math.floor(matrixSize * MAX_LOGO_RATIO) | 1));
}

/**
 * Fraction of the code's modules a logo of this span would cover, quiet ring
 * included. Used by the tests to hold the cap honest.
 */
export function logoCoverage(matrixSize: number, span: number): number {
  const withPadding = span + 2;
  return (withPadding * withPadding) / (matrixSize * matrixSize);
}
