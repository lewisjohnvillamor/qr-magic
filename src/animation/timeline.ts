/**
 * A small reversible tween timeline.
 *
 * This exists in place of an animation library because the product needs
 * exactly one thing from one: a paused sequence of eased tweens over a plain
 * object, playable forwards and backwards, that lands on its end values
 * exactly. That is a hundred lines, and writing them keeps every dependency
 * this project ships under a licence compatible with its own.
 *
 * Two properties the reveal depends on:
 *
 * - **Exactness.** At `t = 0` and `t = duration` every value is its literal
 *   start or end number, not a float a hair away from it. The QR lock state
 *   requires `lock === 1`, not `0.9999`.
 * - **One source of truth.** Reversing plays the same tracks backwards rather
 *   than running a second sequence, so forward and back cannot drift apart.
 */

/** Easing curves, matching the usual `powerN` family: `powerN` is degree N+1. */
const EASES = {
  linear: (p: number) => p,
  'power1.out': (p: number) => 1 - (1 - p) ** 2,
  'power1.inOut': (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2),
  'power2.out': (p: number) => 1 - (1 - p) ** 3,
  'power2.inOut': (p: number) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2),
  'power3.inOut': (p: number) => (p < 0.5 ? 8 * p ** 4 : 1 - (-2 * p + 2) ** 4 / 2),
  'power4.out': (p: number) => 1 - (1 - p) ** 5,
} as const;

export type EaseName = keyof typeof EASES;

/** Numeric properties of `T` — the only kind a tween can drive. */
type NumericKeys<T> = {
  [K in keyof T]: T[K] extends number ? K : never;
}[keyof T];

interface Track {
  from: number;
  to: number;
  start: number;
  end: number;
  ease: (p: number) => number;
}

export interface TweenOptions {
  /** Absolute start time on the timeline, in seconds. */
  at: number;
  duration: number;
  ease?: EaseName;
}

export interface TimelineCallbacks {
  onComplete?: () => void;
  onReverseComplete?: () => void;
}

export class Timeline<T extends object> {
  private readonly tracks = new Map<NumericKeys<T>, Track[]>();
  private readonly initial: Partial<Record<NumericKeys<T>, number>> = {};
  private time = 0;
  private total = 0;
  private direction: 1 | -1 = 1;
  private frame = 0;
  private lastStamp = 0;
  private killed = false;

  constructor(
    private readonly target: T,
    private readonly callbacks: TimelineCallbacks = {},
  ) {}

  /**
   * Tween `key` to `to`. Its start value is wherever the previous tween on the
   * same key finished, so tracks chain the way a written-out sequence reads.
   */
  to(key: NumericKeys<T>, to: number, options: TweenOptions): this {
    const existing = this.tracks.get(key) ?? [];
    if (existing.length === 0) {
      this.initial[key] = this.target[key] as number;
    }
    const from = existing.length ? existing[existing.length - 1]!.to : (this.target[key] as number);
    const end = options.at + options.duration;
    existing.push({
      from,
      to,
      start: options.at,
      end,
      ease: EASES[options.ease ?? 'power2.inOut'],
    });
    this.tracks.set(key, existing);
    this.total = Math.max(this.total, end);
    return this;
  }

  duration(): number {
    return this.total;
  }

  progress(): number {
    return this.total === 0 ? 1 : this.time / this.total;
  }

  /** Scrub to an absolute time and apply it. Never fires callbacks. */
  seek(time: number): this {
    this.time = Math.min(this.total, Math.max(0, time));
    this.apply();
    return this;
  }

  /**
   * Advance by `delta` seconds in the current direction, firing the end
   * callbacks on arrival. Separated from the frame loop so the sequence can be
   * driven deterministically in tests.
   */
  tick(delta: number): this {
    if (this.killed || delta <= 0) return this;
    // Already parked at the end we are heading for: do nothing, so an extra
    // tick cannot fire a second completion callback.
    if (this.direction === 1 && this.time >= this.total) return this;
    if (this.direction === -1 && this.time <= 0) return this;
    const next = this.time + delta * this.direction;

    if (this.direction === 1 && next >= this.total) {
      this.seek(this.total);
      this.stop();
      this.callbacks.onComplete?.();
      return this;
    }
    if (this.direction === -1 && next <= 0) {
      this.seek(0);
      this.stop();
      this.callbacks.onReverseComplete?.();
      return this;
    }
    this.seek(next);
    return this;
  }

  play(): this {
    if (this.killed || this.time >= this.total) return this;
    this.direction = 1;
    this.start();
    return this;
  }

  reverse(): this {
    if (this.killed || this.time <= 0) return this;
    this.direction = -1;
    this.start();
    return this;
  }

  /** Stop, optionally jumping to a time first. */
  pause(time?: number): this {
    this.stop();
    if (time !== undefined) this.seek(time);
    return this;
  }

  kill(): void {
    this.stop();
    this.killed = true;
  }

  // ---- internals ----

  private apply(): void {
    for (const [key, tracks] of this.tracks) {
      let value = this.initial[key] ?? 0;
      for (const track of tracks) {
        if (this.time >= track.end) {
          // Past this track: hold its exact end value, so the final state is
          // the literal number rather than an eased approximation of it.
          value = track.to;
          continue;
        }
        if (this.time <= track.start) break;
        const span = track.end - track.start;
        const p = span === 0 ? 1 : (this.time - track.start) / span;
        value = track.from + (track.to - track.from) * track.ease(p);
        break;
      }
      (this.target[key] as number) = value;
    }
  }

  private start(): void {
    if (this.frame !== 0 || typeof requestAnimationFrame === 'undefined') return;
    this.lastStamp = 0;
    const step = (stamp: number) => {
      if (this.killed) return;
      // The first frame has no previous stamp to measure against, so it only
      // establishes the baseline rather than advancing by an arbitrary amount.
      const delta = this.lastStamp === 0 ? 0 : (stamp - this.lastStamp) / 1000;
      this.lastStamp = stamp;
      if (delta > 0) this.tick(delta);
      if (this.frame !== 0) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  private stop(): void {
    if (this.frame !== 0 && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.frame);
    }
    this.frame = 0;
  }
}
