/**
 * Taking a picture from someone, safely.
 *
 * Shared by the centre logo and the custom sculpture, because they need exactly
 * the same three things and disagreeing about any of them would be a bug: the
 * same accepted formats, the same size cap, and the same re-encode.
 *
 * That last one is the important one. Every accepted image is decoded, scaled
 * down and drawn into a canvas *we* own, and only that canvas is read back.
 * It bounds the memory a picture can cost, drops metadata nobody asked to
 * publish, and keeps the export canvas clean of anything that could taint it.
 */

/** Largest accepted upload, before re-encoding. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const ACCEPTED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/**
 * File types offered in the picker.
 *
 * SVG is deliberately absent. It can reference external resources, and drawing
 * one into a canvas can mark that canvas as tainted — which would make
 * `toDataURL` throw and break the PNG export at the exact moment someone is
 * trying to save their code. A raster round-trip has no such failure mode.
 */
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

export type ImageReadResult =
  | { ok: true; canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }
  | { ok: false; message: string };

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
 * Accept a picked file and hand back a canvas holding it, no larger than
 * `maxPixels` on its longest side.
 */
export async function readImageFile(file: File, maxPixels: number): Promise<ImageReadResult> {
  if (!ACCEPTED.has(file.type)) {
    return { ok: false, message: 'Use a PNG, JPEG, WebP or GIF image.' };
  }
  if (file.size > MAX_IMAGE_BYTES) {
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

  const scale = Math.min(1, maxPixels / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return { ok: false, message: 'This device cannot process that image.' };
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return { ok: true, canvas, context };
}
