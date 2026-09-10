import type { QrMatrix } from './generate-matrix';
import { isFinderModule, moduleAt } from './generate-matrix';
import { logoModuleSpan, LOGO_RATIO } from './logo';
import { CORNER_RADIUS, DOT_FILL, MODULE_RADIUS, isDetached } from './shapes';
import type { ShapeId } from './shapes';

export interface LogoOptions {
  /** A decoded image. Anything `drawImage` accepts. */
  image: CanvasImageSource;
  /** Width of the logo box as a fraction of the code's width. */
  ratio?: number;
}

export interface DrawOptions {
  foreground: string;
  background: string;
  /** Device pixels per QR module. Rounded to an integer so edges stay crisp. */
  modulePixels?: number;
  /** Optional per-module colour (the mosaic look). Falls back to `foreground`. */
  moduleColor?: (row: number, column: number) => string;
  /** Shape of an ordinary data module. Defaults to a plain square. */
  moduleShape?: ShapeId;
  /** Shape of the three corner finder rings. Defaults to a plain square. */
  cornerShape?: ShapeId;
  /** Image to place in the middle. Requires level H — see `generateMatrix`. */
  logo?: LogoOptions | null;
}

/**
 * A rounded square, given per-corner radii.
 *
 * Hand-rolled from `arcTo` rather than `roundRect`, which is recent enough that
 * a headless renderer or an older WebView can be missing it — and a missing
 * method here means a code that does not draw at all.
 */
function roundedPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radii: [number, number, number, number],
): void {
  const limit = Math.min(width, height) / 2;
  const [tl, tr, br, bl] = radii.map((radius) => Math.max(0, Math.min(radius, limit))) as [
    number,
    number,
    number,
    number,
  ];
  context.beginPath();
  context.moveTo(x + tl, y);
  context.lineTo(x + width - tr, y);
  context.arcTo(x + width, y, x + width, y + tr, tr);
  context.lineTo(x + width, y + height - br);
  context.arcTo(x + width, y + height, x + width - br, y + height, br);
  context.lineTo(x + bl, y + height);
  context.arcTo(x, y + height, x, y + height - bl, bl);
  context.lineTo(x, y + tl);
  context.arcTo(x, y, x + tl, y, tl);
  context.closePath();
}

function fillRounded(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  side: number,
  radius: number,
): void {
  if (radius <= 0) {
    context.fillRect(x, y, side, side);
    return;
  }
  roundedPath(context, x, y, side, side, [radius, radius, radius, radius]);
  context.fill();
}

/**
 * One data module, rounded only where it has nothing to join to.
 *
 * This is the whole reason `round` is safe. A decoder samples the middle of a
 * module and cares most that a run of dark modules reads as one unbroken bar;
 * rounding a corner that touches a dark neighbour would cut a notch into that
 * bar. So a corner is only softened when both of the modules that meet there
 * are light, and a solid block of modules comes out with a rounded outline and
 * a completely solid interior.
 */
function fillDataModule(
  context: CanvasRenderingContext2D,
  matrix: QrMatrix,
  row: number,
  column: number,
  x: number,
  y: number,
  size: number,
  shape: ShapeId,
): void {
  if (shape === 'square') {
    context.fillRect(x, y, size, size);
    return;
  }

  if (isDetached(shape)) {
    const inset = (size * (1 - DOT_FILL)) / 2;
    const side = size - inset * 2;
    fillRounded(context, x + inset, y + inset, side, side / 2);
    return;
  }

  const radius = MODULE_RADIUS[shape] * size;
  const up = moduleAt(matrix, row - 1, column);
  const down = moduleAt(matrix, row + 1, column);
  const left = moduleAt(matrix, row, column - 1);
  const right = moduleAt(matrix, row, column + 1);
  roundedPath(context, x, y, size, size, [
    up || left ? 0 : radius,
    up || right ? 0 : radius,
    down || right ? 0 : radius,
    down || left ? 0 : radius,
  ]);
  context.fill();
}

/**
 * One finder pattern: a 7-module ring with a 3-module eye.
 *
 * Drawn as three shapes rather than 33 modules, because the corner shape is a
 * property of the ring, not of the modules inside it. The topology a detector
 * looks for — dark, light, dark in a 1:1:3:1:1 ratio through the centre — is
 * preserved exactly at every radius, including the circle.
 */
function fillFinder(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  shape: ShapeId,
  ink: string,
  background: string,
): void {
  const radius = CORNER_RADIUS[shape];
  context.fillStyle = ink;
  fillRounded(context, x, y, size * 7, radius * size * 7);
  context.fillStyle = background;
  fillRounded(context, x + size, y + size, size * 5, radius * size * 5);
  context.fillStyle = ink;
  fillRounded(context, x + size * 2, y + size * 2, size * 3, radius * size * 3);
}

/**
 * Draw the mathematically exact QR — quiet zone included — into a 2D context.
 *
 * Integer module sizes are non-negotiable: fractional module widths produce
 * anti-aliased module boundaries, which is the single most common cause of a
 * "beautiful but unscannable" code.
 *
 * With the default square module and square corners this produces exactly the
 * same pixels it always has; every shape branch below is opt-in.
 */
