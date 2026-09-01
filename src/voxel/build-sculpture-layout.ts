import type { SculptureId } from './types';
import { createRng } from './rng';

export interface SculpturePoint {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  colorIndex: number;
}

export interface SculptureOptions {
  /** Target number of cubes. Quality tiers scale this down. */
  count: number;
  seed: number;
}

type Builder = (options: SculptureOptions) => SculpturePoint[];

const TAU = Math.PI * 2;

function point(
  position: [number, number, number],
  colorIndex: number,
  rotation: [number, number, number] = [0, 0, 0],
  scale = 1,
): SculpturePoint {
  return { position, rotation, scale, colorIndex };
}

/**
 * Floating cube — a hollow lattice shell so the silhouette reads as a cube
 * without wasting voxels on an invisible interior.
 */
const buildCube: Builder = ({ count, seed }) => {
  const rng = createRng(seed);
  const points: SculpturePoint[] = [];
  const side = Math.max(4, Math.round(Math.cbrt(count * 1.6)));
  const half = (side - 1) / 2;
  const gap = 1.05;

  for (let x = 0; x < side; x += 1) {
    for (let y = 0; y < side; y += 1) {
      for (let z = 0; z < side; z += 1) {
        const onShell =
          x === 0 || y === 0 || z === 0 || x === side - 1 || y === side - 1 || z === side - 1;
        if (!onShell) continue;
        // Carve a sparse pattern so the shell breathes rather than reading as a solid box.
        if ((x + y + z) % 2 === 1 && rng() > 0.35) continue;
        points.push(
          point(
            [(x - half) * gap, (y - half) * gap, (z - half) * gap],
            (x + y + z) % 4,
            [0, 0, 0],
            0.92 + rng() * 0.12,
          ),
        );
      }
    }
  }
  return points;
};

/** Crystal — two stacked pyramids, densest at the waist. */
const buildCrystal: Builder = ({ count, seed }) => {
  const rng = createRng(seed);
  const points: SculpturePoint[] = [];
  const layers = Math.max(10, Math.round(Math.sqrt(count) * 0.75));
  const waist = layers / 2;

  for (let layer = 0; layer < layers; layer += 1) {
    const t = layer / (layers - 1);
    // Widest at the waist, tapering to a point at both tips.
    const radius = (1 - Math.abs(t - 0.5) * 2) * layers * 0.3 + 0.8;
    const y = (layer - waist) * 0.98;
    const ring = Math.max(4, Math.round(radius * 5));
    for (let i = 0; i < ring; i += 1) {
      const angle = (i / ring) * TAU + layer * 0.19;
      const jitter = 0.9 + rng() * 0.2;
      points.push(
        point(
          [Math.cos(angle) * radius * jitter, y, Math.sin(angle) * radius * jitter],
          // Offsetting by the ring index breaks up horizontal colour banding.
          (layer * 2 + i) % 4,
          [0, angle, 0],
          0.8 + (1 - Math.abs(t - 0.5) * 2) * 0.35,
        ),
      );
    }
  }
  return points;
};

/** Gift box — walls, a cross ribbon and a small bow. */
const buildGift: Builder = ({ count, seed }) => {
  const rng = createRng(seed);
  const points: SculpturePoint[] = [];
  const side = Math.max(5, Math.round(Math.cbrt(count * 1.9)));
  const half = (side - 1) / 2;
  const gap = 1.02;

  for (let x = 0; x < side; x += 1) {
    for (let y = 0; y < side; y += 1) {
      for (let z = 0; z < side; z += 1) {
        const onShell =
          x === 0 || y === 0 || z === 0 || x === side - 1 || y === side - 1 || z === side - 1;
        if (!onShell) continue;
        const onRibbon = x === Math.round(half) || z === Math.round(half);
        if (!onRibbon && (x + y + z) % 3 === 1 && rng() > 0.55) continue;
        points.push(
          point(
            [(x - half) * gap, (y - half) * gap, (z - half) * gap],
            onRibbon ? 2 : (x + z) % 2,
            [0, 0, 0],
            onRibbon ? 1.02 : 0.95,
          ),
        );
      }
    }
  }

  // Bow: two small loops on top.
  const top = half * gap + 0.9;
  for (let i = 0; i < 14; i += 1) {
    const angle = (i / 14) * TAU;
    const r = 1.15;
    points.push(
      point([Math.cos(angle) * r - 0.9, top + Math.sin(angle) * 0.5, 0], 2, [0, 0, angle], 0.6),
    );
    points.push(
      point([Math.cos(angle) * r + 0.9, top + Math.sin(angle) * 0.5, 0], 2, [0, 0, angle], 0.6),
    );
  }
  return points;
};

