import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Block } from './registry';
import { useApp } from '../context/AppContext';
import { AppIcon, DirArrow } from '../components/AppIcon';
import type { IconName } from '../components/AppIcon';

function AmberNote({ text }: { text: string }) {
  return (
    <div className="amber-note mt-3 flex gap-2 items-start">
      <AppIcon name="alert-triangle" className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

/**
 * Interactive cost-of-living calculator (browsing path). The user picks a few
 * options and the calculator derives every line (rent, food, transport,
 * utilities, health, leisure) and the monthly total automatically.
 */
function CostOfLiving() {
  const { t } = useTranslation();
  const [district, setDistrict] = useState<'central' | 'suburban'>('central');
  const [lifestyle, setLifestyle] = useState<'budget' | 'comfort' | 'premium'>('comfort');
  const [household, setHousehold] = useState<'single' | 'couple' | 'family'>('single');

  // lifestyle multiplier + per-household scaling factors per category
  const life = lifestyle === 'budget' ? 0.7 : lifestyle === 'premium' ? 1.8 : 1;
  const persons = household === 'single' ? 1 : household === 'couple' ? 2 : 4;
  const rentFactor = household === 'single' ? 1 : household === 'couple' ? 1.25 : 1.6;
  const foodFactor = household === 'single' ? 1 : household === 'couple' ? 1.8 : 3;
  const utilFactor = household === 'single' ? 1 : household === 'couple' ? 1.2 : 1.5;
  const leisureFactor = household === 'single' ? 1 : household === 'couple' ? 1.6 : 2.2;
  const healthLife = lifestyle === 'budget' ? 0.8 : lifestyle === 'premium' ? 1.6 : 1;

  const r2 = (n: number) => Math.round(n / 50) * 50; // round to the nearest 50 TL
  const rent = r2((district === 'central' ? 28000 : 15000) * life * rentFactor);
  const food = r2(6000 * life * foodFactor);
  const transport = r2((district === 'central' ? 1100 : 1750) * persons);
  const utilities = r2(3000 * life * utilFactor);
  const health = r2(1200 * persons * healthLife);
  const leisure = r2(3500 * life * leisureFactor);
  const total = rent + food + transport + utilities + health + leisure;
  const fmt = (n: number) => `${n.toLocaleString()} ${t('common.tl')}`;

  const lines = [
    ['rent', rent, 'building'],
    ['food', food, 'shopping-bag'],
    ['transport', transport, 'bus'],
    ['utilities', utilities, 'lightbulb'],
    ['health', health, 'heart-pulse'],
    ['leisure', leisure, 'star'],
  ] as const;

  return (
    <div className="mt-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-xs font-semibold text-navy/70">
          {t('blocks.costOfLiving.district')}
          <select className="input mt-1" value={district} onChange={(e) => setDistrict(e.target.value as 'central' | 'suburban')}>
            <option value="central">{t('blocks.costOfLiving.central')}</option>
            <option value="suburban">{t('blocks.costOfLiving.suburban')}</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-navy/70">
          {t('blocks.costOfLiving.lifestyle')}
          <select className="input mt-1" value={lifestyle} onChange={(e) => setLifestyle(e.target.value as 'budget' | 'comfort' | 'premium')}>
            <option value="budget">{t('blocks.costOfLiving.budget')}</option>
            <option value="comfort">{t('blocks.costOfLiving.comfort')}</option>
            <option value="premium">{t('blocks.costOfLiving.premium')}</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-navy/70">
          {t('blocks.costOfLiving.household')}
          <select className="input mt-1" value={household} onChange={(e) => setHousehold(e.target.value as 'single' | 'couple' | 'family')}>
            <option value="single">{t('blocks.costOfLiving.single')}</option>
            <option value="couple">{t('blocks.costOfLiving.couple')}</option>
            <option value="family">{t('blocks.costOfLiving.family')}</option>
          </select>
        </label>
      </div>
      <ul className="mt-4 text-sm divide-y divide-cream-dark">
        {lines.map(([k, v, icon]) => (
          <li key={k} className="flex items-center justify-between py-2">
            <span className="text-navy/70 flex items-center gap-2">
              <AppIcon name={icon as IconName} className="w-4 h-4 text-navy/50" />
              {t(`blocks.costOfLiving.${k}`)}
            </span>
            <span className="font-semibold" dir="ltr">{fmt(v)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-xl bg-navy px-4 py-3 flex justify-between items-center">
        <span className="text-sm font-semibold text-white">{t('blocks.costOfLiving.total')}</span>
        <span className="text-lg font-extrabold text-white" dir="ltr">{fmt(total)}</span>
      </div>
      <p className="mt-2 text-[11px] text-navy/50">{t('blocks.costOfLiving.disclaimer')}</p>
    </div>
  );
}

/** District quick-links for the city-guide block (proper nouns; no translation). */
function CityDistricts() {
  const { t } = useTranslation();
  const districts = ['Kadıköy', 'Beşiktaş', 'Üsküdar', 'Şişli', 'Fatih', 'Beyoğlu'];
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-navy/70">{t('blocks.cityGuide.districtsLabel')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {districts.map((d) => (
          <Link
            key={d}
            to="/map"
            className="text-xs font-semibold bg-cream hover:bg-brand-blue rounded-full px-3 py-2 text-navy transition-colors flex items-center gap-1.5"
          >
            <AppIcon name="map-pin" className="w-3 h-3" />
            {d}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Service overview grid (browsing path). */
function ServicesGrid() {
  const { t } = useTranslation();
  const items: { to: string; icon: IconName; key: string }[] = [
    { to: '/real-estate', icon: 'building', key: 'realEstate' },
    { to: '/health-tourism', icon: 'heart-pulse', key: 'health' },
    { to: '/map', icon: 'map', key: 'map' },
  ];
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      {items.map((i) => (
        <Link key={i.to} to={i.to} className="card card-hover flex items-center gap-3 p-3">
          <span className="icon-chip !w-10 !h-10">
            <AppIcon name={i.icon} />
          </span>
          <span className="text-sm font-semibold text-navy">{t(`blocks.serviceOverview.${i.key}`)}</span>
        </Link>
      ))}
    </div>
  );
}

export function BlockCard({ block }: { block: Block }) {
  const { t } = useTranslation();
  const { profile, updateProfile } = useApp();
  const navigate = useNavigate();

  const done = block.hasKey ? profile.has[block.hasKey] : !!profile.completed[block.id];
  const isChecklist = block.kind === 'checklist';
  const docs = block.hasDocs ? (t(`blocks.${block.id}.docs`, { returnObjects: true }) as string[]) : [];

  const toggleDone = () => {
    if (block.hasKey) {
      updateProfile({ has: { ...profile.has, [block.hasKey]: !done } });
    } else {
      updateProfile({ completed: { ...profile.completed, [block.id]: !done } });
    }
  };

  const onNudge = () => {
    updateProfile({ path: 'planning', reason: 'live' });
    navigate('/');
  };

  const residenceExpired = !!profile.renewals.residence && new Date(profile.renewals.residence) < new Date();

  return (
    <article className={`card card-hover flex flex-col p-5 ${done && isChecklist ? 'opacity-70' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="icon-chip">
          <AppIcon name={block.icon} className="w-5 h-5" />
        </span>
        <div className="flex-1">
          <h3 className="font-bold text-navy">{t(`blocks.${block.id}.title`)}</h3>
          <p className="mt-1 text-sm text-gray-500">{t(`blocks.${block.id}.body`)}</p>
        </div>
        {isChecklist && (
          <button
            onClick={toggleDone}
            aria-label={t('common.markDone')}
            aria-pressed={done}
            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
              done ? 'bg-navy border-navy text-white' : 'border-navy/40 text-transparent hover:border-navy'
            }`}
          >
            <AppIcon name="check" className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {block.id === 'renewalTracker' && residenceExpired && <AmberNote text={t('blocks.renewalTracker.expiredNote')} />}
      {block.hasWarning && <AmberNote text={t(`blocks.${block.id}.warning`)} />}
      {block.hasTip && (
        <div className="mt-3 rounded-xl bg-brand-blue px-4 py-3 text-sm text-navy flex gap-2 items-start">
          <AppIcon name="lightbulb" className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{t(`blocks.${block.id}.tip`)}</span>
        </div>
      )}

      {block.hasDuration && (
        <p className="mt-3 text-xs text-navy/70 flex items-center gap-1.5">
          <AppIcon name="clock" className="w-3.5 h-3.5" />
          <span className="font-semibold">{t('common.duration')}:</span> {t(`blocks.${block.id}.duration`)}
        </p>
      )}
      {docs.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-navy/70 flex items-center gap-1.5">
            <AppIcon name="file-text" className="w-3.5 h-3.5" />
            {t('common.requiredDocs')}:
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {docs.map((d) => (
              <li key={d} className="text-xs bg-cream rounded-full px-2.5 py-1 text-navy/80">
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {block.kind === 'col' && <CostOfLiving />}
      {block.kind === 'services' && <ServicesGrid />}
      {block.id === 'cityGuide' && <CityDistricts />}

      <div className="flex-1" />
      {block.kind === 'nudge' ? (
        <button onClick={onNudge} className="btn-primary w-full mt-4">
          {t(`blocks.${block.id}.cta`)}
          <DirArrow />
        </button>
      ) : block.kind !== 'services' && block.kind !== 'col' ? (
        // "Help me with this" CTAs route to the concierge help page instead of
        // dropping users into the gated chat.
        <Link to={block.ctaTo === '/premium' ? `/help?topic=${block.id}` : block.ctaTo} className="btn-primary w-full mt-4">
          {t(`blocks.${block.id}.cta`)}
          <DirArrow />
        </Link>
      ) : null}
    </article>
  );
}
