import { useTranslation } from 'react-i18next';
import { CONTACT_PAGE } from '../data/contactPage';
import { usePageMeta } from '../lib/seo';
import { AppIcon } from '../components/AppIcon';
import type { IconName } from '../components/AppIcon';
import { ContactPageSchema } from '../components/AboutPageSchema';
import {
  CONTACT_EMAIL,
  HAS_EMAIL,
  HAS_WHATSAPP,
  WHATSAPP_DISPLAY,
  emailHref,
  whatsappHref,
} from '../lib/contact';

/**
 * /contact — the channels that actually reach Rafiq.
 *
 * Every contact value comes from src/lib/contact.ts (env-backed), never from
 * the translation files, so there is one place to change a number and no way
 * for a stale one to survive in three languages. An unconfigured channel is
 * not rendered at all rather than rendered broken.
 *
 * See src/data/contactPage.ts for the copy and for why there is no office
 * address and no response-time promise here.
 */

/** One contact channel row. Rendered only when its value is configured. */
function Channel({
  icon,
  label,
  body,
  value,
  href,
  cta,
}: {
  icon: IconName;
  label: string;
  body: string;
  value: string;
  href: string;
  cta?: string;
}) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-navy">
        <AppIcon name={icon} className="h-5 w-5 shrink-0" />
        {label}
      </h2>
      <p className="mt-3 text-sm leading-7 text-gray-650">{body}</p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        dir="ltr"
        className="mt-3 block text-[15px] font-bold text-navy underline underline-offset-4"
      >
        {value}
      </a>
      {cta && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-btn bg-navy px-5 text-[14px] font-bold text-white"
        >
          {cta}
        </a>
      )}
    </section>
  );
}

/** A short labelled fact — where we work, languages, when we reply. */
function Fact({ icon, label, body }: { icon: IconName; label: string; body: string }) {
  return (
    <div className="card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-navy">
        <AppIcon name={icon} className="h-4 w-4 shrink-0" />
        {label}
      </h2>
      <p className="mt-2.5 text-sm leading-7 text-gray-650">{body}</p>
    </div>
  );
}

export function Contact() {
  const { i18n } = useTranslation();
  const language = i18n.language as 'ar' | 'en' | 'ru' | 'fa';
  const isRtl = language === 'ar' || language === 'fa';
  const content = CONTACT_PAGE[language] ?? CONTACT_PAGE.ar;

  usePageMeta({ title: content.seoTitle, description: content.metaDescription });

  const waHref = whatsappHref(content.intro);
  const mailHref = emailHref(content.title);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14" dir={isRtl ? 'rtl' : 'ltr'}>
      <ContactPageSchema />

      <header className="rounded-card bg-navy px-6 py-8 text-white shadow-card sm:px-9 sm:py-10">
        <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{content.title}</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-white/90 sm:text-base">{content.intro}</p>
      </header>

      <div className="mt-6 space-y-4">
        {HAS_WHATSAPP && waHref && (
          <Channel
            icon="message-circle"
            label={content.whatsappLabel}
            body={content.whatsappBody}
            value={WHATSAPP_DISPLAY}
            href={waHref}
            cta={content.whatsappCta}
          />
        )}

        {HAS_EMAIL && mailHref && (
          <Channel
            icon="mail"
            label={content.emailLabel}
            body={content.emailBody}
            value={CONTACT_EMAIL}
            href={mailHref}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Fact icon="map-pin" label={content.areaLabel} body={content.area} />
          <Fact icon="languages" label={content.languagesLabel} body={content.languages} />
          <Fact icon="clock" label={content.availabilityLabel} body={content.availability} />
          <Fact icon="receipt" label={content.costLabel} body={content.costNote} />
        </div>

        <section className="card p-5 sm:p-6">
          <h2 className="text-lg font-extrabold text-navy">{content.tipsHeading}</h2>
          <p className="mt-3 text-sm leading-7 text-gray-650">{content.tipsIntro}</p>
          <ul className="mt-3 space-y-2">
            {content.tips.map((tip) => (
              <li key={tip} className="flex items-start gap-2.5 text-sm leading-7 text-gray-650">
                <AppIcon name="check-circle" className="mt-1.5 h-4 w-4 shrink-0 text-navy/60" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
