import { useEffect, useState } from 'react';
import { SiteImage } from './SiteImage';

/**
 * Background slideshow that auto-advances every `intervalMs` (default 3s) with a
 * smooth crossfade. Direction-agnostic (works the same in RTL). Renders absolute
 * to fill its positioned parent.
 */
export function ImageCarousel({
  images,
  intervalMs = 3000,
  priority = false,
}: {
  images: string[];
  intervalMs?: number;
  /** The home hero is the LCP element — its slides must not lazy-load. */
  priority?: boolean;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % images.length), intervalMs);
    return () => clearInterval(id);
  }, [images.length, intervalMs]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {images.map((src, i) => (
        <div
          key={src}
          className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
          style={{ opacity: i === idx ? 1 : 0 }}
          aria-hidden
        >
          <SiteImage src={src} alt="" className="w-full h-full" priority={priority} />
        </div>
      ))}
    </div>
  );
}
