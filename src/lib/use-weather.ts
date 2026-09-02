import { useEffect, useState } from 'react';
import type { Weather } from './weather';
import { fetchWeather } from './weather';

/**
 * How often to ask again. Weather moves slowly and a scene left open on a
 * second monitor should not be polling a public API all afternoon.
 */
const REFRESH_MS = 15 * 60 * 1000;

/**
 * Live conditions where the viewer is, or null until (and unless) they arrive.
 *
 * Starts null and stays null on every failure, so the scene renders normally
 * from the first frame and only ever gains weather. Nothing waits on this.
 */
export function useWeather(enabled = true): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    // Nothing to grade when there is no scene, so nothing is fetched either.
    if (!enabled) return;
    const controller = new AbortController();
    let timer = 0;

    const poll = async () => {
      const next = await fetchWeather(controller.signal);
      if (controller.signal.aborted) return;
      // A failed refresh keeps the last good reading rather than clearing the
      // sky: a dropped request is not evidence the rain stopped.
      if (next) setWeather(next);
      timer = window.setTimeout(() => void poll(), REFRESH_MS);
    };

    void poll();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [enabled]);

  return weather;
}
