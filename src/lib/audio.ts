/**
 * A small procedural sound bed. No audio files ship with the product: the two
 * cues are synthesised, so there is nothing to license and nothing to download.
 *
 * The context is created lazily on the first user gesture, which is both the
 * browser autoplay rule and the accessibility expectation.
 */

type Cue = 'reveal' | 'lock';

let context: AudioContext | null = null;

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

const CUES: Record<Cue, { frequencies: number[]; duration: number; gain: number }> = {
  reveal: { frequencies: [196, 294, 392], duration: 0.55, gain: 0.06 },
  lock: { frequencies: [523.25, 659.25, 783.99], duration: 0.75, gain: 0.05 },
};

/** Play one cue. Silent and side-effect free when muted or unsupported. */
export function playCue(cue: Cue, muted: boolean): void {
  if (muted) return;
  const audio = ensureContext();
  if (!audio) return;

  const now = audio.currentTime;
  const { frequencies, duration, gain } = CUES[cue];

  frequencies.forEach((frequency, index) => {
    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;

    const start = now + index * 0.06;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + 0.04);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(envelope).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  });
}

/** Release the audio context. Used on unmount so nothing is left running. */
export function disposeAudio(): void {
  void context?.close();
  context = null;
}
