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

export interface GenerateMatrixOptions {
  quietZone?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * Generate the module matrix locally. Never hits the network.
 *
 * @throws if the value cannot be encoded (for example, it is too long for the
 * chosen error correction level).
 */
export function generateMatrix(value: string, options: GenerateMatrixOptions = {}): QrMatrix {
  const quietZone = options.quietZone ?? DEFAULT_QUIET_ZONE;
  const errorCorrectionLevel = options.errorCorrectionLevel ?? 'H';

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

/** Count of dark modules — the number of voxels the QR state requires. */
export function countDarkModules(matrix: QrMatrix): number {
  let count = 0;
  for (const module of matrix.modules) if (module) count += 1;
  return count;
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
