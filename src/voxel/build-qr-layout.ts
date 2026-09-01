import type { QrMatrix } from '../qr/generate-matrix';
import { isFinderModule, moduleAt } from '../qr/generate-matrix';
import { buildSculptureLayout } from './build-sculpture-layout';
import { createRng } from './rng';
import type { SculptureId, VoxelInstance, VoxelLayout } from './types';

/** One world unit per module: adjacent dark modules must touch exactly. */
export const MODULE_SPACING = 1;

/** Raised height of a QR tile while the code is the sculpture's plinth. */
export const TILE_HEIGHT = 0.55;

/**
 * Tile height in the scan-ready state. Near zero so a tile viewed off-axis
 * from above cannot show a side face and widen its module.
 */
export const LOCK_HEIGHT = 0.04;

/** Fraction of the base's width the sculpture is scaled to occupy. */
const SCULPTURE_FOOTPRINT = 0.5;

/** Clearance between the tile tops and the lowest sculpture cube. */
const SCULPTURE_LIFT = 0.45;

export interface LayoutOptions {
  matrix: QrMatrix;
  sculpture: SculptureId;
  /** Target decorative voxel count for the sculpture standing on the base. */
  sculptureCount: number;
  seed: number;
}

/**
 * Ground position of a module's centre.
 *
 * The code lies flat in the XZ plane — it is the base the sculpture stands on,
 * finder squares visible from the very first frame — so rows map to depth and
 * columns to width, centred on the origin.
 */
export function modulePosition(
  matrix: QrMatrix,
  row: number,
  column: number,
): [number, number, number] {
  const x = (column - matrix.size / 2 + 0.5) * MODULE_SPACING;
  const z = (row - matrix.size / 2 + 0.5) * MODULE_SPACING;
  return [x, 0, z];
}

/**
 * Build the full voxel layout.
 *
 * Two kinds of cube share one `InstancedMesh`:
 *
 *  - **QR tiles** — one per dark module, always present, always in place. In
 *    the idle state they stand `TILE_HEIGHT` proud of the base plane so the
 *    code reads as a sculpted plinth; at lock they settle flush so nothing can
 *    cast or catch a shadow across a module boundary.
 *  - **Sculpture cubes** — pure decoration standing on the plinth. On reveal
 *    each one rains down into the nearest dark module and vanishes into it, so
 *    the sculpture reads as being absorbed by the code rather than replaced.
 */
