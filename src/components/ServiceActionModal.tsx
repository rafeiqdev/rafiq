import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { pickText } from '../data/services';
import type { ServiceItem } from '../data/services';
import { guideSlugForServiceId } from '../data/guides';
import { useApp } from '../context/AppContext';
import { Modal } from './Modal';
import { AppIcon, DirArrow } from './AppIcon';
import type { IconName } from './AppIcon';
import { ServiceRequestModal } from './ServiceRequestModal';
import { track } from '../lib/analytics';

/**
 * Shown when a user picks a service. Three ways to handle it:
 *  - Self-guide   → the open step-by-step guide page (/services/:slug).
 *  - AI assistant → the AI chat (/premium), pre-pointed at this service.
 *  - Get a person → the existing service-request form (field assistant).
 */
export function ServiceActionModal({ service, onClose }: { service: ServiceItem; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { tier } = useApp();
  const isPro = tier === 'pro' || tier === 'elite';
  const [showRequest, setShowRequest] = useState(false);

  useEffect(() => {
    track('guide_choice_shown', { service_slug: service.id, lang: i18n.language });
  }, [service.id, i18n.language]);

  if (showRequest) return <ServiceRequestModal service={service} onClose={onClose} />;

  const goGuide = () => {
    track('diy_clicked', { service_slug: service.id, lang: i18n.language });
    const slug = guideSlugForServiceId(service.id);
    if (slug && isPro) navigate(`/services/${slug}`);
    else navigate(`/premium?topic=${encodeURIComponent(service.id)}`);
  };
  const goAi = () => {
    track('ai_clicked', { service_slug: service.id, lang: i18n.language });
    navigate(`/premium?topic=${encodeURIComponent(service.id)}`);
  };
  const getPerson = () => {
    track('get_person_clicked', { service_slug: service.id, lang: i18n.language });
    setShowRequest(true);
  };

  return (
    <Modal onClose={onClose} labelId="service-action-title" maxWidth="max-w-2xl">
      <div className="card p-6">
        <h2 id="service-action-title" className="text-lg font-extrabold text-navy text-center">
          {t('guide.choice.title')}
        </h2>
        <p className="mt-1 text-center text-sm text-navy/60">{pickText(service.title, i18n.language)}</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ChoiceCard
            icon="file-text"
            badge={t('guide.badge.pro')}
            badgeClass="bg-gold-soft text-gold-dark"
            label={t('guide.choice.diy.label')}
            subtitle={t('guide.choice.diy.subtitle')}
            onClick={goGuide}
          />
          <ChoiceCard
            icon="message-circle"
            badge={t('guide.choice.ai.badge')}
            badgeClass="bg-gold-soft text-gold-dark"
            label={t('guide.choice.ai.label')}
            subtitle={t('guide.choice.ai.subtitle')}
            onClick={goAi}
          />
          <ChoiceCard
            icon="users"
            badge={t('guide.choice.person.badge')}
            badgeClass="bg-navy text-white"
            label={t('guide.choice.person.label')}
            subtitle={t('guide.choice.person.subtitle')}
            onClick={getPerson}
          />
        </div>
      </div>
    </Modal>
  );
}

function ChoiceCard({
  icon,
  badge,
  badgeClass,
  label,
  subtitle,
  onClick,
}: {
  icon: IconName;
  badge: string;
  badgeClass: string;
  label: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="card card-hover p-5 text-start flex flex-col h-full">
      <div className="flex items-center justify-between">
        <span className="icon-chip">
          <AppIcon name={icon} />
        </span>
        <span className={`rounded-full text-[10px] font-bold px-2 py-0.5 ${badgeClass}`}>{badge}</span>
      </div>
      <h3 className="mt-3 font-bold text-navy">{label}</h3>
      <p className="mt-1 text-xs text-navy/60 flex-1">{subtitle}</p>
      <span className="mt-3 text-sm font-semibold text-navy inline-flex items-center gap-1">
        <DirArrow className="w-4 h-4" />
      </span>
    </button>
  );
}
