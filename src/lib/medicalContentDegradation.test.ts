import { describe, expect, it, vi } from 'vitest';

/**
 * Reproduces the exact bug reported live: the medical-tourism migration had
 * not been applied yet, so medical_specialties/services/faqs/testimonials/
 * page_sections did not exist — and every public section rendered a raw
 * "something went wrong, retry" block for a logged-out visitor.
 *
 * medicalContent.* must resolve to [] (never throw) on ANY read failure —
 * missing table, network blip, whatever — so the public page always shows a
 * clean empty state / hides the section instead. Once the migration is
 * applied this is simply dead code on the happy path; before it, it is the
 * whole fix.
 */

let responseByTable: Record<string, { data: unknown; error: unknown }> = {};

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        order: () => Promise.resolve(responseByTable[table] ?? { data: [], error: null }),
        eq: () => ({ order: () => Promise.resolve(responseByTable[table] ?? { data: [], error: null }) }),
      }),
    }),
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
  },
  supabaseEnabled: true,
}));

import { medicalContent } from './api';

const UNDEFINED_TABLE = { data: null, error: { code: '42P01', message: 'relation "public.medical_specialties" does not exist' } };

describe('medicalContent.* degrades gracefully when the migration has not been applied', () => {
  it('specialties() resolves to [] instead of throwing on a missing table', async () => {
    responseByTable = { medical_specialties: UNDEFINED_TABLE };
    await expect(medicalContent.specialties()).resolves.toEqual([]);
  });

  it('services() resolves to [] instead of throwing', async () => {
    responseByTable = { medical_services: UNDEFINED_TABLE };
    await expect(medicalContent.services()).resolves.toEqual([]);
  });

  it('faqs() resolves to [] instead of throwing', async () => {
    responseByTable = { medical_faqs: UNDEFINED_TABLE };
    await expect(medicalContent.faqs()).resolves.toEqual([]);
  });

  it('testimonials() resolves to [] instead of throwing', async () => {
    responseByTable = { medical_testimonials: UNDEFINED_TABLE };
    await expect(medicalContent.testimonials()).resolves.toEqual([]);
  });

  it('sections() resolves to [] instead of throwing (so every section falls back to visible=true)', async () => {
    responseByTable = { medical_page_sections: UNDEFINED_TABLE };
    await expect(medicalContent.sections()).resolves.toEqual([]);
  });

  it('still maps real rows through correctly once the table exists', async () => {
    responseByTable = {
      medical_specialties: {
        data: [{ id: 's1', slug: 'dental', name: { en: 'Dental', ar: '', fa: '', ru: '' }, description: {}, icon: null, sort: 0, visible: true }],
        error: null,
      },
    };
    const rows = await medicalContent.specialties();
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe('dental');
  });
});
