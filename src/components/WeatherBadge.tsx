import type { Weather } from '../lib/weather';

export interface WeatherBadgeProps {
  weather: Weather | null;
}

/** One glyph per condition, matching the six moods the scene can draw. */
const GLYPH: Record<Weather['condition'], string> = {
  clear: '☀',
  cloudy: '☁',
  fog: '≈',
  rain: '☂',
  snow: '❄',
  storm: '⚡',
};

const LABEL: Record<Weather['condition'], string> = {
  clear: 'Clear',
  cloudy: 'Cloudy',
  fog: 'Fog',
  rain: 'Rain',
  snow: 'Snow',
  storm: 'Storm',
};

/**
 * What the sky is doing where you are, and why the scene looks like this.
 *
 * Without it the weather is just an unexplained mood — the sculpture is dim
 * and something is falling on it and you have no idea why. It also discloses
 * the one outside request the product makes, at the moment its result is
 * visible, which is where a disclosure is actually read.
 *
 * Renders nothing until a reading arrives, so a blocked or failed lookup
 * leaves no empty slot behind.
 */
export function WeatherBadge({ weather }: WeatherBadgeProps) {
  if (!weather) return null;

  const condition = LABEL[weather.condition];
  const temperature = `${Math.round(weather.temperature)}°C`;
  const where = weather.place;

  return (
    <span
      className="weather-badge"
      data-testid="weather-badge"
      title={`${condition}, ${temperature}${where ? ` in ${where}` : ''} — live conditions for your time zone, from Open-Meteo. Your exact location is never requested or sent.`}
    >
      <span aria-hidden="true">{GLYPH[weather.condition]}</span>
      <span className="visually-hidden">Local weather: </span>
      <span className="weather-reading">
        {condition} {temperature}
      </span>
      {/* The place is the time zone's reference city, not the viewer's
          position — naming it is what stops the reading looking like it knows
          exactly where they are. */}
      {where ? <span className="weather-place">{where}</span> : null}
    </span>
  );
}
