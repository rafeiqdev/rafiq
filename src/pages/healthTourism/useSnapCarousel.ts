import { useEffect, useRef } from 'react';
import { useAutoCarousel } from './useAutoCarousel';

/**
 * Single-card-at-a-time auto-advancing carousel for a horizontally
 * snap-scrolling track (Tailwind `snap-x snap-mandatory`). Reimplements the
 * mockup's `initInfiniteForwardSlider` (which physically moved DOM nodes)
 * as index + scrollIntoView, so React keeps owning the DOM.
 */
export function useSnapCarousel(length: number, intervalMs: number, resumeDelayMs = 1500) {
  const { index, pause, resume } = useAutoCarousel(length, intervalMs, resumeDelayMs);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const child = track.children[index] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  }, [index]);

  return { index, pause, resume, trackRef };
}
