import type { SculpturePoint } from './build-sculpture-layout';
import { createRng } from './rng';

/**
 * A picture, turned into a thing that stands in the scene.
 *
 * The interesting problem is not "put a cube where each pixel is" — that gives
 * a flat card with a brick where the background used to be. It is deciding
 * which pixels are *the subject*, how deep the subject should be, and how to
 * spend a fixed cube budget on both. Each of those is a judgement this module
 * makes explicitly rather than leaving to whatever the image happens to be.
 *
 * Everything here is pure and works on plain arrays, so it can be tested
 * without a canvas — which matters, because the failure modes are all about
 * pixel arithmetic and none of them are about the DOM.
 */

/** Row-major RGBA, four bytes per pixel. The shape `getImageData` returns. */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface ImageSculptureOptions {
  /** Cube budget. The grid is coarsened until the result fits inside it. */
  count: number;
  seed: number;
  /** Longest side of the voxel grid, before the budget is applied. */
  resolution?: number;
}

/**
 * Longest side of the grid.
 *
 * Past this the voxels are smaller than the eye resolves at the size the
 * sculpture is drawn, and the budget is spent on detail nobody sees at the cost
 * of a silhouette that reads.
 */
export const MAX_RESOLUTION = 56;

/** Below this a picture stops being recognisable at all. */
export const MIN_RESOLUTION = 10;

/** Alpha below this counts as nothing there. */
export const ALPHA_THRESHOLD = 96;

/**
 * How close a cell must be to the border colour to count as background.
 *
 * Euclidean distance in RGB, out of a possible 441. Generous enough to absorb
 * JPEG noise and a soft vignette, tight enough that a pale subject on white
 * survives.
 */
export const BACKGROUND_TOLERANCE = 42;

/**
 * Fraction of the border the commonest colour must hold before it is believed
 * to be the background.
 *
 * A photograph's border is all over the place and no colour comes close, so it
 * gets no removal — which is right, every part of it is the subject. A logo's
 * border is one flat colour and clears this easily even when the subject runs
 * off the edge of the frame.
 */
export const BORDER_DOMINANCE = 0.55;

/** Channel width of the buckets the border is counted in. */
const BUCKET = 24;

/** Deepest a subject is extruded, in cubes. */
export const MAX_DEPTH = 4;

/**
 * Depth the grid is chosen to afford.
 *
 * The budget can be spent on resolution or on depth, and spending it all on
 * resolution gives a picture one cube thick: seen from the side it is a line,
 * and the reveal — where the sculpture turns before it comes apart — shows a
 * card rather than an object. A coarser grid that is genuinely solid reads as a
 * thing standing on the code, which is the point of the feature.
 */
export const TARGET_DEPTH = 3;

interface Cell {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Average each grid cell over the pixels it covers.
 *
 * Box-sampled rather than point-sampled: a single sample per cell picks up
 * whatever pixel happens to land under it, which turns a thin outline into a
 * dashed one and makes the whole result flicker as the resolution changes.
 * Colour is weighted by alpha so a mostly-transparent cell is not dragged
 * toward whatever colour its invisible pixels happen to carry.
 */
export function sampleGrid(image: RgbaImage, columns: number, rows: number): Cell[] {
  const cells: Cell[] = new Array(columns * rows);
  for (let row = 0; row < rows; row += 1) {
    const y0 = Math.floor((row * image.height) / rows);
    const y1 = Math.max(y0 + 1, Math.floor(((row + 1) * image.height) / rows));
    for (let column = 0; column < columns; column += 1) {
      const x0 = Math.floor((column * image.width) / columns);
      const x1 = Math.max(x0 + 1, Math.floor(((column + 1) * image.width) / columns));

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let weight = 0;
      let pixels = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * image.width + x) * 4;
          const alpha = image.data[i + 3] ?? 0;
          r += (image.data[i] ?? 0) * alpha;
          g += (image.data[i + 1] ?? 0) * alpha;
          b += (image.data[i + 2] ?? 0) * alpha;
          a += alpha;
          weight += alpha;
          pixels += 1;
        }
      }
      cells[row * columns + column] =
        weight > 0
          ? { r: r / weight, g: g / weight, b: b / weight, a: a / Math.max(1, pixels) }
          : { r: 0, g: 0, b: 0, a: 0 };
    }
  }
  return cells;
}

function distance(a: Cell, b: Cell): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

/**
 * The colour the picture is sitting *on*, if it is sitting on one.
 *
 * Taken from the border, because that is the one region a subject almost never
 * occupies, and only believed when most of the border agrees with itself. A
 * photograph edge-to-edge has no such colour and keeps every pixel — which is
 * right: there is no background to remove, the whole frame is the subject.
 */
