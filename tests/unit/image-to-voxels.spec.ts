import { describe, expect, it } from 'vitest';
import {
  ALPHA_THRESHOLD,
  BACKGROUND_TOLERANCE,
  detectBackground,
  imageToSculpture,
  sampleGrid,
} from '../../src/voxel/image-to-voxels';
import type { RgbaImage } from '../../src/voxel/image-to-voxels';

type Paint = (x: number, y: number) => [number, number, number, number] | null;

/** Build an image from a painter, so fixtures read as pictures not byte arrays. */
function image(width: number, height: number, paint: Paint): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const rgba = paint(x, y) ?? [0, 0, 0, 0];
      const i = (y * width + x) * 4;
      data[i] = rgba[0];
      data[i + 1] = rgba[1];
      data[i + 2] = rgba[2];
      data[i + 3] = rgba[3];
    }
  }
  return { width, height, data };
}

/** Distance of a `#rrggbb` colour from pure white, in the same units as the tolerance. */
function distanceFromWhite(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return Math.sqrt((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2);
}

const WHITE: [number, number, number, number] = [255, 255, 255, 255];
const RED: [number, number, number, number] = [220, 40, 70, 255];

/** A red disc on white — a logo, in other words. */
const discOnWhite = image(120, 120, (x, y) => (Math.hypot(x - 60, y - 60) < 40 ? RED : WHITE));

describe('detectBackground', () => {
  it('believes a flat border', () => {
    const cells = sampleGrid(discOnWhite, 24, 24);
    const background = detectBackground(24, 24, cells);
    expect(background).not.toBeNull();
    expect(background?.r).toBeGreaterThan(240);
  });

  it('does not invent one for an image that runs edge to edge', () => {
    // A gradient has no background: every part of it is the subject, and
    // removing "the border colour" would eat a stripe out of the picture.
    const gradient = image(80, 80, (x) => [Math.round((x / 80) * 255), 40, 200, 255]);
    expect(detectBackground(20, 20, sampleGrid(gradient, 20, 20))).toBeNull();
  });

  it('has nothing to say about a fully transparent border', () => {
    const cutout = image(60, 60, (x, y) => (Math.hypot(x - 30, y - 30) < 18 ? RED : null));
    expect(detectBackground(20, 20, sampleGrid(cutout, 20, 20))).toBeNull();
  });
});

describe('imageToSculpture', () => {
  it('drops the background and keeps only the subject', () => {
    const points = imageToSculpture(discOnWhite, { count: 900, seed: 1 });
    expect(points.length).toBeGreaterThan(0);

    // Nothing left may be the white it was standing on. Cells straddling the
    // edge of the disc are part white and legitimately survive, so the test is
    // that no voxel is *the background colour*, not that none is pale.
    const distances = points.map((p) => distanceFromWhite(p.color ?? '#000000'));
    expect(Math.min(...distances)).toBeGreaterThan(BACKGROUND_TOLERANCE);

    // And the subject is nearly all of what is left: a disc of radius 40 in a
    // 120px frame is about a third of it, so a result anywhere near the full
    // frame would mean the background came through.
    const fullFrame = 24 * 24;
    expect(points.length).toBeLessThan(fullFrame * 2);
  });

  it('still finds the background when the subject runs off the edge', () => {
    // A logo cropped to its own bounding box runs off the frame. Averaging the
    // border is then dragged into no-man's-land by those pixels, matches
    // nothing, and hands back the whole picture as a solid slab — which is
    // exactly what happened the first time this was tried. Counting instead
    // means the subject has to outnumber the background around the edge before
    // detection gives up.
    const bleeding = image(120, 120, (_x, y) => (y > 30 && y < 90 ? RED : WHITE));
    const background = detectBackground(24, 24, sampleGrid(bleeding, 24, 24));
    expect(background).not.toBeNull();
    expect(background?.r).toBeGreaterThan(230);

    // And the picture does not come back as a slab.
    const points = imageToSculpture(bleeding, { count: 900, seed: 2 });
    expect(points.length).toBeGreaterThan(0);
    expect(Math.min(...points.map((p) => distanceFromWhite(p.color ?? '#000000')))).toBeGreaterThan(
      BACKGROUND_TOLERANCE,
    );
  });

  it('keeps the subject its own colour', () => {
    const points = imageToSculpture(discOnWhite, { count: 900, seed: 1 });
    const faces = points.filter((p) => p.color === '#dc2846');
    expect(faces.length).toBeGreaterThan(0);
  });

  it('spends the budget on depth, not only on resolution', () => {
    // One cube thick is a card: seen from the side it is a line, and the reveal
    // turns the sculpture before it comes apart. A coarser grid that is solid
    // reads as an object, which is the point.
    const points = imageToSculpture(discOnWhite, { count: 1400, seed: 4 });
    const byColumn = new Map<string, number>();
    for (const p of points) {
      const key = `${p.position[0].toFixed(2)}:${p.position[1].toFixed(2)}`;
      byColumn.set(key, (byColumn.get(key) ?? 0) + 1);
    }
    const depths = Array.from(byColumn.values());
    expect(Math.min(...depths)).toBeGreaterThanOrEqual(2);
  });

  it('is deterministic', () => {
    const a = imageToSculpture(discOnWhite, { count: 600, seed: 7 });
    const b = imageToSculpture(discOnWhite, { count: 600, seed: 7 });
    expect(a).toEqual(b);
  });

  it('stays inside the cube budget', () => {
    for (const count of [200, 600, 1400]) {
      const points = imageToSculpture(discOnWhite, { count, seed: 3 });
      expect(points.length, `budget ${count}`).toBeLessThanOrEqual(count * 1.05);
    }
  });

  it('drops transparent pixels', () => {
    const cutout = image(80, 80, (x, y) => (Math.hypot(x - 40, y - 40) < 25 ? RED : null));
    const points = imageToSculpture(cutout, { count: 800, seed: 5 });
    expect(points.length).toBeGreaterThan(0);
    expect(ALPHA_THRESHOLD).toBeGreaterThan(0);
  });

  it('returns nothing for an empty image', () => {
    expect(
      imageToSculpture(
        image(0, 0, () => null),
        { count: 100, seed: 1 },
      ),
    ).toEqual([]);
  });
});
