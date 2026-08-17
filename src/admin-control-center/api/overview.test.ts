import { describe, expect, it } from 'vitest';
import type { AdminUser } from '../../lib/types';
import { computeUserKpis } from './overview';

/**
 * The one invariant that matters here: an UNREADABLE aggregate must poison the
 * total to null ("—"), never be silently treated as 0. This is the same
 * honesty rule the classic Admin enforces; the Control Center reuses the same
 * data, so it must reuse the same rule.
 */

function user(over: Partial<AdminUser>): AdminUser {
  return {
    id: over.id ?? crypto.randomUUID(),
    email: 'x@y.z',
    name: 'X',
    provider: 'email',
    isAdmin: false,
    role: 'user',
    isCompany: false,
    isMedicalCoordinator: false,
    referralCode: '',
    createdAt: new Date().toISOString(),
    onboardingCompleted: false,
    tier: 'free',
    bookings: 0,
    leads: 0,
    payments: 0,
    ...over,
  };
}

describe('computeUserKpis', () => {
  it('counts users and paying users by tier', () => {
    const k = computeUserKpis([
      user({ tier: 'free' }),
      user({ tier: 'pro' }),
      user({ tier: 'elite' }),
    ]);
    expect(k.totalUsers).toBe(3);
    expect(k.payingUsers).toBe(2);
  });

  it('sums bookings and leads when every source is readable', () => {
    const k = computeUserKpis([
      user({ bookings: 2, leads: 1 }),
      user({ bookings: 3, leads: 4 }),
    ]);
    expect(k.totalBookings).toBe(5);
    expect(k.totalLeads).toBe(5);
  });

  it('returns null (never 0) for a total when ANY row was unreadable', () => {
    const k = computeUserKpis([
      user({ bookings: 5, leads: 5 }),
      user({ bookings: null, leads: 2 }), // bookings table unreadable for this user
    ]);
    expect(k.totalBookings).toBeNull();
    expect(k.totalLeads).toBe(7);
  });

  it('handles an empty list without inventing numbers', () => {
    const k = computeUserKpis([]);
    expect(k).toEqual({ totalUsers: 0, payingUsers: 0, totalBookings: 0, totalLeads: 0 });
  });
});
