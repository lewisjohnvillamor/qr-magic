import { describe, expect, it } from 'vitest';
import { parseWeather } from '../../src/lib/weather';
import { coordinatesForTimeZone } from '../../src/lib/timezone-coordinates';

function body(current: Record<string, unknown>) {
  return { current: { temperature_2m: 12, weather_code: 0, ...current } };
}

describe('weather parsing', () => {
  it('maps WMO codes onto the moods the scene can draw', () => {
    const cases: [number, string][] = [
      [0, 'clear'],
      [1, 'clear'],
      [3, 'cloudy'],
      [45, 'fog'],
      [53, 'rain'],
      [65, 'rain'],
      [73, 'snow'],
      [81, 'rain'],
      [86, 'snow'],
      [95, 'storm'],
    ];
    for (const [code, condition] of cases) {
      expect(parseWeather(body({ weather_code: code }))?.condition, `code ${code}`).toBe(condition);
    }
  });

  it('normalises cloud, wind and precipitation into 0..1', () => {
    const weather = parseWeather(
      body({ weather_code: 61, cloud_cover: 50, wind_speed_10m: 30, precipitation: 2 }),
    );
    expect(weather?.cloudCover).toBeCloseTo(0.5);
    expect(weather?.wind).toBeCloseTo(0.5);
    expect(weather?.precipitation).toBeCloseTo(0.5);
  });

  it('clamps values that exceed the scale rather than overdriving the scene', () => {
    const weather = parseWeather(
      body({ weather_code: 95, cloud_cover: 100, wind_speed_10m: 200, precipitation: 99 }),
    );
    expect(weather?.cloudCover).toBe(1);
    expect(weather?.wind).toBe(1);
    expect(weather?.precipitation).toBe(1);
  });

  it('always shows something falling when the condition says it is', () => {
    // Reported precipitation lags the code, so a "rain" mood with 0 mm would
    // otherwise render as dry.
    const weather = parseWeather(body({ weather_code: 61, precipitation: 0 }));
    expect(weather?.precipitation).toBeGreaterThan(0);
  });

  it('leaves dry conditions dry', () => {
    expect(parseWeather(body({ weather_code: 3, precipitation: 5 }))?.precipitation).toBe(0);
  });

  it('rejects anything it cannot trust rather than rendering NaN', () => {
    expect(parseWeather(null)).toBeNull();
    expect(parseWeather('nope')).toBeNull();
    expect(parseWeather({})).toBeNull();
    expect(parseWeather({ current: null })).toBeNull();
    expect(parseWeather({ current: { temperature_2m: 12 } })).toBeNull();
    expect(parseWeather({ current: { weather_code: 'rain', temperature_2m: 12 } })).toBeNull();
    expect(parseWeather(body({ temperature_2m: Number.NaN }))).toBeNull();
  });

  it('defaults a missing day flag to daytime', () => {
    expect(parseWeather(body({}))?.isDay).toBe(true);
    expect(parseWeather(body({ is_day: 0 }))?.isDay).toBe(false);
  });
});

describe('time zone coordinates', () => {
  it('resolves well-known zones to the right hemisphere', () => {
    const tokyo = coordinatesForTimeZone('Asia/Tokyo');
    expect(tokyo?.latitude).toBeGreaterThan(30);
    expect(tokyo?.longitude).toBeGreaterThan(130);

    const sydney = coordinatesForTimeZone('Australia/Sydney');
    expect(sydney?.latitude).toBeLessThan(0);

    const manila = coordinatesForTimeZone('Asia/Manila');
    expect(manila?.latitude).toBeCloseTo(14.58, 1);
    expect(manila?.longitude).toBeCloseTo(121, 0);
  });

  it('falls back to the region for a zone it has never heard of', () => {
    // A zone added after the table was generated still lands on a continent.
    const invented = coordinatesForTimeZone('Europe/Atlantis');
    expect(invented).not.toBeNull();
  });

  it('returns null for a name with no region at all', () => {
    expect(coordinatesForTimeZone('Nowhere')).toBeNull();
  });

  it('refuses zones that name an offset rather than a place', () => {
    // Servers, CI runners and hardened browsers report these. Guessing a
    // position from an offset would drop the viewer in the ocean.
    for (const zone of ['UTC', 'Etc/UTC', 'Etc/GMT+5', 'GMT', 'Zulu', 'Universal']) {
      expect(coordinatesForTimeZone(zone), zone).toBeNull();
    }
  });
});
