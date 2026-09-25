import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon } from './AppIcon';
import { WhatsAppIcon } from './WhatsAppButton';

// New UI copy for this panel only, keyed by language code.
const copy: Record<string, { title: string; hint: string; copyLink: string; copied: string; more: string }> = {
  en: {
    title: 'Share this service',
    hint: 'Whoever opens the link lands straight on this service.',
    copyLink: 'Copy link',
    copied: 'Link copied',
    more: 'More',
  },
  ar: {
    title: 'شارك هذه الخدمة',
    hint: 'من يفتح الرابط تُفتح له هذه الخدمة مباشرة.',
    copyLink: 'نسخ الرابط',
    copied: 'تم نسخ الرابط',
    more: 'المزيد',
  },
  fa: {
    title: 'این خدمت را به اشتراک بگذارید',
    hint: 'هر کس لینک را باز کند، مستقیم به همین خدمت می‌رسد.',
    copyLink: 'کپی لینک',
    copied: 'لینک کپی شد',
    more: 'بیشتر',
  },
  ru: {
    title: 'Поделиться услугой',
    hint: 'По ссылке сразу откроется эта услуга.',
    copyLink: 'Копировать ссылку',
    copied: 'Ссылка скопирована',
    more: 'Ещё',
  },
};

export function shareCopy(lang: string) {
  return copy[(lang || 'en').split('-')[0]] ?? copy.en;
}

/** `/xx/services?open=<id>` on the current origin — the catalogue deep link
 * that opens this one card on arrival, no sign-in needed. */
export function serviceShareUrl(serviceId: string) {
  const path = window.location.pathname.replace(/\/services\/?.*$/, '/services');
  return `${window.location.origin}${path}?open=${encodeURIComponent(serviceId)}`;
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / non-secure contexts: the hidden-textarea fallback.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/**
 * The "share this service" sheet that slides up inside the expanded service
 * card (same shape as the "how do you want this done" panel). Copy link,
 * WhatsApp, Telegram, Facebook, X, plus the phone's own share sheet where the
 * browser offers one.
 */
export function ServiceSharePanel({
  serviceId,
  title,
  open,
  onClose,
}: {
  serviceId: string;
  title: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const c = shareCopy(i18n.language);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  // Built lazily so it always reflects the page's current language segment.
  const url = open ? serviceShareUrl(serviceId) : '';
  const text = `${title} — ${t('common.appName')}`;
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const onCopy = async () => {
    if (await copyText(url)) {
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2200);
    }
  };
  const onNative = async () => {
    try {
      await navigator.share({ title: text, text, url });
    } catch {
      /* dismissed */
    }
  };

  const u = encodeURIComponent(url);
  const tx = encodeURIComponent(text);
  const networks = [
    { key: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, icon: <WhatsAppIcon />, color: '#25D366' },
    { key: 'telegram', label: 'Telegram', href: `https://t.me/share/url?url=${u}&text=${tx}`, icon: <TelegramIcon />, color: '#229ED9' },
    { key: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, icon: <FacebookIcon />, color: '#1877F2' },
    { key: 'x', label: 'X', href: `https://twitter.com/intent/tweet?url=${u}&text=${tx}`, icon: <XIcon />, color: '#000000' },
  ];

  return (
    <section className="esc-share-panel" aria-hidden={!open}>
      <button type="button" className="esc-close-panel" onClick={onClose} aria-label={t('common.close')}>
        ×
      </button>
      <span className="esc-panel-kicker">{title}</span>
      <h3>{c.title}</h3>
      <p className="esc-share-hint">{c.hint}</p>

      <div className="esc-share-link">
        <span dir="ltr">{url.replace(/^https?:\/\//, '')}</span>
        <button type="button" onClick={onCopy} className={copied ? 'is-copied' : ''}>
          <AppIcon name={copied ? 'check' : 'copy'} />
          {copied ? c.copied : c.copyLink}
        </button>
      </div>

      <div className="esc-share-grid">
        {networks.map((n) => (
          <a key={n.key} href={n.href} target="_blank" rel="noopener noreferrer" className="esc-share-net">
            <span className="esc-share-net-icon" style={{ background: n.color }}>
              {n.icon}
            </span>
            {n.label}
          </a>
        ))}
        {canNativeShare && (
          <button type="button" onClick={onNative} className="esc-share-net">
            <span className="esc-share-net-icon esc-share-net-more">
              <AppIcon name="share-2" />
            </span>
            {c.more}
          </button>
        )}
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {copied ? c.copied : ''}
      </span>
    </section>
  );
}