export function drawCanonicalQr(
  context: CanvasRenderingContext2D,
  matrix: QrMatrix,
  options: DrawOptions,
): { pixelSize: number; modulePixels: number } {
  const moduleShape = options.moduleShape ?? 'square';
  const cornerShape = options.cornerShape ?? 'square';
  const modulePixels = Math.max(1, Math.round(options.modulePixels ?? 8));
  const pixelSize = matrix.total * modulePixels;

  context.canvas.width = pixelSize;
  context.canvas.height = pixelSize;
  context.imageSmoothingEnabled = false;

  context.fillStyle = options.background;
  context.fillRect(0, 0, pixelSize, pixelSize);

  /**
   * The finder rings are drawn whole as soon as *anything* is shaped.
   *
   * They can only stay in the module loop while both shapes are square, where
   * the loop already draws them correctly and each ring keeps its own
   * per-module mosaic colour — so the untouched default stays byte-for-byte
   * what it was before shapes existed.
   *
   * The moment the module shape is not square they have to leave it, and that
   * is not cosmetic. Letting `dot` reach a finder module draws the ring as 33
   * separate circles, which destroys the 1:1:3:1:1 dark-light-dark ratio a
   * detector scans for: the code then fails to decode at all, whatever the
   * data modules look like. This was caught by the decode matrix rather than by
   * eye, because a dotted finder square still looks like a finder square.
   */
  const shapedCorners = cornerShape !== 'square' || moduleShape !== 'square';

  context.fillStyle = options.foreground;
  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (!moduleAt(matrix, row, column)) continue;
      if (shapedCorners && isFinderModule(matrix, row, column)) continue;
      if (options.moduleColor) context.fillStyle = options.moduleColor(row, column);
      fillDataModule(
        context,
        matrix,
        row,
        column,
        (column + matrix.quietZone) * modulePixels,
        (row + matrix.quietZone) * modulePixels,
        modulePixels,
        moduleShape,
      );
    }
  }

  if (shapedCorners) {
    const corners: Array<[number, number]> = [
      [0, 0],
      [0, matrix.size - 7],
      [matrix.size - 7, 0],
    ];
    for (const [row, column] of corners) {
      // One colour for the whole ring, sampled at its centre. Every structural
      // module is pinned to the same luminance anyway, so this costs nothing a
      // scanner can measure.
      const ink = options.moduleColor?.(row + 3, column + 3) ?? options.foreground;
      fillFinder(
        context,
        (column + matrix.quietZone) * modulePixels,
        (row + matrix.quietZone) * modulePixels,
        modulePixels,
        cornerShape,
        ink,
        options.background,
      );
    }
  }

  if (options.logo) drawLogo(context, matrix, modulePixels, options.logo, options.background);

  return { pixelSize, modulePixels };
}

/**
 * Place the logo, on its own quiet pad.
 *
 * The pad matters as much as the cap: dropping a picture straight onto modules
 * leaves its edge pixels reading as half-modules, and a detector that finds a
 * damaged module is in a worse position than one that finds a clean light area
 * and lets error correction fill it in. So a background square one module
 * larger than the logo is cleared first, and the logo is fitted inside it.
 *
 * Everything here snaps to whole modules, so the code around the logo keeps its
 * exact grid.
 */
function drawLogo(
  context: CanvasRenderingContext2D,
  matrix: QrMatrix,
  modulePixels: number,
  logo: LogoOptions,
  background: string,
): void {
  const span = logoModuleSpan(matrix.size, logo.ratio ?? LOGO_RATIO);
  const padded = span + 2;
  const origin = (matrix.total - padded) / 2;
  const x = Math.round(origin) * modulePixels;
  const y = Math.round(origin) * modulePixels;
  const side = padded * modulePixels;

  context.fillStyle = background;
  context.fillRect(x, y, side, side);

  const inner = span * modulePixels;
  const image = logo.image;
  const width = imageWidth(image);
  const height = imageHeight(image);
  if (width <= 0 || height <= 0) return;

  // Contain rather than cover: a cropped logo is worse than a smaller one, and
  // growing past the pad would eat modules the cap was chosen to protect.
  const scale = Math.min(inner / width, inner / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  context.imageSmoothingEnabled = true;
  context.drawImage(
    image,
    x + modulePixels + (inner - drawWidth) / 2,
    y + modulePixels + (inner - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  context.imageSmoothingEnabled = false;
}

function imageWidth(image: CanvasImageSource): number {
  if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) {
    return image.naturalWidth || image.width;
  }
  const sized = image as { width?: number | SVGAnimatedLength };
  return typeof sized.width === 'number' ? sized.width : 0;
}

function imageHeight(image: CanvasImageSource): number {
  if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) {
    return image.naturalHeight || image.height;
  }
  const sized = image as { height?: number | SVGAnimatedLength };
  return typeof sized.height === 'number' ? sized.height : 0;
}
