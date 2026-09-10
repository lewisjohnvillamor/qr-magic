import { describe, expect, it } from 'vitest';
import { SHAPE_IDS, isDetached, isShapeId, minimumEccFor } from '../../src/qr/shapes';
import { buildMatrix, minimumEcc } from '../../src/qr/build-matrix';
import { logoCoverage, logoModuleSpan, MAX_LOGO_RATIO } from '../../src/qr/logo';
import { MAX_PAYLOAD_LENGTH } from '../../src/qr/payloads';
import { drawCanonicalQr } from '../../src/qr/draw-canonical';
import { generateMatrix, isFinderModule, moduleAt } from '../../src/qr/generate-matrix';

const VALUE = 'https://example.com/shapes';

/**
 * A context that records what was asked of it.
 *
 * jsdom has no 2D canvas, and these tests are not about pixels anyway — they
 * are about which drawing calls each shape makes, which is exactly what decides
 * whether a module ends up square, rounded or detached.
 */
function recordingContext() {
  const rects: number[][] = [];
  const fills: string[] = [];
  const arcs: number[] = [];
  let images = 0;
  const context = {
    canvas: { width: 0, height: 0 },
    fillRect: (...args: number[]) => rects.push(args),
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arcTo: (...args: number[]) => arcs.push(args[4] ?? 0),
    fill: () => fills.push('path'),
    drawImage: () => {
      images += 1;
    },
    set fillStyle(_value: string) {},
    set imageSmoothingEnabled(_value: boolean) {},
  };
  return {
    context: context as unknown as CanvasRenderingContext2D,
    rects,
    fills,
    arcs,
    images: () => images,
  };
}

describe('shape vocabulary', () => {
  it('recognises exactly its own ids', () => {
    for (const id of SHAPE_IDS) expect(isShapeId(id)).toBe(true);
    expect(isShapeId('hexagon')).toBe(false);
    expect(isShapeId(null)).toBe(false);
  });

  it('detaches dots and nothing else', () => {
    expect(isDetached('dot')).toBe(true);
    expect(isDetached('round')).toBe(false);
    expect(isDetached('semi')).toBe(false);
    expect(isDetached('square')).toBe(false);
  });
});

describe('error correction floors', () => {
  it('leaves an ordinary square code free to step down the ladder', () => {
    expect(minimumEccFor('square')).toBeNull();
    expect(minimumEcc({ value: VALUE, moduleShape: 'square', hasLogo: false })).toBeUndefined();
  });

  it('pins a dotted code to Q, because dots erode every module', () => {
    expect(minimumEcc({ value: VALUE, moduleShape: 'dot', hasLogo: false })).toBe('Q');
    const built = buildMatrix({ value: VALUE, moduleShape: 'dot', hasLogo: false });
    expect(built.ok && ['Q', 'H']).toContain(built.ok && built.matrix.errorCorrectionLevel);
  });

  it('pins a logoed code to H, whatever else is set', () => {
    expect(minimumEcc({ value: VALUE, moduleShape: 'square', hasLogo: true })).toBe('H');
    const built = buildMatrix({ value: VALUE, moduleShape: 'square', hasLogo: true });
    expect(built.ok && built.matrix.errorCorrectionLevel).toBe('H');
  });

  it('can raise the floor for any value the app will accept', () => {
    // Level H holds 1,273 bytes at the largest version and nothing longer than
    // MAX_PAYLOAD_LENGTH ever reaches here, so raising the floor never costs
    // someone their code. The guard in `buildMatrix` stays as a guard: this is
    // the reason it should not fire, not a reason to drop it.
    const longest = `https://example.com/${'a'.repeat(MAX_PAYLOAD_LENGTH - 20)}`;
    expect(longest.length).toBe(MAX_PAYLOAD_LENGTH);
    const built = buildMatrix({ value: longest, moduleShape: 'dot', hasLogo: true });
    expect(built.ok).toBe(true);
    expect(built.ok && built.matrix.errorCorrectionLevel).toBe('H');
  });
});

describe('logo bounds', () => {
  it('keeps the covered area far inside what level H can recover', () => {
    for (const size of [21, 25, 29, 33, 41, 45]) {
      const span = logoModuleSpan(size);
      expect(span % 2).toBe(1);
      expect(span).toBeGreaterThanOrEqual(3);
      // Level H recovers 30%. The pad is counted in, and the result still has
      // to leave the great majority of that budget for the camera.
      expect(logoCoverage(size, span)).toBeLessThan(0.1);
    }
  });

  it('never exceeds the cap, however large a ratio is asked for', () => {
    const size = 41;
    expect(logoModuleSpan(size, 0.9)).toBeLessThanOrEqual(Math.floor(size * MAX_LOGO_RATIO) | 1);
  });
});

