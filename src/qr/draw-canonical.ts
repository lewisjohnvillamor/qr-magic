import type { QrMatrix } from './generate-matrix';
import { moduleAt } from './generate-matrix';

export interface DrawOptions {
  foreground: string;
  background: string;
  /** Device pixels per QR module. Rounded to an integer so edges stay crisp. */
  modulePixels?: number;
}

/**
 * Draw the mathematically exact QR — quiet zone included — into a 2D context.
 *
 * Integer module sizes are non-negotiable: fractional module widths produce
 * anti-aliased module boundaries, which is the single most common cause of a
 * "beautiful but unscannable" code.
 */
export function drawCanonicalQr(
  context: CanvasRenderingContext2D,
  matrix: QrMatrix,
  options: DrawOptions,
): { pixelSize: number; modulePixels: number } {
  const modulePixels = Math.max(1, Math.round(options.modulePixels ?? 8));
  const pixelSize = matrix.total * modulePixels;

  context.canvas.width = pixelSize;
  context.canvas.height = pixelSize;
  context.imageSmoothingEnabled = false;

  context.fillStyle = options.background;
  context.fillRect(0, 0, pixelSize, pixelSize);

  context.fillStyle = options.foreground;
  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (!moduleAt(matrix, row, column)) continue;
      context.fillRect(
        (column + matrix.quietZone) * modulePixels,
        (row + matrix.quietZone) * modulePixels,
        modulePixels,
        modulePixels,
      );
    }
  }

  return { pixelSize, modulePixels };
}

/** Render the canonical QR to a detached canvas, sized to fit `targetPixels`. */
export function renderCanonicalQrCanvas(
  matrix: QrMatrix,
  options: DrawOptions & { targetPixels?: number },
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas context unavailable');

  const modulePixels =
    options.modulePixels ?? Math.max(2, Math.floor((options.targetPixels ?? 512) / matrix.total));

  drawCanonicalQr(context, matrix, { ...options, modulePixels });
  return canvas;
}
