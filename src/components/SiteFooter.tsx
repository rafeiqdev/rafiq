import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Logo } from './Logo';
import { AppIcon } from './AppIcon';
import type { IconName } from './AppIcon';
import { setLanguage } from '../i18n';
import { LANGS } from '../lib/types';
import type { Lang } from '../lib/types';

// Same guard the floating WhatsApp button uses: hide the channel entirely
// unless a real number is configured, so we never hand a customer off to an
// empty or placeholder chat.
const WA = String(import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');
const WA_CONFIGURED = !!WA && WA !== '905000000000';

type FooterGroup = { id: string; titleKey: string; icon: IconName; links: { to: string; key: string }[] };

// Three explicit groups instead of the old "two unlabeled link columns" — every
// link now sits under a heading that says what it is, which is what makes the
// footer scannable on both desktop and phone.
const GROUPS: FooterGroup[] = [
  {
    id: 'services',
    titleKey: 'nav.services',
    icon: 'layers',
    links: [
      { to: '/services', key: 'nav.allServices' },
      { to: '/real-estate', key: 'nav.realEstate' },
      { to: '/health-tourism', key: 'nav.health' },
      { to: '/tricks', key: 'nav.tricks' },
    ],
  },
  {
    id: 'explore',
    titleKey: 'footer.exploreTitle',
    icon: 'compass',
    links: [
      { to: '/', key: 'nav.home' },
      { to: '/premium', key: 'nav.premium' },
      { to: '/map', key: 'nav.map' },
      { to: '/referrals', key: 'nav.referrals' },
      { to: '/company/register', key: 'nav.forCompanies' },
    ],
  },
  {
    id: 'legal',
    titleKey: 'footer.legalTitle',
    icon: 'shield-check',
    links: [
      { to: '/terms', key: 'nav.terms' },
      { to: '/privacy', key: 'nav.privacy' },
      { to: '/refund', key: 'nav.refund' },
    ],
  },
];

const LEGAL_LINKS = GROUPS[2].links;

function GroupHeading({ icon, label }: { icon: IconName; label: string }) {
  return (
    <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/50">
      <AppIcon name={icon} className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

/** The "need help?" card + WhatsApp channel — shared by both layouts. */
function HelpCard({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  const waHref = `https://wa.me/${WA}?text=${encodeURIComponent(t('whatsapp.default'))}`;

  return (
    <div className={`rounded-card border border-white/15 bg-white/[0.06] ${compact ? 'p-4' : 'p-5'}`}>
      <h3 className="font-bold text-white text-[15px]">{t('footer.helpTitle')}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">{t('footer.helpBody')}</p>
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <Link
          to="/premium"
          className="inline-flex items-center justify-center gap-2 rounded-btn bg-white text-navy font-bold text-[13px] px-4 min-h-[44px]"
        >
          <AppIcon name="message-circle" className="w-4 h-4" />
          {t('footer.helpAi')}
        </Link>
        {WA_CONFIGURED && (
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-btn border border-white/25 text-white font-semibold text-[13px] px-4 min-h-[44px] hover:bg-white/10"
          >
            <AppIcon name="phone" className="w-4 h-4" />
            {t('footer.helpWhatsapp')}
          </a>
        )}
      </div>
    </div>
  );
}

/** Inline language picker — the mobile screens have no header switcher, so the
 *  footer is the only place a phone user can change language from Home. */
function LangRow() {
  const { t, i18n } = useTranslation();
  return (
    <div>
      <GroupHeading icon="globe" label={t('common.language')} />
      <div className="mt-2.5 flex flex-wrap gap-2">
        {LANGS.map((l) => {
          const active = i18n.language === l.code;
          return (
            <button
              key={l.code}
              type="button"
              dir={l.dir}
              onClick={() => setLanguage(l.code as Lang)}
              aria-pressed={active}
              className={`rounded-full px-3.5 min-h-[36px] text-[13px] border transition-colors ${
                active
                  ? 'bg-white text-navy border-white font-bold'
                  : 'border-white/20 text-white/75 hover:bg-white/10'
              }`}
            >
              {l.native}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Bottom strip: disclaimer + copyright + always-visible legal links. */
function LegalStrip({ mobile }: { mobile?: boolean }) {
  const { t } = useTranslation();
  return (
    <div
      className={`border-t border-white/10 ${
        mobile ? 'px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+96px)]' : 'mx-auto max-w-6xl px-4 py-6'
      }`}
    >
      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-white/55">
        <AppIcon name="info" className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>{t('footer.disclaimer')}</span>
      </p>
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-[12px] text-white/55">
          © {new Date().getFullYear()} {t('common.appName')} — {t('footer.rights')}
        </p>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="text-white/70 underline-offset-4 hover:text-white hover:underline">
              {t(l.key)}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

/**
 * Site footer.
 *
 * `variant="mobile"` renders the phone version, which previously did not exist
 * at all: the mobile screens are chrome-free (see MOBILE_CHROME_FREE_ROUTES in
 * Layout.tsx), so the terms/privacy/refund block simply vanished on phones.
 * It collapses the link groups into accordions to stay short, keeps the legal
 * links visible in the bottom strip regardless, and reserves space for the
 * fixed bottom tab bar.
 */
export function SiteFooter({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const { t } = useTranslation();

  if (variant === 'mobile') {
    return (
      <footer className="bg-navy text-white/80 rounded-t-[28px]">
        <div className="px-5 pt-8 pb-6">
          <Logo size={30} variant="white" />
          <p className="mt-3 text-[14px] leading-relaxed text-white/70">{t('footer.brandBody')}</p>

          <div className="mt-5">
            <HelpCard compact />
          </div>

          <div className="mt-6 divide-y divide-white/10 border-y border-white/10">
            {GROUPS.map((g) => (
              <details key={g.id} className="group">
                <summary className="flex items-center justify-between gap-3 min-h-[52px] cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <GroupHeading icon={g.icon} label={t(g.titleKey)} />
                  <span className="text-white/40 text-xl leading-none transition-transform group-open:rotate-45">+</span>
                </summary>
                <ul className="pb-3">
                  {g.links.map((l) => (
                    <li key={l.to}>
                      <Link
                        to={l.to}
                        className="flex items-center min-h-[44px] text-[14px] text-white/75 active:text-white"
                      >
                        {t(l.key)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>

          <div className="mt-6">
            <LangRow />
          </div>
        </div>

        <LegalStrip mobile />
      </footer>
    );
  }

  return (
    <footer className="bg-navy text-white/80 mt-16">
      <div className="mx-auto max-w-6xl px-4 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-12">
        {/* brand + help */}
        <div className="sm:col-span-2 lg:col-span-4">
          <Logo size={34} variant="white" />
          <p className="mt-4 text-sm leading-relaxed text-white/70">{t('footer.brandBody')}</p>
          <div className="mt-5">
            <HelpCard />
          </div>
        </div>

        {/* link groups */}
        {GROUPS.map((g) => (
          <nav key={g.id} className="lg:col-span-2">
            <GroupHeading icon={g.icon} label={t(g.titleKey)} />
            <ul className="mt-3 flex flex-col gap-2.5 text-sm">
              {g.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-white/70 hover:text-white transition-colors">
                    {t(l.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div className="sm:col-span-2 lg:col-span-2">
          <LangRow />
        </div>
      </div>

      <LegalStrip />
    </footer>
  );
}
