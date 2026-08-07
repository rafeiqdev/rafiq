import { useEffect, useRef } from 'react';
import { useAutoCarousel } from './useAutoCarousel';

/**
 * Single-card-at-a-time auto-advancing carousel for a horizontally
 * snap-scrolling track (Tailwind `snap-x snap-mandatory`). Reimplements the
 * mockup's `initInfiniteForwardSlider` (which physically moved DOM nodes)
 * as index + a manual scrollLeft update, so React keeps owning the DOM.
 *
 * Deliberately NOT scrollIntoView: it can adjust the whole page's (or any
 * ancestor's) vertical scroll to bring the card into view, and with three of
 * these carousels auto-advancing on independent timers, that fights the
 * visitor's own scroll every few seconds. Setting the track's scrollLeft
 * directly touches only the horizontal track, never the page.
 */
export function useSnapCarousel(length: number, intervalMs: number, resumeDelayMs = 1500) {
  const { index, pause, resume } = useAutoCarousel(length, intervalMs, resumeDelayMs);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const child = track.children[index] as HTMLElement | undefined;
    if (!child) return;
    track.scrollTo({ left: child.offsetLeft, behavior: 'smooth' });
  }, [index]);

  return { index, pause, resume, trackRef };
}
