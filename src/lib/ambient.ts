/**
 * Per-theme soundscapes: a synthesised layer over a scored one.
 *
 * The synthesised half — pad, filtered noise, sparse accents — is built from
 * oscillators at runtime, so it costs a few kilobytes of code, needs no
 * network, and is what you hear if anything else fails. Under it sits one
 * licensed track per theme (see `music.ts`), fetched lazily.
 *
 * Everything is quiet by design — a lofi bed under the scene, not a jingle.
 * Sound starts only from the user's own toggle (the autoplay rule and the
 * accessibility expectation), and stopping ramps down rather than cutting.
 */

import type { ThemeId } from '../themes/themes';
import { musicUrl } from './music';

export interface AmbientConfig {
  /** Sustained pad chord, in Hz. */
  chord: number[];
  padType: OscillatorType;
  padGain: number;
  /** Low-pass cutoff shaping the pad's warmth. */
  padFilterHz: number;
  /** Band-passed noise bed: centre frequency and level. 0 disables. */
  noiseHz: number;
  noiseQ: number;
  noiseGain: number;
  /** Sparse melodic accents drawn from this scale (Hz). */
  scale: number[];
  /** Average seconds between accents. 0 disables. */
  accentEvery: number;
  accentGain: number;
  accentDecay: number;
  accentType: OscillatorType;
}

/** Frequencies are simple just-ish voicings; nothing needs to be in tune with
 * anything else, only with itself. */
export const AMBIENT_THEMES: Record<ThemeId, AmbientConfig> = {
  nature: {
    chord: [98, 147, 196, 247],
    padType: 'sine',
    padGain: 0.028,
    padFilterHz: 520,
    noiseHz: 950,
    noiseQ: 0.45,
    noiseGain: 0.02,
    scale: [523.25, 587.33, 659.25, 783.99, 880],
    accentEvery: 4.2,
    accentGain: 0.035,
    accentDecay: 1.4,
    accentType: 'sine',
  },
  cyber: {
    chord: [55, 110, 164.81, 220],
    padType: 'sawtooth',
    padGain: 0.014,
    padFilterHz: 420,
    noiseHz: 2400,
    noiseQ: 1.2,
    noiseGain: 0.006,
    scale: [440, 523.25, 659.25, 880, 1046.5],
    accentEvery: 2.6,
    accentGain: 0.03,
    accentDecay: 0.5,
    accentType: 'square',
  },
  crystal: {
    chord: [130.81, 196, 261.63, 329.63],
    padType: 'triangle',
    padGain: 0.022,
    padFilterHz: 900,
    noiseHz: 3600,
    noiseQ: 2,
    noiseGain: 0.004,
    scale: [1046.5, 1174.66, 1318.51, 1567.98, 2093],
    accentEvery: 3.4,
    accentGain: 0.028,
    accentDecay: 2.2,
    accentType: 'sine',
  },
  sunset: {
    chord: [87.31, 130.81, 174.61, 220],
    padType: 'triangle',
    padGain: 0.03,
    padFilterHz: 460,
    noiseHz: 700,
    noiseQ: 0.4,
    noiseGain: 0.012,
    scale: [349.23, 392, 440, 523.25, 587.33],
    accentEvery: 5.2,
    accentGain: 0.03,
    accentDecay: 1.8,
    accentType: 'sine',
  },
  snow: {
    chord: [110, 164.81, 220, 277.18],
    padType: 'sine',
    padGain: 0.024,
    padFilterHz: 600,
    noiseHz: 1400,
    noiseQ: 0.35,
    noiseGain: 0.022,
    scale: [659.25, 783.99, 880, 987.77, 1318.51],
    accentEvery: 6,
    accentGain: 0.024,
    accentDecay: 2.6,
    accentType: 'sine',
  },
  brand: {
    chord: [110, 220, 330],
    padType: 'sine',
    padGain: 0.018,
    padFilterHz: 550,
    noiseHz: 0,
    noiseQ: 1,
    noiseGain: 0,
    scale: [440, 554.37, 659.25],
    accentEvery: 7,
    accentGain: 0.018,
    accentDecay: 1.6,
    accentType: 'sine',
  },
};

