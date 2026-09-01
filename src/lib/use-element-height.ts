import { useEffect, useState } from 'react';

/**
 * Track the height of the first element matching `selector`.
 *
 * The scene needs to know how much of the viewport the control panel covers so
 * the QR code can be framed in the space that is actually visible.
 */
export function useElementHeight(selector: string): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const element = document.querySelector(selector);
    if (!element) return;

    const measure = () => setHeight(element.getBoundingClientRect().height);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [selector]);

  return height;
}
