export const SCULPTURE_IDS = ['cube', 'crystal', 'gift', 'city', 'island', 'portal'] as const;

export type SculptureId = (typeof SCULPTURE_IDS)[number];

export interface SculptureMeta {
  id: SculptureId;
  label: string;
  hint: string;
}

export const SCULPTURES: readonly SculptureMeta[] = [
  { id: 'cube', label: 'Floating cube', hint: 'A slowly turning lattice of cubes' },
  { id: 'crystal', label: 'Crystal', hint: 'A faceted double pyramid' },
  { id: 'gift', label: 'Gift box', hint: 'A wrapped box with a ribbon and bow' },
  { id: 'city', label: 'Miniature city', hint: 'A block of towers on a plaza' },
  { id: 'island', label: 'Island', hint: 'A floating island with a small tree' },
  { id: 'portal', label: 'Abstract portal', hint: 'A ring of cubes around an open centre' },
];

export const DEFAULT_SCULPTURE: SculptureId = 'crystal';

export function isSculptureId(value: unknown): value is SculptureId {
  return typeof value === 'string' && (SCULPTURE_IDS as readonly string[]).includes(value);
}

/** One cube, with both of its lives: artistic pose and QR pose. */
export interface VoxelInstance {
  sculpturePosition: [number, number, number];
  sculptureRotation: [number, number, number];
  sculptureScale: number;
  qrPosition: [number, number, number];
  qrRotation: [number, number, number];
  qrScale: number;
  colorIndex: number;
  /** Normalized 0..1 stagger offset within the reorganization stage. */
  delay: number;
  /** True when this cube lands on a dark QR module and must be exact. */
  isQrModule: boolean;
  /** For tiles: the [row, column] of the module this cube is. */
  module?: [number, number];
  /** True for the three corner finder squares, which exist at rest. */
  isFinder?: boolean;
  /**
   * True for the decorative ground beneath a finder square. Unlike sculpture
   * cubes these stay where they are and simply fade, because they are the
   * scenery the squares sit in rather than something being absorbed.
   */
  isPedestal?: boolean;
  /** Restrained random offset used during the scatter stage. */
  scatter: [number, number, number];
}

export interface VoxelLayout {
  instances: VoxelInstance[];
  /** Module count per side including the quiet zone. */
  qrExtent: number;
  /** World-space width of the QR presentation area. */
  qrWorldSize: number;
  moduleSpacing: number;
}
