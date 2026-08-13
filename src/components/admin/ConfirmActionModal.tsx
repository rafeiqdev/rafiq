import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../Modal';
import { AppIcon } from '../AppIcon';

/**
 * Shared confirmation gate for sensitive admin actions. Explains what is
 * about to happen before it happens — does not change what the action
 * itself does, only inserts a click-through in front of it.
 */
export function ConfirmActionModal({
  title,
  record,
  currentStatus,
  expectedResult,
  reversible,
  notifiesCustomer,
  requireReason = false,
  confirmLabel,
  busy = false,
  onConfirm,
  onClose,
}: {
  /** Name of the action, e.g. "Verify payment". */
  title: string;
  /** Human-readable label for the affected record, e.g. "Ahmad K. — 1,200 TRY". */
  record?: string;
  currentStatus?: string;
  /** What will happen if confirmed. */
  expectedResult: string;
  reversible: boolean;
  notifiesCustomer: boolean;
  requireReason?: boolean;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: (reason?: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const canConfirm = !requireReason || reason.trim().length > 0;

  return (
    <Modal onClose={onClose} labelId="confirm-action-title" maxWidth="max-w-sm">
      <div className="card p-6">
        <div className="icon-chip mx-auto">
          <AppIcon name="alert-triangle" className="w-6 h-6" />
        </div>
        <h2 id="confirm-action-title" className="mt-4 text-lg font-extrabold text-navy text-center">
          {title}
        </h2>

        <div className="mt-4 space-y-2 text-sm">
          {record && (
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">{t('admin.confirm.record')}</span>
              <span className="font-semibold text-navy text-end break-all">{record}</span>
            </div>
          )}
          {currentStatus && (
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">{t('admin.confirm.currentStatus')}</span>
              <span className="font-semibold text-navy">{currentStatus}</span>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">{t('admin.confirm.result')}</span>
            <span className="font-semibold text-navy text-end">{expectedResult}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">{t('admin.confirm.reversible')}</span>
            <span className="font-semibold text-navy">
              {reversible ? t('common.yes') : t('common.no')}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">{t('admin.confirm.notifiesCustomer')}</span>
            <span className="font-semibold text-navy">
              {notifiesCustomer ? t('common.yes') : t('common.no')}
            </span>
          </div>
        </div>

        {requireReason && (
          <div className="mt-4">
            <label htmlFor="confirm-reason" className="block text-xs font-semibold text-gray-500 mb-1">
              {t('admin.confirm.reason')}
            </label>
            <textarea
              id="confirm-reason"
              className="input w-full text-sm"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1" disabled={busy}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(requireReason ? reason.trim() : undefined)}
            className="btn-primary flex-1"
            disabled={busy || !canConfirm}
          >
            {confirmLabel ?? t('common.confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
