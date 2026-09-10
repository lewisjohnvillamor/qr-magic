import { create } from 'zustand';
import { buildMatrix } from '../qr/build-matrix';
import { generateMatrix } from '../qr/generate-matrix';
import type { QrMatrix } from '../qr/generate-matrix';
import {
  DEFAULT_PAYLOAD_KIND,
  createDraft,
  describePayload,
  draftFor,
  encodePayload,
  isPayloadKind,
} from '../qr/payloads';
import type { PayloadDraft, PayloadKind } from '../qr/payloads';
import { DEFAULT_CORNER_SHAPE, DEFAULT_MODULE_SHAPE, isShapeId, isDetached } from '../qr/shapes';
import type { ShapeId } from '../qr/shapes';
import { DEFAULT_SCULPTURE, isSculptureId } from '../voxel/types';
import type { SculptureId } from '../voxel/types';
import { DEFAULT_THEME, isThemeId } from '../themes/themes';
import type { ThemeId } from '../themes/themes';
import type { QualityLevel } from '../lib/quality';
import { detectQualityLevel, readDeviceHints } from '../lib/quality';
import { buildShareUrl, readExperienceFromSearch } from '../sharing/share-codec';

export const DEFAULT_URL = 'https://voxelqr.example/hello';

/** Where the experience is in the reveal choreography. */
export type Phase = 'sculpture' | 'revealing' | 'scan-ready' | 'returning';

export type CommitResult = { ok: true; value: string } | { ok: false; message: string };

export interface ExperienceState {
  /** What kind of thing the code carries. */
  payloadKind: PayloadKind;
  /** Every field of every kind, so switching kinds never loses typing. */
  draft: PayloadDraft;
  /** The exact string currently encoded. */
  value: string;
  valueError: string | null;
  valueIsDense: boolean;

  sculpture: SculptureId;
  theme: ThemeId;
  moduleShape: ShapeId;
  cornerShape: ShapeId;
  /** Centre logo as a self-contained PNG data URL, or null. */
  logo: string | null;

  quality: QualityLevel;
  reducedMotion: boolean;
  muted: boolean;

  phase: Phase;
  /** Message queued for the ARIA live region. */
  announcement: string;

  matrix: QrMatrix;

  setDraftField: (key: string, value: string) => void;
  setPayloadKind: (kind: PayloadKind) => void;
  commitPayload: () => CommitResult;
  setSculpture: (id: SculptureId) => void;
  setTheme: (id: ThemeId) => void;
  setModuleShape: (id: ShapeId) => void;
  setCornerShape: (id: ShapeId) => void;
  setLogo: (dataUrl: string | null) => void;
  setReducedMotion: (reduced: boolean) => void;
  toggleMuted: () => void;
  shareUrl: (origin: string, options?: { readOnly?: boolean }) => string;
  /** One line describing what the code carries, for the viewer panel. */
  describe: () => string;
}

function safeMatrix(value: string, moduleShape: ShapeId, hasLogo: boolean): QrMatrix {
  const result = buildMatrix({ value, moduleShape, hasLogo });
  return result.ok ? result.matrix : generateMatrix(DEFAULT_URL);
}

/** Read the initial experience from the address bar, falling back to defaults. */
export function readInitialExperience(search: string) {
  const decoded = readExperienceFromSearch(search);
  if (!decoded.ok) {
    return {
      value: DEFAULT_URL,
      kind: DEFAULT_PAYLOAD_KIND,
      draft: createDraft(DEFAULT_URL),
      sculpture: DEFAULT_SCULPTURE,
      theme: DEFAULT_THEME,
      moduleShape: DEFAULT_MODULE_SHAPE,
      cornerShape: DEFAULT_CORNER_SHAPE,
      failed: decoded.reason !== 'missing',
    };
  }
  const { payload } = decoded;
  const kind = isPayloadKind(payload.kind) ? payload.kind : DEFAULT_PAYLOAD_KIND;
  return {
    value: payload.url,
    kind,
    draft: { ...createDraft(kind === 'url' ? payload.url : DEFAULT_URL), ...(payload.f ?? {}) },
    sculpture: isSculptureId(payload.sculpture) ? payload.sculpture : DEFAULT_SCULPTURE,
    theme: isThemeId(payload.theme) ? payload.theme : DEFAULT_THEME,
    moduleShape: isShapeId(payload.module) ? payload.module : DEFAULT_MODULE_SHAPE,
    cornerShape: isShapeId(payload.corner) ? payload.corner : DEFAULT_CORNER_SHAPE,
    failed: false,
  };
}

