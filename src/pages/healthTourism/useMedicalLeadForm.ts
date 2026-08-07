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
export interface SpecialtyChip {
  slug: string;
  label: string;
}

const FILE_ACCEPT = 'image/*,.pdf,.doc,.docx';

export function humanFileSize(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Shared lead-form state + submission for the /health-tourism landing page,
 * used by both the desktop and mobile components so the two layouts never
 * drift on how a request actually reaches the backend.
 *
 * The client-provided mockups submit purely client-side (build a wa.me
 * message, no backend call). We keep medicalRequests.create() as the primary
 * write — same as the rest of the app — and offer the WhatsApp message as the
 * success-modal's "continue" action, matching the mockups' own success-sheet
 * pattern (its button already just opens WhatsApp).
 */
export function useMedicalLeadForm(chips: SpecialtyChip[]) {
  const { t } = useTranslation();
  const { user } = useApp();

  const [requestType, setRequestType] = useState<RequestType>('consultation');
  const [formSpecialty, setFormSpecialty] = useState<string>(chips[0]?.slug ?? '');

  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

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
    setFormSpecialty(chips[0]?.slug ?? '');
    setNotes('');
    setFiles([]);
  };

  const specialtyLabel = chips.find((c) => c.slug === formSpecialty)?.label ?? formSpecialty;

  const submitConsultation = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setSubmitting(true);
      const typeLabel = t(`medical.landing.form.requestType.${requestType}`);
      const description = notes.trim() ? `${typeLabel} — ${specialtyLabel}\n\n${notes.trim()}` : `${typeLabel} — ${specialtyLabel}`;
      const contactNotes = `${name}\n${phone}`;

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
    [submitting, formSpecialty, specialtyLabel, requestType, notes, name, phone, files, user, t],
  );

  // Mirrors mobile.js/app.js's WhatsApp message format exactly (name/phone/specialty/notes).
  const waHref = WA_ENABLED
    ? `https://wa.me/${WA}?text=${encodeURIComponent(
        [
          `${t(`medical.landing.form.requestType.${requestType}`)} — Rafiq Istanbul`,
          `${name}`,
          `${phone}`,
          `${specialtyLabel}`,
          notes.trim() || null,
        ]
          .filter(Boolean)
          .join('\n'),
      )}`
    : null;

  return {
    requestType,
    setRequestType,
    formSpecialty,
    setFormSpecialty,
    files,
    addFiles,
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
