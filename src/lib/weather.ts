/**
 * Live weather for wherever the scene is being viewed.
 *
 * The sculpture stands somewhere. Making it rain on it when it is raining on
 * the person looking is the whole idea — the scene stops being a picture and
 * starts being a window.
 *
 * Two deliberate constraints shape this:
 *
 * 1. **No permission prompt.** Location comes from the browser's time zone,
 *    which resolves to a reference city. A widget embedded in someone else's
 *    blog cannot reasonably prompt a reader for their precise position, and
 *    would mostly be refused. City-level is also the right resolution: weather
 *    is regional, and the scene only needs rain from snow from clear.
 * 2. **Never load-bearing.** Every failure path — offline, blocked by a host's
 *    CSP, an unknown time zone, a slow network — resolves to `null` and the
 *    scene renders exactly as it did before. Weather is decoration on top of a
 *    QR code, and the QR code is the product.
 */

import { coordinatesForTimeZone } from './timezone-coordinates';

/** The one third-party host this product talks to. */
const FORECAST_ORIGIN = 'https://api.open-meteo.com';

/**
 * Open-Meteo needs no API key and no account, which is why it is the one
 * outside service here: adding weather costs the product no secret to store
 * and no user to register.
 */
const FORECAST_URL = `${FORECAST_ORIGIN}/v1/forecast`;

/** Give up rather than leave the scene waiting on a slow network. */
const REQUEST_TIMEOUT_MS = 6000;

/**
 * What the scene actually renders. Deliberately a small vocabulary: the point
 * is a legible mood, not a meteorological readout.
 */
export type Condition = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

export interface Weather {
  condition: Condition;
  /** Celsius, as reported. */
  temperature: number;
  /** 0..1, driving how much cloud cover the sky picks up. */
  cloudCover: number;
  /** 0..1 against a 60 km/h ceiling, driving sway and precipitation slant. */
  wind: number;
  /** 0..1 intensity of whatever is falling; 0 when nothing is. */
  precipitation: number;
  isDay: boolean;
  /** The reference city the reading is for, e.g. "Manila". */
  place: string;
}

/**
 * WMO weather codes, collapsed to the six moods the scene can draw.
 *
 * The full table is ~30 codes distinguishing, for instance, light freezing
 * drizzle from dense freezing drizzle. The scene cannot show that difference
 * and should not pretend to, so the ranges below are intentionally coarse.
 */
function conditionFromCode(code: number): Condition {
  if (code >= 95) return 'storm';
  if (code >= 85) return 'snow'; // snow showers
  if (code >= 80) return 'rain'; // rain showers
  if (code >= 71) return 'snow'; // snow fall, snow grains
  if (code >= 61) return 'rain'; // rain
  if (code >= 56) return 'rain'; // freezing drizzle
  if (code >= 51) return 'rain'; // drizzle
  if (code >= 45) return 'fog';
  if (code >= 2) return 'cloudy';
  return 'clear'; // 0 clear, 1 mainly clear
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** The browser's own time zone, or null where it will not say. */
function viewerTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** The viewer's approximate position, or null if the time zone is unknown. */
export function viewerCoordinates(): { latitude: number; longitude: number } | null {
  const zone = viewerTimeZone();
  return zone ? coordinatesForTimeZone(zone) : null;
}

/**
 * A readable name for the place a reading belongs to.
 *
 * Taken from the time zone's own last segment, because that is literally the
 * city whose coordinates were queried — naming anything else would claim more
 * precision than the lookup has. `America/Argentina/Buenos_Aires` gives
 * "Buenos Aires".
 */
export function placeForTimeZone(zone: string): string {
  const segments = zone.split('/');
  return (segments[segments.length - 1] ?? zone).replace(/_/g, ' ');
}

/**
 * Fetch current conditions where the viewer is, or null if anything goes wrong.
 *
 * Never throws: callers treat weather as an enhancement, so a rejected promise
 * would only give every one of them the same empty catch block.
 */
export async function fetchWeather(signal?: AbortSignal): Promise<Weather | null> {
  const where = viewerCoordinates();
  if (!where) return null;

  const url = new URL(FORECAST_URL);
  url.searchParams.set('latitude', where.latitude.toFixed(2));
  url.searchParams.set('longitude', where.longitude.toFixed(2));
  url.searchParams.set(
    'current',
    'temperature_2m,weather_code,wind_speed_10m,cloud_cover,precipitation,is_day',
  );

  // Two ways to stop waiting: the caller unmounting, and our own patience.
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => timeout.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const response = await fetch(url.toString(), { signal: timeout.signal });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    const zone = viewerTimeZone();
    return parseWeather(body, zone ? placeForTimeZone(zone) : '');
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Read the response defensively.
 *
 * This is third-party JSON: it is parsed field by field, and anything missing
 * or non-numeric collapses the whole thing to null rather than producing a
 * scene driven by `NaN`.
 */
export function parseWeather(body: unknown, place = ''): Weather | null {
  if (typeof body !== 'object' || body === null) return null;
  const current = (body as { current?: unknown }).current;
  if (typeof current !== 'object' || current === null) return null;

  const read = (key: string): number | null => {
    const value = (current as Record<string, unknown>)[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };

  const code = read('weather_code');
  const temperature = read('temperature_2m');
  if (code === null || temperature === null) return null;

  const condition = conditionFromCode(code);
  const precipitation = read('precipitation') ?? 0;

  return {
    condition,
    temperature,
    cloudCover: clamp01((read('cloud_cover') ?? 0) / 100),
    // 60 km/h is a gale; anything above it may as well be "as windy as we draw".
    wind: clamp01((read('wind_speed_10m') ?? 0) / 60),
    // A few millimetres an hour is already heavy rain, so 4 mm is full scale.
    // Anything falling reads as at least a light fall, so the scene never shows
    // a "rain" mood with no rain in it.
    precipitation:
      condition === 'rain' || condition === 'snow' || condition === 'storm'
        ? Math.max(0.25, clamp01(precipitation / 4))
        : 0,
    isDay: (read('is_day') ?? 1) === 1,
    place,
  };
}
