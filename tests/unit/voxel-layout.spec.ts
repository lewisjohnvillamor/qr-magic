import { describe, expect, it } from 'vitest';
import { generateMatrix, countDarkModules, moduleAt } from '../../src/qr/generate-matrix';
import { MODULE_SPACING, buildQrLayout, modulePosition } from '../../src/voxel/build-qr-layout';
import { buildSculptureLayout } from '../../src/voxel/build-sculpture-layout';
import { SCULPTURE_IDS } from '../../src/voxel/types';
import { createRng, hashString } from '../../src/voxel/rng';

const matrix = generateMatrix('https://example.com/voxelqr');

function layoutFor(sculpture: (typeof SCULPTURE_IDS)[number], count = 900) {
  return buildQrLayout({ matrix, sculpture, sculptureCount: count, seed: 1234 });
}

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('produces values in [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('hashes strings stably and distinctly', () => {
    expect(hashString('a')).toBe(hashString('a'));
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});

describe('module positions', () => {
  it('centres the grid on the origin', () => {
    const first = modulePosition(matrix, 0, 0);
    const last = modulePosition(matrix, matrix.size - 1, matrix.size - 1);
    expect(first[0]).toBeCloseTo(-last[0], 10);
    expect(first[1]).toBeCloseTo(-last[1], 10);
    expect(first[2]).toBe(0);
  });

  it('spaces adjacent modules by exactly one unit', () => {
    const a = modulePosition(matrix, 3, 3);
    const b = modulePosition(matrix, 3, 4);
    expect(b[0] - a[0]).toBeCloseTo(MODULE_SPACING, 10);
    const c = modulePosition(matrix, 4, 3);
    expect(a[1] - c[1]).toBeCloseTo(MODULE_SPACING, 10);
  });
});

describe('buildQrLayout', () => {
  it('allocates exactly one voxel per dark module', () => {
    const layout = layoutFor('crystal');
    const qrVoxels = layout.instances.filter((instance) => instance.isQrModule);
    expect(qrVoxels).toHaveLength(countDarkModules(matrix));
  });

  it('places every QR voxel on a dark module at z = 0 with scale 1', () => {
    const layout = layoutFor('crystal');
    const seen = new Set<string>();
    for (const instance of layout.instances) {
      if (!instance.isQrModule) continue;
      const [x, y, z] = instance.qrPosition;
      expect(z).toBe(0);
      expect(instance.qrScale).toBe(1);
      expect(instance.qrRotation).toEqual([0, 0, 0]);

      const column = Math.round(x / MODULE_SPACING + matrix.size / 2 - 0.5);
      const row = Math.round(matrix.size / 2 - 0.5 - y / MODULE_SPACING);
      expect(moduleAt(matrix, row, column)).toBe(true);
      const key = `${row}:${column}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(countDarkModules(matrix));
  });

  it('moves surplus decorative voxels outside the protected QR area and fades them', () => {
    const layout = buildQrLayout({
      matrix,
      sculpture: 'city',
      sculptureCount: 4000,
      seed: 9,
    });
    const decorative = layout.instances.filter((instance) => !instance.isQrModule);
    expect(decorative.length).toBeGreaterThan(0);
    const radius = (matrix.total / 2) * MODULE_SPACING;
    for (const instance of decorative) {
      expect(instance.qrScale).toBe(0);
      expect(Math.hypot(instance.qrPosition[0], instance.qrPosition[1])).toBeGreaterThan(radius);
    }
  });

  it('starts missing sculpture voxels hidden when the sculpture is smaller than the code', () => {
    const layout = buildQrLayout({ matrix, sculpture: 'crystal', sculptureCount: 40, seed: 3 });
    const hidden = layout.instances.filter((instance) => instance.sculptureScale === 0);
    expect(hidden.length).toBeGreaterThan(0);
    for (const instance of hidden) expect(instance.isQrModule).toBe(true);
  });

  it('keeps stagger delays inside the range the renderer assumes', () => {
    const layout = layoutFor('portal');
    for (const instance of layout.instances) {
      expect(instance.delay).toBeGreaterThanOrEqual(0);
      expect(instance.delay).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic for the same seed and inputs', () => {
    expect(layoutFor('island')).toEqual(layoutFor('island'));
  });

  it('reports the presentation area including the quiet zone', () => {
    const layout = layoutFor('cube');
    expect(layout.qrExtent).toBe(matrix.total);
    expect(layout.qrWorldSize).toBe(matrix.total * MODULE_SPACING);
  });
});

describe('sculptures', () => {
  it.each(SCULPTURE_IDS)('%s produces a finite, non-empty point cloud', (id) => {
    const points = buildSculptureLayout(id, { count: 900, seed: 5 });
    expect(points.length).toBeGreaterThan(100);
    for (const point of points) {
      for (const value of [...point.position, ...point.rotation, point.scale]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(point.scale).toBeGreaterThan(0);
      expect(point.colorIndex).toBeGreaterThanOrEqual(0);
      expect(point.colorIndex).toBeLessThan(4);
    }
  });

  it.each(SCULPTURE_IDS)('%s is deterministic', (id) => {
    expect(buildSculptureLayout(id, { count: 600, seed: 11 })).toEqual(
      buildSculptureLayout(id, { count: 600, seed: 11 }),
    );
  });

  it.each(SCULPTURE_IDS)('%s stays within a sane bounding radius', (id) => {
    const points = buildSculptureLayout(id, { count: 1400, seed: 2 });
    for (const point of points) {
      expect(Math.hypot(...point.position)).toBeLessThan(40);
    }
  });
});