interface Scene {
  gain: GainNode;
  stop: () => void;
}

/**
 * The scored bed under the synthesised layer.
 *
 * One piece per theme (see `music.ts`), fetched only when someone turns the
 * sound on and cached per theme thereafter, so switching back and forth does
 * not re-download. A failed or undecodable fetch is swallowed: the synth bed
 * is the product's actual soundtrack and must survive a missing file.
 */
const MUSIC_GAIN = 0.16;

/**
 * Seconds trimmed from each end of the loop.
 *
 * MP3 decoders pad the start and end of a stream with a few milliseconds of
 * silence. Looping the raw buffer would play that padding every time round as
 * an audible hiccup, so the loop points sit just inside it.
 */
const MUSIC_LOOP_INSET = 0.05;

const musicBuffers = new Map<ThemeId, AudioBuffer>();
const musicPending = new Map<ThemeId, Promise<AudioBuffer | null>>();

async function loadMusic(audio: AudioContext, theme: ThemeId): Promise<AudioBuffer | null> {
  const cached = musicBuffers.get(theme);
  if (cached) return cached;

  let pending = musicPending.get(theme);
  if (!pending) {
    pending = (async () => {
      try {
        const response = await fetch(musicUrl(theme));
        if (!response.ok) return null;
        const buffer = await audio.decodeAudioData(await response.arrayBuffer());
        musicBuffers.set(theme, buffer);
        return buffer;
      } catch {
        // A missing or undecodable track must not take the synth bed with it.
        return null;
      } finally {
        musicPending.delete(theme);
      }
    })();
    musicPending.set(theme, pending);
  }
  return pending;
}

let context: AudioContext | null = null;
let current: Scene | null = null;
let currentTheme: ThemeId | null = null;

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  if (context.state === 'suspended') void context.resume();
  return context;
}

/** Two seconds of soft pink-ish noise, looped. Built once per context. */
let noiseBuffer: AudioBuffer | null = null;
function ensureNoiseBuffer(audio: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === audio.sampleRate) return noiseBuffer;
  const length = audio.sampleRate * 2;
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const channel = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    // Paul Kellet's economy pink-noise approximation.
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    channel[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
  }
  noiseBuffer = buffer;
  return buffer;
}

