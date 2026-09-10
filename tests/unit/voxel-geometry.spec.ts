import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createVoxelGeometry } from '../../src/voxel/module-geometry';
import { SHAPE_IDS } from '../../src/qr/shapes';

describe('createVoxelGeometry', () => {
  it('gives every shape its own form, so the model changes as well as the code', () => {
    const geometries = SHAPE_IDS.map((shape) => createVoxelGeometry(shape));
    // A shape option that left the geometry alone would be a setting that only
    // takes effect once the animation is over — which is not the option asked
    // for. Vertex counts are not enough to tell them apart (`semi` and `round`
    // are the same mesh at two radii), so the positions themselves are compared.
    const forms = geometries.map((geometry) =>
      Array.from((geometry.attributes.position?.array ?? []) as Float32Array)
        .map((value) => value.toFixed(4))
        .join(','),
    );
    expect(new Set(forms).size).toBe(SHAPE_IDS.length);
    for (const geometry of geometries) geometry.dispose();
  });

  it('carries the colour attribute instancing multiplies into', () => {
    for (const shape of SHAPE_IDS) {
      const geometry = createVoxelGeometry(shape);
      const colors = geometry.attributes.color;
      expect(colors).toBeInstanceOf(THREE.BufferAttribute);
      expect(colors?.count).toBe(geometry.attributes.position?.count);
      // Ones, so the per-instance colour stays authoritative.
      expect(Array.from((colors?.array ?? []) as Float32Array).every((v) => v === 1)).toBe(true);
      geometry.dispose();
    }
  });

  it('keeps every shape inside the one-unit cell the layout assumes', () => {
    for (const shape of SHAPE_IDS) {
      const geometry = createVoxelGeometry(shape);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox as THREE.Box3;
      const size = box.getSize(new THREE.Vector3());
      // Within a rounding error of a unit cube, centred on the origin: the
      // instance matrices are shared, so a shape that measured differently
      // would sit off its own module.
      expect(size.x).toBeCloseTo(1, 5);
      expect(size.y).toBeCloseTo(1, 5);
      expect(size.z).toBeCloseTo(1, 5);
      expect(box.getCenter(new THREE.Vector3()).length()).toBeCloseTo(0, 5);
      geometry.dispose();
    }
  });
});
