import { create } from 'zustand';
import { normalizeUrl } from '../qr/normalize-url';
import type { UrlValidation } from '../qr/normalize-url';
import { generateMatrix } from '../qr/generate-matrix';
import type { QrMatrix } from '../qr/generate-matrix';
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

export interface ExperienceState {
  /** Raw text in the input field. */
  draftUrl: string;
  /** Last successfully normalized destination. */
  url: string;
  urlError: string | null;
  urlIsDense: boolean;

  sculpture: SculptureId;
  theme: ThemeId;
  brandForeground: string;
  brandBackground: string;

  quality: QualityLevel;
  qualityPinned: boolean;
  reducedMotion: boolean;
  muted: boolean;

  phase: Phase;
  /** Message queued for the ARIA live region. */
  announcement: string;

  matrix: QrMatrix;

  setDraftUrl: (value: string) => void;
  commitUrl: (value?: string) => UrlValidation;
  setSculpture: (id: SculptureId) => void;
  setTheme: (id: ThemeId) => void;
  setBrandColors: (foreground: string, background: string) => void;
  setQuality: (level: QualityLevel, pinned?: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  toggleMuted: () => void;
  setPhase: (phase: Phase) => void;
  announce: (message: string) => void;
  applyPayload: (payload: {
    url: string;
    sculpture?: SculptureId;
    theme?: ThemeId;
    foreground?: string;
    background?: string;
  }) => void;
  shareUrl: (origin: string, options?: { readOnly?: boolean }) => string;
}

function safeMatrix(value: string): QrMatrix {
  try {
    return generateMatrix(value);
  } catch {
    return generateMatrix(DEFAULT_URL);
  }
}

/** Read the initial experience from the address bar, falling back to defaults. */
export function readInitialExperience(search: string) {
  const decoded = readExperienceFromSearch(search);
  if (!decoded.ok) {
    return {
      url: DEFAULT_URL,
      sculpture: DEFAULT_SCULPTURE,
      theme: DEFAULT_THEME,
      restored: false,
      failed: decoded.reason !== 'missing',
    };
  }
  const { payload } = decoded;
  return {
    url: payload.url,
    sculpture: isSculptureId(payload.sculpture) ? payload.sculpture : DEFAULT_SCULPTURE,
    theme: isThemeId(payload.theme) ? payload.theme : DEFAULT_THEME,
    foreground: payload.foreground,
    background: payload.background,
    restored: true,
    failed: false,
  };
}

export const createExperienceStore = (search = '') => {
  const initial = readInitialExperience(search);
  const hints = readDeviceHints();

  return create<ExperienceState>()((set, get) => ({
    draftUrl: initial.url,
    url: initial.url,
    urlError: null,
    urlIsDense: initial.url.length > 300,

    sculpture: initial.sculpture,
    theme: initial.theme,
    brandForeground: initial.foreground ?? '#111111',
    brandBackground: initial.background ?? '#f7f4ec',

    quality: detectQualityLevel(hints),
    qualityPinned: false,
    reducedMotion: false,
    muted: true,

    phase: 'sculpture',
    announcement: initial.failed
      ? 'That shared link could not be read, so the default experience was loaded.'
      : '',

    matrix: safeMatrix(initial.url),

    setDraftUrl: (value) => set({ draftUrl: value, urlError: null }),

    commitUrl: (value) => {
      const candidate = value ?? get().draftUrl;
      const result = normalizeUrl(candidate);
      if (!result.ok) {
        set({ urlError: result.message, announcement: result.message });
        return result;
      }
      let matrix: QrMatrix;
      try {
        matrix = generateMatrix(result.url);
      } catch {
        const message = 'That link is too long to encode as a QR code.';
        set({ urlError: message, announcement: message });
        return { ok: false, reason: 'too-long', message };
      }
      set({
        url: result.url,
        draftUrl: result.url,
        urlError: null,
        urlIsDense: result.dense,
        matrix,
        announcement: result.dense
          ? 'Link ready. This link is long, so the code is dense — scan from closer.'
          : 'Link ready.',
      });
      return result;
    },

    setSculpture: (id) => set({ sculpture: id }),
    setTheme: (id) => set({ theme: id }),
    setBrandColors: (foreground, background) =>
      set({ brandForeground: foreground, brandBackground: background }),
    setQuality: (level, pinned = true) => set({ quality: level, qualityPinned: pinned }),
    setReducedMotion: (reduced) => set({ reducedMotion: reduced }),
    toggleMuted: () => set((state) => ({ muted: !state.muted })),
    setPhase: (phase) => set({ phase }),
    announce: (message) => set({ announcement: message }),

    applyPayload: (payload) => {
      const result = normalizeUrl(payload.url);
      if (!result.ok) return;
      set({
        url: result.url,
        draftUrl: result.url,
        urlError: null,
        urlIsDense: result.dense,
        matrix: safeMatrix(result.url),
        sculpture: payload.sculpture ?? get().sculpture,
        theme: payload.theme ?? get().theme,
        brandForeground: payload.foreground ?? get().brandForeground,
        brandBackground: payload.background ?? get().brandBackground,
      });
    },

    shareUrl: (origin, options) => {
      const state = get();
      return buildShareUrl(
        origin,
        {
          url: state.url,
          sculpture: state.sculpture,
          theme: state.theme,
          ...(state.theme === 'brand'
            ? { foreground: state.brandForeground, background: state.brandBackground }
            : {}),
        },
        options ?? {},
      );
    },
  }));
};

export const useExperienceStore = createExperienceStore(
  typeof window === 'undefined' ? '' : window.location.search,
);
