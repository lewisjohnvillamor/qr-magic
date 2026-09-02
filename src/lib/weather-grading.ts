/**
 * How live weather bends a theme's look.
 *
 * The themes are the art direction and stay in charge: weather is a grade
 * applied on top, not a replacement palette. Heavy cloud pulls the light down
 * and the haze in; night cools and dims everything; fog does what fog does. A
 * theme still looks like itself in the rain.
 *
 * Every multiplier is bounded so no combination of conditions can grade the
 * scene into darkness — and none of it touches the QR code, which is locked to
 * its own flat colours at scan time regardless of the sky.
 */

import type { Weather } from './weather';

export interface WeatherGrade {
  /** Multiplier on ambient and key light. */
  light: number;
  /** Multiplier on the theme's fog near distance: lower pulls haze closer. */
  fogNear: number;
  /** Multiplier on the theme's fog far distance. */
  fogFar: number;
  /** 0..1 blend toward a desaturated overcast grey. */
  wash: number;
  /** Multiplier on the sculpture's idle sway, so wind is visible in the model. */
  sway: number;
}

export const NEUTRAL_GRADE: WeatherGrade = {
  light: 1,
  fogNear: 1,
  fogFar: 1,
  wash: 0,
  sway: 1,
};

export function gradeFor(weather: Weather | null): WeatherGrade {
  if (!weather) return NEUTRAL_GRADE;

  // Cloud is the main dimmer, but only down to 72%: a fully overcast scene
  // should read as flat and grey, not as an unlit one.
  let light = 1 - weather.cloudCover * 0.28;
  let fogNear = 1;
  let fogFar = 1;
  let wash = weather.cloudCover * 0.35;

  switch (weather.condition) {
    case 'fog':
      // Fog is the one condition allowed to dominate the frame.
      fogNear = 0.35;
      fogFar = 0.55;
      wash = Math.max(wash, 0.6);
      light *= 0.9;
      break;
    case 'rain':
      fogNear = 0.7;
      fogFar = 0.85;
      wash = Math.max(wash, 0.4);
      break;
    case 'storm':
      fogNear = 0.6;
      fogFar = 0.8;
      wash = Math.max(wash, 0.5);
      light *= 0.85;
      break;
    case 'snow':
      // Snow brightens rather than darkens: the sky is low but everything
      // scatters.
      fogNear = 0.6;
      fogFar = 0.9;
      wash = Math.max(wash, 0.45);
      light *= 1.05;
      break;
    case 'cloudy':
    case 'clear':
      break;
  }

  // Night is a floor, not a blackout: the sculpture still has to be legible,
  // and someone browsing at 2am should still see what they came for.
  if (!weather.isDay) {
    light *= 0.6;
    fogFar *= 0.85;
  }

  return {
    light: Math.min(1.2, Math.max(0.45, light)),
    fogNear,
    fogFar,
    wash: Math.min(1, wash),
    // A gale gets roughly double the idle sway; still air gets the usual.
    sway: 1 + weather.wind * 1.2,
  };
}
