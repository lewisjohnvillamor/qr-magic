import type { QrMatrix } from './generate-matrix';
import { moduleAt } from './generate-matrix';

export interface DrawOptions {
  foreground: string;
  background: string;
  /** Device pixels per QR module. Rounded to an integer so edges stay crisp. */
  modulePixels?: number;
  /** Optional per-module colour (the mosaic look). Falls back to `foreground`. */
  moduleColor?: (row: number, column: number) => string;
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
      if (options.moduleColor) context.fillStyle = options.moduleColor(row, column);
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
