import gsap from 'gsap';

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

export interface TimelineCallbacks {
  onRevealComplete?: () => void;
  onReturnComplete?: () => void;
  onUpdate?: (progress: number) => void;
}

export interface RevealTimelineOptions {
  reducedMotion: boolean;
  callbacks?: TimelineCallbacks;
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
): gsap.core.Timeline {
  const { reducedMotion, callbacks } = options;

  const timeline = gsap.timeline({
    paused: true,
    defaults: { ease: 'power2.inOut' },
    onUpdate: () => callbacks?.onUpdate?.(timeline.progress()),
    onComplete: () => callbacks?.onRevealComplete?.(),
    onReverseComplete: () => callbacks?.onReturnComplete?.(),
  });

  if (reducedMotion) {
    // No scatter, no camera swing: a short, direct interpolation that still ends
    // in the exact frontal lock the QR state requires.
    timeline
      .to(values, { camera: 1, duration: 0.45, ease: 'power1.inOut' }, 0)
      .to(values, { idle: 0, duration: 0.2 }, 0)
      .to(values, { morph: 1, duration: 0.5, ease: 'power1.inOut' }, 0)
      .to(values, { lock: 1, backing: 1, duration: 0.25, ease: 'power1.out' }, 0.35);
    return timeline;
  }

  timeline
    // Anticipation — the sculpture gathers itself.
    .to(values, { squash: 0.9, idle: 0.35, duration: 0.25, ease: 'power2.out' }, 0)
    // Camera alignment — swing round to the QR viewing angle.
    .to(values, { camera: 1, duration: 0.65, ease: 'power2.inOut' }, 0.15)
    // Scatter — cubes separate, then gather again during reorganization.
    .to(values, { scatter: 1, duration: 0.45, ease: 'power2.out' }, 0.25)
    .to(values, { squash: 1, duration: 0.4 }, 0.25)
    .to(values, { idle: 0, duration: 0.4 }, 0.4)
    // Reorganization — the long move onto the grid.
    .to(values, { morph: 1, duration: 0.9, ease: 'power3.inOut' }, 0.7)
    .to(values, { scatter: 0, duration: 0.75, ease: 'power2.inOut' }, 0.75)
    // Lock — rotations snap, spacing becomes exact, backing plane resolves.
    .to(values, { lock: 1, duration: 0.25, ease: 'power4.out' }, 1.5)
    .to(values, { backing: 1, duration: 0.3, ease: 'power1.out' }, 1.45);

  return timeline;
}
