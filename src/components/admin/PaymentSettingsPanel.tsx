import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { checkout, toCheckoutConfig } from '../../lib/api';
import type { CheckoutGateway, CheckoutSettings } from '../../lib/api';
import { normaliseIban, validateCheckoutSettings } from '../../lib/checkoutValidation';
import { AppIcon } from '../AppIcon';

/**
 * Payment settings, editable from the admin page.
 *
 * The reason this exists: the IBAN lived only in a hand-written settings row,
 * and for weeks the row did not exist at all — so customers were shown the
 * placeholder "TR00 0000…" as real payment instructions and nothing on any
 * screen said so. Every group therefore reports its LIVE customer-facing state,
 * computed with toCheckoutConfig — the exact function the checkout page uses,
 * so the admin badge and what a customer sees can never disagree.
 *
 * NO SECRETS HERE. `settings` is anon-readable, so gateways carry a label and a
 * public checkout URL only. Any gateway needing an API key or webhook secret
 * keeps it in a server-side env var; there is deliberately no field for one.
 */

const EMPTY: CheckoutSettings = {
  bank: { enabled: false, iban: '', holder: '', bankName: '' },
  crypto: { enabled: false, network: '', wallet: '' },
  gateways: [],
};

/** 44px minimum — this is edited from a phone. */
const FIELD = 'input mt-1 min-h-[44px] w-full';
const BTN = 'min-h-[44px] px-4 text-sm';

function StatusPill({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
        visible ? 'bg-green-100 text-green-800' : 'bg-gold-soft text-gold-dark'
      }`}
    >
      <AppIcon name={visible ? 'check' : 'alert-triangle'} className="h-3.5 w-3.5 shrink-0" />
      {t(visible ? 'admin.paymentSettings.statusVisible' : 'admin.paymentSettings.statusHidden')}
    </span>
  );
}

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold ${
        on ? 'bg-navy text-white' : 'bg-cream-dark text-navy/70'
      }`}
    >
      {label}
    </button>
  );
}

