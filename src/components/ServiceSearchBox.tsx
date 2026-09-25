import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { pickText, normalizeSearch, keywordsFor } from '../data/services';
import { useCatalog } from '../data/catalogStore';
import { AppIcon } from './AppIcon';

// The catalogue search box on /services (desktop + mobile). Sliding placeholder
// adapted from 21st.dev "Placeholders And Vanish Input" (Aceternity), minus the
// canvas vanish effect. While empty it cycles through the most-asked services
// for the visitor's language; focusing shows them as a list, typing shows live
// matches, and Enter / the keyboard's search key opens a service directly:
// the top match when something is typed, or the suggestion currently shown in
// the placeholder when the box is empty.

type Popular = { id: string; label: string };

const POPULAR: Record<string, Popular[]> = {
  ar: [
    { id: 'res-tourist', label: 'إقامة سياحية' },
    { id: 're-buy', label: 'شراء بيت في تركيا' },
    { id: 'res-property', label: 'إقامة عقارية' },
    { id: 'res-renew', label: 'تجديد الإقامة' },
    { id: 'res-citizenship', label: 'الجنسية التركية' },
    { id: 'health-tourism', label: 'زراعة الشعر والأسنان' },
    { id: 'res-student', label: 'إقامة طالب' },
    { id: 'tour-airport', label: 'استقبال من المطار' },
    { id: 'tr-sworn', label: 'ترجمة محلّفة' },
    { id: 'bank-account', label: 'فتح حساب بنكي' },
  ],
  en: [
    { id: 'res-tourist', label: 'Tourist residence permit' },
    { id: 're-buy', label: 'Buying a home in Turkey' },
    { id: 'res-property', label: 'Property residence permit' },
    { id: 'res-renew', label: 'Residence permit renewal' },
    { id: 'res-citizenship', label: 'Turkish citizenship' },
    { id: 'health-tourism', label: 'Hair transplant & dental' },
    { id: 'res-student', label: 'Student residence permit' },
    { id: 'tour-airport', label: 'Airport pickup' },
    { id: 'tr-sworn', label: 'Sworn translation' },
    { id: 'bank-account', label: 'Opening a bank account' },
  ],
  fa: [
    { id: 'res-tourist', label: 'اقامت توریستی' },
    { id: 're-buy', label: 'خرید خانه در ترکیه' },
    { id: 'res-property', label: 'اقامت ملکی' },
    { id: 'res-citizenship', label: 'شهروندی ترکیه' },
    { id: 'res-renew', label: 'تمدید اقامت' },
    { id: 'health-tourism', label: 'کاشت مو و دندان' },
    { id: 'res-student', label: 'اقامت دانشجویی' },
    { id: 'tour-airport', label: 'ترانسفر فرودگاه' },
    { id: 'tr-sworn', label: 'ترجمه رسمی' },
    { id: 'bank-account', label: 'افتتاح حساب بانکی' },
  ],
  ru: [
    { id: 'res-tourist', label: 'Туристический ВНЖ' },
    { id: 're-buy', label: 'Покупка квартиры в Турции' },
    { id: 'res-property', label: 'ВНЖ по недвижимости' },
    { id: 'res-renew', label: 'Продление ВНЖ' },
    { id: 'res-citizenship', label: 'Гражданство Турции' },
    { id: 'health-tourism', label: 'Пересадка волос и зубы' },
    { id: 'res-student', label: 'Студенческий ВНЖ' },
    { id: 'tour-airport', label: 'Трансфер из аэропорта' },
    { id: 'tr-sworn', label: 'Присяжный перевод' },
    { id: 'bank-account', label: 'Открыть счёт в банке' },
  ],
};

const COPY: Record<string, { try: string; label: string; popular: string }> = {
  ar: { try: 'ابحث مثلاً:', label: 'ابحث عن خدمة', popular: 'الأكثر طلبًا' },
  en: { try: 'Try:', label: 'Search services', popular: 'Popular searches' },
  fa: { try: 'مثلاً:', label: 'جستجوی خدمات', popular: 'جستجوهای پرطرفدار' },
  ru: { try: 'Например:', label: 'Поиск услуг', popular: 'Популярные запросы' },
};

const ROTATE_MS = 2800;
const MAX_MATCHES = 6;

