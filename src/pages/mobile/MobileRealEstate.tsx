import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listings as listingsApi } from '../../lib/api';
import type { InvestmentRecord, Listing, ListingType } from '../../lib/types';
import { AppIcon } from '../../components/AppIcon';
import { MobileTabBar } from '../../components/MobileTabBar';
import {
  EligibilityValue,
  InvestmentPhoto,
  useLocalized,
} from '../../components/realestate/InvestmentCard';
import {
  citizenshipEligibility,
  priceRange,
  residencyEligibility,
} from '../../data/investments';
import { ISTANBUL_AREAS } from '../../data/istanbulAreas';
import { useInvestments } from '../../hooks/useInvestments';
import { BANNERS } from '../../lib/images';
import { SITE_URL, usePageMeta } from '../../lib/seo';
import styles from './MobileRealEstate.module.css';

type ChipMode = 'all' | 'cit' | 'cheap' | 'big';
type SheetType = '' | ListingType;

interface SheetFilters {
  type: SheetType;
  district: string;
  pmin: number | null;
  pmax: number | null;
  mmin: number | null;
  mmax: number | null;
  rooms: string[];
  cit: boolean;
  build: '' | 'ready' | 'under-construction';
  furnished: boolean;
  parking: boolean;
  elevator: boolean;
  security: boolean;
}

const EMPTY_SHEET: SheetFilters = {
  type: '',
  district: '',
  pmin: null,
  pmax: null,
  mmin: null,
  mmax: null,
  rooms: [],
  cit: false,
  build: '',
  furnished: false,
  parking: false,
  elevator: false,
  security: false,
};

const FAV_KEY = 'rafiq_favs';
const RECENT_KEY = 'rafiq_recent';

/** Extra Turkish → Arabic district names beyond src/data/istanbulAreas. */
const EXTRA_AR: Record<string, string> = {
  Arnavutköy: 'أرناؤوطكوي',
  Büyükçekmece: 'بيوكشكمجة',
  Çekmeköy: 'تشكمكوي',
  Güngören: 'غونغورن',
  Kağıthane: 'كاغيتهانة',
  Sultangazi: 'سلطان غازي',
};

function districtName(tr: string, lang: string): string {
  const hit = ISTANBUL_AREAS.find((a) => a.name.tr === tr);
  if (hit) return (hit.name as Record<string, string>)[lang] ?? hit.name.en;
  if (lang === 'ar') return EXTRA_AR[tr] ?? tr;
  return tr;
}

const fmtUsd = (n: number): string => '$' + Number(n).toLocaleString('en-US');

function parseNum(v: string): number | null {
  const n = parseFloat(v);
  return v.trim() === '' || Number.isNaN(n) ? null : n;
}

