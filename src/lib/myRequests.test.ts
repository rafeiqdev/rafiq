import { describe, expect, it } from 'vitest';
import {
  bookingStatus,
  leadStatus,
  mergeRequests,
  parseLeadItem,
  referenceFor,
  serviceStatus,
} from './myRequests';
import type { Booking, CustomerRequest, Lead } from './types';
import { CASE_FILE_DIVIDER } from './bookingSummary';

const req = (over: Partial<CustomerRequest> = {}): CustomerRequest => ({
  id: '9f3c1a20-1111-2222-3333-444455556666',
  serviceTitle: 'مراقبة فتح حساب بنكي',
  category: 'banking',
  area: null,
  message: null,
  status: 'new',
  createdAt: '2026-08-10T10:00:00Z',
  serviceType: 'direct',
  broadcast: false,
  ...over,
});

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'b1b2c3d4-1111-2222-3333-444455556666',
  userId: 'u1',
  userEmail: 'a@b.c',
  problemSummary: 'تجديد الإقامة',
  transcript: [],
  preferredDatetime: '2026-08-20T09:00:00Z',
  preferredLanguage: 'ar',
  status: 'new',
  createdAt: '2026-08-11T10:00:00Z',
  ...over,
});

const lead = (over: Partial<Lead> = {}): Lead => ({
  id: 'ffee0011-1111-2222-3333-444455556666',
  kind: 'realestate',
  item: '[viewing] Beşiktaş 2+1 · $250,000 · #L-9',
  status: 'new',
  createdAt: '2026-08-12T10:00:00Z',
  ...over,
});

describe('the reference number a customer reads out', () => {
  it('is stable for the same row — nothing stores it, so it must be derived', () => {
    expect(referenceFor('service', 'abc123def')).toBe(referenceFor('service', 'abc123def'));
  });

  it('names the source, so an admin knows which table to look in', () => {
    expect(referenceFor('service', 'abcdef123')).toMatch(/^SR-/);
    expect(referenceFor('ai', 'abcdef123')).toMatch(/^AI-/);
    expect(referenceFor('realestate', 'abcdef123')).toMatch(/^RE-/);
    expect(referenceFor('health', 'abcdef123')).toMatch(/^HT-/);
  });

  it('is always six characters, even for a short or punctuation-heavy id', () => {
    for (const id of ['1', 'a-b', '', '9f3c1a20-1111-2222-3333-444455556666']) {
      expect(referenceFor('service', id)).toMatch(/^SR-[0-9A-Z]{6}$/);
    }
  });

  it('separates two different rows', () => {
    expect(referenceFor('service', 'aaaaaaa1')).not.toBe(referenceFor('service', 'bbbbbbb2'));
  });
});

/**
 * Each table has its own status words. A customer must never have to work out
 * whether "confirmed" is better or worse than "accepted".
 */
describe('every source speaks the same four words', () => {
  it('maps the service-request workflow', () => {
    expect(serviceStatus('new')).toBe('pending');
    expect(serviceStatus('pending')).toBe('pending');
    expect(serviceStatus('accepted')).toBe('accepted');
    expect(serviceStatus('done')).toBe('done');
    expect(serviceStatus('rejected')).toBe('rejected');
  });

  it('maps a booking, where "confirmed" is this list\'s "accepted"', () => {
    expect(bookingStatus('new')).toBe('pending');
    expect(bookingStatus('confirmed')).toBe('accepted');
    expect(bookingStatus('done')).toBe('done');
    expect(bookingStatus('cancelled')).toBe('rejected');
  });

  it('maps a lead, whose admin vocabulary has drifted over the years', () => {
    expect(leadStatus('new')).toBe('pending');
    expect(leadStatus('contacted')).toBe('accepted');
    expect(leadStatus('closed')).toBe('done');
    expect(leadStatus('lost')).toBe('rejected');
  });

  it('falls back to pending for a word nobody has seen before, never to done', () => {
    // The dangerous default is "done": it tells a customer we finished
    // something we may not have started.
    expect(serviceStatus('escalated_tier2')).toBe('pending');
    expect(bookingStatus('escalated_tier2')).toBe('pending');
    expect(leadStatus('escalated_tier2')).toBe('pending');
  });
});

describe('the listing tag a property enquiry carries', () => {
  it('splits the service key from the human text', () => {
    expect(parseLeadItem('[viewing] Beşiktaş 2+1 · $250,000 · #L-9')).toEqual({
      serviceKey: 'viewing',
      itemText: 'Beşiktaş 2+1 · $250,000 · #L-9',
    });
  });

  it('leaves an untagged (older) lead alone rather than inventing a key', () => {
    expect(parseLeadItem('Interested in Kadıköy')).toEqual({
      serviceKey: null,
      itemText: 'Interested in Kadıköy',
    });
  });
});

describe('the merged list', () => {
  it('carries all three sources, newest first', () => {
    const merged = mergeRequests({ services: [req()], bookings: [booking()], leads: [lead()] });
    expect(merged.map((r) => r.kind)).toEqual(['realestate', 'ai', 'service']);
  });

  it('treats a still-loading or failed source as absent, never as empty data', () => {
    // The caller passes null for a source that has not answered. It must
    // contribute nothing — and must not blank the sources that did answer.
    const merged = mergeRequests({ services: [req()], bookings: null, leads: null });
    expect(merged).toHaveLength(1);
    expect(merged[0].kind).toBe('service');
  });

  it('titles an assistant request with the prose brief, not the case file', () => {
    const raw = `تجديد الإقامة السياحية\n\n${CASE_FILE_DIVIDER}\n${JSON.stringify({ permitType: 'tourist' })}`;
    const [item] = mergeRequests({ bookings: [booking({ problemSummary: raw })] });
    expect(item.title).toBe('تجديد الإقامة السياحية');
    expect(item.title).not.toContain('permitType');
  });

  it('gives every row a reference, a kind, a status and a date', () => {
    for (const item of mergeRequests({ services: [req()], bookings: [booking()], leads: [lead()] })) {
      expect(item.reference).toMatch(/^[A-Z]{2}-[0-9A-Z]{6}$/);
      expect(['service', 'ai', 'realestate', 'health']).toContain(item.kind);
      expect(['pending', 'accepted', 'done', 'rejected']).toContain(item.status);
      expect(Number.isNaN(new Date(item.createdAt).getTime())).toBe(false);
    }
  });

  it('routes a health-tourism lead to its own kind', () => {
    const [item] = mergeRequests({ leads: [lead({ kind: 'health', item: 'زراعة شعر' })] });
    expect(item.kind).toBe('health');
    expect(item.reference).toMatch(/^HT-/);
  });
});
