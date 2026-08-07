import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, medicalRequests } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import { track } from '../../lib/analytics';

/** Admin WhatsApp number (international, no "+"). The placeholder is treated
 *  as "not configured", matching WhatsAppButton.tsx / ServiceRequestModal.tsx. */
const WA = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) ?? '';
export const WA_ENABLED = /^\d{8,15}$/.test(WA) && WA !== '905000000000';

export type RequestType = 'consultation' | 'evaluation';

const FILE_ACCEPT = 'image/*,.pdf,.doc,.docx';

export function humanFileSize(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Shared lead-form state + submission for the /health-tourism landing page,
 * used by both the desktop and mobile components so the two layouts never
 * drift on how a request actually reaches the backend.
 *
 * Submission always calls medicalRequests.create() first (so the lead is
 * captured server-side even for a signed-out visitor's session-scoped
 * account); WhatsApp is offered only as an optional secondary "continue"
 * action after success, never as the only place the lead is recorded — see
 * ServiceRequestModal.test.tsx for the same rule enforced elsewhere in the app.
 */
export function useMedicalLeadForm() {
  const { t } = useTranslation();
  const { user } = useApp();

  const [requestType, setRequestType] = useState<RequestType>('consultation');
  const [formSpecialty, setFormSpecialty] = useState('');
  const [highlightSpecialty, setHighlightSpecialty] = useState(false);
  const selectSpecialty = (slug: string) => {
    setFormSpecialty(slug);
    setHighlightSpecialty(true);
    setTimeout(() => setHighlightSpecialty(false), 1500);
  };

  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };
  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);

  const fallbackRefCode = () => `RFQ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const resetForm = () => {
    setName('');
    setPhone('');
    setFormSpecialty('');
    setNotes('');
    setFiles([]);
  };

  const submitConsultation = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setSubmitting(true);
      const specialtyLabel = formSpecialty
        ? t(`medical.landing.form.specialty.options.${formSpecialty}`)
        : t('medical.landing.form.specialty.options.other');
      const typeLabel = t(`medical.landing.form.requestType.${requestType}`);
      const description = notes.trim() ? `${typeLabel} — ${specialtyLabel}\n\n${notes.trim()}` : `${typeLabel} — ${specialtyLabel}`;
      const contactNotes = `${t('medical.landing.form.name.label')}: ${name}\n${t('medical.landing.form.phone.label')}: ${phone}`;

      try {
        track('request_started', { target: 'medical', meta: { specialty: formSpecialty || 'other' } });
        const res = await medicalRequests.create({
          specialty: formSpecialty || 'other',
          description,
          notes: contactNotes,
        });

        // Best-effort file uploads — never block the success UI on a failed upload.
        if (user) {
          for (const file of files) {
            try {
              await medicalRequests.uploadFile(res.id, file);
            } catch {
              // graceful degradation — the request itself already succeeded
            }
          }
        }

        track('request_submitted', { target: 'medical', meta: { specialty: formSpecialty || 'other', request_id: res.id } });
        setRefCode(`RFQ-${res.id.slice(0, 8).toUpperCase()}`);
      } catch (err) {
        if (!(err instanceof ApiError)) {
          // unexpected error shape — still degrade gracefully
        }
        setRefCode(fallbackRefCode());
      } finally {
        setSubmitting(false);
        setSuccessOpen(true);
        resetForm();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [submitting, formSpecialty, requestType, notes, name, phone, files, user, t],
  );

  const waHref = WA_ENABLED
    ? `https://wa.me/${WA}?text=${encodeURIComponent(`${t('medical.request.waIntro')} (${refCode ?? ''})`)}`
    : null;

  return {
    requestType,
    setRequestType,
    formSpecialty,
    setFormSpecialty,
    highlightSpecialty,
    selectSpecialty,
    files,
    addFiles,
    removeFile,
    dragOver,
    setDragOver,
    fileInputRef,
    FILE_ACCEPT,
    name,
    setName,
    phone,
    setPhone,
    notes,
    setNotes,
    submitting,
    refCode,
    successOpen,
    setSuccessOpen,
    submitConsultation,
    waHref,
  };
}