function readIds(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function hasAmenity(l: Listing, key: string): boolean {
  if (key === 'furnished') return !!l.furnished || (l.amenities ?? []).includes('furnished');
  return (l.amenities ?? []).includes(key);
}

const WA = String(import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');

export function MobileRealEstate() {
  const { t, i18n } = useTranslation();
  const L = useLocalized();
  const { items: investments } = useInvestments();
  const [all, setAll] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ChipMode>('all');
  const [f, setF] = useState<SheetFilters>(EMPTY_SHEET);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [recentOpen, setRecentOpen] = useState(false);
  const [placesOpen, setPlacesOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [galIdx, setGalIdx] = useState(0);
  const [favTick, setFavTick] = useState(0);
  const closeTimer = useRef<number | null>(null);

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const dName = (tr: string): string => districtName(tr, lang);
  const roomsLabel = (rooms: string): string =>
    /Üzeri/i.test(rooms || '') ? t('realEstate.mx.rooms10') : rooms || '';

  usePageMeta({
    title: `${t('realEstate.title')} — ${t('common.appName')}`,
    description: t('realEstate.subtitle'),
    image: `${SITE_URL}${BANNERS.realEstate}`,
  });

  useEffect(() => {
    listingsApi
      .list()
      .then(setAll)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Lock body scroll while any overlay is open.
  useEffect(() => {
    const locked = sheetOpen || searchOpen || detailId !== null;
    document.body.style.overflow = locked ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sheetOpen, searchOpen, detailId]);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  // Filter sheet closes on Escape.
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setSheetOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  const filtered = useMemo(() => {
    let l = [...all];
    if (f.type) l = l.filter((d) => (d.listingType ?? 'sale') === f.type);
    if (f.district) l = l.filter((d) => d.district === f.district);
    if (f.pmin !== null) l = l.filter((d) => d.priceUsd >= (f.pmin as number));
    if (f.pmax !== null) l = l.filter((d) => d.priceUsd <= (f.pmax as number));
    if (f.rooms.length) l = l.filter((d) => f.rooms.includes(d.rooms));
    if (f.mmin !== null) l = l.filter((d) => d.m2 >= (f.mmin as number));
    if (f.mmax !== null) l = l.filter((d) => d.m2 <= (f.mmax as number));
    if (f.cit) l = l.filter((d) => d.citizenship);
    if (f.build) l = l.filter((d) => d.buildStatus === f.build);
    if (f.furnished) l = l.filter((d) => hasAmenity(d, 'furnished'));
    if (f.parking) l = l.filter((d) => hasAmenity(d, 'parking'));
    if (f.elevator) l = l.filter((d) => hasAmenity(d, 'elevator'));
    if (f.security) l = l.filter((d) => hasAmenity(d, 'security'));
    if (mode === 'cit') l = l.filter((d) => d.citizenship);
    if (mode === 'cheap') l.sort((a, b) => a.priceUsd - b.priceUsd);
    else if (mode === 'big') l.sort((a, b) => b.m2 - a.m2);
    return l;
  }, [all, f, mode]);

  const preview = useMemo(() => {
    const anyF =
      f.type ||
      f.district ||
      f.pmin !== null ||
      f.pmax !== null ||
      f.rooms.length ||
      f.mmin !== null ||
      f.mmax !== null ||
      f.cit ||
      f.build ||
      f.furnished ||
      f.parking ||
      f.elevator ||
      f.security;
    let l = [...filtered];
    if (mode === 'all' && !anyF) l.sort((a, b) => a.priceUsd - b.priceUsd);
    return l.slice(0, mode === 'cit' ? 10 : 6);
  }, [filtered, f, mode]);

  const activeCount = useMemo(() => {
    let n = 0;
    if (f.type) n++;
    if (f.district) n++;
    if (f.pmin !== null || f.pmax !== null) n++;
    if (f.rooms.length) n++;
    if (f.mmin !== null || f.mmax !== null) n++;
    if (f.cit) n++;
    if (f.build) n++;
    for (const k of ['furnished', 'parking', 'elevator', 'security'] as const) if (f[k]) n++;
    return n;
  }, [f]);

  const districts = useMemo(
    () =>
      [...new Set(all.map((d) => d.district).filter(Boolean))].sort((a, b) =>
        dName(a).localeCompare(dName(b), lang === 'ar' ? 'ar' : 'en'),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, lang],
  );
  const roomOpts = useMemo(() => [...new Set(all.map((d) => d.rooms).filter(Boolean))], [all]);
  const eligibleCount = useMemo(() => all.filter((d) => d.citizenship).length, [all]);
  const latestUpdate = useMemo(() => {
    const stamps = all.map((d) => d.updatedAt).filter((x): x is string => !!x);
    return stamps.length ? stamps.sort().reverse()[0] : null;
  }, [all]);

  const detail = detailId !== null ? (all.find((d) => d.id === detailId) ?? null) : null;
  const detailImages = useMemo(() => {
    if (!detail) return [];
    const imgs = detail.images && detail.images.length ? detail.images : detail.image ? [detail.image] : [];
    return imgs.filter(Boolean) as string[];
  }, [detail]);
  const favs = useMemo(() => readIds(FAV_KEY), [favTick, detailId]);
  const isFav = detail !== null && favs.includes(detail.id);

  const openDetail = (id: string): void => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setLeaving(false);
    setGalIdx(0);
    setDetailId(id);
  };
  const closeDetail = (): void => {
    if (detailId === null || leaving) return;
    setLeaving(true);
    closeTimer.current = window.setTimeout(() => {
      setDetailId(null);
      setLeaving(false);
      closeTimer.current = null;
    }, 230);
  };
  const toggleFav = (): void => {
    if (!detail) return;
    const cur = readIds(FAV_KEY);
    const next = cur.includes(detail.id) ? cur.filter((x) => x !== detail.id) : [...cur, detail.id];
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
    } catch {
      /* private mode — the heart just won't persist */
    }
    setFavTick((n) => n + 1);
  };
  const shareDetail = async (): Promise<void> => {
    if (!detail) return;
    const url = `${window.location.origin}/real-estate/${detail.id}`;
    const title = detailTitle(detail);
    try {
      if (navigator.share) {
        await navigator.share({ title, text: title, url });
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        window.alert(t('common.copied'));
      }
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const detailTitle = (d: Listing): string => {
    const unit = (d.listingType ?? 'sale') === 'commercial' ? t('realEstate.mx.unitCommercial') : t('realEstate.mx.unitApt');
    return `${unit} ${roomsLabel(d.rooms)} · ${dName(d.district)} · ${d.m2} ${t('realEstate.perM2')}`;
  };
  const detailDesc = (d: Listing): string | null =>
    d.translations?.[lang as 'ar' | 'en' | 'fa' | 'ru']?.description ?? d.description ?? null;

  const onGalleryScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const el = e.currentTarget;
    const n = detailImages.length;
    if (!n) return;
    const idx = Math.min(n - 1, Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    setGalIdx(idx);
  };

  // ── search overlay ──
  const recent: string[] = useMemo(() => (searchOpen ? readIds(RECENT_KEY) : []), [searchOpen, term]);
  const pushRecent = (name: string): void => {
    const r = [name, ...readIds(RECENT_KEY).filter((x) => x !== name)].slice(0, 6);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(r));
    } catch {
      /* ignore */
    }
  };
  const searchMatches = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return [];
    return districts.filter(
      (d) => d.toLowerCase().includes(q) || dName(d).toLowerCase().includes(q),
    );
  }, [term, districts]);
  const suggested = useMemo(
    () =>
      [...districts].sort(
        (a, b) => all.filter((x) => x.district === b).length - all.filter((x) => x.district === a).length,
      ),
    [districts, all],
  );
  const districtCount = (d: string): number => all.filter((x) => x.district === d).length;
  const chooseDistrict = (name: string): void => {
    setF((prev) => ({ ...prev, district: name }));
    pushRecent(name);
    setSearchOpen(false);
    setTerm('');
    window.scrollTo({ top: 0 });
  };
  const clearDistrict = (): void => {
    setF((prev) => ({ ...prev, district: '' }));
    setSearchOpen(false);
    setTerm('');
    window.scrollTo({ top: 0 });
  };

  const toggleRoom = (r: string): void =>
    setF((prev) => ({ ...prev, rooms: prev.rooms.includes(r) ? prev.rooms.filter((x) => x !== r) : [...prev.rooms, r] }));

  const investCta = (o: InvestmentRecord): string =>
    `https://wa.me/${WA}?text=${encodeURIComponent(`${t('realEstate.mx.stripTitle')}: ${L(o.name)} (${L(o.district)})`)}`;

  const detailWa = detail
    ? `https://wa.me/${WA}?text=${encodeURIComponent(`${t('common.appName')} — ${detailTitle(detail)} — ${fmtUsd(detail.priceUsd)}`)}`
    : '';

  const investSection = investments.length > 0 && (
    <section className={styles.sec}>
      <h2>
        {t('realEstate.mx.investStripTitle')}{' '}
        <span className={styles.cnt}>{t('realEstate.mx.investSub')}</span>
      </h2>
      <div className={styles.ivrow}>
        {investments.slice(0, 6).map((o) => (
          <Link key={o.slug} to={`/real-estate/investments/${o.slug}`} className={styles.ivcard}>
            <div className={styles['iv-img']}>
              <InvestmentPhoto opp={o} />
              <span className={styles['iv-badge']}>
                <AppIcon name="trending-up" className="w-3.5 h-3.5" />
                {t('invest.badge')}
              </span>
            </div>
            <div className={styles['iv-body']}>
              <h3 className={styles['iv-name']}>{L(o.name)}</h3>
              <div className={styles['iv-loc']}>
                <AppIcon name="map-pin" className="w-3.5 h-3.5" />
                {L(o.district)}
              </div>
              <div className={styles['iv-stats']}>
                <div className={styles['iv-stat']}>
                  <b dir="ltr">{priceRange(o, t('invest.from'))}</b>
                  <span>{t('invest.priceRange')}</span>
                </div>
                <div className={styles['iv-stat']}>
                  <EligibilityValue state={citizenshipEligibility(o)} kind="citizenship" />
                  <span>{t('invest.citizenshipShort')}</span>
                </div>
                <div className={styles['iv-stat']}>
                  <EligibilityValue state={residencyEligibility(o)} kind="residency" />
                  <span>{t('invest.residencyShort')}</span>
                </div>
              </div>
              <div className={styles['iv-tags']}>
                {[L(o.type), ...o.pros.slice(0, 2).map((p) => L(p))].map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <span className={styles['iv-cta']}>
                <AppIcon name="trending-up" className="w-[18px] h-[18px]" />
                {t('invest.openFile')}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className={styles.root}>
      <div className="pb-[calc(env(safe-area-inset-bottom)+88px)]">
        <header className={styles.hdr}>
          <div className={styles['hdr-top']}>
            <div>
              <h1>{t('realEstate.title')}</h1>
              <div className={styles.brand}>{t('realEstate.mx.brand')}</div>
            </div>
            <div className={styles['count-pill']}>{t('realEstate.mx.count', { count: all.length })}</div>
          </div>
          {latestUpdate && (
            <div className={styles.upd}>
              {t('realEstate.mx.updated', {
                date: new Date(latestUpdate).toLocaleDateString(i18n.language || 'ar'),
              })}
            </div>
          )}
        </header>

        <button type="button" className={styles.search} onClick={() => setSearchOpen(true)} aria-label={t('realEstate.mx.searchPh')}>
          <span className={styles.ic}>
            <AppIcon name="search" className="w-[22px] h-[22px]" />
          </span>
          <span className={styles.ph}>{f.district ? dName(f.district) : t('realEstate.mx.searchPh')}</span>
        </button>

        <div className={styles.infocard}>
          <div className={styles.mark}>
            <AppIcon name="building" className="w-[38px] h-[38px]" />
          </div>
          <div>
            <b>{t('realEstate.mx.infoTitle')}</b>
            <p>{t('realEstate.mx.infoBody', { eligible: eligibleCount, total: all.length })}</p>
          </div>
        </div>

        <div className={styles.fbar}>
          <button type="button" className={styles.fbtn} onClick={() => setSheetOpen(true)}>
            <AppIcon name="sliders-horizontal" className="w-[18px] h-[18px]" />
            {t('realEstate.filters.title')}
            <span className={styles.fbadge} hidden={activeCount === 0}>
              {activeCount}
            </span>
          </button>
        </div>

        <div className={styles.chips} role="group" aria-label={t('realEstate.filters.title')}>
          {(['all', 'cit', 'cheap', 'big'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`${styles.chip}${mode === m ? ` ${styles.on}` : ''}`}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
            >
              {t(`realEstate.mx.chip${m === 'all' ? 'All' : m === 'cit' ? 'Cit' : m === 'cheap' ? 'Cheap' : 'Big'}`)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className={styles.sk} aria-label={t('common.loading')}>
            <i />
            <i />
            <i />
          </div>
        ) : (
          <>
            <section className={styles.sec}>
              <h2>
                {t('realEstate.mx.bestTitle')} <span className={styles.cnt}>({preview.length})</span>
              </h2>
              <div className={styles.hscroll}>
                {preview.length === 0 ? (
                  <div className={styles.empty}>{t('realEstate.mx.noResults')}</div>
                ) : (
                  preview.map((d, i) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`${styles.hcard} ${styles.enter}`}
                      style={{ '--i': Math.min(i, 11) } as CSSProperties}
                      onClick={() => openDetail(d.id)}
                    >
                      <div style={{ position: 'relative' }}>
                        {(d.image || d.images?.[0]) && (
                          <img
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            src={d.image || (d.images as string[])[0]}
                            alt={dName(d.district)}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = `${SITE_URL}/og-cover.png`;
                            }}
                          />
                        )}
                        <span className={`${styles.cit}${d.citizenship ? ` ${styles.yes}` : ''}`}>
                          <AppIcon name="shield-check" className="w-3 h-3" />
                          {d.citizenship ? t('realEstate.citizenshipBadge') : t('realEstate.mx.unknownShort')}
                        </span>
                      </div>
                      <div className={styles.cb}>
                        <h3>{dName(d.district)}</h3>
                        <div className={styles.sub}>
                          {roomsLabel(d.rooms)} · {d.m2} {t('realEstate.perM2')} ·{' '}
                          <AppIcon name="bath" className="w-[15px] h-[15px]" /> {d.bathrooms ?? '—'}
                        </div>
                        <div className={styles.meta}>
                          <span>
                            <AppIcon name="banknote" className="w-[15px] h-[15px]" /> <b>{fmtUsd(d.priceUsd)}</b>
                          </span>
                          <span>
                            <AppIcon name="camera" className="w-[15px] h-[15px]" />{' '}
                            {t('realEstate.mx.photosCount', { count: d.images?.length ?? (d.image ? 1 : 0) })}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            {investSection}

            <section className={styles.sec}>
              <h2>
                {t('realEstate.mx.allTitle')}{' '}
                <span className={styles.cnt}>{t('realEstate.mx.ofTotal', { shown: filtered.length, total: all.length })}</span>
              </h2>
              <div className={styles.vlist}>
                {filtered.length === 0 ? (
                  <div className={styles.empty}>{t('realEstate.mx.noResults')}</div>
                ) : (
                  filtered.map((d, i) => (
                    <div key={d.id}>
                      <button
                        type="button"
                        className={`${styles.vcard} ${styles.enter}`}
                        style={{ '--i': Math.min(i, 11) } as CSSProperties}
                        onClick={() => openDetail(d.id)}
                      >
                        {(d.image || d.images?.[0]) && (
                          <img
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            src={d.image || (d.images as string[])[0]}
                            alt={dName(d.district)}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = `${SITE_URL}/og-cover.png`;
                            }}
                          />
                        )}
                        <div className={styles.vb}>
                          <h3>
                            {dName(d.district)} — {roomsLabel(d.rooms)}
                          </h3>
                          <div className={styles.sub}>
                            {d.m2} {t('realEstate.perM2')} · <AppIcon name="bath" className="w-[15px] h-[15px]" />{' '}
                            {d.bathrooms ?? '—'} · {d.furnished ? t('realEstate.furnished') : t('realEstate.mx.unfurnished')}
                          </div>
                          <div className={styles.pr}>{fmtUsd(d.priceUsd)}</div>
                          <span className={`${styles.tag}${d.citizenship ? ` ${styles.yes}` : ''}`}>
                            <AppIcon name="shield-check" className="w-3 h-3" />
                            {d.citizenship ? t('realEstate.citizenshipBadge') : t('realEstate.mx.unknownShort')}
                          </span>
                        </div>
                      </button>
                      {(i + 1) % 5 === 0 && i < filtered.length - 1 && (
                        <Link to="/real-estate/investments" className={styles.invcard}>
                          <span className={styles['inv-ic']}>
                            <AppIcon name="trending-up" className="w-[22px] h-[22px]" />
                          </span>
                          <span className={styles['inv-tx']}>
                            <b>{t('realEstate.mx.stripTitle')}</b>
                            <span>{t('realEstate.mx.stripBody')}</span>
                          </span>
                          <span className={styles['inv-go']}>{t('realEstate.mx.stripCta')}</span>
                        </Link>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className={styles.invsec}>
              <div className={styles.invbig}>
                <h2>{t('realEstate.mx.invSecTitle')}</h2>
                <p>{t('realEstate.mx.invSecBody')}</p>
                <Link to="/real-estate/investments">{t('realEstate.mx.invSecCta')}</Link>
              </div>
            </section>
          </>
        )}
      </div>

      {/* ── detail overlay ── */}
      <div className={`${styles.dov}${detail !== null ? ` ${styles.open}` : ''}${leaving ? ` ${styles.leaving}` : ''}`}>
        {detail && (
          <div className={styles.dpage}>
            <div className={styles.gwrap}>
              <div className={styles.gtop}>
                <button type="button" className={styles.gbtn} onClick={closeDetail} aria-label={t('common.back')}>
                  <AppIcon name="arrow-right" className="w-5 h-5" />
                </button>
                <div className={styles.gbtns}>
                  <button type="button" className={styles.gbtn} onClick={shareDetail} aria-label={t('realEstate.mx.shareLabel')}>
                    <AppIcon name="share-2" className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    className={`${styles.gbtn}${isFav ? ` ${styles.faved}` : ''}`}
                    onClick={toggleFav}
                    aria-label={t('realEstate.mx.saveLabel')}
                    aria-pressed={isFav}
                  >
                    <AppIcon name="heart" className="w-5 h-5" fill={isFav ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>
              <div className={styles.gtrack} onScroll={onGalleryScroll}>
                {detailImages.map((src) => (
                  <img
                    key={src}
                    src={src}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    alt={dName(detail.district)}
                    onError={(e) => (e.currentTarget as HTMLImageElement).remove()}
                  />
                ))}
              </div>
              <div className={styles.gdots}>
                {detailImages.slice(0, 9).map((src, i) => (
                  <span
                    key={src}
                    className={
                      i === Math.round(galIdx * (Math.min(detailImages.length, 9) - 1) / Math.max(1, detailImages.length - 1))
                        ? styles.on
                        : ''
                    }
                  />
                ))}
              </div>
              <div className={styles.gcount}>
                <AppIcon name="camera" className="w-[14px] h-[14px]" />
                <span>
                  {galIdx + 1} / {detailImages.length}
                </span>
              </div>
            </div>
            <div className={styles.dbody}>
              <div className={styles.dtype}>
                {(detail.listingType ?? 'sale') === 'rent'
                  ? t('realEstate.mx.adRent')
                  : (detail.listingType ?? 'sale') === 'commercial'
                    ? t('realEstate.mx.adCommercial')
                    : t('realEstate.mx.adSale')}{' '}
                — {dName(detail.district)}
              </div>
              <h2 className={styles.dtitle}>{detailTitle(detail)}</h2>
              <div className={styles.dcit}>
                <span className={`${styles.dpill}${detail.citizenship ? ` ${styles.yes}` : ''}`}>
                  <AppIcon name="shield-check" className="w-[13px] h-[13px]" />
                  <span>{detail.citizenship ? t('realEstate.citizenshipBadge') : t('realEstate.mx.unknownShort')}</span>
                </span>
                <span className={styles.dphotos}>{t('realEstate.mx.photosCount', { count: detailImages.length })}</span>
              </div>
              <div className={styles.achips}>
                <span className={styles.achip}>
                  <AppIcon name="bed" className="w-[17px] h-[17px]" />
                  <span>{roomsLabel(detail.rooms)}</span>
                </span>
                <span className={styles.achip}>
                  <AppIcon name="bath" className="w-[17px] h-[17px]" />
                  <span>
                    {detail.bathrooms ?? '—'} {t('realEstate.bathShort')}
                  </span>
                </span>
                <span className={styles.achip}>
                  <AppIcon name="ruler" className="w-[17px] h-[17px]" />
                  <span>
                    {detail.m2} {t('realEstate.perM2')}
                  </span>
                </span>
                <span className={styles.achip}>
                  <AppIcon name="building" className="w-[17px] h-[17px]" />
                  <span>
                    {detail.floor !== null && detail.floor !== undefined
                      ? t('realEstate.mx.floorOf', { floor: detail.floor, total: detail.totalFloors ?? '—' })
                      : t('realEstate.mx.floorUnknown')}
                  </span>
                </span>
                <span className={styles.achip}>
                  <AppIcon name="sofa" className="w-[17px] h-[17px]" />
                  <span>{detail.furnished ? t('realEstate.furnished') : t('realEstate.mx.unfurnished')}</span>
                </span>
                {(detail.amenities ?? []).includes('parking') && (
                  <span className={styles.achip}>
                    <AppIcon name="car" className="w-[17px] h-[17px]" />
                    <span>{t('realEstate.amenity.parking')}</span>
                  </span>
                )}
                {(detail.amenities ?? []).includes('elevator') && (
                  <span className={styles.achip}>
                    <AppIcon name="arrow-up-down" className="w-[17px] h-[17px]" />
                    <span>{t('realEstate.amenity.elevator')}</span>
                  </span>
                )}
                {(detail.amenities ?? []).includes('security') && (
                  <span className={styles.achip}>
                    <AppIcon name="shield-check" className="w-[17px] h-[17px]" />
                    <span>{t('realEstate.amenity.security')}</span>
                  </span>
                )}
              </div>
              <div className={styles.ddet}>
                <h4>{t('realEstate.mx.detailsTitle')}</h4>
                <table className={styles.dtable}>
                  <tbody>
                    <tr>
                      <td>{t('realEstate.mx.rowArea')}</td>
                      <td>{dName(detail.district)}</td>
                    </tr>
                    <tr>
                      <td>{t('realEstate.mx.rowRooms')}</td>
                      <td>{roomsLabel(detail.rooms)}</td>
                    </tr>
                    <tr>
                      <td>{t('realEstate.mx.rowSize')}</td>
                      <td>
                        {detail.m2} {t('realEstate.perM2')}
                      </td>
                    </tr>
                    <tr>
                      <td>{t('realEstate.mx.rowTotal')}</td>
                      <td>{fmtUsd(detail.priceUsd)}</td>
                    </tr>
                    <tr>
                      <td>{t('realEstate.mx.rowM2')}</td>
                      <td>{detail.m2 ? fmtUsd(Math.round(detail.priceUsd / detail.m2)) : '—'}</td>
                    </tr>
                    <tr>
                      <td>{t('realEstate.mx.rowBaths')}</td>
                      <td>{detail.bathrooms ?? '—'}</td>
                    </tr>
                    <tr>
                      <td>{t('realEstate.mx.rowFurn')}</td>
                      <td>{detail.furnished ? t('common.yes') : t('common.no')}</td>
                    </tr>
                    <tr>
                      <td>{t('realEstate.mx.rowFloor')}</td>
                      <td>
                        {(detail.floor ?? '—') as string | number} / {(detail.totalFloors ?? '—') as string | number}
                      </td>
                    </tr>
                    <tr>
                      <td>{t('realEstate.mx.rowAdType')}</td>
                      <td>{t(`realEstate.tabs.${(detail.listingType ?? 'sale') as ListingType}`)}</td>
                    </tr>
                    <tr>
                      <td>{t('realEstate.mx.rowBuild')}</td>
                      <td>
                        {detail.buildStatus === 'under-construction'
                          ? t('realEstate.build.under-construction')
                          : detail.buildStatus === 'ready'
                            ? t('realEstate.build.ready')
                            : '—'}
                      </td>
                    </tr>
                    <tr>
                      <td>{t('realEstate.mx.rowNat')}</td>
                      <td>{detail.citizenship ? t('realEstate.mx.natYes') : t('realEstate.mx.natNo')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {detailDesc(detail) && (
                <div className={styles.ddesc}>
                  <h4>{t('realEstate.mx.descTitle')}</h4>
                  <div className={styles.fulldesc}>{detailDesc(detail)}</div>
                </div>
              )}
            </div>
          </div>
        )}
        {detail && (
          <div className={styles.dbar}>
            <div className={styles.dprice}>
              <b>{fmtUsd(detail.priceUsd)}</b>
              <small>
                {detail.m2 ? `${fmtUsd(Math.round(detail.priceUsd / detail.m2))} / ${t('realEstate.perM2')}` : ''}
              </small>
            </div>
            {WA && (
              <div className={styles['dcta-w']}>
                <a className={styles.dcta} href={detailWa} target="_blank" rel="noopener">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.2 4.79 1.2h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2zm5.8 14.16c-.24.68-1.42 1.31-1.95 1.35-.5.05-1.13.24-3.65-.76-3.07-1.21-5.04-4.33-5.2-4.53-.15-.2-1.24-1.65-1.24-3.15s.79-2.24 1.07-2.54c.28-.3.61-.38.81-.38.2 0 .41 0 .58.01.19.01.44-.07.69.53.24.6.83 2.07.9 2.22.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.18-.31.4-.44.53-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.02 1.12.99 2.06 1.3 2.36 1.45.3.15.47.13.64-.08.17-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.72.81 2.02.96.3.15.5.22.57.35.07.13.07.73-.17 1.41z" />
                  </svg>
                  {t('realEstate.mx.waCta')}
                </a>
                {detail.updatedAt && (
                  <div className={styles.dnote}>
                    {t('realEstate.detail.lastUpdate', {
                      date: new Date(detail.updatedAt).toLocaleDateString(i18n.language || 'ar'),
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── filter sheet ── */}
      <div className={`${styles['mf-ov']}${sheetOpen ? ` ${styles.open}` : ''}`} onClick={(e) => e.target === e.currentTarget && setSheetOpen(false)}>
        <div className={styles['mf-sheet']}>
          <div className={styles['mf-h']}>
            <button type="button" className={styles['mf-clr']} onClick={() => setF({ ...EMPTY_SHEET })}>
              {t('realEstate.filters.clear')}
            </button>
            <b>{t('realEstate.filters.title')}</b>
            <button type="button" className={styles['mf-x']} onClick={() => setSheetOpen(false)} aria-label={t('common.close')}>
              ✕
            </button>
          </div>
          <div className={styles['mf-b']}>
            <div className={styles['mf-sec']}>
              <h4>{t('realEstate.mx.rowAdType')}</h4>
              <div className={styles['mf-picks']}>
                <button
                  type="button"
                  className={`${styles['mf-pick']}${f.type === '' ? ` ${styles.on}` : ''}`}
                  onClick={() => setF((p) => ({ ...p, type: '' }))}
                >
                  {t('realEstate.mx.sheetAll')}
                </button>
                {(['sale', 'rent', 'commercial'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`${styles['mf-pick']}${f.type === v ? ` ${styles.on}` : ''}`}
                    onClick={() => setF((p) => ({ ...p, type: v }))}
                  >
                    {t(`realEstate.tabs.${v}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles['mf-sec']}>
              <h4>{t('realEstate.filters.district')}</h4>
              <select
                className={styles['mf-select']}
                value={f.district}
                onChange={(e) => setF((p) => ({ ...p, district: e.target.value }))}
              >
                <option value="">{t('realEstate.filters.allDistricts')}</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {dName(d)}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles['mf-sec']}>
              <h4>{t('realEstate.filters.price')}</h4>
              <div className={styles['mf-row']}>
                <div className={styles['mf-field']}>
                  <label>{t('realEstate.filters.from')}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    value={f.pmin ?? ''}
                    onChange={(e) => setF((p) => ({ ...p, pmin: parseNum(e.target.value) }))}
                  />
                </div>
                <div className={styles['mf-field']}>
                  <label>{t('realEstate.filters.to')}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={t('realEstate.filters.to')}
                    value={f.pmax ?? ''}
                    onChange={(e) => setF((p) => ({ ...p, pmax: parseNum(e.target.value) }))}
                  />
                </div>
              </div>
            </div>
            <div className={styles['mf-sec']}>
              <h4>{t('realEstate.filters.rooms')}</h4>
              <div className={styles['mf-picks']}>
                {roomOpts.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`${styles['mf-pick']}${f.rooms.includes(r) ? ` ${styles.on}` : ''}`}
                    onClick={() => toggleRoom(r)}
                  >
                    {roomsLabel(r)}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles['mf-sec']}>
              <h4>{t('realEstate.filters.area')}</h4>
              <div className={styles['mf-row']}>
                <div className={styles['mf-field']}>
                  <label>{t('realEstate.filters.from')}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    value={f.mmin ?? ''}
                    onChange={(e) => setF((p) => ({ ...p, mmin: parseNum(e.target.value) }))}
                  />
                </div>
                <div className={styles['mf-field']}>
                  <label>{t('realEstate.filters.to')}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={t('realEstate.filters.to')}
                    value={f.mmax ?? ''}
                    onChange={(e) => setF((p) => ({ ...p, mmax: parseNum(e.target.value) }))}
                  />
                </div>
              </div>
            </div>
            <div className={styles['mf-sec']}>
              <h4>{t('realEstate.filters.citizenship')}</h4>
              <label className={styles['mf-chk']}>
                <input type="checkbox" checked={f.cit} onChange={(e) => setF((p) => ({ ...p, cit: e.target.checked }))} />{' '}
                {t('realEstate.filters.citizenship_yes')}
              </label>
            </div>
            <div className={styles['mf-sec']}>
              <h4>{t('realEstate.mx.rowBuild')}</h4>
              <div className={styles['mf-picks']}>
                <button
                  type="button"
                  className={`${styles['mf-pick']}${f.build === '' ? ` ${styles.on}` : ''}`}
                  onClick={() => setF((p) => ({ ...p, build: '' }))}
                >
                  {t('realEstate.mx.sheetAll')}
                </button>
                <button
                  type="button"
                  className={`${styles['mf-pick']}${f.build === 'ready' ? ` ${styles.on}` : ''}`}
                  onClick={() => setF((p) => ({ ...p, build: 'ready' }))}
                >
                  {t('realEstate.build.ready')}
                </button>
                <button
                  type="button"
                  className={`${styles['mf-pick']}${f.build === 'under-construction' ? ` ${styles.on}` : ''}`}
                  onClick={() => setF((p) => ({ ...p, build: 'under-construction' }))}
                >
                  {t('realEstate.build.under-construction')}
                </button>
              </div>
            </div>
            <div className={styles['mf-sec']}>
              <h4>{t('realEstate.filters.extras')}</h4>
              {(['furnished', 'parking', 'elevator', 'security'] as const).map((k) => (
                <label key={k} className={styles['mf-chk']}>
                  <input
                    type="checkbox"
                    checked={f[k]}
                    onChange={(e) => setF((p) => ({ ...p, [k]: e.target.checked }))}
                  />{' '}
                  {t(`realEstate.amenity.${k}`)}
                </label>
              ))}
            </div>
          </div>
          <div className={styles['mf-f']}>
            <span>{t('realEstate.mx.matchCount', { count: filtered.length })}</span>
            <button type="button" className={styles['mf-done']} onClick={() => setSheetOpen(false)}>
              {t('realEstate.filters.apply', { count: filtered.length })}
            </button>
          </div>
        </div>
      </div>

      {/* ── search page ── */}
      <div className={`${styles.sov}${searchOpen ? ` ${styles.open}` : ''}`}>
        <div className={styles['s-top']}>
          <button type="button" className={styles['s-back']} onClick={() => setSearchOpen(false)} aria-label={t('common.back')}>
            <AppIcon name="chevron-right" className="w-6 h-6" />
          </button>
          <div className={styles['s-inp']}>
            <AppIcon name="search" className={`${styles['s-inpic']} w-[18px] h-[18px]`} />
            <input
              placeholder={t('realEstate.mx.searchPh')}
              autoComplete="off"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            {term && (
              <button type="button" className={styles['s-clr']} onClick={() => setTerm('')} aria-label={t('common.close')}>
                ✕
              </button>
            )}
          </div>
        </div>
        <div className={styles['s-body']}>
          <button type="button" className={styles['s-loc']} onClick={clearDistrict}>
            <AppIcon name="navigation" className="w-5 h-5" />
            {t('realEstate.mx.currentLoc')}
          </button>
          <div>
            {term.trim() ? (
              <>
                <div className={styles['s-label']}>{t('realEstate.mx.placesTitle')}</div>
                {searchMatches.length === 0 ? (
                  <div className={styles['s-empty']}>{t('realEstate.mx.noPlaces')}</div>
                ) : (
                  searchMatches.map((d) => (
                    <button key={d} type="button" className={`${styles['s-item']} ${styles.pl}`} onClick={() => chooseDistrict(d)}>
                      <span className={styles['s-ic']}>
                        <AppIcon name="map-pin" className="w-[22px] h-[22px]" />
                      </span>
                      <span className={styles['s-txt']}>
                        <b>{dName(d)}</b>
                        <span>{t('realEstate.mx.istCity')}</span>
                      </span>
                    </button>
                  ))
                )}
              </>
            ) : (
              <>
                {recent.length > 0 && (
                  <>
                    <div className={styles['s-label']}>{t('realEstate.mx.recentTitle')}</div>
                    {(recentOpen ? recent : recent.slice(0, 3)).map((d) => (
                      <button key={d} type="button" className={`${styles['s-item']} ${styles.rec}`} onClick={() => chooseDistrict(d)}>
                        <span className={styles['s-ic']}>
                          <AppIcon name="clock" className="w-[22px] h-[22px]" />
                        </span>
                        <span className={styles['s-txt']}>
                          <b>{dName(d)}</b>
                          <span>{t('realEstate.mx.availCount', { count: districtCount(d) })}</span>
                        </span>
                      </button>
                    ))}
                    {recent.length > 3 && (
                      <button type="button" className={styles['s-more']} onClick={() => setRecentOpen((v) => !v)}>
                        {recentOpen ? t('realEstate.mx.less') : t('realEstate.mx.more')}{' '}
                        <AppIcon name={recentOpen ? 'chevron-up' : 'chevron-down'} className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
                <div className={styles['s-label']}>{t('realEstate.mx.suggestedTitle')}</div>
                {(placesOpen ? suggested : suggested.slice(0, 3)).map((d) => (
                  <button key={d} type="button" className={`${styles['s-item']} ${styles.pl}`} onClick={() => chooseDistrict(d)}>
                    <span className={styles['s-ic']}>
                      <AppIcon name="map-pin" className="w-[22px] h-[22px]" />
                    </span>
                    <span className={styles['s-txt']}>
                      <b>{dName(d)}</b>
                      <span>{t('realEstate.mx.istCity')}</span>
                    </span>
                  </button>
                ))}
                {suggested.length > 3 && (
                  <button type="button" className={styles['s-more']} onClick={() => setPlacesOpen((v) => !v)}>
                    {placesOpen ? t('realEstate.mx.less') : t('realEstate.mx.more')}{' '}
                    <AppIcon name={placesOpen ? 'chevron-up' : 'chevron-down'} className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <MobileTabBar />
    </div>
  );
}
