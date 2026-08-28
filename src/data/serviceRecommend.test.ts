import { describe, it, expect } from 'vitest';
import { recommendedServiceIds } from './serviceRecommend';
import { SERVICES } from './services';
import { EMPTY_PROFILE, SITUATIONS } from '../lib/types';
import type { Profile } from '../lib/types';

const student = (over: Partial<Profile> = {}): Profile => ({
  ...EMPTY_PROFILE,
  situation: 'student',
  ...over,
});

const ID_SET = new Set(SERVICES.map((s) => s.id));

describe('recommendedServiceIds', () => {
  it('returns nothing when there is no situation', () => {
    expect(recommendedServiceIds(EMPTY_PROFILE)).toEqual([]);
  });

  it('every situation produces a non-empty, all-real, no-repeat list', () => {
    for (const situation of SITUATIONS) {
      const ids = recommendedServiceIds({ ...EMPTY_PROFILE, situation });
      expect(ids.length, `${situation} is empty`).toBeGreaterThan(0);
      expect(new Set(ids).size, `${situation} has repeats`).toBe(ids.length);
      for (const id of ids) expect(ID_SET.has(id), `${situation}: unknown id ${id}`).toBe(true);
    }
  });

  it('leads each persona with its intended top three', () => {
    const top3 = (p: Partial<Profile>) => recommendedServiceIds({ ...EMPTY_PROFILE, ...p }).slice(0, 3);
    expect(top3({ situation: 'planning' })).toEqual(['re-rent', 'tr-sworn', 'tour-airport']); // reason unset → default
    expect(top3({ situation: 'arrived' })).toEqual(['tel-sim', 'bank-account', 'res-tax']); // reason unset → default
    expect(top3({ situation: 'visiting' })).toEqual(['tour-airport', 'tour-daytrips', 'tour-hotels']); // trip unset → default
    expect(top3({ situation: 'resident' })).toEqual(['res-renew', 'ins-residence', 'daily-license']); // type unset → default
    expect(top3({ situation: 'long_resident' })).toEqual(['res-citizenship', 're-buy', 'legal-ltd']); // goal unset → default
  });

  // ── long-settled resident: main goal + property branch the top three ──
  it('branches the long-resident top-3 by their main goal now', () => {
    const top3 = (goal: Profile['longResidentGoal']) =>
      recommendedServiceIds({ ...EMPTY_PROFILE, situation: 'long_resident', longResidentGoal: goal }).slice(0, 3);
    expect(top3('citizenship')).toEqual(['res-eligibility', 'res-citizenship', 'legal-consult']);
    expect(top3('longstay')).toEqual(['res-renew', 'ins-residence', 'res-eligibility']);
    expect(top3('property')).toEqual(['re-buy', 're-valuation', 're-management']);
    expect(top3('business')).toEqual(['legal-ltd', 'acc-monthly', 'legal-contracts']);
    expect(top3('family')).toEqual(['edu-university', 'res-family', 'ins-family']);
    expect(top3('stability')).toEqual(['res-renew', 'ins-residence', 'daily-reminders']);
  });

  it('surfaces the new phase-2 gap services for the personas that need them', () => {
    const has = (p: Partial<Profile>, id: string) =>
      recommendedServiceIds({ ...EMPTY_PROFILE, ...p }).includes(id);
    expect(has({ situation: 'student', studentStage: 'coming' }, 'edu-advisory')).toBe(true);
    expect(has({ situation: 'student', studentStage: 'settled' }, 'edu-career')).toBe(true);
    expect(has({ situation: 'student' }, 'ins-student')).toBe(true);
    expect(has({ situation: 'visiting' }, 'visa-check')).toBe(true);
    expect(has({ situation: 'planning', planningReason: 'work' }, 'visa-check')).toBe(true);
    expect(has({ situation: 'arrived' }, 'res-eligibility')).toBe(true);
    expect(has({ situation: 'resident', residentType: 'retired' }, 'daily-eldercare')).toBe(true);
    expect(has({ situation: 'long_resident', longResidentGoal: 'citizenship' }, 'res-eligibility')).toBe(true);
  });

  it('a property-owning long resident leads with management and valuation', () => {
    const ids = recommendedServiceIds({ ...EMPTY_PROFILE, situation: 'long_resident', longResidentGoal: 'stability', longResidentProperty: 'multiple' });
    expect(ids.slice(0, 2)).toEqual(['re-management', 're-valuation']);
  });

  // ── planner: reason for relocating branches the top three ──
  it('branches the planner top-3 by the reason they are moving', () => {
    const top3 = (reason: Profile['planningReason']) =>
      recommendedServiceIds({ ...EMPTY_PROFILE, situation: 'planning', planningReason: reason }).slice(0, 3);
    expect(top3('work')).toEqual(['res-work', 'tr-sworn', 'ins-residence']);
    expect(top3('study')).toEqual(['edu-university', 'tr-sworn', 'edu-denklik']);
    expect(top3('family')).toEqual(['res-family', 'tr-sworn', 'edu-schools']);
    expect(top3('business')).toEqual(['legal-ltd', 'acc-monthly', 're-buy']);
    expect(top3('retirement')).toEqual(['re-rent', 'ins-residence', 'health-doctors']);
    expect(top3('other')).toEqual(['re-rent', 'tr-sworn', 'tour-airport']); // unknown → default
  });

  // ── newcomer: reason branches the top three ──
  it('branches the newcomer top-3 by the reason they came', () => {
    const top3 = (reason: Profile['arrivedReason']) =>
      recommendedServiceIds({ ...EMPTY_PROFILE, situation: 'arrived', arrivedReason: reason }).slice(0, 3);
    expect(top3('work')).toEqual(['res-work', 'bank-account', 'tel-sim']);
    expect(top3('living')).toEqual(['re-rent', 'tel-address', 'ins-residence']);
    expect(top3('family')).toEqual(['res-family', 'edu-schools', 'ins-family']);
    expect(top3('business')).toEqual(['legal-ltd', 'acc-monthly', 'legal-consult']);
    expect(top3('study')).toEqual(['res-student', 'ins-residence', 'edu-tomer']);
    expect(top3('short')).toEqual(['tour-daytrips', 'tour-hotels', 'tel-sim']);
    expect(top3('other')).toEqual(['tel-sim', 'bank-account', 'res-tax']); // unknown → default
  });

  it('a newcomer who owns their home is not offered rentals or moving', () => {
    const ids = recommendedServiceIds({ ...EMPTY_PROFILE, situation: 'arrived', arrivedHousing: 'owned' });
    expect(ids).not.toContain('re-rent');
    expect(ids).not.toContain('daily-moving');
  });

  it('a newcomer with no home gets the housing bundle promoted', () => {
    const ids = recommendedServiceIds({ ...EMPTY_PROFILE, situation: 'arrived', arrivedReason: 'work', arrivedHousing: 'none' });
    expect(ids).toContain('re-rent');
    expect(ids.indexOf('re-rent')).toBeLessThan(ids.indexOf('daily-reminders'));
  });

  // ── visitor: trip type + service level branch the top three ──
  it('branches the visitor top-3 by the kind of trip they want', () => {
    const top3 = (trip: Profile['visitorTrip']) =>
      recommendedServiceIds({ ...EMPTY_PROFILE, situation: 'visiting', visitorTrip: trip }).slice(0, 3);
    expect(top3('sights')).toEqual(['tour-daytrips', 'tour-tickets', 'tour-airport']);
    expect(top3('shopping')).toEqual(['daily-shopping', 'tour-driver', 'tour-airport']);
    expect(top3('nature')).toEqual(['tour-bosphorus', 'tour-daytrips', 'tour-airport']);
    expect(top3('multicity')).toEqual(['tour-multicity', 'tour-packages', 'tour-airport']);
    expect(top3('medical')).toEqual(['health-tourism', 'tr-medical', 'tour-airport']);
    expect(top3('family')).toEqual(['tour-packages', 'tour-daytrips', 'tour-airport']);
    expect(top3('mix')).toEqual(['tour-airport', 'tour-daytrips', 'tour-hotels']); // no override → default
  });

  it('a VIP visitor leads with the premium airport reception and private driver', () => {
    const ids = recommendedServiceIds({ ...EMPTY_PROFILE, situation: 'visiting', visitorTrip: 'sights', visitorService: 'vip' });
    expect(ids.slice(0, 2)).toEqual(['tour-vip', 'tour-driver']);
  });

  // ── resident: nature of residence + plan branch the top three ──
  it('branches the resident top-3 by the nature of their residence', () => {
    const top3 = (type: Profile['residentType']) =>
      recommendedServiceIds({ ...EMPTY_PROFILE, situation: 'resident', residentType: type }).slice(0, 3);
    expect(top3('employee')).toEqual(['res-renew', 'res-work', 'ins-residence']);
    expect(top3('business')).toEqual(['acc-monthly', 'legal-ltd', 'res-renew']);
    expect(top3('family')).toEqual(['res-renew', 'ins-family', 'edu-schools']);
    expect(top3('retired')).toEqual(['res-renew', 'ins-residence', 'daily-eldercare']);
    expect(top3('investor')).toEqual(['re-buy', 're-management', 'res-citizenship']);
  });

  it('a resident plan promotes the matching development service to the front', () => {
    const ids = recommendedServiceIds({ ...EMPTY_PROFILE, situation: 'resident', residentType: 'employee', residentPlan: 'property' });
    expect(ids.slice(0, 2)).toEqual(['re-buy', 're-management']);
    const cit = recommendedServiceIds({ ...EMPTY_PROFILE, situation: 'resident', residentType: 'family', residentPlan: 'citizenship' });
    expect(cit[0]).toBe('res-citizenship');
  });

  // ── the "give him what he doesn't have" rule ──
  it('never recommends a service the user ticked as already done', () => {
    const has = { turkishPhone: true, taxNumber: true, residencePermit: true, bankAccount: true };
    const ids = recommendedServiceIds({ ...EMPTY_PROFILE, situation: 'arrived', has });
    expect(ids).not.toContain('tel-sim'); // has phone
    expect(ids).not.toContain('res-tax'); // has tax number
    expect(ids).not.toContain('bank-account'); // has bank
    expect(ids).not.toContain('res-tourist'); // has a permit → no first-application permit
    expect(ids.length).toBeGreaterThan(0); // but still has things to offer
  });

  it('a student who has a phone/bank is not offered the SIM/bank services', () => {
    const ids = recommendedServiceIds(student({ has: { ...EMPTY_PROFILE.has, turkishPhone: true, bankAccount: true } }));
    expect(ids).not.toContain('tel-sim');
    expect(ids).not.toContain('bank-account');
    expect(ids).toContain('res-student'); // student-specific offer survives
  });

  // ── student stage / follow-up behaviour ──
  it('leads with the student stage-specific top picks', () => {
    expect(recommendedServiceIds(student({ studentStage: 'coming' })).slice(0, 3)).toEqual([
      'edu-advisory', 'edu-university', 'tr-sworn',
    ]);
    expect(recommendedServiceIds(student({ studentStage: 'settled' })).slice(0, 3)).toEqual([
      'res-renew', 'res-work', 'edu-career',
    ]);
  });

  it('defaults an un-answered student stage to the "just arrived" ordering', () => {
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
    expect(ids).toContain('re-rent');
    expect(ids.indexOf('re-rent')).toBeLessThan(ids.indexOf('res-work'));
  });

  // ── family extras ──
  it('adds schooling and family insurance for a staying persona with family', () => {
    expect(recommendedServiceIds({ ...EMPTY_PROFILE, situation: 'resident', family: 'yes' })).toContain('edu-schools');
    expect(recommendedServiceIds(student({ family: 'yes' }))).toContain('ins-family');
  });

  it('does NOT add schooling for a visitor with family (they are passing through)', () => {
    expect(recommendedServiceIds({ ...EMPTY_PROFILE, situation: 'visiting', family: 'yes' })).not.toContain(
      'edu-schools',
    );
  });
});
