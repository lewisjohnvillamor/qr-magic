import { useEffect, useState } from 'react';

/**
 * Decode an image source into an element that is ready to draw.
 *
 * Returns `null` until the bytes are actually decoded, which matters more than
 * it sounds: `drawImage` with a half-loaded image silently draws nothing, and
 * the thing that would silently lose here is the logo in the middle of someone's
 * code. Callers depend on the returned element, so the draw simply happens
 * again once it arrives.
 *
 * The element is checked against the source on the way out rather than cleared
 * on the way in. Clearing would mean a state write during the effect for the
 * source that is going away — a wasted render — and comparing is both cheaper
 * and exact: a stale element is one whose `src` is not the one being asked for.
 */
export function useImage(src: string | null): HTMLImageElement | null {
  const [loaded, setLoaded] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) return;
    let live = true;
    const element = new Image();
    element.onload = () => {
      if (live) setLoaded(element);
    };
    element.onerror = () => {
      if (live) setLoaded(null);
    };
    element.src = src;
    return () => {
      live = false;
    };
  }, [src]);

  return src && loaded?.src === src ? loaded : null;
}
