import type { QrMatrix } from '../qr/generate-matrix';
import { moduleAt } from '../qr/generate-matrix';
import { buildSculptureLayout } from './build-sculpture-layout';
import type { SculpturePoint } from './build-sculpture-layout';
import { createRng } from './rng';
import type { SculptureId, VoxelInstance, VoxelLayout } from './types';

/** One world unit per module: adjacent dark modules must touch exactly. */
export const MODULE_SPACING = 1;

export interface LayoutOptions {
  matrix: QrMatrix;
  sculpture: SculptureId;
  /** Target decorative voxel count before QR modules are accounted for. */
  sculptureCount: number;
  seed: number;
}

interface QrTarget {
  row: number;
  column: number;
  position: [number, number, number];
}

/**
 * World-space centre of a module.
 *
 * The grid is centred on the origin so the camera can always frame it by
 * distance alone, and the quiet zone is accounted for by the caller through
 * {@link VoxelLayout.qrWorldSize}.
 */
export function modulePosition(
  matrix: QrMatrix,
  row: number,
  column: number,
): [number, number, number] {
  const x = (column - matrix.size / 2 + 0.5) * MODULE_SPACING;
  const y = (matrix.size / 2 - row - 0.5) * MODULE_SPACING;
  return [x, y, 0];
}

function collectQrTargets(matrix: QrMatrix): QrTarget[] {
  const targets: QrTarget[] = [];
  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (!moduleAt(matrix, row, column)) continue;
      targets.push({ row, column, position: modulePosition(matrix, row, column) });
    }
  }
  return targets;
}

/** Angle around the origin, used to pair sculpture cubes with nearby modules. */
function angleOf(x: number, y: number): number {
  const angle = Math.atan2(y, x);
  return angle < 0 ? angle + Math.PI * 2 : angle;
}

/**
 * Build the full voxel layout: every cube gets a sculpture pose and a QR pose.
 *
 * Allocation rules (spec §10.3):
 *  - every dark module is allocated a cube first;
 *  - surplus decorative cubes are pushed outside the protected QR region and
 *    fade out rather than landing on light modules;
 *  - when the sculpture has fewer cubes than the QR needs, the shortfall starts
 *    hidden and appears during the transformation.
 */
export function buildQrLayout(options: LayoutOptions): VoxelLayout {
  const { matrix, sculpture, sculptureCount, seed } = options;
  const rng = createRng(seed ^ 0x9e3779b9);

  const qrTargets = collectQrTargets(matrix);
  const sculpturePoints = buildSculptureLayout(sculpture, { count: sculptureCount, seed });

  // Pairing by angle keeps cube paths from crossing the whole grid, which reads
  // as a gathering rather than as noise.
  const sortedTargets = [...qrTargets].sort((a, b) => {
    const angleDelta =
      angleOf(a.position[0], a.position[1]) - angleOf(b.position[0], b.position[1]);
    if (Math.abs(angleDelta) > 1e-6) return angleDelta;
    return Math.hypot(a.position[0], a.position[1]) - Math.hypot(b.position[0], b.position[1]);
  });

  const sortedPoints = [...sculpturePoints].sort((a, b) => {
    const angleDelta =
      angleOf(a.position[0], a.position[1]) - angleOf(b.position[0], b.position[1]);
    if (Math.abs(angleDelta) > 1e-6) return angleDelta;
    return Math.hypot(a.position[0], a.position[1]) - Math.hypot(b.position[0], b.position[1]);
  });

  const instances: VoxelInstance[] = [];
  const qrRadius = (matrix.total / 2) * MODULE_SPACING;

  const makeScatter = (): [number, number, number] => [
    (rng() - 0.5) * 7,
    (rng() - 0.5) * 7,
    (rng() - 0.5) * 9,
  ];

  const delayFor = (position: [number, number, number]) => {
    // Cubes closest to the centre settle first; the outline resolves last.
    const distance = Math.hypot(position[0], position[1]) / Math.max(qrRadius, 1);
    return Math.min(1, Math.max(0, distance)) * 0.55 + rng() * 0.2;
  };

  // 1. Required QR modules.
  for (let i = 0; i < sortedTargets.length; i += 1) {
    const target = sortedTargets[i] as QrTarget;
    const source: SculpturePoint | undefined = sortedPoints[i];
    const hidden = source === undefined;
    instances.push({
      sculpturePosition: source
        ? source.position
        : [target.position[0] * 0.12, target.position[1] * 0.12, 0],
      sculptureRotation: source ? source.rotation : [rng() * 3, rng() * 3, rng() * 3],
      sculptureScale: hidden ? 0 : source.scale,
      qrPosition: target.position,
      qrRotation: [0, 0, 0],
      qrScale: 1,
      colorIndex: source ? source.colorIndex : i % 4,
      delay: delayFor(target.position),
      isQrModule: true,
      scatter: makeScatter(),
    });
  }

  // 2. Surplus decorative cubes: pushed to a ring outside the quiet zone.
  for (let i = sortedTargets.length; i < sortedPoints.length; i += 1) {
    const source = sortedPoints[i] as SculpturePoint;
    const angle = angleOf(source.position[0], source.position[1]);
    const ring = qrRadius + 2.5 + rng() * 6;
    instances.push({
      sculpturePosition: source.position,
      sculptureRotation: source.rotation,
      sculptureScale: source.scale,
      qrPosition: [Math.cos(angle) * ring, Math.sin(angle) * ring, (rng() - 0.5) * 6 - 3],
      qrRotation: [rng() * 2, rng() * 2, rng() * 2],
      // Decorative cubes fade out entirely so nothing competes with the code.
      qrScale: 0,
      colorIndex: source.colorIndex,
      delay: 0.1 + rng() * 0.3,
      isQrModule: false,
      scatter: makeScatter(),
    });
  }

  return {
    instances,
    qrExtent: matrix.total,
    qrWorldSize: matrix.total * MODULE_SPACING,
    moduleSpacing: MODULE_SPACING,
  };
}
