import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError, leads } from '../lib/api';
import { useApp } from '../context/AppContext';
import { AppIcon } from '../components/AppIcon';
import type { IconName } from '../components/AppIcon';
import { MedicalTourismTypes } from '../components/MedicalTourismTypes';

const SERVICES: { id: string; icon: IconName }[] = [
  { id: 'hair', icon: 'scissors' },
  { id: 'dental', icon: 'smile' },
  { id: 'checkup', icon: 'stethoscope' },
];

export function HealthTourism() {
  const { t } = useTranslation();
  const { user } = useApp();
  const navigate = useNavigate();
  const [requested, setRequested] = useState<Record<string, boolean>>({});

  // requests are persisted leads — reflect existing ones after reload
  useEffect(() => {
    if (!user) return;
    leads
      .mine()
      .then((mine) => {
        const map: Record<string, boolean> = {};
        for (const l of mine.filter((x) => x.kind === 'health')) {
          const match = SERVICES.find((s) => l.item.startsWith(s.id));
          if (match) map[match.id] = true;
        }
        setRequested(map);
      })
      .catch(() => {});
  }, [user]);

  const request = async (id: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    try {
      await leads.create('health', `${id} — ${t(`health.services.${id}.title`)}`);
      setRequested((r) => ({ ...r, [id]: true }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) navigate('/auth');
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-extrabold text-navy">{t('health.title')}</h1>
      <p className="mt-1 text-navy/70">{t('health.subtitle')}</p>

      <div className="mt-6 grid gap-5 md:grid-cols-3 items-stretch">
        {SERVICES.map((s) => (
          <div key={s.id} className="card card-hover flex flex-col p-5">
            <div className="icon-chip">
              <AppIcon name={s.icon} className="w-6 h-6" />
            </div>
            <h2 className="mt-3 font-bold text-navy">{t(`health.services.${s.id}.title`)}</h2>
            <p className="mt-2 text-sm text-gray-500 flex-1">{t(`health.services.${s.id}.body`)}</p>
            <button
              onClick={() => request(s.id)}
              disabled={requested[s.id]}
              className="btn-primary w-full mt-4 disabled:opacity-60"
            >
              {requested[s.id] && <AppIcon name="check" className="w-4 h-4" />}
              {requested[s.id] ? t('health.requested') : t('health.cta')}
            </button>
          </div>
        ))}
      </div>

      {/* Interactive directory of medical-tourism types (no prices, no clinic names) */}
      <MedicalTourismTypes />
    </div>
  );
}
