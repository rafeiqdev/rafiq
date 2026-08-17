import { useState } from 'react';
import { AppIcon } from '../AppIcon';
import type { IconName } from '../AppIcon';

/**
 * FNV-1a hash → a stable 32-bit number for a place name. Cheap, deterministic,
 * and good enough spread for colour selection (this is decoration, not crypto).
 */
function hashName(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The visual fill for a place: the real Google photo when we have one, and a
 * generated gradient tile when we don't.
 *
 * The old fallback was a single flat colour with one icon, so every photo-less
 * restaurant looked identical and dull. Instead — technique borrowed from
 * name-seeded avatars — each place hashes its own name into a distinct two-tone
 * gradient, stamps its initial, and keeps the category icon as a small badge.
 * Two places now never look the same unless they share a name, and the tile
 * reads as intentional branding rather than a missing image.
 *
 * Pure CSS (layered gradients), so a list of dozens of thumbnails costs nothing
 * — no canvas, no WebGL, no animation loop.
 */
export function PlaceThumb({
  name,
  photo,
  icon = 'map-pin',
  size = 'sm',
  className = '',
}: {
  name: string;
  photo?: string | null;
  icon?: IconName;
  /** `sm` for the list thumbnail, `lg` for the detail banner. */
  size?: 'sm' | 'lg';
  className?: string;
}) {
  const [imgOk, setImgOk] = useState(true);

  if (photo && imgOk) {
    return (
      <img
        src={photo}
        alt=""
        loading={size === 'lg' ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setImgOk(false)}
        className={`absolute inset-0 h-full w-full object-cover ${className}`}
      />
    );
  }

  const h = hashName(name || 'rafiq');
  const hue1 = h % 360;
  const hue2 = (hue1 + 35 + ((h >> 9) % 55)) % 360;
  const initial = (name.trim()[0] || '?').toUpperCase();

  // Two layered backgrounds: a faint dot grid for texture over a diagonal
  // two-tone gradient. Both are seeded from the same hue pair.
  const background = `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.16) 1px, transparent 0) 0 0 / ${
    size === 'lg' ? '16px 16px' : '11px 11px'
  }, linear-gradient(135deg, hsl(${hue1} 60% 52%), hsl(${hue2} 58% 38%))`;

  const isLg = size === 'lg';

  return (
    <div
      aria-hidden
      className={`absolute inset-0 flex items-center justify-center overflow-hidden ${className}`}
      style={{ background }}
    >
      {/* soft top-light so the tile has depth, not a flat wash */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/10" />
      <span
        className={`relative font-black leading-none text-white/90 drop-shadow-sm ${
          isLg ? 'text-6xl' : 'text-2xl'
        }`}
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        {initial}
      </span>
      <span
        className={`absolute flex items-center justify-center rounded-full bg-white/25 text-white backdrop-blur-sm ${
          isLg ? 'bottom-3 end-3 h-9 w-9' : 'bottom-1 end-1 h-5 w-5'
        }`}
      >
        <AppIcon name={icon} className={isLg ? 'h-4 w-4' : 'h-3 w-3'} />
      </span>
    </div>
  );
}
