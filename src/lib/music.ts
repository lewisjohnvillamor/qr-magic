/**
 * The scored bed under each theme.
 *
 * Every theme gets its own piece rather than sharing one, because the music is
 * doing the same job as the palette: telling you what kind of place you are
 * looking at. A rain-lit neon street and a still snowfield should not sound
 * alike.
 *
 * All six are Kevin MacLeod pieces licensed CC BY 4.0 (see ATTRIBUTION.md),
 * cut to a seamless ~77-second loop and encoded mono by `tools/build-audio.py`.
 * Each is ~600 KB and only the current theme's track is ever fetched, and only
 * once someone turns the sound on — so a visitor who never unmutes downloads
 * none of it, and one who does pays for exactly one.
 */

import type { ThemeId } from '../themes/themes';

export interface MusicTrack {
  /** File under `public/audio/`, without extension. */
  id: string;
  title: string;
  /** ISRC, so the recording is identifiable beyond its title. */
  isrc: string;
}

export const MUSIC_TRACKS: Record<ThemeId, MusicTrack> = {
  nature: { id: 'nature', title: 'Ripples', isrc: 'USUAN1100691' },
  cyber: { id: 'cyber', title: 'Ethernight Club', isrc: 'USUAN2100002' },
  crystal: { id: 'crystal', title: 'Melodie Victoria', isrc: 'USUAN1100819' },
  sunset: { id: 'sunset', title: 'Evening', isrc: 'USUAN2300002' },
  snow: { id: 'snow', title: 'Frost Waltz', isrc: 'USUAN1100516' },
  brand: { id: 'brand', title: 'Our Story Begins', isrc: 'USUAN1100856' },
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
