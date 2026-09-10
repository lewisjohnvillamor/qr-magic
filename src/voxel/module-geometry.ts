import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ShapeId } from '../qr/shapes';

/**
 * The shape a single voxel is, in 3D.
 *
 * This is the other half of {@link ShapeId}: the same four words the canvas
 * renderer turns into paths, turned here into geometry. Choosing "round" has to
 * change the thing you are looking at as well as the thing you eventually scan,
 * or it is not really an option — it is a setting that only takes effect once
 * the animation is over.
 *
 * Every geometry is a unit cube's worth of space, centred on the origin, so the
 * layout maths and the instance matrices are identical whichever is picked.
 */

/** Corner radius per shape, in units of the 1×1×1 cell. */
const RADIUS: Record<ShapeId, number> = {
  square: 0,
  semi: 0.16,
  round: 0.38,
  dot: 0.5,
};

/**
 * Triangle budget.
 *
 * A box is 12 triangles and there can be a few thousand voxels on screen, so
 * the rounded forms are kept deliberately coarse: two segments of rounding
 * reads as soft at the sizes a module is ever drawn at, and a 12×8 sphere is
 * round enough for a dot that is a few dozen pixels across at most.
 */
const ROUNDING_SEGMENTS = 2;

function createShape(shape: ShapeId): THREE.BufferGeometry {
  switch (shape) {
    case 'square':
      return new THREE.BoxGeometry(1, 1, 1);
    case 'dot':
      return new THREE.SphereGeometry(0.5, 12, 8);
    case 'semi':
    case 'round':
      return new RoundedBoxGeometry(1, 1, 1, ROUNDING_SEGMENTS, RADIUS[shape]);
  }
}

/**
 * Build the geometry for a shape, ready for instancing.
 *
 * `vertexColors` needs a colour attribute to multiply into; ones keep the
 * per-instance colour authoritative, exactly as the box always did.
 */
export function createVoxelGeometry(shape: ShapeId): THREE.BufferGeometry {
  const geometry = createShape(shape);
  const vertexCount = geometry.attributes.position?.count ?? 0;
  const colors = new Float32Array(vertexCount * 3).fill(1);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}
