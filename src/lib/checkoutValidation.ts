/**
 * Shared validity + placeholder detection for manual payment details.
 *
 * One source of truth on purpose: the admin editor decides whether to REJECT a
 * save, and checkout.config() decides whether to SHOW a rail to a customer. If
 * those two ever disagreed we would be back to the original bug — a rail that
 * looked configured in the admin panel while customers saw the placeholder.
 */

/**
 * Dummy values shown only when nothing real has been configured. Kept here so
 * the detectors below can compare against them by value.
 */
export const PLACEHOLDER_CHECKOUT = {
  iban: 'TR00 0000 0000 0000 0000 0000 00',
  holder: 'Rafiq Istanbul',
  wallet: 'TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  network: 'TRC20 (USDT)',
};

export const squash = (s: unknown): string =>
  (typeof s === 'string' ? s : '').replace(/\s+/g, '').toUpperCase();

/** Display form: groups of four, uppercase. */
export function normaliseIban(raw: string): string {
  const v = squash(raw);
  return (v.match(/.{1,4}/g) ?? []).join(' ');
}

/**
 * Is this a real IBAN, or the placeholder?
 *
 * Checked BY VALUE, not merely by whether the settings row exists: the row can
 * be present and still hold the dummy data, and that reads as "configured" to
 * any row-existence test.
 */
export function isRealIban(iban: unknown): boolean {
  const v = squash(iban);
  if (!v) return false;
  if (v === squash(PLACEHOLDER_CHECKOUT.iban)) return false;
  if (/^[A-Z]{2}0+$/.test(v)) return false; // country prefix then only zeros
  return v.length >= 16;
}

/** Is this a real wallet address, or the TXXXX… placeholder? */
export function isRealWallet(wallet: unknown): boolean {
  const v = squash(wallet);
  if (!v) return false;
  if (v === squash(PLACEHOLDER_CHECKOUT.wallet)) return false;
  if (/^[A-Z]?X+$/.test(v)) return false; // TXXXX… / XXXX… filler
  if (/^(.)\1+$/.test(v)) return false; // one repeated character
  return v.length >= 20;
}

/** Turkish IBAN: TR followed by 24 digits. Spaces are tolerated. */
export function isValidTrIban(raw: string): boolean {
  return /^TR\d{24}$/.test(squash(raw));
}

/**
 * Does the address look like something the chosen network would accept?
 *
 * Shape-only — we cannot verify an address exists, but a TRC20 address pasted
 * into an ERC20 rail is a lost payment, and that is worth catching.
 */
export function isPlausibleWallet(network: string, address: string): boolean {
  if (!isRealWallet(address)) return false;
  const raw = (address ?? '').trim();
  const net = (network ?? '').toUpperCase();

  if (net.includes('TRC')) return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(raw);
  if (net.includes('ERC') || net.includes('BEP') || net.includes('ETH') || net.includes('POLYGON')) {
    return /^0x[0-9a-fA-F]{40}$/.test(raw);
  }
  // Unknown network: fall back to the generic placeholder check above.
  return true;
}

/** https only — a checkout link sent over http is a downgrade attack waiting. */
export function isHttpsUrl(value: string): boolean {
  try {
    return new URL((value ?? '').trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Field path -> i18n key. Empty object means the settings are saveable. */
export type CheckoutErrors = Record<string, string>;

interface ValidatableSettings {
  bank: { enabled: boolean; iban: string; holder: string; bankName: string };
  crypto: { enabled: boolean; network: string; wallet: string };
  gateways: { id: string; label: string; url: string; enabled: boolean }[];
}

/**
 * Save-time validation.
 *
 * Only ENABLED groups are validated: a rail switched off may hold half-finished
 * data the admin is still working on, and refusing to save that would trap them
 * with no way to persist progress. An enabled rail, by contrast, is a promise
 * to customers and must be complete before it can be stored at all — which is
 * the first of the two guards. The second is toCheckoutConfig(), which hides an
 * enabled-but-invalid rail even if one reaches the database another way.
 */
export function validateCheckoutSettings(s: ValidatableSettings): CheckoutErrors {
  const errors: CheckoutErrors = {};

  if (s.bank.enabled) {
    if (!isValidTrIban(s.bank.iban)) errors['bank.iban'] = 'admin.paymentSettings.errors.iban';
    else if (!isRealIban(s.bank.iban)) errors['bank.iban'] = 'admin.paymentSettings.errors.ibanPlaceholder';
    if (s.bank.holder.trim().length < 3) errors['bank.holder'] = 'admin.paymentSettings.errors.holder';
  }

  if (s.crypto.enabled) {
    if (s.crypto.network.trim() === '') errors['crypto.network'] = 'admin.paymentSettings.errors.network';
    if (!isRealWallet(s.crypto.wallet)) errors['crypto.wallet'] = 'admin.paymentSettings.errors.walletPlaceholder';
    else if (!isPlausibleWallet(s.crypto.network, s.crypto.wallet)) {
      // A TRC20 address pasted into an ERC20 rail is a lost payment.
      errors['crypto.wallet'] = 'admin.paymentSettings.errors.walletNetwork';
    }
  }

  s.gateways.forEach((g, i) => {
    if (!g.enabled) return;
    if (g.label.trim() === '') errors[`gateways.${i}.label`] = 'admin.paymentSettings.errors.gatewayLabel';
    if (!isHttpsUrl(g.url)) errors[`gateways.${i}.url`] = 'admin.paymentSettings.errors.gatewayUrl';
  });

  return errors;
}
