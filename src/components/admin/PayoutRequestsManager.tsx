import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminPayouts } from '../../lib/api';
import type { AdminPayout } from '../../lib/api';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import { SectionState } from '../SectionState';
import { AppIcon } from '../AppIcon';
import { ConfirmActionModal } from './ConfirmActionModal';

/**
 * Withdrawal requests, and the buttons that settle them.
 *
 * This is the half of the wallet that never existed. A user could ask to
 * withdraw and the row landed in payout_requests as 'under_review' — where it
 * stayed forever, because the Control Center only reads those rows and this
 * page had no payout section at all. Nobody could pay anybody.
 *
 * The three buttons map onto what actually happens with the money:
 *   موافقة  — cleared to send, nothing has moved yet
 *   تم التحويل — the transfer left the bank; ONLY this moves the earnings out
 *               of the user's balance (admin_set_payout_status flips the
 *               attached commissions to 'paid')
 *   رفض     — hands the money back, so they can request it again
 *
 * "تم التحويل" is deliberately unavailable before موافقة: marking a payout
 * paid is the irreversible step, and it should take two deliberate clicks on
 * two different days rather than one on a crowded screen.
 */

type Action = 'approved' | 'paid' | 'cancelled';

function money(amount: number, currency: string): string {
  const n = amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (currency === 'USD') return `$${n}`;
  if (currency === 'EUR') return `€${n}`;
  if (currency === 'TRY') return `${n} TL`;
  return `${n} ${currency}`;
}

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  const tone =
    status === 'paid'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : status === 'approved' || status === 'processing'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : status === 'under_review'
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-gray-100 text-gray-700 border-gray-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${tone}`}>
      {t(`wallet.statuses.${status}`, status)}
    </span>
  );
}

/** The payout's destination, spelled out so it can be copied into a bank form. */
function Destination({ row }: { row: AdminPayout }) {
  const { t } = useTranslation();
  const d = row.payoutDetails ?? {};
  const lines: [string, string | undefined][] =
    row.payoutMethod === 'crypto'
      ? [[t('admin.payouts.wallet'), d.walletAddress]]
      : [
          [t('admin.payouts.accountHolder'), d.accountHolder],
          [t('admin.payouts.bank'), d.bankName],
          ['IBAN', d.iban],
        ];
  return (
    <div className="mt-2 rounded-xl bg-cream p-3 text-xs space-y-1">
      {lines.map(([label, value]) =>
        value ? (
          <div key={label} className="flex gap-2">
            <span className="text-navy/50 shrink-0">{label}:</span>
            <span className="font-mono font-bold text-navy break-all" dir="ltr">
              {value}
            </span>
          </div>
        ) : null,
      )}
      {d.notes && <p className="text-navy/60 pt-1 border-t border-cream-dark">{d.notes}</p>}
    </div>
  );
}

export function PayoutRequestsManager() {
  const { t } = useTranslation();
  const section = useAsyncSection(() => adminPayouts.list(), []);
  const [confirm, setConfirm] = useState<{ row: AdminPayout; action: Action } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const run = async (reason?: string) => {
    if (!confirm) return;
    setBusy(true);
    setFailure(null);
    try {
      await adminPayouts.setStatus(confirm.row.id, confirm.action, reason);
      setConfirm(null);
      section.reload();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-extrabold text-navy">{t('admin.payouts.title')}</h2>
        <button type="button" onClick={section.reload} className="btn-secondary text-xs px-3 py-1.5">
          {t('common.refresh')}
        </button>
      </div>
      <p className="mt-1 text-sm text-navy/60">{t('admin.payouts.intro')}</p>

      {failure && (
        <p className="mt-3 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-800">
          {failure}
        </p>
      )}

      <div className="mt-4">
        <SectionState
          section={section}
          title={t('admin.payouts.title')}
          isEmpty={(rows) => rows.length === 0}
          empty={<p className="text-sm text-navy/60">{t('admin.payouts.empty')}</p>}
        >
          {(rows) => (
            <ul className="space-y-3">
              {rows.map((row) => {
                const open = row.status === 'under_review';
                const cleared = row.status === 'approved' || row.status === 'processing';
                return (
                  <li key={row.id} className="rounded-2xl border border-cream-dark p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-navy break-words">
                          {row.userName || row.userEmail || t('admin.payouts.unknownUser')}
                        </p>
                        <p className="text-xs text-navy/50 break-all">
                          {row.userEmail}
                          {row.referralCode ? ` · ${row.referralCode}` : ''}
                        </p>
                      </div>
                      <div className="text-end shrink-0">
                        <p className="text-lg font-extrabold text-navy font-mono" dir="ltr">
                          {money(row.amount, row.currency)}
                        </p>
                        <div className="mt-1">
                          <StatusPill status={row.status} />
                        </div>
                      </div>
                    </div>

                    <Destination row={row} />

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-navy/45 me-auto">
                        {new Date(row.createdAt).toLocaleDateString()}
                        {row.adminNotes ? ` · ${row.adminNotes}` : ''}
                      </span>

                      {open && (
                        <button
                          type="button"
                          onClick={() => setConfirm({ row, action: 'approved' })}
                          className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1.5"
                        >
                          <AppIcon name="check-circle" className="w-3.5 h-3.5" />
                          {t('admin.payouts.approve')}
                        </button>
                      )}
                      {cleared && (
                        <button
                          type="button"
                          onClick={() => setConfirm({ row, action: 'paid' })}
                          className="btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1.5"
                        >
                          <AppIcon name="credit-card" className="w-3.5 h-3.5" />
                          {t('admin.payouts.markPaid')}
                        </button>
                      )}
                      {(open || cleared) && (
                        <button
                          type="button"
                          onClick={() => setConfirm({ row, action: 'cancelled' })}
                          className="text-xs px-3 py-1.5 rounded-lg font-bold text-rose-700 hover:bg-rose-50 inline-flex items-center gap-1.5"
                        >
                          <AppIcon name="x-circle" className="w-3.5 h-3.5" />
                          {t('admin.payouts.reject')}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionState>
      </div>

      {confirm && (
        <ConfirmActionModal
          title={t(`admin.payouts.confirm.${confirm.action}Title`)}
          record={`${confirm.row.userName || confirm.row.userEmail || ''} — ${money(confirm.row.amount, confirm.row.currency)}`}
          currentStatus={t(`wallet.statuses.${confirm.row.status}`, confirm.row.status)}
          expectedResult={t(`admin.payouts.confirm.${confirm.action}Result`)}
          // Only "تم التحويل" is one-way: it moves the earnings out of the
          // user's balance and stands for money that has left the bank.
          reversible={confirm.action !== 'paid'}
          notifiesCustomer={false}
          requireReason={confirm.action === 'cancelled'}
          confirmLabel={t(`admin.payouts.${confirm.action === 'approved' ? 'approve' : confirm.action === 'paid' ? 'markPaid' : 'reject'}`)}
          busy={busy}
          onConfirm={run}
          onClose={() => setConfirm(null)}
        />
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-navy/45">{t('admin.payouts.note')}</p>
    </section>
  );
}