function darkCount(matrix: ReturnType<typeof generateMatrix>): number {
  let count = 0;
  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (moduleAt(matrix, row, column)) count += 1;
    }
  }
  return count;
}

function finderDarkCount(matrix: ReturnType<typeof generateMatrix>): number {
  let count = 0;
  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (moduleAt(matrix, row, column) && isFinderModule(matrix, row, column)) count += 1;
    }
  }
  return count;
}

describe('drawCanonicalQr shapes', () => {
  const matrix = generateMatrix(VALUE);

  it('draws a plain square code with exactly one rect per dark module', () => {
    const { context, rects, fills } = recordingContext();
    drawCanonicalQr(context, matrix, { foreground: '#000', background: '#fff' });
    // One background fill plus one per module, and no paths at all: the default
    // output is the same drawing it always was.
    expect(rects.length).toBe(darkCount(matrix) + 1);
    expect(fills.length).toBe(0);
  });

  it('never lets a detached shape reach a finder ring', () => {
    // Drawing a finder as 33 separate dots destroys the 1:1:3:1:1 ratio a
    // detector scans for, and the code stops decoding entirely. The rings
    // therefore leave the module loop as soon as the module shape is not
    // square, whatever the corner shape is set to. This was caught by the
    // decode matrix rather than by eye: a dotted finder square still looks
    // like a finder square.
    const { context, rects, fills } = recordingContext();
    drawCanonicalQr(context, matrix, {
      foreground: '#000',
      background: '#fff',
      moduleShape: 'dot',
      cornerShape: 'square',
    });
    // Every data module is a path. The only rects left are the background and
    // the three square rings, which a zero radius draws as plain fills.
    expect(rects.length).toBe(1 + 9);
    expect(fills.length).toBe(darkCount(matrix) - finderDarkCount(matrix));
  });

  it('draws every module as a path once a shape is chosen', () => {
    const { context, rects, fills } = recordingContext();
    drawCanonicalQr(context, matrix, {
      foreground: '#000',
      background: '#fff',
      moduleShape: 'round',
    });
    expect(rects.length).toBe(1 + 9);
    expect(fills.length).toBe(darkCount(matrix) - finderDarkCount(matrix));
  });

  it('keeps a run of modules solid by rounding only free corners', () => {
    // A corner shared with a dark neighbour must be square, or the unbroken
    // bar a decoder samples gets a notch cut out of it. A real code has both
    // kinds of corner in quantity, so both radii have to appear.
    const { context, arcs } = recordingContext();
    drawCanonicalQr(context, matrix, {
      foreground: '#000',
      background: '#fff',
      moduleShape: 'round',
    });
    expect(arcs.some((radius) => radius === 0)).toBe(true);
    expect(arcs.some((radius) => radius > 0)).toBe(true);
  });

  it('draws shaped finder rings whole instead of module by module', () => {
    const plain = recordingContext();
    drawCanonicalQr(plain.context, matrix, { foreground: '#000', background: '#fff' });

    const shaped = recordingContext();
    drawCanonicalQr(shaped.context, matrix, {
      foreground: '#000',
      background: '#fff',
      cornerShape: 'round',
    });

    let finderModules = 0;
    for (let row = 0; row < matrix.size; row += 1) {
      for (let column = 0; column < matrix.size; column += 1) {
        if (moduleAt(matrix, row, column) && isFinderModule(matrix, row, column))
          finderModules += 1;
      }
    }
    expect(finderModules).toBeGreaterThan(0);
    // The finder modules leave the rect loop, and three rings of three shapes
    // each arrive as paths in their place.
    expect(shaped.rects.length).toBe(plain.rects.length - finderModules);
    expect(shaped.fills.length).toBe(9);
  });

  it('clears a pad before placing a logo, so its edge never lands mid-module', () => {
    const { context, rects, images } = recordingContext();
    const logoMatrix = generateMatrix(VALUE, { errorCorrectionLevel: 'H' });
    drawCanonicalQr(context, logoMatrix, {
      foreground: '#000',
      background: '#fff',
      modulePixels: 8,
      logo: { image: { width: 100, height: 50 } as unknown as CanvasImageSource },
    });
    expect(images()).toBe(1);
    const pad = rects[rects.length - 1] ?? [];
    const span = logoModuleSpan(logoMatrix.size);
    expect(pad[2]).toBe((span + 2) * 8);
    // Snapped to whole modules in both axes.
    expect((pad[0] ?? 0) % 8).toBe(0);
    expect((pad[1] ?? 0) % 8).toBe(0);
  });
});
