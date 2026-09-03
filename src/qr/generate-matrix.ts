import QRCode from 'qrcode';

/**
 * Deterministic boolean module matrix for a destination URL.
 *
 * Everything downstream — voxel layout, backing texture, 2D fallback — reads this
 * one structure, so the sculpture and the canonical QR can never disagree.
 */
export interface QrMatrix {
  /** Number of modules per side, excluding the quiet zone. */
  readonly size: number;
  /** Quiet-zone width in modules, included in `total`. */
  readonly quietZone: number;
  /** `size + quietZone * 2`: the full presentation area in modules. */
  readonly total: number;
  /** Row-major dark-module flags, `size * size` entries. */
  readonly modules: readonly boolean[];
  /** The exact string encoded in the code. */
  readonly value: string;
  /** Error correction level used. */
  readonly errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
}

export const DEFAULT_QUIET_ZONE = 4;

/**
 * Error-correction levels, strongest first.
 *
 * `H` recovers 30% of a damaged code but needs the most modules; `M` recovers
 * 15% and is the usual default for print.
 */
export const ECC_LADDER = ['H', 'Q', 'M'] as const;

/**
 * Module count above which the code is stepped down the ladder.
 *
 * Redundancy protects a code that is *obscured*. Nothing obscures this one:
 * the sculpture is fully absorbed, particles have faded, and the scan plane is
 * clean. What actually limits scanning here is how many screen pixels each
 * module gets — and that is set by the module count.
 *
 * Measured with `tests/e2e/degrade.ts` (shrink a capture until it stops
 * decoding): at 33 modules a capture still decodes at a tenth of its size,
 * while a 69-module code at level H has no headroom at all. Holding the count
 * near this threshold buys back that margin, and costs redundancy the design
 * does not need.
 */
export const TARGET_MAX_MODULES = 45;

export interface GenerateMatrixOptions {
  quietZone?: number;
  /** Force a level. Omit to let the ladder pick the strongest that fits. */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  /** Override the step-down threshold; mainly for tests. */
  targetMaxModules?: number;
}

/**
 * Strongest error correction whose code still fits the module budget.
 *
 * Falls back to the weakest level on the ladder when nothing fits, which is
 * the best available answer for a very long URL.
 */
export function chooseErrorCorrectionLevel(
  value: string,
  targetMaxModules = TARGET_MAX_MODULES,
): 'M' | 'Q' | 'H' {
  let fallback: 'M' | 'Q' | 'H' = ECC_LADDER[ECC_LADDER.length - 1] as 'M';
  for (const level of ECC_LADDER) {
    const size = QRCode.create(value, { errorCorrectionLevel: level }).modules.size;
    fallback = level;
    if (size <= targetMaxModules) return level;
  }
  return fallback;
}

/**
 * Generate the module matrix locally. Never hits the network.
 *
 * @throws if the value cannot be encoded (for example, it is too long for the
 * chosen error correction level).
 */
export function generateMatrix(value: string, options: GenerateMatrixOptions = {}): QrMatrix {
  const quietZone = options.quietZone ?? DEFAULT_QUIET_ZONE;
  const errorCorrectionLevel =
    options.errorCorrectionLevel ?? chooseErrorCorrectionLevel(value, options.targetMaxModules);

  const created = QRCode.create(value, { errorCorrectionLevel });
  const size = created.modules.size;
  const data = created.modules.data;

  const modules: boolean[] = new Array(size * size);
  for (let i = 0; i < size * size; i += 1) {
    modules[i] = data[i] === 1;
  }

  return {
    size,
    quietZone,
    total: size + quietZone * 2,
    modules,
    value,
    errorCorrectionLevel,
  };
}

/** Read a module by row/column. Out-of-range coordinates read as light. */
export function moduleAt(matrix: QrMatrix, row: number, column: number): boolean {
  if (row < 0 || column < 0 || row >= matrix.size || column >= matrix.size) return false;
  return matrix.modules[row * matrix.size + column] === true;
}

/**
 * Count of dark modules — the number of voxels the QR state requires.
 *
 * Only the tests call it, to check the layout builds exactly one tile per dark
 * module. It stays here because that is a fact about a matrix, and an unused
 * export is tree-shaken out of the bundle.
 */
export function countDarkModules(matrix: QrMatrix): number {
  let count = 0;
  for (const module of matrix.modules) if (module) count += 1;
  return count;
}

/**
 * True when the module belongs to one of the three corner finder squares.
 * These are the code's identity — the one part of the pattern that can be
 * shown as decoration without exposing any data.
 */
export function isFinderModule(matrix: QrMatrix, row: number, column: number): boolean {
  const inCorner = (r0: number, c0: number) =>
    row >= r0 && row < r0 + 7 && column >= c0 && column < c0 + 7;
  return inCorner(0, 0) || inCorner(0, matrix.size - 7) || inCorner(matrix.size - 7, 0);
}

/**
 * True when the module belongs to a finder pattern (including its separator) or
 * to the timing patterns. These must never be decorated, shrunk or removed.
 */
export function isProtectedModule(matrix: QrMatrix, row: number, column: number): boolean {
  const inFinder = (r0: number, c0: number) =>
    row >= r0 - 1 && row <= r0 + 7 && column >= c0 - 1 && column <= c0 + 7;

  if (inFinder(0, 0)) return true;
  if (inFinder(0, matrix.size - 7)) return true;
  if (inFinder(matrix.size - 7, 0)) return true;
  if (row === 6 || column === 6) return true;
  return false;
}
