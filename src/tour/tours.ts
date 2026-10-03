/**
 * The tours themselves — which screen gets one and what it points at.
 *
 * Pure data, no DOM: a step names its target by the `data-tour="<key>"`
 * attribute stamped on the real element, and its copy by `tour.<id>.<step>`
 * keys in the four locale files. `src/tour/tourState.ts` turns this into
 * something the screen can show (drops steps whose target is not on the page,
 * remembers what the visitor has already seen).
 *
 * Why `data-tour` rather than ids/classes: ids on these elements are already
 * taken for deep links (#locker, #renewals) and classes change with styling;
 * a dedicated attribute cannot be broken by a redesign that does not mean to.
 *
 * Phase 1 is the home screen plus the four tab destinations. "/" is two very
 * different screens — the guest landing page (src/pages/Home.tsx: hero with two
 * buttons, how-it-works, services carousel, discover, FAQ, NO tab bar) and the
 * signed-in dashboard (UserHome, which has the tab bar) — so the home tour
 * lists the targets of both and whichever ones are not rendered are dropped at
 * show time. Likewise the guest "map" tab vs the signed-in "requests" tab.
 */

export type TourPlacement = 'top' | 'bottom' | 'auto' | 'center';

export type TourStepDef = {
  /** `data-tour` value of the element to spotlight; omitted = centered card. */
  target?: string;
  /** i18n key under `tour.<tourId>.` for title/body: `${key}Title`/`${key}Body`. */
  key: string;
  placement?: TourPlacement;
};

export type TourDef = {
  id: string;
  /** Exact pathnames this tour belongs to. */
  paths: string[];
  steps: TourStepDef[];
};

export const TOURS: TourDef[] = [
  {
    id: 'home',
    paths: ['/', '/home'],
    steps: [
      { key: 'welcome', placement: 'center' },
      // guest landing page
      { target: 'home-hero-cta', key: 'heroCta', placement: 'top' },
      { target: 'home-how', key: 'how' },
      { target: 'home-services', key: 'servicesCarousel' },
      { target: 'home-discover', key: 'discover' },
      { target: 'home-faq', key: 'faq' },
      // signed-in dashboard (bottom tab bar)
      { target: 'tab-chat', key: 'chat', placement: 'top' },
      { target: 'tab-map', key: 'map', placement: 'top' },
      { target: 'tab-requests', key: 'requests', placement: 'top' },
      { target: 'tab-services', key: 'services', placement: 'top' },
      { target: 'tab-profile', key: 'profile', placement: 'top' },
    ],
  },
  {
    id: 'chat',
    paths: ['/premium'],
    steps: [
      { target: 'chat-input', key: 'input', placement: 'top' },
      { target: 'chat-attach', key: 'attach', placement: 'top' },
      { target: 'chat-voice', key: 'voice', placement: 'top' },
    ],
  },
  {
    id: 'services',
    paths: ['/services'],
    steps: [
      { target: 'services-search', key: 'search' },
      { target: 'services-filter', key: 'filter' },
      { target: 'services-list', key: 'list' },
    ],
  },
  {
    id: 'requests',
    paths: ['/requests'],
    steps: [
      { target: 'requests-search', key: 'search' },
      { target: 'requests-list', key: 'list' },
    ],
  },
  {
    id: 'profile',
    paths: ['/profile'],
    steps: [
      { target: 'profile-locker', key: 'locker' },
      { target: 'profile-renewals', key: 'renewals' },
      { target: 'profile-pipeline', key: 'pipeline' },
    ],
  },
];
