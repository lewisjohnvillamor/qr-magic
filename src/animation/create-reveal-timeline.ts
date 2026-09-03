import { Timeline } from './timeline';

/**
 * The mutable value the whole transformation reads from.
 *
 * One object, one timeline. The render loop samples these numbers every frame;
 * React state is never touched during the animation.
 */
export interface RevealValues {
  /** Sculpture pose (0) → QR pose (1). */
  morph: number;
  /** Restrained scatter amplitude, rises and falls inside the timeline. */
  scatter: number;
  /** Sculpture camera (0) → frontal QR camera (1). */
  camera: number;
  /** Rotation snap and exact module spacing (0 → 1). */
  lock: number;
  /** Opacity of the canonical backing plane. */
  backing: number;
  /** Anticipation squash applied to the whole sculpture. */
  squash: number;
  /** Idle float/rotation amplitude, damped to zero as the reveal proceeds. */
  idle: number;
}

export function createRevealValues(): RevealValues {
  return { morph: 0, scatter: 0, camera: 0, lock: 0, backing: 0, squash: 1, idle: 1 };
}

export interface RevealCallbacks {
  onRevealComplete?: () => void;
  onReturnComplete?: () => void;
}

export interface RevealTimelineOptions {
  reducedMotion: boolean;
  callbacks?: RevealCallbacks;
}

/**
 * Build the single reversible master timeline (spec §11).
 *
 * The reverse animation is the same timeline played backwards — there is no
 * second sequence to keep in sync, and no stray `setTimeout` anywhere in the
 * transformation.
 */
export function createRevealTimeline(
  values: RevealValues,
  options: RevealTimelineOptions,
): Timeline<RevealValues> {
  const { reducedMotion, callbacks } = options;

  const timeline = new Timeline(values, {
    onComplete: () => callbacks?.onRevealComplete?.(),
    onReverseComplete: () => callbacks?.onReturnComplete?.(),
  });

  if (reducedMotion) {
    // No scatter, no camera swing: a short, direct interpolation that still ends
    // in the exact frontal lock the QR state requires.
    timeline
      .to('camera', 1, { at: 0, duration: 0.45, ease: 'power1.inOut' })
      .to('idle', 0, { at: 0, duration: 0.2 })
      .to('morph', 1, { at: 0, duration: 0.5, ease: 'power1.inOut' })
      .to('lock', 1, { at: 0.35, duration: 0.25, ease: 'power1.out' })
      .to('backing', 1, { at: 0.35, duration: 0.25, ease: 'power1.out' });
    return timeline;
  }

  timeline
    // Anticipation — the sculpture gathers itself.
    .to('squash', 0.9, { at: 0, duration: 0.25, ease: 'power2.out' })
    .to('idle', 0.35, { at: 0, duration: 0.25, ease: 'power2.out' })
    // Camera alignment — swing round to the QR viewing angle.
    .to('camera', 1, { at: 0.15, duration: 0.65, ease: 'power2.inOut' })
    // Scatter — cubes separate, then gather again during reorganization.
    .to('scatter', 1, { at: 0.25, duration: 0.45, ease: 'power2.out' })
    .to('squash', 1, { at: 0.25, duration: 0.4 })
    .to('idle', 0, { at: 0.4, duration: 0.4 })
    // Reorganization — the long move onto the grid.
    .to('morph', 1, { at: 0.7, duration: 0.9, ease: 'power3.inOut' })
    .to('scatter', 0, { at: 0.75, duration: 0.75, ease: 'power2.inOut' })
    // Lock — rotations snap, spacing becomes exact, backing plane resolves.
    .to('lock', 1, { at: 1.5, duration: 0.25, ease: 'power4.out' })
    .to('backing', 1, { at: 1.45, duration: 0.3, ease: 'power1.out' });

  return timeline;
}
