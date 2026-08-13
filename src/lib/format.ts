/** Masks an email as `ab***@domain.com` — keeps the first 2 local-part chars and the full domain. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(local.length - visible.length, 3))}@${domain}`;
}

/** Masks a phone number, keeping a short prefix and the last 2 digits: `+90 555 *** **45`. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone;
  const last2 = digits.slice(-2);
  const prefixLen = phone.startsWith('+') ? 3 : 0;
  const prefix = phone.slice(0, prefixLen);
  return `${prefix}${'*'.repeat(Math.max(digits.length - 2, 3))}${last2}`;
}
