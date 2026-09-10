import { generateMatrix } from './generate-matrix';
import type { QrMatrix } from './generate-matrix';
import { minimumEccFor } from './shapes';
import type { ShapeId } from './shapes';

/**
 * Everything about a code that changes the matrix itself.
 *
 * Colour and sculpture do not appear here, because they cannot alter a single
 * module. Shape and logo can: both take dark area away, and error correction is
 * the only thing that gives it back.
 */
export interface CodeConfig {
  value: string;
  moduleShape: ShapeId;
  hasLogo: boolean;
}

export type MatrixResult = { ok: true; matrix: QrMatrix } | { ok: false; message: string };

/**
 * The floor this configuration must not step below.
 *
 * A logo pins the code to `H` outright — 30% recovery against a covered area
 * capped at roughly 5% is the margin that makes a logo safe rather than lucky.
 * Dotted modules pin it to `Q`. With neither, the ladder is free to trade
 * redundancy for a lower module count as it always has.
 */
export function minimumEcc(config: CodeConfig): 'M' | 'Q' | 'H' | undefined {
  if (config.hasLogo) return 'H';
  return minimumEccFor(config.moduleShape) ?? undefined;
}

/**
 * Build the matrix for a configuration, or say why it cannot be built.
 *
 * The failure is real and worth naming: a long value that encodes comfortably
 * at level M may have no version at all at level H, so adding a logo to a long
 * link can genuinely fail. Reporting that beats silently dropping the floor and
 * handing back a code the logo would break.
 */
export function buildMatrix(config: CodeConfig): MatrixResult {
  const floor = minimumEcc(config);
  try {
    return {
      ok: true,
      matrix: generateMatrix(config.value, floor ? { minimumErrorCorrectionLevel: floor } : {}),
    };
  } catch {
    if (config.hasLogo) {
      return {
        ok: false,
        message:
          'That is too long to encode with a logo in the middle. Shorten it, or remove the logo.',
      };
    }
    return { ok: false, message: 'That is too long to encode as a QR code.' };
  }
}
