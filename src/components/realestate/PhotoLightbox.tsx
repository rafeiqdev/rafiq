import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../Modal';
import { AppIcon } from '../AppIcon';
import { listingThumbUrl } from '../../lib/images';

/**
 * Full-size photo viewer for a listing gallery. Built on the shared Modal
 * (portal + focus trap + scroll lock), so it inherits the layout-shift-free
 * scroll lock instead of re-implementing it.
 */
export function PhotoLightbox({
  photos,
  index,
  alt,
  onClose,
}: {
  photos: string[];
  index: number;
  alt: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [active, setActive] = useState(index);

  useEffect(() => setActive(index), [index]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setActive((i) => (i + 1) % photos.length);
      if (e.key === 'ArrowLeft') setActive((i) => (i - 1 + photos.length) % photos.length);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [photos.length]);

  return (
    <Modal onClose={onClose} labelId="photo-lightbox-title" maxWidth="max-w-5xl">
      <h2 id="photo-lightbox-title" className="sr-only">{alt}</h2>
      <div className="relative flex flex-col items-center">
        <div className="relative w-full flex items-center justify-center">
          <img
            src={photos[active]}
            alt={t('realEstate.detail.photo', { n: active + 1 })}
            className="max-h-[80vh] w-auto max-w-full rounded-card object-contain bg-navy-900"
          />
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setActive((i) => (i - 1 + photos.length) % photos.length)}
                aria-label={t('realEstate.detail.prevPhoto')}
                className="absolute start-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-navy shadow-card hover:bg-white"
              >
                <AppIcon name="chevron-left" className="w-5 h-5 dir-arrow" />
              </button>
              <button
                type="button"
                onClick={() => setActive((i) => (i + 1) % photos.length)}
                aria-label={t('realEstate.detail.nextPhoto')}
                className="absolute end-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-navy shadow-card hover:bg-white"
              >
                <AppIcon name="chevron-right" className="w-5 h-5 dir-arrow" />
              </button>
              <span className="absolute bottom-2 start-1/2 -translate-x-1/2 rounded-full bg-navy/70 px-3 py-1 text-xs font-bold text-white" dir="ltr">
                {active + 1} / {photos.length}
              </span>
            </>
          )}
        </div>
        {photos.length > 1 && (
          <div className="mt-3 flex w-full gap-2 overflow-x-auto pb-1">
            {photos.map((u, i) => (
              <button
                key={u + i}
                type="button"
                onClick={() => setActive(i)}
                aria-label={t('realEstate.detail.photo', { n: i + 1 })}
                aria-current={i === active}
                className={`shrink-0 w-16 h-12 rounded-btn overflow-hidden border-2 ${i === active ? 'border-navy' : 'border-transparent'}`}
              >
                <img
                  src={listingThumbUrl(u)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={64}
                  height={48}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
