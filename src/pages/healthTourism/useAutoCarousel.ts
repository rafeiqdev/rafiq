import { useEffect, useRef, useState } from 'react';

/**
 * Rotating-index autoplay carousel: React-state equivalent of the standalone
 * mockup's `initInfiniteForwardSlider`, which physically moved DOM nodes
 * (`carousel.appendChild(firstCard)`) to fake an infinite loop. Here the loop
 * is just `index % length`, so React keeps owning the DOM.
 *
 * Pauses while the pointer/touch is down and resumes `resumeDelayMs` after
 * release, matching the mockup's touch-pause behavior.
 */
export function useAutoCarousel(length: number, intervalMs: number, resumeDelayMs = 1500) {
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (length <= 1) return;
    const id = setInterval(() => {
      if (!pausedRef.current) setIndex((i) => (i + 1) % length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [length, intervalMs]);

  const pause = () => {
    pausedRef.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  };
  const resume = () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      pausedRef.current = false;
    }, resumeDelayMs);
  };

  const goTo = (i: number) => setIndex(((i % length) + length) % length);

  useEffect(() => () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }, []);

  return { index, goTo, pause, resume };
}
