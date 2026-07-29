import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { pickText } from '../data/services';
import type { ServiceItem } from '../data/services';
import { Modal } from './Modal';
import { AppIcon, DirArrow } from './AppIcon';
import type { IconName } from './AppIcon';
import { ServiceRequestModal } from './ServiceRequestModal';
import { track } from '../lib/analytics';

/**
 * Shown when a user picks a service. Two ways to handle it:
 *  - AI assistant → the AI chat (/premium), pre-pointed at this service.
 *  - Get a person → the service-request form (field assistant).
 */
export function ServiceActionModal({ service, onClose }: { service: ServiceItem; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [showRequest, setShowRequest] = useState(false);

  useEffect(() => {
    track('service_view', { target: service.id, meta: { category: service.category, type: service.type } });
  }, [service.id, service.category, service.type]);

  if (showRequest) {
    return (
      <ServiceRequestModal
        source={{ id: service.id, title: pickText(service.title, i18n.language), category: service.category, type: service.type }}
        onClose={onClose}
      />
    );
  }

  const goAi = () => {
    // chat_opened fires when /premium actually mounts (Premium.tsx), which
    // also covers every other way of reaching the chat — no separate event here.
    navigate(`/premium?topic=${encodeURIComponent(service.id)}`);
  };
  const getPerson = () => {
    track('request_started', { target: service.id, meta: { category: service.category } });
    setShowRequest(true);
  };

  return (
    <Modal onClose={onClose} labelId="service-action-title" maxWidth="max-w-md">
      <div className="card p-4 sm:p-5">
        <h2 id="service-action-title" className="text-base font-extrabold text-navy text-center">
          {t('serviceAction.choice.title')}
        </h2>
        <p className="mt-0.5 text-center text-xs text-navy/60">{pickText(service.title, i18n.language)}</p>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <ChoiceCard
            icon="message-circle"
            iconAccent="bg-gold text-white"
            badge={t('serviceAction.choice.ai.badge')}
            badgeClass="bg-gold-soft text-gold-dark"
            label={t('serviceAction.choice.ai.label')}
            subtitle={t('serviceAction.choice.ai.subtitle')}
            onClick={goAi}
          />
          <ChoiceCard
            icon="users"
            iconAccent="bg-brand-red text-white"
            badge={t('serviceAction.choice.person.badge')}
            badgeClass="bg-navy text-white"
            label={t('serviceAction.choice.person.label')}
            subtitle={t('serviceAction.choice.person.subtitle')}
            onClick={getPerson}
          />
        </div>
      </div>
    </Modal>
  );
}

function ChoiceCard({
  icon,
  iconAccent,
  badge,
  badgeClass,
  label,
  subtitle,
  onClick,
}: {
  icon: IconName;
  /** solid fill + text-white for the icon badge, e.g. "bg-navy text-white" */
  iconAccent: string;
  badge: string;
  badgeClass: string;
  label: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group card p-3 text-start flex flex-col h-full border border-cream-dark hover:border-navy/25 hover:-translate-y-0.5 hover:shadow-cardHover transition-all duration-200"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`flex items-center justify-center w-9 h-9 rounded-xl shadow-soft ${iconAccent}`}>
          <AppIcon name={icon} className="w-4 h-4" />
        </span>
        <span className={`rounded-full text-[9px] font-bold px-2 py-0.5 ${badgeClass}`}>{badge}</span>
      </div>
      <h3 className="mt-2.5 text-sm font-extrabold text-navy">{label}</h3>
      <p className="mt-0.5 text-[11px] text-navy/60 leading-snug flex-1">{subtitle}</p>
      <span className="mt-2.5 inline-flex items-center justify-center w-7 h-7 rounded-full bg-cream text-navy group-hover:bg-navy group-hover:text-white transition-colors">
        <DirArrow className="w-3.5 h-3.5" />
      </span>
    </button>
  );
}