export function buildQrLayout(options: LayoutOptions): VoxelLayout {
  const { matrix, sculpture, sculptureCount, seed } = options;
  const rng = createRng(seed ^ 0x9e3779b9);

  const qrWorldSize = matrix.total * MODULE_SPACING;
  const qrRadius = qrWorldSize / 2;
  const instances: VoxelInstance[] = [];

  // ---- QR tiles ----
  const darkPositions: Array<[number, number, number]> = [];
  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (!moduleAt(matrix, row, column)) continue;
      const [x, , z] = modulePosition(matrix, row, column);
      darkPositions.push([x, 0, z]);
      const ripple = Math.hypot(x, z) / Math.max(qrRadius, 1);
      // At rest only the three finder squares exist as visible relief; every
      // data tile lies flush and background-coloured — the code is a secret
      // the reveal surfaces, not something on display. Finder cubes vary in
      // height so the squares read as hand-stacked voxels, not extrusions.
      const finder = isFinderModule(matrix, row, column);
      const restHeight = finder ? TILE_HEIGHT * (0.65 + rng() * 0.75) : LOCK_HEIGHT;
      instances.push({
        sculpturePosition: [x, restHeight / 2, z],
        sculptureRotation: [0, 0, 0],
        sculptureScale: 1,
        qrPosition: [x, LOCK_HEIGHT / 2, z],
        qrRotation: [0, 0, 0],
        qrScale: 1,
        colorIndex: 0,
        // Tiles settle in a ripple travelling outward from the centre.
        delay: Math.min(1, ripple) * 0.5 + rng() * 0.1,
        isQrModule: true,
        module: [row, column],
        isFinder: finder,
        scatter: [0, 0, 0],
      });
    }
  }

  /**
   * Pedestals under the finder squares.
   *
   * The three squares are the only part of the code that exists at rest, and
   * bare rings floating on nothing read as markers rather than scenery. Each
   * one gets a small pad of decorative voxels beneath and around it, built
   * from the sculpture's own palette — earth under grass, a stone footing —
   * so the squares become three little plots belonging to the same world.
   *
   * They are decoration, not code: like every sculpture cube they fade out as
   * the reveal runs, leaving the exact modules behind.
   */
  const finderCentres: Array<[number, number]> = [
    [3, 3],
    [3, matrix.size - 4],
    [matrix.size - 4, 3],
  ];
  for (const [centreRow, centreColumn] of finderCentres) {
    for (let dr = -4; dr <= 4; dr += 1) {
      for (let dc = -4; dc <= 4; dc += 1) {
        // Nibble the corners so the pad reads as ground, not as a tile.
        const edge = Math.max(Math.abs(dr), Math.abs(dc));
        if (edge === 4 && Math.abs(dr) + Math.abs(dc) >= 7) continue;
        if (edge === 4 && rng() > 0.55) continue;
        const [x, , z] = modulePosition(matrix, centreRow + dr, centreColumn + dc);
        // Two layers: a surface course and the earth it sits on.
        for (let layer = 0; layer < 2; layer += 1) {
          const y = -0.28 - layer * 0.56;
          instances.push({
            sculpturePosition: [x, y, z],
            sculptureRotation: [0, 0, 0],
            sculptureScale: 1,
            qrPosition: [x, y, z],
            qrRotation: [0, 0, 0],
            qrScale: 0,
            colorIndex: layer === 0 ? (edge >= 3 ? 1 : 0) : 3,
            delay: 0.05 + rng() * 0.2,
            isQrModule: false,
            isPedestal: true,
            scatter: [(rng() - 0.5) * 2, rng() * 1.5, (rng() - 0.5) * 2],
          });
        }
      }
    }
  }

  // ---- Sculpture standing on the plinth ----
  const raw = buildSculptureLayout(sculpture, { count: sculptureCount, seed });

  let radiusXZ = 1e-6;
  let minY = Infinity;
  for (const point of raw) {
    radiusXZ = Math.max(radiusXZ, Math.hypot(point.position[0], point.position[2]));
    minY = Math.min(minY, point.position[1]);
  }
  // Fit the sculpture inside the code's footprint and stand it on the tiles.
  const scale = Math.min(1.6, (qrRadius * SCULPTURE_FOOTPRINT) / radiusXZ);
  const lift = TILE_HEIGHT + SCULPTURE_LIFT - minY * scale;

  const nearestDark = (x: number, z: number): [number, number, number] => {
    let best = darkPositions[0] ?? [0, 0, 0];
    let bestDistance = Infinity;
    for (const candidate of darkPositions) {
      const distance = (candidate[0] - x) ** 2 + (candidate[2] - z) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
    return best;
  };

  const sculptureTop = raw.reduce((top, p) => Math.max(top, p.position[1]), 0) * scale + lift;

  for (const point of raw) {
    const x = point.position[0] * scale;
    const y = point.position[1] * scale + lift;
    const z = point.position[2] * scale;
    const [tx, , tz] = nearestDark(x, z);
    instances.push({
      sculpturePosition: [x, y, z],
      sculptureRotation: point.rotation,
      sculptureScale: point.scale * scale,
      // Rains down into the nearest dark module and is absorbed by it.
      qrPosition: [tx, TILE_HEIGHT / 2, tz],
      qrRotation: [0, 0, 0],
      qrScale: 0,
      colorIndex: point.colorIndex,
      // Higher cubes leave later, so the sculpture peels from the ground up.
      delay: Math.min(1, Math.max(0, y / Math.max(sculptureTop, 1))) * 0.55 + rng() * 0.15,
      isQrModule: false,
      scatter: [(rng() - 0.5) * 5, rng() * 4 + 1, (rng() - 0.5) * 5],
    });
  }

  return {
    instances,
    qrExtent: matrix.total,
    qrWorldSize,
    moduleSpacing: MODULE_SPACING,
  };
}
