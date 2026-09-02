/**
 * The scored bed under each theme.
 *
 * Every theme gets its own piece rather than sharing one, because the music is
 * doing the same job as the palette: telling you what kind of place you are
 * looking at. A rain-lit neon street and a still snowfield should not sound
 * alike.
 *
 * Every track is lofi: unhurried, electric-piano-led, mixed to sit under a
 * scene rather than in front of one. A bed you notice only when it stops is
 * the point — the sculpture is the thing being looked at.
 *
 * All five are Kevin MacLeod pieces licensed CC BY 4.0, cut to a seamless
 * ~77-second loop and encoded mono by `tools/build-audio.py`. Each is ~600 KB,
 * and only the current theme's track is ever fetched, and only once someone
 * turns the sound on — so a visitor who never unmutes downloads none of it, and
 * one who does pays for exactly one.
 *
 * ATTRIBUTION.md is the canonical licence record, down to each recording's
 * ISRC. None of that is repeated here, where it would only drift.
 */

import type { ThemeId } from '../themes/themes';

export interface MusicTrack {
  /** File under `public/audio/`, without extension. */
  id: string;
  /** Named in the credit the licence requires. */
  title: string;
}

export const MUSIC_TRACKS: Record<ThemeId, MusicTrack> = {
  nature: { id: 'nature', title: 'Groove Grove' },
  cyber: { id: 'cyber', title: 'Soporific' },
  crystal: { id: 'crystal', title: 'Comfortable Mystery' },
  sunset: { id: 'sunset', title: 'Late Night Radio' },
  snow: { id: 'snow', title: 'Study And Relax' },
};

export const MUSIC_COMPOSER = 'Kevin MacLeod (incompetech.com)';
export const MUSIC_LICENCE = 'CC BY 4.0';

/**
 * The credit CC BY 4.0 requires, naming the piece actually playing.
 *
 * It rides on the sound control rather than sitting in a file nobody opens, so
 * it travels with the widget into whatever page embeds it. The licence also
 * requires changes to be stated, hence the closing clause.
 */
export function musicCredit(theme: ThemeId): string {
  const track = MUSIC_TRACKS[theme];
  return `“${track.title}” by ${MUSIC_COMPOSER}, licensed ${MUSIC_LICENCE} — shortened and remixed to loop.`;
}

export function musicUrl(theme: ThemeId): string {
  return `${import.meta.env.BASE_URL}audio/${MUSIC_TRACKS[theme].id}.mp3`;
}
