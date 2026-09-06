/**
 * The one place that decides how to reach Rafiq.
 *
 * The WhatsApp number and contact email were previously read straight from
 * import.meta.env in each component that needed them (SiteFooter, the floating
 * WhatsApp button, LocalBusinessSchema...), each repeating the same
 * "digits-only, and treat the placeholder as unset" guard. /contact and the
 * Organization JSON-LD both need the same values, and a contact detail that
 * disagrees with itself across a site is worse than one that is missing — so
 * the guard lives here now and everything reads it from one module.
 *
 * A channel that is not configured is reported as unconfigured rather than
 * rendered broken: no `wa.me/` link with no number behind it, no `mailto:`
 * with an empty address, and no `telephone`/`email` property in the structured
 * data claiming a contact route that does not exist.
 */

/** Placeholder shipped in .env.example — present but deliberately not a real number. */
const WA_PLACEHOLDER = '905000000000';

const RAW_WHATSAPP = String(import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');

/** International format, digits only, no "+". Empty string when not configured. */
export const WHATSAPP_NUMBER: string =
  RAW_WHATSAPP && RAW_WHATSAPP !== WA_PLACEHOLDER ? RAW_WHATSAPP : '';

export const HAS_WHATSAPP: boolean = WHATSAPP_NUMBER !== '';

/**
 * E.164 form (`+90...`) for `tel:` links and schema.org `telephone`, which
 * both expect the leading plus. Empty string when not configured.
 */
export const WHATSAPP_E164: string = HAS_WHATSAPP ? `+${WHATSAPP_NUMBER}` : '';

/** Display form, grouped for readability: +90 552 458 88 80. */
export const WHATSAPP_DISPLAY: string = HAS_WHATSAPP
  ? WHATSAPP_NUMBER.replace(/^(\d{2})(\d{3})(\d{3})(\d{2})(\d{2})$/, '+$1 $2 $3 $4 $5')
  : '';

export const CONTACT_EMAIL: string = String(import.meta.env.VITE_CONTACT_EMAIL ?? '').trim();

export const HAS_EMAIL: boolean = CONTACT_EMAIL !== '';

/**
 * Optional public office address. Empty is the expected state — Rafiq's work
 * is field-based and there are no premises open to visitors, so nothing here
 * invents one. See .env.example for why publishing an address that does not
 * exist would damage exactly the trust this site trades on.
 */
export const OFFICE_ADDRESS: string = String(import.meta.env.VITE_OFFICE_ADDRESS ?? '').trim();

export const HAS_OFFICE_ADDRESS: boolean = OFFICE_ADDRESS !== '';

/** Builds a wa.me link with a pre-filled message, or null when unconfigured. */
export function whatsappHref(message: string): string | null {
  if (!HAS_WHATSAPP) return null;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/** Builds a mailto: link with a pre-filled subject, or null when unconfigured. */
export function emailHref(subject?: string): string | null {
  if (!HAS_EMAIL) return null;
  return subject ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}` : `mailto:${CONTACT_EMAIL}`;
}
