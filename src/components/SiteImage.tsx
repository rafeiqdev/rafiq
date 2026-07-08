import { useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Optimized, lazy-loaded image with a fade-in and a graceful on-brand fallback.
 * Always render inside a sized container (give it width/height via className).
 */
export function SiteImage({
  src,
  alt,
  className = '',
  imgClassName = 'w-full h-full object-cover',
  fallback,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallback?: ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className={`relative overflow-hidden bg-navy/5 ${className}`}>
      {!failed && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`${imgClassName} transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {/* loading skeleton */}
      {!loaded && !failed && <div className="absolute inset-0 animate-pulse bg-cream-dark/60" aria-hidden />}
      {/* fallback when the photo can't load */}
      {failed && (fallback ?? <div className="absolute inset-0 bg-gradient-to-br from-navy to-navy-light" aria-hidden />)}
    </div>
  );
}
