import { describe, it, expect } from 'vitest';
import { recommendedServiceIds } from './serviceRecommend';
import { SERVICES } from './services';
import { EMPTY_PROFILE } from '../lib/types';
import type { Profile } from '../lib/types';

const student = (over: Partial<Profile> = {}): Profile => ({
  ...EMPTY_PROFILE,
  situation: 'student',
  ...over,
});

const ID_SET = new Set(SERVICES.map((s) => s.id));

describe('recommendedServiceIds', () => {
  it('returns nothing for a non-student (falls back to default dashboard)', () => {
    expect(recommendedServiceIds(student({ situation: 'resident' }))).toEqual([]);
    expect(recommendedServiceIds(EMPTY_PROFILE)).toEqual([]);
  });

  it('every recommended id is a real catalog service (no dead cards)', () => {
    const profiles: Profile[] = [
      student(),
      student({ studentStage: 'coming' }),
      student({ studentStage: 'arrived' }),
      student({ studentStage: 'settled', studentResidency: 'have' }),
      student({ studentHousing: 'none', family: 'yes' }),
    ];
    for (const p of profiles) {
      for (const id of recommendedServiceIds(p)) {
        expect(ID_SET.has(id), `unknown service id: ${id}`).toBe(true);
      }
    }
  });

  it('never repeats a service id', () => {
    const ids = recommendedServiceIds(student({ studentStage: 'arrived', studentHousing: 'none', family: 'yes' }));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('leads with the stage-specific top picks', () => {
    expect(recommendedServiceIds(student({ studentStage: 'coming' })).slice(0, 3)).toEqual([
      'edu-university',
      'tr-sworn',
      'tour-airport',
    ]);
    expect(recommendedServiceIds(student({ studentStage: 'arrived' })).slice(0, 3)).toEqual([
      'res-student',
      'ins-residence',
      'bank-account',
    ]);
    expect(recommendedServiceIds(student({ studentStage: 'settled' })).slice(0, 3)).toEqual([
      'res-renew',
      'ins-residence',
      'res-work',
    ]);
  });

  it('defaults an un-answered stage to the "just arrived" ordering', () => {
    expect(recommendedServiceIds(student()).slice(0, 3)).toEqual(['res-student', 'ins-residence', 'bank-account']);
  });

  it('a student who already has a permit sees renewal, not first application', () => {
    const ids = recommendedServiceIds(student({ studentStage: 'settled', studentResidency: 'have' }));
    expect(ids).toContain('res-renew');
    expect(ids).not.toContain('res-student');
  });

  it('a dorm resident is not offered rentals or moving, but still address registration', () => {
    const ids = recommendedServiceIds(student({ studentHousing: 'dorm' }));
    expect(ids).not.toContain('re-rent');
    expect(ids).not.toContain('daily-moving');
    expect(ids).toContain('tel-address');
  });

  it('a student with no housing gets the housing bundle promoted', () => {
    const ids = recommendedServiceIds(student({ studentStage: 'arrived', studentHousing: 'none' }));
    // housing services appear ahead of the tail of the base list
    expect(ids).toContain('re-rent');
    expect(ids.indexOf('re-rent')).toBeLessThan(ids.indexOf('res-work'));
  });

  it('adds schooling and family insurance only when family joins', () => {
    expect(recommendedServiceIds(student({ family: 'yes' }))).toContain('edu-schools');
    expect(recommendedServiceIds(student({ family: 'yes' }))).toContain('ins-family');
    expect(recommendedServiceIds(student({ family: 'no' }))).not.toContain('edu-schools');
  });
});
