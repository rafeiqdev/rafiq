import { describe, expect, it } from 'vitest';
import { allowedNext, MEDICAL_REQUEST_TRANSITIONS, SERVICE_REQUEST_TRANSITIONS } from './statusTransitions';

describe('allowedNext — service requests', () => {
  it('offers accept/reject from new', () => {
    expect(allowedNext(SERVICE_REQUEST_TRANSITIONS, 'new')).toEqual(['accepted', 'rejected']);
  });
  it('offers done/reject from accepted', () => {
    expect(allowedNext(SERVICE_REQUEST_TRANSITIONS, 'accepted')).toEqual(['done', 'rejected']);
  });
  it('done and rejected are terminal', () => {
    expect(allowedNext(SERVICE_REQUEST_TRANSITIONS, 'done')).toEqual([]);
    expect(allowedNext(SERVICE_REQUEST_TRANSITIONS, 'rejected')).toEqual([]);
  });
  it('an unknown status has no legal next step', () => {
    expect(allowedNext(SERVICE_REQUEST_TRANSITIONS, 'bogus')).toEqual([]);
  });
});

describe('allowedNext — medical tourism', () => {
  it('cannot jump straight from pending_review to paid', () => {
    expect(allowedNext(MEDICAL_REQUEST_TRANSITIONS, 'pending_review')).not.toContain('paid');
  });
  it('walks the full happy path', () => {
    let status = 'pending_review';
    const path = ['under_review', 'collecting_offers', 'offers_available', 'awaiting_payment', 'paid', 'booked'];
    for (const next of path) {
      expect(allowedNext(MEDICAL_REQUEST_TRANSITIONS, status)).toContain(next);
      status = next;
    }
  });
  it('cancelled is terminal', () => {
    expect(allowedNext(MEDICAL_REQUEST_TRANSITIONS, 'cancelled')).toEqual([]);
  });
  it('every non-terminal status can reach cancelled', () => {
    for (const [status, next] of Object.entries(MEDICAL_REQUEST_TRANSITIONS)) {
      if (status === 'cancelled') continue;
      expect(next).toContain('cancelled');
    }
  });
});
