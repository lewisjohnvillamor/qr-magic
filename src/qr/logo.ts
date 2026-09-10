/**
 * The logo in the middle of a code.
 *
 * Putting a picture over a QR code means deleting modules, and the only reason
 * that works at all is error correction: level H can lose 30% of the code and
 * still decode. This module exists to keep that trade explicit and bounded
 * rather than trusting whatever the user drops in.
 *
 * Two rules do the work. The area is capped — {@link MAX_LOGO_RATIO} of the
 * code's width, so at most about 6% of its area against a 30% budget, leaving
 * the rest of the margin for the camera, the screen and the glare. And every
 * accepted image is re-encoded here: decoded, scaled down and written back out
 * as PNG, which caps the size, drops metadata, and means the canvas the code is
 * drawn on is never tainted by a foreign image — the "save as image" export
 * would fail silently otherwise.
 */

/** Largest accepted upload before re-encoding. */
export const MAX_LOGO_BYTES = 4 * 1024 * 1024;

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

const ACCEPTED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/** File types offered in the picker. SVG is deliberately absent: see below. */
export const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

export type LogoResult = { ok: true; dataUrl: string } | { ok: false; message: string };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('decode failed'));
    image.src = src;
  });
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * Accept a picked file and return a small, self-contained PNG data URL.
 *
 * SVG is refused rather than supported. An SVG can reference external
 * resources, and drawing one into a canvas can mark that canvas as tainted —
 * which would make `toDataURL` throw and break the PNG export, at the exact
 * moment someone is trying to save their code. A raster round-trip has no such
 * failure mode.
 */
export async function readLogoFile(file: File): Promise<LogoResult> {
  if (!ACCEPTED.has(file.type)) {
    return { ok: false, message: 'Use a PNG, JPEG, WebP or GIF image.' };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { ok: false, message: 'That image is larger than 4 MB. Try a smaller one.' };
  }

  let image: HTMLImageElement;
  try {
    image = await loadImage(await readAsDataUrl(file));
  } catch {
    return { ok: false, message: 'That image could not be read.' };
  }

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (width < 1 || height < 1) return { ok: false, message: 'That image is empty.' };

  const scale = Math.min(1, LOGO_MAX_PIXELS / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) return { ok: false, message: 'This device cannot process that image.' };
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  try {
    return { ok: true, dataUrl: canvas.toDataURL('image/png') };
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
