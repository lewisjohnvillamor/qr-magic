import { describe, expect, it } from 'vitest';
import {
  countDarkModules,
  generateMatrix,
  isProtectedModule,
  moduleAt,
} from '../../src/qr/generate-matrix';

const URL = 'https://example.com/voxelqr';

describe('generateMatrix', () => {
  it('produces a square matrix with the requested quiet zone', () => {
    const matrix = generateMatrix(URL);
    expect(matrix.modules).toHaveLength(matrix.size * matrix.size);
    expect(matrix.quietZone).toBe(4);
    expect(matrix.total).toBe(matrix.size + 8);
    expect(matrix.errorCorrectionLevel).toBe('H');
  });

  it('is deterministic for the same input', () => {
    expect(generateMatrix(URL).modules).toEqual(generateMatrix(URL).modules);
  });

  it('changes when the destination changes', () => {
    expect(generateMatrix(URL).modules).not.toEqual(generateMatrix(`${URL}/other`).modules);
  });

  it('renders the three finder patterns as dark 7x7 blocks', () => {
    const matrix = generateMatrix(URL);
    const corners: Array<[number, number]> = [
      [0, 0],
      [0, matrix.size - 7],
      [matrix.size - 7, 0],
    ];
    for (const [r0, c0] of corners) {
      for (let r = 0; r < 7; r += 1) {
        for (let c = 0; c < 7; c += 1) {
          const onRing = r === 0 || c === 0 || r === 6 || c === 6;
          const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          expect(moduleAt(matrix, r0 + r, c0 + c)).toBe(onRing || inCore);
        }
      }
    }
  });

  it('reads out-of-range coordinates as light', () => {
    const matrix = generateMatrix(URL);
    expect(moduleAt(matrix, -1, 0)).toBe(false);
    expect(moduleAt(matrix, matrix.size, 0)).toBe(false);
  });

  it('counts a plausible number of dark modules', () => {
    const matrix = generateMatrix(URL);
    const dark = countDarkModules(matrix);
    expect(dark).toBeGreaterThan(matrix.size * matrix.size * 0.3);
    expect(dark).toBeLessThan(matrix.size * matrix.size * 0.7);
  });

  it('marks finder and timing modules as protected', () => {
    const matrix = generateMatrix(URL);
    expect(isProtectedModule(matrix, 3, 3)).toBe(true);
    expect(isProtectedModule(matrix, 6, 12)).toBe(true);
    expect(isProtectedModule(matrix, matrix.size - 3, matrix.size - 3)).toBe(false);
  });

  it('throws for a value that cannot be encoded', () => {
    expect(() => generateMatrix('x'.repeat(20000))).toThrow();
  });
});
