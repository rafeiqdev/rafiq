import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EMPTY_PROFILE } from '../lib/types';
import type { JourneyItem, Profile, User } from '../lib/types';

/**
 * Smoke + behaviour tests for the signed-in dashboard.
 *
 * The page is the first screen a user sees after onboarding, and it reads from
 * five independent sources (journey, profile, bookings, notifications, docs).
 * A single undefined dereference there is a blank app, not a broken panel — so
 * the mount itself is worth pinning, alongside the two properties the redesign
 * exists for:
 *
 *  1. The onboarding answers are echoed back, and steps seeded from them are
 *     credited — a first visit must never read "0%" for someone who told us
 *     they already have a tax number.
 *  2. Empty sections render an invitation, not nothing. Hiding them was what
 *     made a brand-new account look broken rather than new.
 */

const journeyState = {
  items: [] as JourneyItem[],
  state: 'ready' as 'ready' | 'loading' | 'error' | 'empty',
  errorCategory: null,
  progress: { total: 0, done: 0, remaining: 0, percent: 0 },
  next: null as JourneyItem | null,
  reload: vi.fn(),
};
let appState: { user: User | null; authLoading: boolean; profile: Profile };

const docsMock = vi.fn();

vi.mock('../hooks/useJourney', () => ({
  useJourney: () => journeyState,
  journeyTitle: (_t: unknown, i: JourneyItem) => i.titleAr,
  journeyDesc: (_t: unknown, i: JourneyItem) => i.descriptionAr ?? '',
}));

vi.mock('../context/AppContext', () => ({ useApp: () => appState }));

vi.mock('../lib/api', () => ({
  bookings: { mine: () => Promise.resolve([]) },
  notifications: { list: () => Promise.resolve([]) },
  documents: { list: () => docsMock() },
  // NewsSection renders nothing on an empty feed — these tests assert the plan, not the news.
  news: { latest: () => Promise.resolve([]), telegramChannel: () => Promise.resolve(null) },
  // RealEstateSection renders nothing on an empty list — same reasoning as news above.
  listings: { list: () => Promise.resolve([]) },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) => {
      if (vars && 'defaultValue' in vars) return String(vars.defaultValue);
      return vars && Object.keys(vars).length ? `${k} ${Object.values(vars).join(' ')}` : k;
    },
    i18n: { language: 'ar' },
  }),
}));

// jsdom ships no matchMedia, and the desktop layout is what these tests assert on.
vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => false }));

vi.mock('../components/NotificationBell', () => ({ NotificationBell: () => <div /> }));
vi.mock('../components/MobileTabBar', () => ({ MobileTabBar: () => <div /> }));
vi.mock('../components/RafiqLoader', () => ({ RafiqLoaderScreen: () => <div>loader</div> }));
vi.mock('../lib/seo', () => ({ usePageMeta: () => {} }));

import { UserHome } from './UserHome';

function item(over: Partial<JourneyItem>): JourneyItem {
  return {
    id: 'i1',
    taskKey: 'taxNumber',
    titleAr: 'الرقم الضريبي',
    descriptionAr: 'وصف',
    status: 'todo',
    sort: 0,
    relatedRoute: null,
    relatedServiceId: null,
    ...over,
  };
}

const user: User = {
  id: 'u1',
  email: 'ali@example.com',
  name: 'علي تجريبي',
  provider: 'email',
  isAdmin: false,
  role: 'user',
  isCompany: false,
  isMedicalCoordinator: false,
  referralCode: 'ABC123',
  createdAt: '2026-07-01T00:00:00Z',
  onboardingCompleted: true,
};

function mount() {
  return render(
    <MemoryRouter>
      <UserHome />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  docsMock.mockReset().mockResolvedValue([]);
  journeyState.state = 'ready';
  journeyState.reload = vi.fn();
  appState = { user, authLoading: false, profile: { ...EMPTY_PROFILE } };
});

describe('UserHome — first visit after onboarding', () => {
  it('mounts with a fresh profile and an empty journey without throwing', async () => {
    journeyState.items = [];
    journeyState.next = null;
    journeyState.progress = { total: 0, done: 0, remaining: 0, percent: 0 };

    mount();

    // the invitations that must survive a completely empty account
    expect(screen.getByText('dash.noDatesTitle')).toBeInTheDocument();
    expect(screen.getByText('dash.freeCallTitle')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('dash.noDocsTitle')).toBeInTheDocument());
  });

  it('credits steps the onboarding answers already covered instead of showing zero', () => {
    appState.profile = {
      ...EMPTY_PROFILE,
      situation: 'student',
      city: 'istanbul',
      has: { ...EMPTY_PROFILE.has, taxNumber: true, turkishPhone: true },
    };
    const done = [
      item({ id: 'a', taskKey: 'taxNumber', status: 'done', sort: 0 }),
      item({ id: 'b', taskKey: 'turkishPhone', titleAr: 'هاتف تركي', status: 'done', sort: 1 }),
    ];
    const todo = item({ id: 'c', taskKey: 'residencePermit', titleAr: 'الإقامة', sort: 2 });
    journeyState.items = [...done, todo];
    journeyState.next = todo;
    journeyState.progress = { total: 3, done: 2, remaining: 1, percent: 67 };

    mount();

    // the answers are echoed back, so the questionnaire visibly produced something
    expect(screen.getByText('dash.recapTitle')).toBeInTheDocument();
    expect(screen.getByText('situationStatus.student')).toBeInTheDocument();

    // both seeded steps are credited to the answers, not silently pre-checked
    expect(screen.getAllByText('dash.fromAnswers')).toHaveLength(2);

    // progress is reported as real work done, never as "steps waiting"
    expect(screen.getByText(/dash\.doneOf/)).toBeInTheDocument();
    expect(screen.queryByText(/dash\.stepsWaiting/)).not.toBeInTheDocument();
  });

  it('frames a zero-progress journey as steps waiting, not as 0%', () => {
    const first = item({ id: 'a', sort: 0 });
    journeyState.items = [first, item({ id: 'b', titleAr: 'الإقامة', sort: 1 })];
    journeyState.next = first;
    journeyState.progress = { total: 2, done: 0, remaining: 2, percent: 0 };

    mount();

    expect(screen.getByText(/dash\.stepsWaiting/)).toBeInTheDocument();
    expect(screen.queryByText(/dash\.doneOf/)).not.toBeInTheDocument();
    // the anchor invites a start rather than announcing a "next" step
    expect(screen.getByText('dash.startHere')).toBeInTheDocument();
  });

  it('lists every step, not a three-item preview', () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      item({ id: `s${i}`, titleAr: `خطوة ${i}`, sort: i }),
    );
    journeyState.items = many;
    journeyState.next = many[0];
    journeyState.progress = { total: 7, done: 0, remaining: 7, percent: 0 };

    mount();

    // every step is on the page (the first one twice: anchor block + roadmap)
    many.forEach((s) => expect(screen.getAllByText(s.titleAr).length).toBeGreaterThan(0));
    expect(screen.getAllByText(many[0].titleAr)).toHaveLength(2);
  });

  it('keeps rendering when the document locker fetch fails', async () => {
    docsMock.mockRejectedValue(new Error('offline'));
    journeyState.items = [];
    journeyState.next = null;
    journeyState.progress = { total: 0, done: 0, remaining: 0, percent: 0 };

    mount();

    await waitFor(() => expect(screen.getByText('dash.freeCallTitle')).toBeInTheDocument());
    // an unreadable locker shows nothing at all rather than a false "empty"
    expect(screen.queryByText('dash.noDocsTitle')).not.toBeInTheDocument();
  });
});