export const createExperienceStore = (search = '') => {
  const initial = readInitialExperience(search);
  const hints = readDeviceHints();

  return create<ExperienceState>()((set, get) => {
    /**
     * Rebuild the matrix after something that changes its shape budget.
     *
     * Module shape and the logo are not decoration: dots erode every module and
     * a logo deletes a patch of them, and both are answered by moving the error
     * correction floor — which changes the matrix, and can fail outright on a
     * long value. So every one of those settings comes back through here rather
     * than quietly leaving a matrix that no longer matches the code being drawn.
     */
    const reconfigure = (next: { moduleShape?: ShapeId; logo?: string | null }) => {
      const state = get();
      const moduleShape = next.moduleShape ?? state.moduleShape;
      const logo = next.logo === undefined ? state.logo : next.logo;
      const result = buildMatrix({ value: state.value, moduleShape, hasLogo: Boolean(logo) });
      if (!result.ok) {
        set({ announcement: result.message, valueError: result.message });
        return;
      }
      set({
        moduleShape,
        logo,
        matrix: result.matrix,
        valueError: null,
        announcement:
          next.logo !== undefined
            ? next.logo
              ? 'Logo added. The code now uses the strongest error correction.'
              : 'Logo removed.'
            : isDetached(moduleShape)
              ? 'Dot modules. The code now uses stronger error correction to stay scannable.'
              : 'Module shape updated.',
      });
    };

    return {
      payloadKind: initial.kind,
      draft: initial.draft,
      value: initial.value,
      valueError: null,
      valueIsDense: initial.value.length > 300,

      sculpture: initial.sculpture,
      theme: initial.theme,
      moduleShape: initial.moduleShape,
      cornerShape: initial.cornerShape,
      logo: null,

      quality: detectQualityLevel(hints),
      reducedMotion: false,
      muted: true,

      phase: 'sculpture',
      announcement: initial.failed
        ? 'That shared link could not be read, so the default experience was loaded.'
        : '',

      matrix: safeMatrix(initial.value, initial.moduleShape, false),

      setDraftField: (key, value) =>
        set((state) => ({ draft: { ...state.draft, [key]: value }, valueError: null })),

      setPayloadKind: (kind) => set({ payloadKind: kind, valueError: null }),

      commitPayload: () => {
        const state = get();
        const encoded = encodePayload(state.payloadKind, state.draft);
        if (!encoded.ok) {
          set({ valueError: encoded.message, announcement: encoded.message });
          return encoded;
        }
        const built = buildMatrix({
          value: encoded.value,
          moduleShape: state.moduleShape,
          hasLogo: Boolean(state.logo),
        });
        if (!built.ok) {
          set({ valueError: built.message, announcement: built.message });
          return { ok: false, message: built.message };
        }
        set({
          value: encoded.value,
          valueError: null,
          valueIsDense: encoded.dense,
          matrix: built.matrix,
          // The URL field is the one place the app rewrites what was typed:
          // committing normalizes it, and showing the normalized form is how
          // you know it was understood.
          draft: state.payloadKind === 'url' ? { ...state.draft, url: encoded.value } : state.draft,
          announcement: encoded.dense
            ? 'Code ready. This one is long, so the code is dense — scan from closer.'
            : 'Code ready.',
        });
        return { ok: true, value: encoded.value };
      },

      setSculpture: (id) => set({ sculpture: id }),
      setTheme: (id) => set({ theme: id }),
      setModuleShape: (id) => reconfigure({ moduleShape: id }),
      setCornerShape: (id) => set({ cornerShape: id, announcement: 'Corner shape updated.' }),
      setLogo: (dataUrl) => reconfigure({ logo: dataUrl }),
      setReducedMotion: (reduced) => set({ reducedMotion: reduced }),
      toggleMuted: () => set((state) => ({ muted: !state.muted })),

      shareUrl: (origin, options) => {
        const state = get();
        return buildShareUrl(
          origin,
          {
            url: state.value,
            kind: state.payloadKind,
            f: draftFor(state.payloadKind, state.draft),
            sculpture: state.sculpture,
            theme: state.theme,
            module: state.moduleShape,
            corner: state.cornerShape,
          },
          options ?? {},
        );
      },

      describe: () => {
        const state = get();
        return describePayload(state.payloadKind, state.draft, state.value);
      },
    };
  });
};

export const useExperienceStore = createExperienceStore(
  typeof window === 'undefined' ? '' : window.location.search,
);
