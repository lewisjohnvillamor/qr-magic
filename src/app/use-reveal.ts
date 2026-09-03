import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { createRevealTimeline, createRevealValues } from '../animation/create-reveal-timeline';
import type { RevealValues } from '../animation/create-reveal-timeline';
import type { Timeline } from '../animation/timeline';

export interface UseRevealOptions {
  reducedMotion: boolean;
  onRevealComplete: () => void;
  onReturnComplete: () => void;
}

export interface RevealController {
  values: RefObject<RevealValues | null>;
  reveal: () => void;
  returnToSculpture: () => void;
  /** Jump straight to the sculpture pose without animating (input changed). */
  resetImmediately: () => void;
}

/**
 * Owns the single master timeline and its React lifecycle.
 *
 * The timeline is created once per motion preference and killed on unmount, so
 * no animation ever outlives the component that started it.
 */
export function useReveal(options: UseRevealOptions): RevealController {
  const { reducedMotion, onRevealComplete, onReturnComplete } = options;
  const values = useRef<RevealValues>(createRevealValues());
  const timelineRef = useRef<Timeline<RevealValues> | null>(null);

  const callbacks = useRef({ onRevealComplete, onReturnComplete });
  useEffect(() => {
    callbacks.current = { onRevealComplete, onReturnComplete };
  }, [onRevealComplete, onReturnComplete]);

  useEffect(() => {
    const current = values.current;
    const timeline = createRevealTimeline(current, {
      reducedMotion,
      callbacks: {
        onRevealComplete: () => callbacks.current.onRevealComplete(),
        onReturnComplete: () => callbacks.current.onReturnComplete(),
      },
    });
    timelineRef.current = timeline;
    return () => {
      timeline.kill();
      timelineRef.current = null;
      Object.assign(current, createRevealValues());
    };
  }, [reducedMotion]);

  const reveal = useCallback(() => {
    timelineRef.current?.play();
  }, []);

  const returnToSculpture = useCallback(() => {
    timelineRef.current?.reverse();
  }, []);

  const resetImmediately = useCallback(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    timeline.pause(0);
    Object.assign(values.current, createRevealValues());
  }, []);

  return useMemo(
    () => ({ values, reveal, returnToSculpture, resetImmediately }),
    [reveal, returnToSculpture, resetImmediately],
  );
}
