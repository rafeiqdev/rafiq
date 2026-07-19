import { describe, expect, it } from 'vitest';
import { classifyError, errorMessageKey, isSchemaUnavailable } from './errors';
import { familyStatusColumn, nextStatusOnOnboardingEdit, resolveOnboarding } from './onboardingSource';
import { EMPTY_PROFILE } from './types';

describe('error classification', () => {
  it('maps missing-schema codes to schema_unavailable (pre-migration tolerance)', () => {
    for (const code of ['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205']) {
      expect(classifyError({ code, message: 'relation does not exist' })).toBe('schema_unavailable');
      expect(isSchemaUnavailable({ code })).toBe(true);
    }
  });

  it('does NOT swallow an authentication error as missing schema', () => {
    expect(classifyError({ code: 'PGRST301', message: 'JWT expired' })).toBe('unauthenticated');
    expect(classifyError({ status: 401, message: 'Unauthorized' })).toBe('unauthenticated');
    expect(classifyError({ code: 'not_authenticated' })).toBe('unauthenticated');
    expect(isSchemaUnavailable({ code: 'PGRST301' })).toBe(false);
  });

  it('does NOT swallow an RLS / permission error', () => {
    expect(classifyError({ code: '42501', message: 'new row violates row-level security policy' })).toBe('forbidden');
    expect(classifyError({ status: 403 })).toBe('forbidden');
    expect(isSchemaUnavailable({ code: '42501' })).toBe(false);
  });

  it('distinguishes a network/transport failure', () => {
    expect(classifyError(new TypeError('Failed to fetch'))).toBe('network_error');
    expect(classifyError({ message: 'NetworkError when attempting to fetch resource' })).toBe('network_error');
    expect(isSchemaUnavailable(new TypeError('Failed to fetch'))).toBe(false);
  });

  it('flags server errors and falls back to unknown_error safely', () => {
    expect(classifyError({ status: 503, message: 'upstream' })).toBe('server_error');
    expect(classifyError({ code: 'SOMETHING_NEW', message: 'weird' })).toBe('unknown_error');
    expect(classifyError(null)).toBe('unknown_error');
    expect(classifyError(undefined)).toBe('unknown_error');
    expect(isSchemaUnavailable({ code: 'SOMETHING_NEW', message: 'table does not exist' })).toBe(false);
  });

  it('only trusts a message when the error carries no code at all', () => {
    // no code → bounded message detection is allowed
    expect(classifyError({ message: 'Could not find the "city" column of "profiles"' })).toBe('schema_unavailable');
    // unrecognised code present → surface rather than hide
    expect(classifyError({ code: 'XX999', message: 'relation does not exist' })).toBe('unknown_error');
  });

  it('exposes an i18n key per category and never raw detail', () => {
    expect(errorMessageKey('schema_unavailable')).toBe('errors.schema_unavailable');
    expect(errorMessageKey('forbidden')).toBe('errors.forbidden');
  });
});

describe('onboarding source of truth', () => {
  const jsonb = { ...EMPTY_PROFILE, city: 'ankara', situation: 'planning' as const, family: 'no' as const };

  it('prefers structured columns over the JSONB copy', () => {
    const resolved = resolveOnboarding(jsonb, {
      city: 'istanbul',
      situation: 'arrived',
      family_status: 'family',
      onboarding_completed: true,
    });
    expect(resolved.city).toBe('istanbul');
    expect(resolved.situation).toBe('arrived');
    expect(resolved.family).toBe('yes');
  });

  it('falls back to JSONB before the migration (columns absent)', () => {
    const resolved = resolveOnboarding(jsonb, {});
    expect(resolved.city).toBe('ankara');
    expect(resolved.situation).toBe('planning');
    expect(resolved.family).toBe('no');
  });

  it('keeps the flexible `has` checklist from JSONB (engine compatibility)', () => {
    const withHas = { ...jsonb, has: { ...EMPTY_PROFILE.has, taxNumber: true } };
    expect(resolveOnboarding(withHas, { city: 'izmir' }).has.taxNumber).toBe(true);
  });

  it('maps family answers to the column value', () => {
    expect(familyStatusColumn('yes')).toBe('family');
    expect(familyStatusColumn('no')).toBe('alone');
    expect(familyStatusColumn(null)).toBeNull();
  });
});

describe('onboarding edit → journey synchronisation', () => {
  it('completes an existing INCOMPLETE task when answers now say it is done', () => {
    expect(nextStatusOnOnboardingEdit('todo', true)).toBe('done');
  });

  it('never undoes a manually completed task, even if answers contradict it', () => {
    expect(nextStatusOnOnboardingEdit('done', false)).toBe('done');
  });

  it('leaves an incomplete task alone when answers still say it is not done', () => {
    expect(nextStatusOnOnboardingEdit('todo', false)).toBe('todo');
  });

  it('is idempotent — re-running synchronisation changes nothing further', () => {
    const once = nextStatusOnOnboardingEdit('todo', true);
    const twice = nextStatusOnOnboardingEdit(once, true);
    expect(twice).toBe(once);
    const manual = nextStatusOnOnboardingEdit('done', false);
    expect(nextStatusOnOnboardingEdit(manual, false)).toBe('done');
  });
});
