import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { pickText } from '../data/services';
import type { ServiceItem } from '../data/services';
import { AppIcon, DirArrow } from './AppIcon';
import { ServiceRequestModal } from './ServiceRequestModal';
import { annotateGlossaryTerms } from './TermTooltip';
import { track } from '../lib/analytics';
import type { Lang } from '../lib/types';
import './ExpandableServiceCard.css';

type Mode = 'compact' | 'detail' | 'choices';

/** Ported verbatim from the mockup (page.tsx CheckIcon) — the source used its
 * own inline SVGs instead of the site's icon set for this one glyph. */
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 12 2 2 4-4" />
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </svg>
  );
}

/**
 * The service card that starts small in a grid/list and expands to a
 * full-size detail view on click — ported 1:1 (layout, motion, the white
 * toolbar) from the user's mockup. See ExpandableServiceCard.css for the
 * one deliberate deviation (icon instead of per-service photography).
 *
 * The "how do you want this done" panel wires into the site's real AI/human
 * flow (same paths as ServiceActionModal: /premium?topic= and
 * ServiceRequestModal) instead of the mockup's toast placeholder.
 */
export function ExpandableServiceCard({
  service,
  index,
  categoryTitle,
}: {
  service: ServiceItem;
  /** position within the list this card renders in — becomes the "01" index */
  index: number;
  categoryTitle: string;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('compact');
  const [showRequest, setShowRequest] = useState(false);
  const isOpen = mode !== 'compact';

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCard();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const title = pickText(service.title, lang);
  const desc = pickText(service.desc, lang);
  const badgeText = service.type === 'partner' ? t('services.partnerBadge') : t('services.directBadge');
  const num = String(index + 1).padStart(2, '0');

  const openCard = () => {
    track('service_view', { target: service.id, meta: { category: service.category, type: service.type } });
    setMode('detail');
  };
  const closeCard = () => {
    setMode('compact');
    setShowRequest(false);
  };
  const openChoices = () => {
    track('service_click', { target: service.id, meta: { category: service.category } });
    setMode('choices');
  };
  const goAi = () => {
    navigate(`/premium?topic=${encodeURIComponent(service.id)}`);
  };
  const getPerson = () => {
    track('request_started', { target: service.id, meta: { category: service.category } });
    setShowRequest(true);
  };

  return (
    <div className="esc-scope h-full">
      <button type="button" onClick={openCard} className="esc-compact-card" aria-haspopup="dialog">
        <span className="esc-compact-visual">
          <AppIcon name={service.icon} />
          <span className="esc-compact-number">{num}</span>
        </span>
        <span className="esc-compact-content">
          <span className="esc-compact-title-row">
            <strong>{title}</strong>
            <span className="esc-compact-verified">
              <CheckIcon />
              {badgeText}
            </span>
          </span>
          <span className="esc-compact-subtitle">{categoryTitle}</span>
          <span className="esc-compact-description">{desc}</span>
          <span className="esc-compact-footer">
            {service.onRequest && <span className="esc-new-request">{t('services.onRequest')}</span>}
            <span className="esc-expand-cue">
              {t('services.request')}
              <DirArrow className="w-3.5 h-3.5" />
            </span>
          </span>
        </span>
      </button>

      {isOpen &&
        createPortal(
          showRequest ? (
            <ServiceRequestModal
              source={{ id: service.id, title, category: service.category, type: service.type }}
              onClose={closeCard}
            />
          ) : (
            <div className="esc-detail-overlay">
              <button
                type="button"
                className="esc-overlay-backdrop"
                onClick={closeCard}
                aria-label={t('common.close')}
              />
              <article
                className={`esc-service-card ${mode === 'choices' ? 'esc-show-choices' : ''}`}
                role="dialog"
                aria-modal="true"
                aria-label={title}
              >
                <div className="esc-service-image">
                  <AppIcon name={service.icon} />
                </div>
                <div className="esc-image-tint" />

                <div className="esc-card-toolbar">
                  <div className="esc-card-topline">
                    <span className="esc-category-pill">{categoryTitle}</span>
                    <span className="esc-verified-pill">
                      <CheckIcon />
                      {badgeText}
                    </span>
                  </div>
                  <button type="button" className="esc-detail-close" onClick={closeCard} aria-label={t('common.close')}>
                    ×
                  </button>
                </div>

                <div className="esc-card-summary">
                  <span className="esc-service-index">{num}</span>
                  <h2>{annotateGlossaryTerms(title, lang as Lang)}</h2>
                  <p className="esc-service-description">{annotateGlossaryTerms(desc, lang as Lang)}</p>

                  {service.onRequest && (
                    <div className="esc-quick-facts">
                      <span>{t('services.onRequest')}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    className="esc-primary-action"
                    onClick={openChoices}
                    aria-expanded={mode === 'choices'}
                  >
                    <span>{t('common.helpMe')}</span>
                    <span className="esc-action-icon">
                      <DirArrow className="w-4 h-4" />
                    </span>
                  </button>
                </div>

                <section className="esc-choice-panel" aria-hidden={mode !== 'choices'}>
                  <button
                    type="button"
                    className="esc-close-panel"
                    onClick={() => setMode('detail')}
                    aria-label={t('serviceAction.choice.back')}
                  >
                    ×
                  </button>
                  <span className="esc-panel-kicker">{title}</span>
                  <h3>{t('serviceAction.choice.title')}</h3>

                  <button type="button" className="esc-choice" onClick={goAi}>
                    <span className="esc-choice-icon">
                      <AppIcon name="message-circle" />
                    </span>
                    <span className="esc-choice-copy">
                      <span className="esc-choice-label">{t('serviceAction.choice.ai.badge')}</span>
                      <strong>{t('serviceAction.choice.ai.label')}</strong>
                      <small>{t('serviceAction.choice.ai.subtitle')}</small>
                    </span>
                    <span className="esc-choice-arrow">
                      <DirArrow className="w-3.5 h-3.5" />
                    </span>
                  </button>

                  <button type="button" className="esc-choice esc-choice-human" onClick={getPerson}>
                    <span className="esc-choice-icon">
                      <AppIcon name="users" />
                    </span>
                    <span className="esc-choice-copy">
                      <span className="esc-choice-label">{t('serviceAction.choice.person.badge')}</span>
                      <strong>{t('serviceAction.choice.person.label')}</strong>
                      <small>{t('serviceAction.choice.person.subtitle')}</small>
                    </span>
                    <span className="esc-choice-arrow">
                      <DirArrow className="w-3.5 h-3.5" />
                    </span>
                  </button>

                  <button type="button" className="esc-back-action" onClick={() => setMode('detail')}>
                    {t('serviceAction.choice.back')}
                  </button>
                </section>
              </article>
            </div>
          ),
          document.body,
        )}
    </div>
  );
}
