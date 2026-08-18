import { useTranslation } from 'react-i18next';
import { AppIcon } from './AppIcon';
import { pickAppText } from '../data/istanbulApps';
import { QUICK_FACTS } from '../data/istanbulCityGuide';

/** Compact quick-facts chips (population, cost, climate, language) for display over the hero photo. */
export function IstanbulHeroFacts() {
  const { i18n } = useTranslation();
  const lang = i18n.language;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {QUICK_FACTS.map((f, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm"
        >
          <AppIcon name={f.icon} className="w-3.5 h-3.5" />
          <span dir="ltr">{pickAppText(f.value, lang)}</span>
          <span className="text-white/50">·</span>
          <span className="text-white/85 font-normal">{pickAppText(f.label, lang)}</span>
        </span>
      ))}
    </div>
  );
}
