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
 * The visual fill for a place: the real Google photo when one is provided, and
 * a generated tile when it is not.
 *
 * Design intent, after two rejected attempts: NOT a flat single colour (every
 * place looked identical) and NOT a big bold initial (loud and cheap-looking).
 * Instead each place hashes its name into a soft pastel tint — barely different
 * from its neighbour, so a full list reads as calm and intentional rather than
 * a wall of the same box — and shows only its category icon, quietly. The tile
 * is meant to recede, not shout.
 *
 * Pure CSS, so a list of dozens of thumbnails costs nothing — no canvas, no
 * WebGL, no animation loop.
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

  const hue = hashName(name || 'rafiq') % 360;
  const isLg = size === 'lg';

  if (isLg) {
    // Banner: a muted mid-tone wash with a large, soft icon watermark. It sits
    // under the card's dark top-gradient, so it stays calm and legible there.
    const background = `linear-gradient(150deg, hsl(${hue} 34% 50%), hsl(${hue} 40% 38%))`;
    return (
      <div
        aria-hidden
        className={`absolute inset-0 flex items-center justify-center overflow-hidden ${className}`}
        style={{ background }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-white/10" />
        <AppIcon name={icon} className="relative h-20 w-20 text-white/25" />
      </div>
    );
  }

  // List thumbnail: a soft pastel tint carrying just the category icon in a
  // muted tone of the same hue. Quiet, distinct per place, never garish.
  const background = `linear-gradient(150deg, hsl(${hue} 44% 94%), hsl(${hue} 40% 87%))`;
  return (
    <div
      aria-hidden
      className={`absolute inset-0 flex items-center justify-center overflow-hidden ${className}`}
      style={{ background }}
    >
      <span style={{ color: `hsl(${hue} 42% 42%)` }}>
        <AppIcon name={icon} className="h-6 w-6" />
      </span>
    </div>
  );
}
