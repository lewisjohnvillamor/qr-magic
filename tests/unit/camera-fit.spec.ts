import { describe, expect, it } from 'vitest';
import { fitFrontalBox } from '../../src/components/scene/CameraRig';

const base = {
  fovDegrees: 26,
  viewportWidth: 1280,
  viewportHeight: 800,
  bottomInset: 0,
};

describe('fitFrontalBox', () => {
  it('fits by height when the box is tall', () => {
    const fit = fitFrontalBox({ ...base, width: 10, height: 40 });
    const halfFov = Math.tan((base.fovDegrees * Math.PI) / 360);
    expect(fit.distance).toBeCloseTo(20 / halfFov, 6);
  });

  it('fits by width when the box is wide', () => {
    const fit = fitFrontalBox({ ...base, width: 200, height: 10 });
    const halfFov = Math.tan((base.fovDegrees * Math.PI) / 360);
    expect(fit.distance).toBeCloseTo(100 / (halfFov * (1280 / 800)), 6);
  });

  it('does not offset the framing when nothing covers the viewport', () => {
    expect(fitFrontalBox({ ...base, width: 30, height: 30 }).offsetY).toBeCloseTo(0, 10);
  });

  it('pulls back and lifts the subject when the panel covers the bottom', () => {
    const clear = fitFrontalBox({ ...base, width: 30, height: 30 });
    const covered = fitFrontalBox({ ...base, width: 30, height: 30, bottomInset: 300 });
    expect(covered.distance).toBeGreaterThan(clear.distance);
    // A negative offset moves the framing point down, lifting the subject.
    expect(covered.offsetY).toBeLessThan(0);
  });

  it('centres the subject in exactly the free strip of viewport', () => {
    const inset = 240;
    const fit = fitFrontalBox({ ...base, width: 30, height: 30, bottomInset: inset });
    const halfFov = Math.tan((base.fovDegrees * Math.PI) / 360);
    const unitsPerPixel = (2 * fit.distance * halfFov) / base.viewportHeight;
    // The subject's centre should land at the midpoint of the free strip.
    const subjectPixelY = base.viewportHeight / 2 + fit.offsetY / unitsPerPixel;
    expect(subjectPixelY).toBeCloseTo((base.viewportHeight - inset) / 2, 6);
  });

  it('never surrenders more than 60% of the viewport to the interface', () => {
    const huge = fitFrontalBox({ ...base, width: 30, height: 30, bottomInset: 100_000 });
    const clamped = fitFrontalBox({ ...base, width: 30, height: 30, bottomInset: 480 });
    expect(huge.distance).toBeCloseTo(clamped.distance, 6);
    expect(Number.isFinite(huge.distance)).toBe(true);
  });

  it('handles a degenerate viewport without producing NaN', () => {
    const fit = fitFrontalBox({
      width: 30,
      height: 30,
      fovDegrees: 26,
      viewportWidth: 0,
      viewportHeight: 0,
      bottomInset: 0,
    });
    expect(Number.isFinite(fit.distance)).toBe(true);
    expect(Number.isFinite(fit.offsetY)).toBe(true);
  });
});
