import { readImageFile } from '../lib/image-file';
import { hashString } from './rng';
import { imageToSculpture } from './image-to-voxels';
import type { SculpturePoint } from './build-sculpture-layout';

/**
 * Longest side the picture is sampled from.
 *
 * Larger than the voxel grid on purpose: each cell averages the pixels under
 * it, so having several to average is what keeps a thin outline solid instead
 * of dashed. Much larger than this and the extra pixels are averaged away
 * anyway, at the cost of holding a big bitmap in memory.
 */
export const SCULPTURE_MAX_PIXELS = 320;

/** Longest side of the thumbnail shown back to whoever uploaded it. */
const PREVIEW_PIXELS = 96;

export interface CustomSculpture {
  /** The file's own name, so the chip says which picture this is. */
  name: string;
  /** A small thumbnail, for the drawer. */
  preview: string;
  /** The built sculpture. Lives in memory only — it never leaves the device. */
  points: SculpturePoint[];
}

export type SculptureFileResult =
  { ok: true; sculpture: CustomSculpture } | { ok: false; message: string };

/**
 * Turn a picked file into a sculpture the scene can stand on the code.
 *
 * The conversion happens once, here, rather than inside the layout builder:
 * that runs again on every link, theme and quality change, and re-reading a
 * bitmap each time would be a stutter for no gain.
 */
export async function readSculptureFile(
  file: File,
  options: { count: number },
): Promise<SculptureFileResult> {
  const read = await readImageFile(file, SCULPTURE_MAX_PIXELS);
  if (!read.ok) return read;

  const { canvas, context } = read;
  let pixels: ImageData;
  try {
    pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return { ok: false, message: 'That image could not be read on this device.' };
  }

  const points = imageToSculpture(pixels, {
    count: options.count,
    // Seeded from the picture itself, so the same upload always builds the same
    // object — the promise every built-in sculpture makes.
    seed: hashString(`${file.name}:${canvas.width}x${canvas.height}:${file.size}`),
  });

  if (points.length === 0) {
    return { ok: false, message: 'That image came out empty. Try one with more contrast.' };
  }

  let preview: string;
  try {
    preview = toThumbnail(canvas);
  } catch {
    return { ok: false, message: 'That image could not be used here.' };
  }

  return { ok: true, sculpture: { name: file.name, preview, points } };
}

function toThumbnail(source: HTMLCanvasElement): string {
  const scale = Math.min(1, PREVIEW_PIXELS / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2d context');
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}
