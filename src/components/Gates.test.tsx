import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { PlanTier, User } from '../lib/types';

// Keys are asserted directly — this suite is about *which* branch renders,
// not about copy.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const useAppMock = vi.fn();
vi.mock('../context/AppContext', () => ({ useApp: () => useAppMock() }));

import { RequireAdmin, RequireAuth, RequireCompany, RequireOnboarded } from './Gates';

function mockState(over: {
  user?: Partial<User> | null;
  authLoading?: boolean;
  tier?: PlanTier;
  onboardingCompleted?: boolean;
}) {
  useAppMock.mockReturnValue({
    user: over.user ?? null,
    authLoading: over.authLoading ?? false,
    tier: over.tier ?? 'free',
    onboardingCompleted: over.onboardingCompleted ?? false,
  });
}

function renderGate(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const PAGE = <p>protected page</p>;
const pending = () => document.querySelector('[aria-busy]');

describe('auth-gated routes while the session is still resolving', () => {
  // Regression: the guards used to decide on `user` alone. Because the Supabase
  // session resolves asynchronously, every guard painted its wall on the first
  // frame and swapped to the real page a moment later — a visible flash on
  // every page entry.
  it('RequireAuth shows a neutral placeholder, not the sign-in wall', () => {
    mockState({ user: null, authLoading: true });
    renderGate(<RequireAuth>{PAGE}</RequireAuth>);

    expect(pending()).toBeInTheDocument();
    expect(screen.queryByText('gates.authRequired.title')).not.toBeInTheDocument();
    expect(screen.queryByText('protected page')).not.toBeInTheDocument();
  });

  it('RequireAdmin does not flash the admin-only wall', () => {
    mockState({ user: { isAdmin: true } as Partial<User>, authLoading: true });
    renderGate(<RequireAdmin>{PAGE}</RequireAdmin>);

    expect(pending()).toBeInTheDocument();
    expect(screen.queryByText('gates.adminOnly')).not.toBeInTheDocument();
  });

  it('RequireCompany does not flash the company wall', () => {
    mockState({ user: { isCompany: true } as Partial<User>, authLoading: true });
    renderGate(<RequireCompany>{PAGE}</RequireCompany>);

    expect(pending()).toBeInTheDocument();
    expect(screen.queryByText('company.gate.title')).not.toBeInTheDocument();
  });

});

describe('auth-gated routes once the session has resolved', () => {
  it('RequireAuth redirects a genuine guest to /auth', () => {
    mockState({ user: null, authLoading: false });
    render(
      <MemoryRouter initialEntries={['/map']}>
        <Routes>
          <Route path="/map" element={<RequireAuth>{PAGE}</RequireAuth>} />
          <Route path="/auth" element={<p>auth page</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('auth page')).toBeInTheDocument();
    expect(screen.queryByText('protected page')).not.toBeInTheDocument();
  });

  it('RequireAuth renders the page for a signed-in user', () => {
    mockState({ user: { id: 'u1' } as Partial<User>, authLoading: false });
    renderGate(<RequireAuth>{PAGE}</RequireAuth>);

    expect(screen.getByText('protected page')).toBeInTheDocument();
  });

  it('RequireAdmin still walls off a non-admin', () => {
    mockState({ user: { id: 'u1', isAdmin: false } as Partial<User>, authLoading: false });
    renderGate(<RequireAdmin>{PAGE}</RequireAdmin>);

    expect(screen.getByText('gates.adminOnly')).toBeInTheDocument();
    expect(screen.queryByText('protected page')).not.toBeInTheDocument();
  });

  it('RequireCompany admits an admin', () => {
    mockState({ user: { id: 'u1', isAdmin: true } as Partial<User>, authLoading: false });
    renderGate(<RequireCompany>{PAGE}</RequireCompany>);

    expect(screen.getByText('protected page')).toBeInTheDocument();
  });
});

/**
 * RequireOnboarded is the single decision point that replaced the old
 * auto-opening questionnaire modal. The modal used to render *over* whichever
 * page the user landed on; the guard must instead swap the page out entirely.
 */
describe('RequireOnboarded', () => {
  // Renders the guard at /home with a visible stand-in for /onboarding, so a
  // redirect is observable rather than inferred.
  function renderAt(path: string, ui: React.ReactElement) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/home" element={ui} />
          <Route path="/journey" element={ui} />
          <Route path="/profile" element={ui} />
          <Route path="/onboarding" element={<p>onboarding page</p>} />
          <Route path="/auth" element={<p>auth page</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  const GUARDED = <RequireOnboarded>{PAGE}</RequireOnboarded>;

  it('shows only a neutral placeholder while the session resolves', () => {
    // The reported bug: personalized content painted first, then the
    // questionnaire appeared on top of it.
    mockState({ user: null, authLoading: true });
    renderAt('/home', GUARDED);

    expect(pending()).toBeInTheDocument();
    expect(screen.queryByText('protected page')).not.toBeInTheDocument();
    expect(screen.queryByText('onboarding page')).not.toBeInTheDocument();
  });

  it('sends a guest to sign in rather than into onboarding', () => {
    // Sending them to /onboarding would bounce forever: it's itself
    // auth-gated. /auth is not, so this is a one-way trip.
    mockState({ user: null, authLoading: false });
    renderAt('/home', GUARDED);

    expect(screen.getByText('auth page')).toBeInTheDocument();
    expect(screen.queryByText('onboarding page')).not.toBeInTheDocument();
  });

  // /account is absent on purpose: it is now a bare redirect to /profile and
  // carries no guard of its own. /profile below is the surface that must gate.
  it.each(['/home', '/journey', '/profile'])(
    'redirects an incomplete user away from %s, without rendering it first',
    (path) => {
      mockState({ user: { id: 'u1' } as Partial<User>, onboardingCompleted: false });
      renderAt(path, GUARDED);

      expect(screen.getByText('onboarding page')).toBeInTheDocument();
      expect(screen.queryByText('protected page')).not.toBeInTheDocument();
    },
  );

  it('renders the page once onboarding is complete', () => {
    mockState({ user: { id: 'u1' } as Partial<User>, onboardingCompleted: true });
    renderAt('/home', GUARDED);

    expect(screen.getByText('protected page')).toBeInTheDocument();
    expect(screen.queryByText('onboarding page')).not.toBeInTheDocument();
  });

  it('ignores a stale local profile — only the server flag admits a user', () => {
    // The legacy modal keyed off the `rafiq_profile` localStorage blob. A
    // leftover blob must not be able to wave someone past onboarding.
    localStorage.setItem('rafiq_profile', JSON.stringify({ path: 'living', situation: 'resident' }));
    mockState({ user: { id: 'u1' } as Partial<User>, onboardingCompleted: false });
    renderAt('/home', GUARDED);

    expect(screen.getByText('onboarding page')).toBeInTheDocument();
    localStorage.removeItem('rafiq_profile');
  });
});
