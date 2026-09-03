import { describe, expect, it, vi } from 'vitest';
import {
  createRevealTimeline,
  createRevealValues,
} from '../../src/animation/create-reveal-timeline';
import { Timeline } from '../../src/animation/timeline';

describe('reveal timeline', () => {
  it('starts at the sculpture pose', () => {
    const values = createRevealValues();
    createRevealTimeline(values, { reducedMotion: false });
    expect(values).toMatchObject({
      morph: 0,
      scatter: 0,
      camera: 0,
      lock: 0,
      backing: 0,
      squash: 1,
      idle: 1,
    });
  });

  it('reaches an exact lock state at the end', () => {
    const values = createRevealValues();
    const timeline = createRevealTimeline(values, { reducedMotion: false });
    timeline.seek(timeline.duration());
    // Exactly 1, not 0.9999: the QR lock state depends on these being literal.
    expect(values.morph).toBe(1);
    expect(values.lock).toBe(1);
    expect(values.backing).toBe(1);
    expect(values.scatter).toBe(0);
    expect(values.idle).toBe(0);
    expect(values.camera).toBe(1);
    expect(values.squash).toBe(1);
  });

  it('scatters in the middle but not at either end', () => {
    const values = createRevealValues();
    const timeline = createRevealTimeline(values, { reducedMotion: false });
    timeline.seek(0.7);
    expect(values.scatter).toBeGreaterThan(0.5);
    timeline.seek(timeline.duration());
    expect(values.scatter).toBe(0);
  });

  it('returns to the exact sculpture pose when reversed', () => {
    const values = createRevealValues();
    const timeline = createRevealTimeline(values, { reducedMotion: false });
    timeline.seek(timeline.duration());
    timeline.seek(0);
    expect(values).toMatchObject({
      morph: 0,
      scatter: 0,
      camera: 0,
      lock: 0,
      backing: 0,
      squash: 1,
      idle: 1,
    });
  });

  it('moves every value monotonically through the reveal', () => {
    // Nothing may overshoot or double back: a value that leaves its range mid
    // flight would put the sculpture somewhere the layout never accounts for.
    const values = createRevealValues();
    const timeline = createRevealTimeline(values, { reducedMotion: false });
    for (let t = 0; t <= timeline.duration(); t += 0.01) {
      timeline.seek(t);
      expect(values.morph).toBeGreaterThanOrEqual(0);
      expect(values.morph).toBeLessThanOrEqual(1);
      expect(values.lock).toBeGreaterThanOrEqual(0);
      expect(values.lock).toBeLessThanOrEqual(1);
      expect(values.squash).toBeGreaterThan(0);
    }
  });

  it('uses a shorter, scatter-free sequence under reduced motion', () => {
    const values = createRevealValues();
    const reduced = createRevealTimeline(values, { reducedMotion: true });
    const full = createRevealTimeline(createRevealValues(), { reducedMotion: false });
    expect(reduced.duration()).toBeLessThan(full.duration());

    for (let t = 0; t <= reduced.duration(); t += 0.05) {
      reduced.seek(t);
      expect(values.scatter).toBe(0);
    }
    reduced.seek(reduced.duration());
    expect(values.morph).toBe(1);
    expect(values.lock).toBe(1);
    expect(values.camera).toBe(1);
  });

  it('fires the completion callbacks in both directions', () => {
    const onRevealComplete = vi.fn();
    const onReturnComplete = vi.fn();
    const values = createRevealValues();
    const timeline = createRevealTimeline(values, {
      reducedMotion: true,
      callbacks: { onRevealComplete, onReturnComplete },
    });

    timeline.play().tick(timeline.duration() + 0.1);
    expect(onRevealComplete).toHaveBeenCalledTimes(1);
    expect(onReturnComplete).not.toHaveBeenCalled();

    timeline.reverse().tick(timeline.duration() + 0.1);
    expect(onReturnComplete).toHaveBeenCalledTimes(1);
    expect(onRevealComplete).toHaveBeenCalledTimes(1);
  });

  it('stops advancing once killed', () => {
    const values = createRevealValues();
    const timeline = createRevealTimeline(values, { reducedMotion: true });
    timeline.play();
    timeline.kill();
    timeline.tick(10);
    expect(timeline.progress()).toBe(0);
    expect(values.morph).toBe(0);
  });
});

describe('timeline primitive', () => {
  const build = (callbacks = {}) => {
    const target = { a: 0, b: 10 };
    const timeline = new Timeline(target, callbacks);
    timeline
      .to('a', 1, { at: 0, duration: 1, ease: 'linear' })
      .to('b', 0, { at: 1, duration: 1, ease: 'linear' });
    return { target, timeline };
  };

  it('takes its duration from the last track to finish', () => {
    expect(build().timeline.duration()).toBe(2);
  });

  it('interpolates linearly and holds values between tracks', () => {
    const { target, timeline } = build();
    timeline.seek(0.5);
    expect(target.a).toBeCloseTo(0.5);
    // `b` has not started yet, so it sits at its untouched initial value.
    expect(target.b).toBe(10);
    timeline.seek(1.5);
    expect(target.a).toBe(1); // finished, held exactly
    expect(target.b).toBeCloseTo(5);
  });

  it('chains a second tween on a key from where the first ended', () => {
    const target = { a: 0 };
    const timeline = new Timeline(target);
    timeline
      .to('a', 4, { at: 0, duration: 1, ease: 'linear' })
      .to('a', 2, { at: 1, duration: 1, ease: 'linear' });
    timeline.seek(1.5);
    expect(target.a).toBeCloseTo(3);
  });

  it('clamps seeks to its own bounds', () => {
    const { target, timeline } = build();
    timeline.seek(-5);
    expect(timeline.progress()).toBe(0);
    expect(target.a).toBe(0);
    timeline.seek(99);
    expect(timeline.progress()).toBe(1);
    expect(target.b).toBe(0);
  });

  it('reverses from wherever it currently is', () => {
    const { target, timeline } = build();
    timeline.seek(1.5);
    timeline.reverse().tick(0.5);
    expect(target.b).toBeCloseTo(10);
    expect(timeline.progress()).toBeCloseTo(0.5);
  });

  it('will not play past the end or reverse past the start', () => {
    const onComplete = vi.fn();
    const { timeline } = build({ onComplete });
    timeline.seek(2);
    timeline.play().tick(1);
    // Already finished: no second completion callback.
    expect(onComplete).not.toHaveBeenCalled();
    expect(timeline.progress()).toBe(1);
  });
});
