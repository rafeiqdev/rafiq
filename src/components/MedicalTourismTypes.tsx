import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MED_GROUPS, MED_TYPES, pickMedText } from '../data/medicalTourism';
import { AppIcon } from './AppIcon';

/**
 * Interactive directory of medical-tourism TYPES in Istanbul, grouped into 3
 * categories, searchable, 4 languages. No prices, no clinic/hospital names —
 * general informational content only. Each card has a replaceable image slot.
 */
export function MedicalTourismTypes() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const rtl = lang === 'ar' || lang === 'fa';
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MED_GROUPS.map((g) => {
      const types = MED_TYPES.filter((x) => x.group === g.id).filter((x) => {
        if (!q) return true;
        return (
          pickMedText(x.name, lang).toLowerCase().includes(q) ||
          pickMedText(x.d, lang).toLowerCase().includes(q) ||
          pickMedText(g.name, lang).toLowerCase().includes(q)
        );
      });
      return { group: g, types };
    }).filter((g) => g.types.length > 0);
  }, [query, lang]);

  return (
    <section id="medical-types" dir={rtl ? 'rtl' : 'ltr'} className="mt-10 scroll-mt-20">
      <h2 className="section-title">{t('medTourism.title')}</h2>

      <div className="relative mt-4 max-w-md">
        <span className="absolute inset-y-0 start-0 flex items-center ps-3 text-navy/40">
          <AppIcon name="search" className="w-4 h-4" />
        </span>
        <input
          className="input ps-9"
          placeholder={t('medTourism.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t('medTourism.search')}
        />
      </div>

      {groups.length === 0 ? (
        <p className="mt-6 text-center text-sm text-navy/50">{t('medTourism.empty')}</p>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {groups.map(({ group, types }) => (
            <div key={group.id}>
              <h3 className="font-extrabold text-navy inline-flex items-center gap-2">
                <span className="text-xl" aria-hidden="true">
                  {group.icon}
                </span>
                {pickMedText(group.name, lang)}
              </h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {types.map((item) => (
                  <article key={pickMedText(item.name, 'en')} className="card overflow-hidden flex flex-col">
                    {/* image slot — replaceable placeholder, no external URL */}
                    <div
                      className="relative h-24 sm:h-32 bg-gradient-to-br from-navy to-navy-light flex items-center justify-center"
                      data-image-slot={pickMedText(item.name, 'en')}
                      aria-hidden="true"
                    >
                      <span className="text-3xl sm:text-4xl opacity-90">{item.icon}</span>
                      <span className="absolute inset-0 bg-gradient-to-t from-navy/40 to-transparent" />
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <h4 className="font-bold text-navy inline-flex items-center gap-2">
                        <span aria-hidden="true">{item.icon}</span>
                        <bdi>{pickMedText(item.name, lang)}</bdi>
                      </h4>
                      <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wide text-navy/40">
                        {t('medTourism.treats')}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-600 leading-relaxed flex-1 break-words">
                        {pickMedText(item.d, lang)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 amber-note text-xs">{t('medTourism.disclaimer')}</p>
    </section>
  );
}
