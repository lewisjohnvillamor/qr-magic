/**
 * Module and corner shapes, shared by both renderings.
 *
 * There are two completely separate drawings of the same matrix in this app —
 * the canvas the scanner reads, and the voxels the eye watches — and a shape
 * option is only honest if it changes both. So the shape vocabulary lives here,
 * in one module that neither renderer owns, and each of them translates it into
 * its own medium: a path in 2D, a geometry in 3D.
 *
 * Shape is a real scanning risk, so the vocabulary is deliberately narrow.
 * `round` and `semi` only round the corners a module does not share with a dark
 * neighbour, so a run of modules stays one solid bar — the thing a decoder
 * actually samples. Only `dot` detaches modules from each other, and it is the
 * one shape that buys back its margin with a forced error-correction floor.
 */

export const SHAPE_IDS = ['square', 'semi', 'round', 'dot'] as const;

export type ShapeId = (typeof SHAPE_IDS)[number];

export interface ShapeMeta {
  id: ShapeId;
  label: string;
  hint: string;
}

export const MODULE_SHAPES: readonly ShapeMeta[] = [
  { id: 'square', label: 'Square', hint: 'The classic code; the sharpest to scan' },
  { id: 'semi', label: 'Semi-round', hint: 'Softened corners, still joined edge to edge' },
  { id: 'round', label: 'Round', hint: 'Fully rounded, flowing into its neighbours' },
  { id: 'dot', label: 'Dots', hint: 'Separate dots; needs the strongest correction' },
];

export const CORNER_SHAPES: readonly ShapeMeta[] = [
  { id: 'square', label: 'Square', hint: 'Square finder rings' },
  { id: 'semi', label: 'Semi-round', hint: 'Slightly softened finder rings' },
  { id: 'round', label: 'Round', hint: 'Rounded finder rings' },
  { id: 'dot', label: 'Circle', hint: 'Circular finder rings and eyes' },
];

export const DEFAULT_MODULE_SHAPE: ShapeId = 'square';
export const DEFAULT_CORNER_SHAPE: ShapeId = 'square';

export function isShapeId(value: unknown): value is ShapeId {
  return typeof value === 'string' && (SHAPE_IDS as readonly string[]).includes(value);
}

/**
 * Corner radius of one module, as a fraction of the module's width.
 *
 * `dot` is a half-width radius on a square, which is a circle.
 */
export const MODULE_RADIUS: Record<ShapeId, number> = {
  square: 0,
  semi: 0.22,
  round: 0.5,
  dot: 0.5,
};

/**
 * True when a module is drawn on its own rather than merged into the run it
 * belongs to. Only dots detach — and only dots pay for it in error correction.
 */
export function isDetached(shape: ShapeId): boolean {
  return shape === 'dot';
}

/**
 * Fraction of its cell a detached module fills.
 *
 * Below 1 so neighbouring dots read as separate; not far below, because every
 * percent removed is dark area a camera has to resolve.
 */
export const DOT_FILL = 0.9;

/** Corner radius of a finder ring, as a fraction of the ring's own side. */
export const CORNER_RADIUS: Record<ShapeId, number> = {
  square: 0,
  semi: 0.16,
  round: 0.32,
  dot: 0.5,
};

/**
 * Weakest error correction a shape may run at.
 *
 * Detached dots throw away the corners of every module, which is exactly the
 * kind of uniform erosion error correction exists to absorb — so a dotted code
 * is pinned to `Q` and never steps down the ladder for size.
 */
export function minimumEccFor(moduleShape: ShapeId): 'M' | 'Q' | 'H' | null {
  return isDetached(moduleShape) ? 'Q' : null;
}
