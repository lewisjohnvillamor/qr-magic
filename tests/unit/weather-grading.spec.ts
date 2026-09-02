import { describe, expect, it } from 'vitest';
import { NEUTRAL_GRADE, gradeFor } from '../../src/lib/weather-grading';
import type { Weather } from '../../src/lib/weather';

function weather(patch: Partial<Weather> = {}): Weather {
  return {
    condition: 'clear',
    temperature: 18,
    cloudCover: 0,
    wind: 0,
    precipitation: 0,
    isDay: true,
    ...patch,
  };
}

describe('weather grading', () => {
  it('leaves the theme alone when there is no weather to apply', () => {
    expect(gradeFor(null)).toEqual(NEUTRAL_GRADE);
  });

  it('never grades the scene into darkness, whatever the conditions', () => {
    const worst = gradeFor(
      weather({ condition: 'storm', cloudCover: 1, isDay: false, precipitation: 1 }),
    );
    expect(worst.light).toBeGreaterThanOrEqual(0.45);
    expect(worst.light).toBeLessThanOrEqual(1.2);
  });

  it('pulls haze in for fog and leaves clear skies open', () => {
    expect(gradeFor(weather({ condition: 'fog' })).fogNear).toBeLessThan(
      gradeFor(weather({ condition: 'clear' })).fogNear,
    );
  });

  it('brightens for snow and dims for storms', () => {
    const snow = gradeFor(weather({ condition: 'snow', cloudCover: 0.8 }));
    const storm = gradeFor(weather({ condition: 'storm', cloudCover: 0.8 }));
    expect(snow.light).toBeGreaterThan(storm.light);
  });

  it('dims at night without blacking out', () => {
    const day = gradeFor(weather({ isDay: true }));
    const night = gradeFor(weather({ isDay: false }));
    expect(night.light).toBeLessThan(day.light);
    expect(night.light).toBeGreaterThan(0.4);
  });

  it('turns wind into visible sway', () => {
    expect(gradeFor(weather({ wind: 0 })).sway).toBe(1);
    expect(gradeFor(weather({ wind: 1 })).sway).toBeGreaterThan(2);
  });

  it('keeps the wash within a blendable range', () => {
    for (const condition of ['clear', 'cloudy', 'fog', 'rain', 'snow', 'storm'] as const) {
      const grade = gradeFor(weather({ condition, cloudCover: 1 }));
      expect(grade.wash).toBeGreaterThanOrEqual(0);
      expect(grade.wash).toBeLessThanOrEqual(1);
    }
  });
});