/** Miniature city — a plaza of towers of varying height. */
const buildCity: Builder = ({ count, seed }) => {
  const rng = createRng(seed);
  const points: SculpturePoint[] = [];
  const grid = Math.max(6, Math.round(Math.sqrt(count / 4)));
  const half = (grid - 1) / 2;
  const gap = 1.25;

  for (let x = 0; x < grid; x += 1) {
    for (let z = 0; z < grid; z += 1) {
      const distance = Math.hypot(x - half, z - half) / half;
      // Plaza floor.
      points.push(point([(x - half) * gap, -3.2, (z - half) * gap], 3, [0, 0, 0], 1.12));
      if (rng() > 0.82) continue; // streets
      const height = Math.max(1, Math.round((1 - distance) * 7 * (0.45 + rng() * 0.85)));
      for (let y = 0; y < height; y += 1) {
        points.push(
          point([(x - half) * gap, -2.6 + y * 0.95, (z - half) * gap], y % 3, [0, 0, 0], 0.9),
        );
      }
    }
  }
  return points;
};

/** Island — a tapered landmass with a small tree on top. */
const buildIsland: Builder = ({ count, seed }) => {
  const rng = createRng(seed);
  const points: SculpturePoint[] = [];
  const radius = Math.max(4, Math.sqrt(count / 7));
  const gap = 1.05;

  for (let y = 0; y < 6; y += 1) {
    const layerRadius = radius * (1 - y * 0.15);
    for (let x = -Math.ceil(layerRadius); x <= Math.ceil(layerRadius); x += 1) {
      for (let z = -Math.ceil(layerRadius); z <= Math.ceil(layerRadius); z += 1) {
        const d = Math.hypot(x, z);
        if (d > layerRadius) continue;
        // Underside tapers to a point.
        if (y > 1 && d > layerRadius - (y - 1) * 1.4) continue;
        points.push(point([x * gap, -y * gap - 0.5, z * gap], y === 0 ? 1 : 3, [0, 0, 0], 0.98));
      }
    }
  }

  // Trunk and canopy.
  for (let y = 0; y < 4; y += 1) {
    points.push(point([0, 0.6 + y * 0.95, 0], 3, [0, 0, 0], 0.7));
  }
  for (let i = 0; i < 46; i += 1) {
    const theta = rng() * TAU;
    const phi = Math.acos(2 * rng() - 1);
    const r = 1.5 + rng() * 0.9;
    points.push(
      point(
        [
          Math.sin(phi) * Math.cos(theta) * r,
          4.6 + Math.cos(phi) * r * 0.8,
          Math.sin(phi) * Math.sin(theta) * r,
        ],
        i % 2,
        [rng() * 0.6, rng() * 0.6, 0],
        0.8 + rng() * 0.3,
      ),
    );
  }
  return points;
};

/**
 * Abstract portal — an upright torus with an open centre.
 *
 * The ring stands in the XY plane so the viewer looks through it rather than
 * down onto it, and so its silhouette already resembles the QR plane it becomes.
 */
const buildPortal: Builder = ({ count, seed }) => {
  const rng = createRng(seed);
  const points: SculpturePoint[] = [];
  const majorRadius = 6;
  const rings = Math.max(28, Math.round(count / 9));

  for (let i = 0; i < rings; i += 1) {
    const angle = (i / rings) * TAU;
    for (let j = 0; j < 9; j += 1) {
      const tubeAngle = (j / 9) * TAU + i * 0.3;
      const tube = 1.25 + rng() * 0.35;
      const r = majorRadius + Math.cos(tubeAngle) * tube;
      points.push(
        point(
          [Math.cos(angle) * r, Math.sin(angle) * r, Math.sin(tubeAngle) * tube],
          (i + j) % 4,
          [tubeAngle, 0, angle],
          0.75 + rng() * 0.35,
        ),
      );
    }
  }

  // A few drifting satellites orbiting the ring's plane.
  for (let i = 0; i < 24; i += 1) {
    const angle = rng() * TAU;
    const r = majorRadius + 2.2 + rng() * 2;
    points.push(
      point(
        [Math.cos(angle) * r, Math.sin(angle) * r, (rng() - 0.5) * 5],
        2,
        [rng(), rng(), rng()],
        0.5 + rng() * 0.4,
      ),
    );
  }
  return points;
};

const BUILDERS: Record<SculptureId, Builder> = {
  cube: buildCube,
  crystal: buildCrystal,
  gift: buildGift,
  city: buildCity,
  island: buildIsland,
  portal: buildPortal,
};

/**
 * Build the artistic pose for a sculpture. Deterministic for a given
 * `(id, count, seed)` triple.
 */
export function buildSculptureLayout(id: SculptureId, options: SculptureOptions): SculpturePoint[] {
  const builder = BUILDERS[id] ?? BUILDERS.crystal;
  return builder(options);
}