export function detectBackground(columns: number, rows: number, cells: Cell[]): Cell | null {
  const border: Cell[] = [];
  for (let column = 0; column < columns; column += 1) {
    const top = cells[column];
    const bottom = cells[(rows - 1) * columns + column];
    if (top) border.push(top);
    if (bottom) border.push(bottom);
  }
  for (let row = 1; row < rows - 1; row += 1) {
    const left = cells[row * columns];
    const right = cells[row * columns + columns - 1];
    if (left) border.push(left);
    if (right) border.push(right);
  }
  if (border.length === 0) return null;

  // A fully transparent border is its own answer: the alpha test already
  // removes those cells, and there is no colour to compare against.
  const opaque = border.filter((cell) => cell.a >= ALPHA_THRESHOLD);
  if (opaque.length === 0) return null;

  /**
   * The commonest border colour, not the average one.
   *
   * Averaging assumes the subject stays clear of the frame, and plenty of
   * pictures — a logo cropped to its own bounding box, most of all — run
   * straight off the edge. A few dozen subject pixels then drag the mean into
   * no-man's-land, nothing matches it, and the whole picture comes back as a
   * solid slab with the background still attached. Counting instead means the
   * subject has to *outnumber* the background around the edge before detection
   * gives up, which is a much better description of "there is no background".
   */
  const buckets = new Map<string, Cell[]>();
  for (const cell of opaque) {
    const key = [cell.r, cell.g, cell.b].map((v) => Math.round(v / BUCKET)).join(':');
    const bucket = buckets.get(key);
    if (bucket) bucket.push(cell);
    else buckets.set(key, [cell]);
  }

  let largest: Cell[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.length > largest.length) largest = bucket;
  }
  if (largest.length / opaque.length < BORDER_DOMINANCE) return null;

  // The bucket's own mean, so the comparison colour is the real shade rather
  // than the middle of whatever range the bucketing happened to draw.
  return largest.reduce(
    (total, cell) => ({
      r: total.r + cell.r / largest.length,
      g: total.g + cell.g / largest.length,
      b: total.b + cell.b / largest.length,
      a: 255,
    }),
    { r: 0, g: 0, b: 0, a: 255 },
  );
}

function toHex(r: number, g: number, b: number): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Relative luminance, 0..1, for deciding how far a cell stands out. */
function luminance(cell: Cell): number {
  return (0.2126 * cell.r + 0.7152 * cell.g + 0.0722 * cell.b) / 255;
}

/**
 * Turn a picture into a sculpture.
 *
 * Deterministic for a given `(image, count, seed)`: the same upload always
 * produces the same object, which is the same promise every built-in sculpture
 * makes and the reason a reload does not reshuffle someone's logo.
 */
export function imageToSculpture(
  image: RgbaImage,
  options: ImageSculptureOptions,
): SculpturePoint[] {
  if (image.width < 1 || image.height < 1) return [];

  const rng = createRng(options.seed ^ 0x5bf03635);
  const budget = Math.max(64, options.count);
  const longest = Math.max(
    MIN_RESOLUTION,
    Math.min(options.resolution ?? MAX_RESOLUTION, MAX_RESOLUTION),
  );

  /**
   * Coarsen until the subject fits the budget.
   *
   * The alternative — sample once and drop cubes to fit — thins the subject
   * evenly and turns a solid shape into a screen door. Fewer, larger cubes keep
   * the silhouette, which is the whole point of the thing.
   */
  let columns = 0;
  let rows = 0;
  let cells: Cell[] = [];
  let kept: number[] = [];
  /** The finest grid that at least fits, if none affords the target depth. */
  let fallback: { columns: number; rows: number; cells: Cell[]; kept: number[] } | null = null;

  for (let side = longest; side >= MIN_RESOLUTION; side = Math.floor(side * 0.8)) {
    const aspect = image.width / image.height;
    columns = Math.max(1, aspect >= 1 ? side : Math.round(side * aspect));
    rows = Math.max(1, aspect >= 1 ? Math.round(side / aspect) : side);
    cells = sampleGrid(image, columns, rows);
    const background = detectBackground(columns, rows, cells);

    kept = [];
    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      if (!cell || cell.a < ALPHA_THRESHOLD) continue;
      if (background && distance(cell, background) <= BACKGROUND_TOLERANCE) continue;
      kept.push(i);
    }

    // A picture with nothing left is a picture whose subject *is* the border
    // colour. Keep everything opaque rather than returning an empty sculpture.
    if (kept.length === 0) {
      kept = cells.reduce<number[]>((list, cell, i) => {
        if (cell && cell.a >= ALPHA_THRESHOLD) list.push(i);
        return list;
      }, []);
    }
    if (kept.length === 0) continue;

    if (kept.length * TARGET_DEPTH <= budget) break;
    if (!fallback && kept.length <= budget) {
      fallback = { columns, rows, cells, kept };
    }
  }

  // Nothing afforded the target depth, so take the finest grid that fit at all.
  if (kept.length * TARGET_DEPTH > budget && fallback) {
    ({ columns, rows, cells, kept } = fallback);
  }

  if (kept.length === 0) return [];

  // Cells are cheap once the grid fits, so the leftover budget buys depth — the
  // same trade the monogram makes, and what stops a picture reading as a decal
  // floating in mid-air.
  const depth = Math.max(1, Math.min(MAX_DEPTH, Math.floor(budget / kept.length)));
  const halfDepth = (depth - 1) / 2;
  const gap = 1.02;

  const points: SculpturePoint[] = [];
  for (const index of kept) {
    const cell = cells[index];
    if (!cell) continue;
    const row = Math.floor(index / columns);
    const column = index % columns;
    const face = toHex(cell.r, cell.g, cell.b);
    // Sides are the same colour in shadow. Lighting alone does not separate
    // them convincingly at this scale, and a face and its own flank in two
    // unrelated colours reads as noise rather than as depth.
    const flank = toHex(cell.r * 0.62, cell.g * 0.62, cell.b * 0.62);
    // Brighter parts of the picture stand a little further forward, so the
    // relief carries some of the image's own modelling instead of being a slab.
    const relief = depth > 1 ? Math.round(luminance(cell) * (depth - 1) * 0.5) : 0;

    for (let z = 0; z < depth; z += 1) {
      points.push({
        position: [
          (column - (columns - 1) / 2) * gap,
          // Row 0 is the top of the picture, so the grid is flipped to stand it
          // up rather than on its head.
          (rows - 1 - row - (rows - 1) / 2) * gap,
          (z - halfDepth + relief) * gap,
        ],
        rotation: [0, 0, 0],
        scale: 0.94 + rng() * 0.08,
        colorIndex: 0,
        color: z === depth - 1 ? face : flank,
      });
    }
  }

  return points;
}