export function ServiceSearchBox({
  value,
  onChange,
  lang,
  inputClassName,
  iconClassName,
  placeholderClassName,
}: {
  value: string;
  onChange: (next: string) => void;
  lang: string;
  inputClassName: string;
  iconClassName: string;
  /** padding/size for the sliding placeholder — must line up with the input's text */
  placeholderClassName: string;
}) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { services } = useCatalog();
  const langCode = (lang || 'en').split('-')[0];
  const copy = COPY[langCode] ?? COPY.en;

  // Only suggest services the catalogue actually shows (admin can hide some).
  const popular = useMemo(() => {
    const ids = new Set(services.map((s) => s.id));
    return (POPULAR[langCode] ?? POPULAR.en).filter((p) => ids.has(p.id));
  }, [services, langCode]);

  const [slot, setSlot] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Rotate the placeholder while the box is empty; pause when the tab is hidden.
  useEffect(() => {
    if (value || popular.length < 2) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!id) id = setInterval(() => setSlot((p) => (p + 1) % popular.length), ROTATE_MS);
    };
    const stop = () => {
      if (id) clearInterval(id);
      id = null;
    };
    const onVis = () => (document.visibilityState === 'visible' ? start() : stop());
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [value, popular.length]);

  const matches = useMemo(() => {
    const nq = normalizeSearch(value);
    if (!nq) return [];
    const tokens = nq.split(' ').filter((tk) => tk.length >= 2);
    const scored = services
      .map((s) => {
        const title = normalizeSearch([s.title.ar, s.title.en, s.title.tr].join(' '));
        const hay = normalizeSearch(
          [s.title.ar, s.title.en, s.title.tr, s.desc.ar, s.desc.en, s.desc.tr, keywordsFor(s.id)].join(' '),
        );
        // title hits rank above keyword/description hits
        const score = title.includes(nq) ? 3 : hay.includes(nq) ? 2 : tokens.some((tk) => hay.includes(tk)) ? 1 : 0;
        return { s, score };
      })
      .filter((x) => x.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, MAX_MATCHES).map(({ s }) => ({ id: s.id, label: pickText(s.title, langCode) }));
  }, [value, services, langCode]);

  const items: Popular[] = value.trim() ? matches : popular;
  const current = popular.length ? popular[slot % popular.length] : null;

  useEffect(() => setActive(-1), [value]);

  // Close when tapping anywhere outside the box.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const go = (id: string) => {
    setOpen(false);
    inputRef.current?.blur();
    navigate(`/services/${id}`);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (active >= 0 && items[active]) return go(items[active].id);
    if (value.trim()) {
      if (matches[0]) go(matches[0].id);
      else {
        setOpen(false);
        inputRef.current?.blur();
      }
      return;
    }
    if (current) go(current.id);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && items.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === 'ArrowUp' && items.length) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && items.length > 0;

  return (
    <div ref={wrapRef} className="relative">
      <form role="search" onSubmit={onSubmit} className="relative">
        <span className={`pointer-events-none absolute inset-y-0 z-10 flex items-center text-navy/40 ${iconClassName}`}>
          <AppIcon name="search" className="h-4 w-4" />
        </span>
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          className={`${inputClassName} [&::-webkit-search-cancel-button]:hidden`}
          value={value}
          aria-label={copy.label}
          aria-expanded={showList}
          aria-controls="service-search-suggestions"
          aria-autocomplete="list"
          role="combobox"
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {!value && current && (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 flex items-center overflow-hidden ${placeholderClassName}`}
          >
            <span className="me-1.5 shrink-0 text-navy/40">{copy.try}</span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={current.id}
                initial={reduceMotion ? { opacity: 0 } : { y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { y: -12, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="truncate font-semibold text-navy/60"
              >
                {current.label}
              </motion.span>
            </AnimatePresence>
          </div>
        )}
      </form>

      <AnimatePresence>
        {showList && (
          <motion.ul
            id="service-search-suggestions"
            role="listbox"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-x-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-cream-dark bg-white py-2 shadow-lg"
          >
            {!value.trim() && (
              <li className="px-4 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wide text-navy/40" role="presentation">
                {copy.popular}
              </li>
            )}
            {items.map((it, i) => (
              <li key={it.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => go(it.id)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-start text-sm font-semibold text-navy transition-colors ${
                    i === active ? 'bg-cream' : 'hover:bg-cream/60'
                  }`}
                >
                  <AppIcon name={value.trim() ? 'search' : 'trending-up'} className="h-3.5 w-3.5 shrink-0 text-gold" />
                  <span className="truncate">{it.label}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
