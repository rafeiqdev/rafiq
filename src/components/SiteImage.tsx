import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Optimized image with a fade-in and a graceful on-brand fallback.
 * Always render inside a sized container (give it width/height via className).
 *
 * Lazy by default; pass `priority` for above-the-fold images (the hero
 * carousel is the LCP element) to load eagerly at high fetch priority.
 */
export function SiteImage({
  src,
  alt,
  className = '',
  imgClassName = 'w-full h-full object-cover',
  fallback,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallback?: ReactNode;
  priority?: boolean;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // A cached image fires `load` before React attaches onLoad, so relying on
  // the handler alone left every warm-cache image at opacity-0 forever.
  useEffect(() => {
    const el = ref.current;
    if (el?.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <div className={`relative overflow-hidden bg-navy/5 ${className}`}>
      {!failed && (
        <img
          ref={ref}
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`${imgClassName} transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          // React 18 has no fetchPriority prop; the lowercase DOM attribute
          // passes through untouched.
          {...(priority ? ({ fetchpriority: 'high' } as Record<string, string>) : null)}
        />
      )}
      {/* loading skeleton */}
      {!loaded && !failed && <div className="absolute inset-0 animate-pulse bg-cream-dark/60" aria-hidden />}
      {/* fallback when the photo can't load */}
      {failed && (fallback ?? <div className="absolute inset-0 bg-gradient-to-br from-navy to-navy-light" aria-hidden />)}
    </div>
  );
}