function buildScene(audio: AudioContext, theme: ThemeId, config: AmbientConfig): Scene {
  const now = audio.currentTime;
  const sceneGain = audio.createGain();
  sceneGain.gain.setValueAtTime(0.0001, now);
  sceneGain.connect(audio.destination);

  const cleanups: Array<() => void> = [];

  // ---- pad ----
  const padFilter = audio.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = config.padFilterHz;
  padFilter.connect(sceneGain);

  // A slow LFO breathes through the filter so the pad never sits still.
  const lfo = audio.createOscillator();
  lfo.frequency.value = 0.06;
  const lfoDepth = audio.createGain();
  lfoDepth.gain.value = config.padFilterHz * 0.35;
  lfo.connect(lfoDepth).connect(padFilter.frequency);
  lfo.start();
  cleanups.push(() => lfo.stop());

  for (const [index, frequency] of config.chord.entries()) {
    const oscillator = audio.createOscillator();
    oscillator.type = config.padType;
    oscillator.frequency.value = frequency;
    // Slight detune per voice gives the lofi drift.
    oscillator.detune.value = (index % 2 === 0 ? 1 : -1) * (3 + index * 2);
    const voice = audio.createGain();
    // Quieter than it was: the music now carries the bed and the pad only
    // tints it toward the theme.
    voice.gain.value = (config.padGain * 0.55) / config.chord.length;
    oscillator.connect(voice).connect(padFilter);
    oscillator.start();
    cleanups.push(() => oscillator.stop());
  }

  // ---- noise bed ----
  if (config.noiseGain > 0) {
    const source = audio.createBufferSource();
    source.buffer = ensureNoiseBuffer(audio);
    source.loop = true;
    const band = audio.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = config.noiseHz;
    band.Q.value = config.noiseQ;
    const noiseGain = audio.createGain();
    noiseGain.gain.value = config.noiseGain;
    const noiseLfo = audio.createOscillator();
    noiseLfo.frequency.value = 0.11;
    const noiseLfoDepth = audio.createGain();
    noiseLfoDepth.gain.value = config.noiseGain * 0.5;
    noiseLfo.connect(noiseLfoDepth).connect(noiseGain.gain);
    source.connect(band).connect(noiseGain).connect(sceneGain);
    source.start();
    noiseLfo.start();
    cleanups.push(() => {
      source.stop();
      noiseLfo.stop();
    });
  }

  // ---- sparse accents through a feedback delay (the lofi echo) ----
  let accentTimer = 0;
  if (config.accentEvery > 0) {
    const delay = audio.createDelay(1.2);
    delay.delayTime.value = 0.42;
    const feedback = audio.createGain();
    feedback.gain.value = 0.32;
    const wet = audio.createGain();
    wet.gain.value = 0.5;
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(sceneGain);

    const playAccent = () => {
      const start = audio.currentTime + 0.02;
      const frequency =
        config.scale[Math.floor(Math.random() * config.scale.length)] ?? config.scale[0] ?? 440;
      const oscillator = audio.createOscillator();
      oscillator.type = config.accentType;
      oscillator.frequency.value = frequency;
      const envelope = audio.createGain();
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(config.accentGain, start + 0.04);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + config.accentDecay);
      oscillator.connect(envelope);
      envelope.connect(sceneGain);
      envelope.connect(delay);
      oscillator.start(start);
      oscillator.stop(start + config.accentDecay + 0.1);
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
      };
    };

    const schedule = () => {
      playAccent();
      const jitter = config.accentEvery * (0.6 + Math.random() * 0.8) * 1000;
      accentTimer = window.setTimeout(schedule, jitter);
    };
    accentTimer = window.setTimeout(schedule, 600);
  }

  // ---- the cinematic bed, under the synthesised layer ----
  let musicSource: AudioBufferSourceNode | null = null;
  let cancelled = false;
  void loadMusic(audio, theme).then((buffer) => {
    if (!buffer || cancelled) return;
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = MUSIC_LOOP_INSET;
    source.loopEnd = Math.max(MUSIC_LOOP_INSET * 2, buffer.duration - MUSIC_LOOP_INSET);
    const musicGain = audio.createGain();
    musicGain.gain.setValueAtTime(0.0001, audio.currentTime);
    musicGain.gain.exponentialRampToValueAtTime(MUSIC_GAIN, audio.currentTime + 2.5);
    source.connect(musicGain).connect(sceneGain);
    source.start(audio.currentTime, MUSIC_LOOP_INSET);
    musicSource = source;
  });
  cleanups.push(() => {
    cancelled = true;
    musicSource?.stop();
  });

  // Fade the whole scene in.
  sceneGain.gain.exponentialRampToValueAtTime(1, now + 1.6);

  return {
    gain: sceneGain,
    stop: () => {
      window.clearTimeout(accentTimer);
      const at = audio.currentTime;
      sceneGain.gain.cancelScheduledValues(at);
      sceneGain.gain.setValueAtTime(Math.max(sceneGain.gain.value, 0.0001), at);
      sceneGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
      window.setTimeout(() => {
        for (const cleanup of cleanups) {
          try {
            cleanup();
          } catch {
            /* already stopped */
          }
        }
        sceneGain.disconnect();
      }, 1000);
    },
  };
}

/** Start (or crossfade to) the ambient loop for a theme. */
export function playAmbient(theme: ThemeId): void {
  const audio = ensureContext();
  if (!audio) return;
  if (currentTheme === theme && current) return;
  current?.stop();
  current = buildScene(audio, theme, AMBIENT_THEMES[theme]);
  currentTheme = theme;
}

/** Fade the ambient loop out. */
export function stopAmbient(): void {
  current?.stop();
  current = null;
  currentTheme = null;
}

/** Release everything. Used on unmount so nothing is left running. */
export function disposeAmbient(): void {
  stopAmbient();
  void context?.close();
  context = null;
  noiseBuffer = null;
  musicBuffers.clear();
  musicPending.clear();
}