export function PaymentSettingsPanel() {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<CheckoutSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDraft(await checkout.adminSettings());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live customer-facing truth, from the same function the checkout page runs.
  const live = useMemo(() => toCheckoutConfig(draft), [draft]);

  const patch = (next: Partial<CheckoutSettings>) => {
    setDraft((d) => ({ ...d, ...next }));
    setSaved(false);
    setSaveFailed(false);
  };

  const setGateway = (i: number, next: Partial<CheckoutGateway>) =>
    patch({ gateways: draft.gateways.map((g, j) => (j === i ? { ...g, ...next } : g)) });

  const addGateway = () =>
    patch({
      gateways: [
        ...draft.gateways,
        { id: `g${Date.now()}`, label: '', url: '', enabled: false },
      ],
    });

  const removeGateway = (i: number) => patch({ gateways: draft.gateways.filter((_, j) => j !== i) });

  const save = async () => {
    const found = validateCheckoutSettings(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Never save invalid data silently, and never look saved.
      setSaved(false);
      setSaveFailed(false);
      return;
    }
    setBusy(true);
    setSaveFailed(false);
    try {
      const normalised: CheckoutSettings = {
        ...draft,
        bank: { ...draft.bank, iban: normaliseIban(draft.bank.iban) },
      };
      await checkout.adminSave(normalised);
      setDraft(normalised);
      setSaved(true);
    } catch {
      // A failed save must be obvious and must not leave the form looking saved.
      setSaved(false);
      setSaveFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const err = (key: string) =>
    errors[key] ? (
      <span className="mt-1 flex items-center gap-1 text-xs text-brand-red">
        <AppIcon name="alert-triangle" className="h-3.5 w-3.5 shrink-0" />
        {t(errors[key])}
      </span>
    ) : null;

  if (loading) return null;

  if (loadFailed) {
    return (
      <div className="card mt-5 border border-brand-red/30 p-4" role="alert">
        <p className="text-sm font-semibold text-brand-red">{t('admin.paymentSettings.loadError')}</p>
        <button onClick={load} className={`btn-secondary mt-3 ${BTN}`}>
          {t('chat.retry')}
        </button>
      </div>
    );
  }

  return (
    <section className="card mt-5 p-6" aria-labelledby="admin-payments-title">
      <h2 id="admin-payments-title" className="font-bold text-navy">
        {t('admin.paymentSettings.title')}
      </h2>
      <p className="mt-1 text-xs text-gray-500">{t('admin.paymentSettings.noSecretsNote')}</p>

      {/* ---------- bank transfer ---------- */}
      <div className="mt-5 rounded-xl bg-cream p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-navy">{t('admin.paymentSettings.bank.title')}</h3>
          <StatusPill visible={live.bankConfigured} />
          <span className="ms-auto">
            <Toggle
              on={draft.bank.enabled}
              onChange={(v) => patch({ bank: { ...draft.bank, enabled: v } })}
              label={t(draft.bank.enabled ? 'admin.paymentSettings.on' : 'admin.paymentSettings.off')}
            />
          </span>
        </div>

        <label className="mt-3 block text-xs font-semibold text-navy/70">
          {t('admin.paymentSettings.bank.iban')}
          <input
            className={FIELD}
            dir="ltr"
            inputMode="text"
            value={draft.bank.iban}
            onChange={(e) => patch({ bank: { ...draft.bank, iban: e.target.value } })}
            aria-invalid={!!errors['bank.iban']}
          />
          {err('bank.iban')}
        </label>

        <label className="mt-3 block text-xs font-semibold text-navy/70">
          {t('admin.paymentSettings.bank.holder')}
          <input
            className={FIELD}
            value={draft.bank.holder}
            onChange={(e) => patch({ bank: { ...draft.bank, holder: e.target.value } })}
            aria-invalid={!!errors['bank.holder']}
          />
          {err('bank.holder')}
        </label>

        <label className="mt-3 block text-xs font-semibold text-navy/70">
          {t('admin.paymentSettings.bank.bankName')}
          <input
            className={FIELD}
            value={draft.bank.bankName}
            onChange={(e) => patch({ bank: { ...draft.bank, bankName: e.target.value } })}
          />
        </label>
      </div>

      {/* ---------- crypto ---------- */}
      <div className="mt-4 rounded-xl bg-cream p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-navy">{t('admin.paymentSettings.crypto.title')}</h3>
          <StatusPill visible={live.cryptoConfigured} />
          <span className="ms-auto">
            <Toggle
              on={draft.crypto.enabled}
              onChange={(v) => patch({ crypto: { ...draft.crypto, enabled: v } })}
              label={t(draft.crypto.enabled ? 'admin.paymentSettings.on' : 'admin.paymentSettings.off')}
            />
          </span>
        </div>

        <label className="mt-3 block text-xs font-semibold text-navy/70">
          {t('admin.paymentSettings.crypto.network')}
          <input
            className={FIELD}
            dir="ltr"
            placeholder="TRC20"
            value={draft.crypto.network}
            onChange={(e) => patch({ crypto: { ...draft.crypto, network: e.target.value } })}
            aria-invalid={!!errors['crypto.network']}
          />
          {err('crypto.network')}
        </label>

        <label className="mt-3 block text-xs font-semibold text-navy/70">
          {t('admin.paymentSettings.crypto.wallet')}
          <input
            className={FIELD}
            dir="ltr"
            value={draft.crypto.wallet}
            onChange={(e) => patch({ crypto: { ...draft.crypto, wallet: e.target.value } })}
            aria-invalid={!!errors['crypto.wallet']}
          />
          {err('crypto.wallet')}
        </label>
      </div>

      {/* ---------- gateways ---------- */}
      <div className="mt-4 rounded-xl bg-cream p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-navy">{t('admin.paymentSettings.gateways.title')}</h3>
          <StatusPill visible={live.gateways.length > 0} />
        </div>
        <p className="mt-1 text-xs text-gray-500">{t('admin.paymentSettings.gateways.help')}</p>

        <ul className="mt-3 flex flex-col gap-3">
          {draft.gateways.map((g, i) => (
            <li key={g.id} className="rounded-lg bg-white p-3">
              <label className="block text-xs font-semibold text-navy/70">
                {t('admin.paymentSettings.gateways.label')}
                <input
                  className={FIELD}
                  value={g.label}
                  onChange={(e) => setGateway(i, { label: e.target.value })}
                  aria-invalid={!!errors[`gateways.${i}.label`]}
                />
                {err(`gateways.${i}.label`)}
              </label>
              <label className="mt-3 block text-xs font-semibold text-navy/70">
                {t('admin.paymentSettings.gateways.url')}
                <input
                  className={FIELD}
                  dir="ltr"
                  inputMode="url"
                  placeholder="https://"
                  value={g.url}
                  onChange={(e) => setGateway(i, { url: e.target.value })}
                  aria-invalid={!!errors[`gateways.${i}.url`]}
                />
                {err(`gateways.${i}.url`)}
              </label>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Toggle
                  on={g.enabled}
                  onChange={(v) => setGateway(i, { enabled: v })}
                  label={t(g.enabled ? 'admin.paymentSettings.on' : 'admin.paymentSettings.off')}
                />
                <button
                  type="button"
                  onClick={() => removeGateway(i)}
                  className={`btn-danger ms-auto ${BTN}`}
                >
                  {t('admin.paymentSettings.gateways.remove')}
                </button>
              </div>
            </li>
          ))}
        </ul>

        <button type="button" onClick={addGateway} className={`btn-secondary mt-3 ${BTN}`}>
          <AppIcon name="plus" className="h-4 w-4 shrink-0" />
          {t('admin.paymentSettings.gateways.add')}
        </button>
      </div>

      {/* ---------- save ---------- */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className={`btn-primary ${BTN} disabled:opacity-50`}>
          {t('admin.paymentSettings.save')}
        </button>
        {saved && (
          <span role="status" className="text-sm font-semibold text-green-700">
            {t('admin.paymentSettings.saved')}
          </span>
        )}
        {saveFailed && (
          <span role="alert" className="text-sm font-semibold text-brand-red">
            {t('admin.paymentSettings.saveError')}
          </span>
        )}
        {Object.keys(errors).length > 0 && (
          <span role="alert" className="text-sm font-semibold text-brand-red">
            {t('admin.paymentSettings.fixErrors')}
          </span>
        )}
      </div>
    </section>
  );
}
