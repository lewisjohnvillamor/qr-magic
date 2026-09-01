import { describe, expect, it, vi } from 'vitest';
import gsap from 'gsap';
import {
  createRevealTimeline,
  createRevealValues,
} from '../../src/animation/create-reveal-timeline';

/** Advance a paused timeline deterministically, without waiting on real time. */
function seek(timeline: gsap.core.Timeline, time: number) {
  timeline.seek(time, false);
}

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
    seek(timeline, timeline.duration());
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
    seek(timeline, 0.7);
    expect(values.scatter).toBeGreaterThan(0.5);
    seek(timeline, timeline.duration());
    expect(values.scatter).toBe(0);
  });

  it('returns to the exact sculpture pose when reversed', () => {
    const values = createRevealValues();
    const timeline = createRevealTimeline(values, { reducedMotion: false });
    seek(timeline, timeline.duration());
    seek(timeline, 0);
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

  it('uses a shorter, scatter-free sequence under reduced motion', () => {
    const values = createRevealValues();
    const reduced = createRevealTimeline(values, { reducedMotion: true });
    const full = createRevealTimeline(createRevealValues(), { reducedMotion: false });
    expect(reduced.duration()).toBeLessThan(full.duration());

    for (let t = 0; t <= reduced.duration(); t += 0.05) {
      seek(reduced, t);
      expect(values.scatter).toBe(0);
    }
    seek(reduced, reduced.duration());
    expect(values.morph).toBe(1);
    expect(values.lock).toBe(1);
    expect(values.camera).toBe(1);
  });

  it('fires the completion callbacks in both directions', async () => {
    const onRevealComplete = vi.fn();
    const onReturnComplete = vi.fn();
    const values = createRevealValues();
    const timeline = createRevealTimeline(values, {
      reducedMotion: true,
      callbacks: { onRevealComplete, onReturnComplete },
    });

    timeline.progress(1, false);
    gsap.ticker.tick();
    expect(onRevealComplete).toHaveBeenCalledTimes(1);

    timeline.reverse(0);
    timeline.progress(0, false);
    gsap.ticker.tick();
    expect(onReturnComplete).toHaveBeenCalledTimes(1);
  });

  it('leaves no live tweens once killed', () => {
    const values = createRevealValues();
    const timeline = createRevealTimeline(values, { reducedMotion: false });
    timeline.play();
    timeline.kill();
    expect(gsap.isTweening(values)).toBe(false);
  });
});
