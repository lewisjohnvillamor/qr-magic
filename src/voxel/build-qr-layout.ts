import type { QrMatrix } from '../qr/generate-matrix';
import { moduleAt } from '../qr/generate-matrix';
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
      instances.push({
        sculpturePosition: [x, TILE_HEIGHT / 2, z],
        sculptureRotation: [0, 0, 0],
        sculptureScale: 1,
        qrPosition: [x, LOCK_HEIGHT / 2, z],
        qrRotation: [0, 0, 0],
        qrScale: 1,
        colorIndex: 0,
        // Tiles settle in a ripple travelling outward from the centre.
        delay: Math.min(1, ripple) * 0.5 + rng() * 0.1,
        isQrModule: true,
        scatter: [0, 0, 0],
      });
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
