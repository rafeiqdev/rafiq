import { AppIcon } from './AppIcon';

/** Read-only star rating with optional "(4.5) · 12" summary. */
export function ReviewStars({ rating, count, size = 'w-4 h-4' }: { rating: number; count?: number; size?: string }) {
  const full = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <AppIcon
          key={i}
          name="star"
          className={`${size} ${i <= full ? 'text-gold-dark' : 'text-cream-dark'}`}
          fill={i <= full ? 'currentColor' : 'none'}
        />
      ))}
      {count !== undefined && (
        <span className="ms-1 text-xs font-semibold text-navy/60" dir="ltr">
          {rating > 0 ? rating.toFixed(1) : '—'} ({count})
        </span>
      )}
    </span>
  );
}

/** Interactive 1–5 star input. */
export function StarRatingInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" onClick={() => onChange(i)} aria-label={`${i}`} className="transition-transform hover:scale-110">
          <AppIcon
            name="star"
            className={`w-8 h-8 ${i <= value ? 'text-gold-dark' : 'text-cream-dark'}`}
            fill={i <= value ? 'currentColor' : 'none'}
          />
        </button>
      ))}
    </div>
  );
}
