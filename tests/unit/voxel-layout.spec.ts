import { describe, expect, it } from 'vitest';
import {
  generateMatrix,
  countDarkModules,
  isFinderModule,
  moduleAt,
} from '../../src/qr/generate-matrix';
import {
  LOCK_HEIGHT,
  MODULE_SPACING,
  TILE_HEIGHT,
  buildQrLayout,
  modulePosition,
} from '../../src/voxel/build-qr-layout';
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
  it('centres the grid on the origin, flat in the ground plane', () => {
    const first = modulePosition(matrix, 0, 0);
    const last = modulePosition(matrix, matrix.size - 1, matrix.size - 1);
    expect(first[0]).toBeCloseTo(-last[0], 10);
    expect(first[2]).toBeCloseTo(-last[2], 10);
    expect(first[1]).toBe(0);
  });

  it('spaces adjacent modules by exactly one unit', () => {
    const a = modulePosition(matrix, 3, 3);
    const b = modulePosition(matrix, 3, 4);
    expect(b[0] - a[0]).toBeCloseTo(MODULE_SPACING, 10);
    const c = modulePosition(matrix, 4, 3);
    expect(c[2] - a[2]).toBeCloseTo(MODULE_SPACING, 10);
  });
});

describe('buildQrLayout', () => {
  it('allocates exactly one tile per dark module, present in both states', () => {
    const layout = layoutFor('crystal');
    const tiles = layout.instances.filter((instance) => instance.isQrModule);
    expect(tiles).toHaveLength(countDarkModules(matrix));
    for (const tile of tiles) {
      expect(tile.sculptureScale).toBe(1);
      expect(tile.qrScale).toBe(1);
    }
  });

  it('places every tile on a dark module of the ground grid', () => {
    const layout = layoutFor('crystal');
    const seen = new Set<string>();
    for (const instance of layout.instances) {
      if (!instance.isQrModule) continue;
      const [x, sy, z] = instance.sculpturePosition;
      const [qx, qy, qz] = instance.qrPosition;
      // Tiles never move in plan — they only settle (or surface) in height.
      expect(qx).toBe(x);
      expect(qz).toBe(z);
      expect(qy).toBeCloseTo(LOCK_HEIGHT / 2, 10);
      expect(instance.qrRotation).toEqual([0, 0, 0]);

      const column = Math.round(x / MODULE_SPACING + matrix.size / 2 - 0.5);
      const row = Math.round(z / MODULE_SPACING + matrix.size / 2 - 0.5);
      // Only the three finder squares exist as relief at rest; data tiles lie
      // flush so the resting base gives none of the code away.
      if (isFinderModule(matrix, row, column)) {
        expect(sy).toBeCloseTo(TILE_HEIGHT / 2, 10);
      } else {
        expect(sy).toBeCloseTo(LOCK_HEIGHT / 2, 10);
      }
      expect(moduleAt(matrix, row, column)).toBe(true);
      const key = `${row}:${column}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(countDarkModules(matrix));
  });

  it('stands the sculpture on the plinth, inside the code footprint', () => {
    const layout = layoutFor('city', 1400);
    const qrRadius = layout.qrWorldSize / 2;
    const decorative = layout.instances.filter((instance) => !instance.isQrModule);
    expect(decorative.length).toBeGreaterThan(100);
    for (const instance of decorative) {
      const [x, y, z] = instance.sculpturePosition;
      expect(y).toBeGreaterThan(TILE_HEIGHT - 1e-9);
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(qrRadius * 0.75);
    }
  });

  it('sends every sculpture cube into a dark module and fades it out', () => {
    const layout = layoutFor('island');
    for (const instance of layout.instances) {
      if (instance.isQrModule) continue;
      expect(instance.qrScale).toBe(0);
      const [x, y, z] = instance.qrPosition;
      expect(y).toBeCloseTo(TILE_HEIGHT / 2, 10);
      const column = Math.round(x / MODULE_SPACING + matrix.size / 2 - 0.5);
      const row = Math.round(z / MODULE_SPACING + matrix.size / 2 - 0.5);
      expect(moduleAt(matrix, row, column)).toBe(true);
    }
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
