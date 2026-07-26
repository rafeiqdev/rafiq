import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The Rafiq loading screen — the branded replacement for the generic ring
 * spinner that used to sit in every "still fetching" state.
 *
 * The wordmark ships as five separate letter PNGs (public/loader/) instead of
 * one image so each letter can hop on its own delay, wave-style, while the
 * word as a whole breathes. The percentages below are the letters' positions
 * inside the original square logo — they reconstruct the wordmark exactly, so
 * the box must stay square for the spacing to hold.
 *
 * Keyframes live in index.css (.rq-*) alongside the rest of the site's motion,
 * where the prefers-reduced-motion block already switches them all off.
 */
const LETTERS: { src: string; left: string; top: string; width: string; height: string }[] = [
  { src: '/loader/rafiq1.png', left: '4.94%', top: '32.30%', width: '20.41%', height: '34.93%' },
  { src: '/loader/rafiq2.png', left: '22.73%', top: '39.79%', width: '25.68%', height: '26.40%' },
  { src: '/loader/rafiq3.png', left: '45.30%', top: '25.68%', width: '17.22%', height: '41.07%' },
  { src: '/loader/rafiq4.png', left: '61.08%', top: '29.98%', width: '9.73%', height: '34.37%' },
  { src: '/loader/rafiq5.png', left: '68.82%', top: '38.04%', width: '29.59%', height: '37.48%' },
];

/** One beat between letters — the hop reads as a wave across the word. */
const HOP_STAGGER_S = 0.13;

const SIZES = {
  sm: 'clamp(88px, 22vw, 116px)',
  md: 'clamp(116px, 30vw, 150px)',
  lg: 'clamp(140px, 36vw, 190px)',
} as const;

export function RafiqLoader({
  size = 'md',
  className = '',
  label,
}: {
  size?: keyof typeof SIZES;
  /** Extra classes on the outer wrapper — usually a min-height to centre within. */
  className?: string;
  /** Visible caption under the mark. Omit for the silent (icon-only) loader. */
  label?: string;
}) {
  const { t } = useTranslation();
  const box = SIZES[size];

  return (
    <div
      className={`flex flex-col items-center justify-center ${className}`}
      role="status"
      aria-live="polite"
      aria-busy
    >
      <div className="relative flex items-center justify-center" style={{ width: box, height: box }}>
        {/* soft navy halo breathing behind the word */}
        <div
          className="rq-halo pointer-events-none absolute rounded-full"
          style={{
            width: '135%',
            height: '135%',
            background: 'radial-gradient(circle, rgba(26,58,107,0.09) 0%, rgba(26,58,107,0) 68%)',
          }}
          aria-hidden
        />
        <div className="rq-rise absolute inset-0">
          <div className="rq-breathe absolute inset-0">
            {LETTERS.map((l, i) => (
              <img
                key={l.src}
                src={l.src}
                alt=""
                aria-hidden
                draggable={false}
                className="rq-letter absolute select-none"
                style={
                  {
                    left: l.left,
                    top: l.top,
                    width: l.width,
                    height: l.height,
                    '--rq-delay': `${i * HOP_STAGGER_S}s`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        </div>
      </div>
      {label ? (
        <p className="animate-fade-in mt-2 text-sm font-semibold text-navy/70">{label}</p>
      ) : (
        <span className="sr-only">{t('common.loading')}</span>
      )}
    </div>
  );
}

/**
 * Full-screen variant — for the moments where the loader IS the page
 * (route chunk still downloading, session still resolving).
 *
 * The mark has to land on the optical centre of what the user actually sees,
 * which depends on whether Layout's header is on screen with it:
 *   inside Layout (page still fetching) → the sticky h-16 header is above it,
 *                                         so centre in the viewport MINUS 4rem
 *   chromeless (App's Suspense fallback replaces the whole shell, header and
 *               all)                    → centre in the full viewport
 * Getting this wrong is only ~32px, but at this size it reads as "sitting
 * slightly too high" rather than centred. dvh (not vh) so mobile browser
 * chrome collapsing doesn't shift it.
 */
export function RafiqLoaderScreen({ label, chromeless = false }: { label?: string; chromeless?: boolean }) {
  return (
    <div
      className={`flex w-full items-center justify-center px-4 ${
        chromeless ? 'min-h-[100dvh]' : 'min-h-[calc(100dvh-4rem)]'
      }`}
    >
      <RafiqLoader label={label} />
    </div>
  );
}
