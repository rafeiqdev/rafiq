import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { User } from '../lib/types';

/**
 * Regression suite for the duplicate-onboarding bug: a newly signed-in user got
 * the legacy questionnaire modal on top of the new /onboarding page. These
 * tests pin the single-flow contract — one surface, reached by redirect, never
 * layered over another page.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ar' } }),
}));

const useAppMock = vi.fn();
vi.mock('../context/AppContext', () => ({ useApp: () => useAppMock() }));

// The questionnaire body is not under test here — only which surface renders.
vi.mock('../lib/api', () => ({
  journey: { ensure: vi.fn().mockResolvedValue(undefined) },
  profileApi: { save: vi.fn().mockResolvedValue({ ok: true }) },
}));

import { EMPTY_PROFILE } from '../lib/types';
import { Onboarding } from './Onboarding';

function mockState(over: { user?: Partial<User> | null; onboardingCompleted?: boolean }) {
  useAppMock.mockReturnValue({
    user: over.user ?? null,
    authLoading: false,
    tier: 'free',
    profile: EMPTY_PROFILE,
    onboardingCompleted: over.onboardingCompleted ?? false,
    updateProfile: vi.fn(),
    refresh: vi.fn(),
  });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/home" element={<p>user home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const questionnaire = () => screen.queryByRole('progressbar');

describe('/onboarding is the only onboarding surface', () => {
  it('runs the questionnaire for a signed-in user who has not finished', () => {
    mockState({ user: { id: 'u1' } as Partial<User>, onboardingCompleted: false });
    renderAt('/onboarding');

    expect(questionnaire()).toBeInTheDocument();
    expect(screen.queryByText('user home')).not.toBeInTheDocument();
  });

  it('never renders for a guest — it shows the sign-in wall', () => {
    mockState({ user: null });
    renderAt('/onboarding');

    expect(questionnaire()).not.toBeInTheDocument();
    expect(screen.getByText('gates.authRequired.title')).toBeInTheDocument();
  });

  it('bounces a completed user to /home so it cannot re-appear on its own', () => {
    mockState({ user: { id: 'u1' } as Partial<User>, onboardingCompleted: true });
    renderAt('/onboarding');

    expect(screen.getByText('user home')).toBeInTheDocument();
    expect(questionnaire()).not.toBeInTheDocument();
  });

  it('re-opens for a completed user only via the explicit ?edit=1 action', () => {
    // "تعديل إجاباتي" — the one deliberate way back in, and it reuses this
    // page rather than the deleted modal.
    mockState({ user: { id: 'u1' } as Partial<User>, onboardingCompleted: true });
    renderAt('/onboarding?edit=1');

    expect(questionnaire()).toBeInTheDocument();
    expect(screen.queryByText('user home')).not.toBeInTheDocument();
  });
});

describe('the legacy onboarding modal is gone', () => {
  const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

  it('is not imported or rendered by the app shell', () => {
    const app = src('../App.tsx');
    expect(app).not.toMatch(/OnboardingModal/);
    // The old auto-open condition; nothing may resurrect it.
    expect(app).not.toMatch(/!onboarded/);
  });

  it('has no source file left behind', () => {
    expect(() => src('../components/OnboardingModal.tsx')).toThrow();
  });

  it('leaves no component referencing it anywhere', () => {
    // `resetOnboarding` was the modal's re-open trigger: it wiped the profile
    // so the auto-open condition became true again.
    for (const f of [
      '../pages/Home.tsx',
      '../pages/ProfilePage.tsx',
      '../pages/UserHome.tsx',
      '../pages/mobile/MobileHome.tsx',
      '../pages/mobile/MobileProfilePage.tsx',
      '../context/AppContext.tsx',
    ]) {
      expect(src(f), f).not.toMatch(/OnboardingModal|resetOnboarding/);
    }
  });
});

describe('entry points lead to the new page', () => {
  const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

  it.each(['../pages/ProfilePage.tsx', '../pages/mobile/MobileProfilePage.tsx'])(
    '%s sends "edit my answers" to /onboarding?edit=1',
    (f) => {
      expect(src(f)).toMatch(/to="\/onboarding\?edit=1"/);
    },
  );

  // /account is not in this list any more: it is a bare redirect to /profile
  // and holds no guard of its own. The gate assertion that used to cover it now
  // rides on /profile, which is where an /account visitor actually lands — see
  // LegacyRedirects.test.tsx for the hop itself.
  it('guards every authenticated product route in App.tsx', () => {
    const app = src('../App.tsx');
    for (const route of ['/home', '/journey', '/profile']) {
      const line = app.split('\n').find((l) => l.includes(`path="${route}"`));
      expect(line, route).toBeDefined();
      // /profile spans several lines — check the element block instead.
      const block = route === '/profile' ? app.slice(app.indexOf('path="/profile"'), app.indexOf('path="/onboarding"')) : line!;
      expect(block, route).toMatch(/RequireOnboarded/);
    }
  });
});
