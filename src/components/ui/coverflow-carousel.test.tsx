import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CoverflowCarousel, type ServiceSlide } from './coverflow-carousel';

/**
 * Buttery-carousel torture suite (57 tests).
 *
 * Pinned behaviors: rendering, button nav, dots, keyboard (LTR+RTL), slow
 * drags, fast flicks, long flings, tap-to-select, Request-Service navigation
 * vs drag guards, autoplay pause/resume/cooldowns, RTL mirroring, and
 * robustness (unmount, resize, reduced-motion, pointercancel).
 *
 * Motion model under test: finger drag writes into a framer-motion MotionValue
 * (no React re-render per pixel); slide slots spring on index change.
 * Tests therefore assert INDEX state (which card is aria-hidden=false),
 * never animation internals.
 */

const hoisted = vi.hoisted(() => ({
  navigate: vi.fn(),
  lang: { language: 'en', dir: 'ltr', isRtl: false },
  reducedMotion: false,
  services: [
    { id: 's1', src: '/a.webp', alt: 'alpha photo', title: 'Alpha', description: 'alpha desc', category: 'Cat A', badge: 'Verified Partner', badgeType: 'partner', href: '/en/services?category=residency' },
    { id: 's2', src: '/b.webp', alt: 'bravo photo', title: 'Bravo', description: 'bravo desc', category: 'Cat B', badge: 'Direct Rafiq Service', badgeType: 'direct', href: '/en/services?category=realestate' },
    { id: 's3', src: '/c.webp', alt: 'charlie photo', title: 'Charlie', description: 'charlie desc', category: 'Cat C', badge: 'Verified Partner', badgeType: 'partner', href: '/en/services?category=tourism' },
    { id: 's4', src: '/d.webp', alt: 'delta photo', title: 'Delta', description: 'delta desc', category: 'Cat D', badge: 'Verified Partner', badgeType: 'partner', href: '/en/services?category=translation' },
    { id: 's5', src: '/e.webp', alt: 'echo photo', title: 'Echo', description: 'echo desc', category: 'Cat E', badge: 'Direct Rafiq Service', badgeType: 'direct', href: '/en/services?category=banking' },
    { id: 's6', src: '/f.webp', alt: 'foxtrot photo', title: 'Foxtrot', description: 'foxtrot desc', category: 'Cat F', badge: 'Verified Partner', badgeType: 'partner', href: '/en/services?category=health' },
  ] as ServiceSlide[],
}));

vi.mock('@/i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: hoisted.lang.language,
    dir: hoisted.lang.dir,
    isRtl: hoisted.lang.isRtl,
    t: {
      servicesCarousel: {
        label: 'Services carousel',
        eyebrow: 'CERTIFIED RAFIQ SERVICES',
        heading: 'Everything You Need in Istanbul',
        description: 'Choose the service matching your needs',
        services: hoisted.services,
      },
      common: { requestService: 'Request Service' },
    },
  }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => hoisted.navigate };
});

// ---------------------------------------------------------------------------
// environment stubs
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let nowValue = 1_000_000;
let nowStep = 16;

function renderCarousel(props: Record<string, unknown> = {}) {
  return render(
    <MemoryRouter>
      <CoverflowCarousel autoScroll={false} {...(props as object)} />
    </MemoryRouter>,
  );
}

function activeTitle(container: HTMLElement): string {
  const h = container.querySelector('[aria-hidden="false"] h3');
  if (!h?.textContent) throw new Error('no centered slide found');
  return h.textContent;
}

function dragSurface(container: HTMLElement): HTMLElement {
  const el = container.querySelector('.touch-pan-y');
  if (!(el instanceof HTMLElement)) throw new Error('drag surface not found');
  return el;
}

function dots(): HTMLElement[] {
  return screen.getAllByRole('button', { name: /Go to slide \d+/ });
}

// Side cards live under aria-hidden="true" wrappers, which role queries skip
// by default — `hidden: true` sees centered and side cards alike.
function groupByTitle(title: string): HTMLElement {
  return screen.getByRole('group', { hidden: true, name: new RegExp(`Service ${title}`) });
}

function queryGroupByTitle(title: string): HTMLElement | null {
  return screen.queryByRole('group', { hidden: true, name: new RegExp(`Service ${title}`) });
}

function requestLinkFor(title: string): HTMLElement {
  return screen.getByRole('link', { hidden: true, name: new RegExp(`Request Service: ${title}`) });
}

/** Slow, human-like drag: real time passes between moves, so velocity stays low. */
async function slowDrag(el: HTMLElement, fromX: number, toX: number, steps = 6) {
  fireEvent.pointerDown(el, { clientX: fromX, pointerId: 1 });
  for (let i = 1; i <= steps; i++) {
    fireEvent.pointerMove(el, {
      clientX: fromX + ((toX - fromX) * i) / steps,
      pointerId: 1,
    });
    await sleep(30);
  }
  fireEvent.pointerUp(el, { clientX: toX, pointerId: 1 });
}

/** Fast flick: moves land in back-to-back frames (mocked clock barely advances). */
async function fastFlick(el: HTMLElement, fromX: number, toX: number) {
  fireEvent.pointerDown(el, { clientX: fromX, pointerId: 1 });
  const mid = fromX + (toX - fromX) / 2;
  fireEvent.pointerMove(el, { clientX: mid, pointerId: 1 });
  await sleep(35);
  fireEvent.pointerMove(el, { clientX: toX, pointerId: 1 });
  await sleep(35);
  fireEvent.pointerUp(el, { clientX: toX, pointerId: 1 });
}

beforeEach(() => {
  hoisted.navigate.mockReset();
  hoisted.lang.language = 'en';
  hoisted.lang.dir = 'ltr';
  hoisted.lang.isRtl = false;
  hoisted.reducedMotion = false;
  nowValue = 1_000_000;
  nowStep = 16;

  vi.spyOn(performance, 'now').mockImplementation(() => (nowValue += nowStep));

  // This jsdom has no PointerEvent constructor, so testing-library's
  // fireEvent.pointer* drops clientX/pointerId (they arrive as undefined and
  // every drag computes NaN). A minimal constructor carrying the MouseEvent
  // init values restores real-browser event shapes for these tests.
  if (typeof window.PointerEvent === 'undefined') {
    class TestPointerEvent extends Event {
      readonly clientX: number;
      readonly clientY: number;
      readonly pointerId: number;
      constructor(type: string, init: { clientX?: number; clientY?: number; pointerId?: number; bubbles?: boolean; cancelable?: boolean; composed?: boolean } = {}) {
        super(type, init);
        this.clientX = init.clientX ?? 0;
        this.clientY = init.clientY ?? 0;
        this.pointerId = init.pointerId ?? 1;
      }
    }
    Object.defineProperty(window, 'PointerEvent', {
      writable: true,
      configurable: true,
      value: TestPointerEvent,
    });
  }

  // Scroll-into-view entrance: report everything visible immediately.
  class MockIO {
    private cb: IntersectionObserverCallback;
    constructor(cb: IntersectionObserverCallback) {
      this.cb = cb;
    }
    observe(target: Element) {
      this.cb(
        [{ isIntersecting: true, target } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIO,
  });

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' && hoisted.reducedMotion,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
});

// ---------------------------------------------------------------------------
// rendering
// ---------------------------------------------------------------------------

describe('rendering', () => {
  it('shows eyebrow, heading and description', () => {
    renderCarousel();
    expect(screen.getByText('CERTIFIED RAFIQ SERVICES')).toBeInTheDocument();
    expect(screen.getByText('Everything You Need in Istanbul')).toBeInTheDocument();
    expect(screen.getByText('Choose the service matching your needs')).toBeInTheDocument();
  });

  it('renders all six default service cards', () => {
    renderCarousel();
    for (const title of ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot']) {
      expect(groupByTitle(title)).toBeInTheDocument();
    }
  });

  it('renders custom slides instead of defaults', () => {
    const slides: ServiceSlide[] = [
      { id: 'x1', src: '/x.webp', alt: 'x', title: 'Custom One', description: 'd', category: 'C', badge: 'B', badgeType: 'partner', href: '/en/a' },
      { id: 'x2', src: '/y.webp', alt: 'y', title: 'Custom Two', description: 'd', category: 'C', badge: 'B', badgeType: 'direct', href: '/en/b' },
    ];
    renderCarousel({ slides });
    expect(groupByTitle('Custom One')).toBeInTheDocument();
    expect(groupByTitle('Custom Two')).toBeInTheDocument();
    expect(queryGroupByTitle('Alpha')).toBeNull();
    expect(dots()).toHaveLength(2);
  });

  it('honors custom eyebrow / heading / description overrides', () => {
    renderCarousel({ eyebrow: 'MY EYEBROW', heading: 'My Heading', description: 'My desc' });
    expect(screen.getByText('MY EYEBROW')).toBeInTheDocument();
    expect(screen.getByText('My Heading')).toBeInTheDocument();
    expect(screen.getByText('My desc')).toBeInTheDocument();
  });

  it('renders one pagination dot per slide', () => {
    renderCarousel();
    expect(dots()).toHaveLength(6);
  });

  it('renders prev/next buttons with LTR labels', () => {
    renderCarousel();
    expect(screen.getByRole('button', { name: 'Previous service' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next service' })).toBeInTheDocument();
  });

  it('renders zero-padded step numbers', () => {
    const { container } = renderCarousel();
    const text = container.textContent ?? '';
    for (const n of ['01', '02', '03', '04', '05', '06']) expect(text).toContain(n);
  });

  it('renders both badge variants', () => {
    renderCarousel();
    expect(screen.getAllByText('Verified Partner').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Direct Rafiq Service').length).toBeGreaterThan(0);
  });

  it('images carry alt text, async decoding and are not draggable', () => {
    renderCarousel();
    const img = screen.getByAltText('alpha photo');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('decoding')).toBe('async');
    expect(img.getAttribute('draggable')).toBe('false');
  });

  it('first slide is centered, the rest are hidden from assistive tech', () => {
    const { container } = renderCarousel();
    expect(activeTitle(container)).toBe('Alpha');
    // One centered wrapper; every other slide wrapper hides its subtree.
    // (Glow/shine divs also carry aria-hidden, so count wrappers via groups.)
    const groups = screen.getAllByRole('group', { hidden: true });
    expect(groups).toHaveLength(6);
    const centered = container.querySelectorAll('[aria-hidden="false"] h3');
    expect(centered).toHaveLength(1);
    expect(centered[0].textContent).toBe('Alpha');
  });

  it('an empty custom slides array falls back to defaults', () => {
    renderCarousel({ slides: [] });
    expect(groupByTitle('Alpha')).toBeInTheDocument();
    expect(dots()).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// button navigation
// ---------------------------------------------------------------------------

describe('button navigation', () => {
  it('next advances Alpha -> Bravo', () => {
    const { container } = renderCarousel();
    fireEvent.click(screen.getByRole('button', { name: 'Next service' }));
    expect(activeTitle(container)).toBe('Bravo');
  });

  it('prev from the first slide wraps to the last (loop)', () => {
    const { container } = renderCarousel();
    fireEvent.click(screen.getByRole('button', { name: 'Previous service' }));
    expect(activeTitle(container)).toBe('Foxtrot');
  });

  it('next from the last slide wraps to the first', () => {
    const { container } = renderCarousel();
    const next = screen.getByRole('button', { name: 'Next service' });
    for (let i = 0; i < 5; i++) fireEvent.click(next);
    expect(activeTitle(container)).toBe('Foxtrot');
    fireEvent.click(next);
    expect(activeTitle(container)).toBe('Alpha');
  });

  it('prev walks backward after going forward', () => {
    const { container } = renderCarousel();
    fireEvent.click(screen.getByRole('button', { name: 'Next service' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous service' }));
    expect(activeTitle(container)).toBe('Alpha');
  });

  it('survives rapid spam: 10x next lands on Echo', () => {
    const { container } = renderCarousel();
    const next = screen.getByRole('button', { name: 'Next service' });
    for (let i = 0; i < 10; i++) fireEvent.click(next);
    expect(activeTitle(container)).toBe('Echo'); // 10 % 6 = 4
  });

  it('alternating next/next/prev lands on Bravo', () => {
    const { container } = renderCarousel();
    fireEvent.click(screen.getByRole('button', { name: 'Next service' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next service' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous service' }));
    expect(activeTitle(container)).toBe('Bravo');
  });

  it('loop=false clamps at both ends', () => {
    const slides = hoisted.services.slice(0, 3);
    const { container } = renderCarousel({ slides, loop: false });
    fireEvent.click(screen.getByRole('button', { name: 'Previous service' }));
    expect(activeTitle(container)).toBe('Alpha');
    const next = screen.getByRole('button', { name: 'Next service' });
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);
    expect(activeTitle(container)).toBe('Charlie');
  });
});

// ---------------------------------------------------------------------------
// pagination dots
// ---------------------------------------------------------------------------

describe('pagination dots', () => {
  it('clicking a dot jumps straight to that slide', () => {
    const { container } = renderCarousel();
    fireEvent.click(dots()[3]);
    expect(activeTitle(container)).toBe('Delta');
  });

  it('clicking the active dot stays put', () => {
    const { container } = renderCarousel();
    fireEvent.click(dots()[0]);
    expect(activeTitle(container)).toBe('Alpha');
  });
});

// ---------------------------------------------------------------------------
// keyboard
// ---------------------------------------------------------------------------

describe('keyboard navigation', () => {
  it('ArrowRight advances in LTR', () => {
    const { container } = renderCarousel();
    fireEvent.keyDown(screen.getByRole('region', { name: 'Services carousel' }), { key: 'ArrowRight' });
    expect(activeTitle(container)).toBe('Bravo');
  });

  it('ArrowLeft goes back in LTR', () => {
    const { container } = renderCarousel();
    fireEvent.keyDown(screen.getByRole('region', { name: 'Services carousel' }), { key: 'ArrowRight' });
    fireEvent.keyDown(screen.getByRole('region', { name: 'Services carousel' }), { key: 'ArrowLeft' });
    expect(activeTitle(container)).toBe('Alpha');
  });

  it('RTL mirrors the arrows: ArrowLeft advances, ArrowRight goes back', () => {
    hoisted.lang.language = 'ar';
    hoisted.lang.dir = 'rtl';
    hoisted.lang.isRtl = true;
    const { container } = renderCarousel();
    const region = screen.getByRole('region', { name: 'Services carousel' });
    expect(region.getAttribute('dir')).toBe('rtl');
    fireEvent.keyDown(region, { key: 'ArrowLeft' });
    expect(activeTitle(container)).toBe('Bravo');
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    expect(activeTitle(container)).toBe('Alpha');
  });

  it('unrelated keys are ignored', () => {
    const { container } = renderCarousel();
    fireEvent.keyDown(screen.getByRole('region', { name: 'Services carousel' }), { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('region', { name: 'Services carousel' }), { key: 'a' });
    expect(activeTitle(container)).toBe('Alpha');
  });
});

// ---------------------------------------------------------------------------
// slow drags
// ---------------------------------------------------------------------------

describe('slow drags (finger speed)', () => {
  it('dragging left past the threshold advances (LTR)', async () => {
    const { container } = renderCarousel();
    await slowDrag(dragSurface(container), 500, 380);
    expect(activeTitle(container)).toBe('Bravo');
  });

  it('dragging right past the threshold goes back (LTR)', async () => {
    const { container } = renderCarousel();
    fireEvent.click(screen.getByRole('button', { name: 'Next service' }));
    expect(activeTitle(container)).toBe('Bravo');
    await slowDrag(dragSurface(container), 300, 420);
    expect(activeTitle(container)).toBe('Alpha');
  });

  it('a short 30px drag stays on the same slide', async () => {
    const { container } = renderCarousel();
    await slowDrag(dragSurface(container), 500, 470);
    expect(activeTitle(container)).toBe('Alpha');
  });

  it('a drag of exactly the 45px threshold still stays (strict >)', async () => {
    const { container } = renderCarousel();
    await slowDrag(dragSurface(container), 500, 455);
    expect(activeTitle(container)).toBe('Alpha');
  });

  it('46px is enough to move', async () => {
    const { container } = renderCarousel();
    await slowDrag(dragSurface(container), 500, 454);
    expect(activeTitle(container)).toBe('Bravo');
  });

  it('RTL mirrors drag direction: right advances, left goes back', async () => {
    hoisted.lang.language = 'ar';
    hoisted.lang.dir = 'rtl';
    hoisted.lang.isRtl = true;
    const { container } = renderCarousel();
    await slowDrag(dragSurface(container), 300, 420); // drag right
    expect(activeTitle(container)).toBe('Bravo');
    await slowDrag(dragSurface(container), 500, 380); // drag left
    expect(activeTitle(container)).toBe('Alpha');
  });

  it('a long hard fling skips two slides', async () => {
    nowStep = 4; // barely any mocked time passes -> high velocity
    const { container } = renderCarousel();
    await slowDrag(dragSurface(container), 600, 150, 8);
    expect(activeTitle(container)).toBe('Charlie');
  });

  it('works on narrow phone widths (150px spacing)', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 390 });
    window.dispatchEvent(new Event('resize'));
    const { container } = renderCarousel();
    await slowDrag(dragSurface(container), 300, 190);
    expect(activeTitle(container)).toBe('Bravo');
  });

  it('three sequential left drags accumulate to Delta', async () => {
    const { container } = renderCarousel();
    const surface = dragSurface(container);
    await slowDrag(surface, 500, 380);
    await slowDrag(surface, 500, 380);
    await slowDrag(surface, 500, 380);
    expect(activeTitle(container)).toBe('Delta');
  });

  it('dragging right from the first slide wraps to the last via loop', async () => {
    const { container } = renderCarousel();
    await slowDrag(dragSurface(container), 300, 430);
    expect(activeTitle(container)).toBe('Foxtrot');
  });

  it('pointercancel with no real move never changes slides', async () => {
    const { container } = renderCarousel();
    const surface = dragSurface(container);
    fireEvent.pointerDown(surface, { clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 495, pointerId: 1 });
    await sleep(40);
    fireEvent.pointerCancel(surface);
    expect(activeTitle(container)).toBe('Alpha');
  });

  it('pointercancel mid-swipe snaps like a release (no stuck half-drag)', async () => {
    const { container } = renderCarousel();
    const surface = dragSurface(container);
    fireEvent.pointerDown(surface, { clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 350, pointerId: 1 });
    await sleep(40);
    fireEvent.pointerCancel(surface);
    expect(activeTitle(container)).toBe('Bravo');
  });
});

// ---------------------------------------------------------------------------
// fast flicks (velocity path)
// ---------------------------------------------------------------------------

describe('fast flicks (velocity, not distance)', () => {
  it('a quick 30px flick advances even though it is under the distance threshold', async () => {
    nowStep = 2; // almost no time passes between frames -> huge velocity
    const { container } = renderCarousel();
    await fastFlick(dragSurface(container), 500, 470);
    expect(activeTitle(container)).toBe('Bravo');
  });

  it('a quick 30px flick to the right goes back', async () => {
    nowStep = 2;
    const { container } = renderCarousel();
    fireEvent.click(screen.getByRole('button', { name: 'Next service' }));
    await fastFlick(dragSurface(container), 400, 430);
    expect(activeTitle(container)).toBe('Alpha');
  });

  it('a slow 120px drag advances by distance even with near-zero velocity', async () => {
    nowStep = 500; // ages pass between frames -> velocity ~0
    const { container } = renderCarousel();
    await slowDrag(dragSurface(container), 500, 380, 4);
    expect(activeTitle(container)).toBe('Bravo');
  });

  it('a slow 30px drag with near-zero velocity stays', async () => {
    nowStep = 500;
    const { container } = renderCarousel();
    await slowDrag(dragSurface(container), 500, 470, 4);
    expect(activeTitle(container)).toBe('Alpha');
  });
});

// ---------------------------------------------------------------------------
// tap-to-select + Request Service
// ---------------------------------------------------------------------------

describe('tap-to-select and Request Service', () => {
  it('tapping a side card centers it', () => {
    const { container } = renderCarousel();
    const bravo = groupByTitle('Bravo');
    fireEvent.pointerDown(bravo, { clientX: 200, pointerId: 1 });
    fireEvent.pointerUp(bravo, { clientX: 200, pointerId: 1 });
    expect(activeTitle(container)).toBe('Bravo');
  });

  it('tapping Request Service navigates through the router (no reload)', () => {
    renderCarousel();
    const link = requestLinkFor('Alpha');
    fireEvent.pointerDown(link, { clientX: 200, pointerId: 1 });
    fireEvent.pointerUp(link, { clientX: 200, pointerId: 1 });
    expect(hoisted.navigate).toHaveBeenCalledTimes(1);
    // The card builds its href from the service id (s1 is not a catalog
    // category, so the id itself is used) — router path, no page reload.
    expect(hoisted.navigate).toHaveBeenCalledWith('/services?category=s1');
  });

  it('a drag that ends on the button advances the slide but NEVER navigates', async () => {
    const { container } = renderCarousel();
    const link = requestLinkFor('Alpha');
    fireEvent.pointerDown(link, { clientX: 500, pointerId: 1 });
    for (let i = 1; i <= 6; i++) {
      fireEvent.pointerMove(link, { clientX: 500 - (120 * i) / 6, pointerId: 1 });
      await sleep(30);
    }
    fireEvent.pointerUp(link, { clientX: 380, pointerId: 1 });
    expect(activeTitle(container)).toBe('Bravo');
    expect(hoisted.navigate).not.toHaveBeenCalled();
  });

  it('tapping the button on a side card still navigates', () => {
    renderCarousel();
    const link = requestLinkFor('Bravo');
    fireEvent.pointerDown(link, { clientX: 200, pointerId: 1 });
    fireEvent.pointerUp(link, { clientX: 200, pointerId: 1 });
    expect(hoisted.navigate).toHaveBeenCalledWith('/services?category=s2');
  });

  it('the anchor keeps a real href as the keyboard fallback', () => {
    renderCarousel();
    expect(requestLinkFor('Alpha').getAttribute('href')).toBe('/en/services?category=s1');
  });
});

// ---------------------------------------------------------------------------
// autoplay
// ---------------------------------------------------------------------------

describe('autoplay', () => {
  it('advances automatically on the interval', async () => {
    const { container } = renderCarousel({ autoScroll: true, autoScrollInterval: 80 });
    await waitFor(() => expect(activeTitle(container)).toBe('Bravo'), { timeout: 3000 });
  });

  it('pauses on hover and resumes on leave', async () => {
    const { container } = renderCarousel({ autoScroll: true, autoScrollInterval: 80 });
    const region = screen.getByRole('region', { name: 'Services carousel' });
    await waitFor(() => expect(activeTitle(container)).toBe('Bravo'), { timeout: 3000 });
    fireEvent.mouseEnter(region);
    const frozen = activeTitle(container);
    await sleep(250);
    expect(activeTitle(container)).toBe(frozen);
    fireEvent.mouseLeave(region);
    await waitFor(() => expect(activeTitle(container)).not.toBe(frozen), { timeout: 3000 });
  });

  it('pauses on focus and resumes on blur', async () => {
    const { container } = renderCarousel({ autoScroll: true, autoScrollInterval: 80 });
    const region = screen.getByRole('region', { name: 'Services carousel' });
    await waitFor(() => expect(activeTitle(container)).toBe('Bravo'), { timeout: 3000 });
    fireEvent.focus(region);
    const frozen = activeTitle(container);
    await sleep(250);
    expect(activeTitle(container)).toBe(frozen);
    fireEvent.blur(region);
    await waitFor(() => expect(activeTitle(container)).not.toBe(frozen), { timeout: 3000 });
  });

  it('pauses while the tab is hidden and resumes when visible', async () => {
    const { container } = renderCarousel({ autoScroll: true, autoScrollInterval: 80 });
    await waitFor(() => expect(activeTitle(container)).toBe('Bravo'), { timeout: 3000 });
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    const frozen = activeTitle(container);
    await sleep(250);
    expect(activeTitle(container)).toBe(frozen);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(activeTitle(container)).not.toBe(frozen), { timeout: 3000 });
  });

  it('reduced-motion disables autoplay entirely', async () => {
    hoisted.reducedMotion = true;
    const { container } = renderCarousel({ autoScroll: true, autoScrollInterval: 80 });
    await sleep(300);
    expect(activeTitle(container)).toBe('Alpha');
  });

  it('autoScroll=false never advances', async () => {
    const { container } = renderCarousel({ autoScroll: false });
    await sleep(250);
    expect(activeTitle(container)).toBe('Alpha');
  });

  it('a manual button press starts a cooldown with no instant yank', async () => {
    const { container } = renderCarousel({ autoScroll: true, autoScrollInterval: 80 });
    fireEvent.click(screen.getByRole('button', { name: 'Next service' }));
    expect(activeTitle(container)).toBe('Bravo');
    await sleep(400);
    expect(activeTitle(container)).toBe('Bravo');
  });

  it('after a drag there is a cooldown, then autoplay resumes on its own', async () => {
    const { container } = renderCarousel({ autoScroll: true, autoScrollInterval: 80 });
    await slowDrag(dragSurface(container), 500, 380);
    expect(activeTitle(container)).toBe('Bravo');
    await sleep(600);
    expect(activeTitle(container)).toBe('Bravo');
    await waitFor(() => expect(activeTitle(container)).toBe('Charlie'), { timeout: 6000 });
  });
});

// ---------------------------------------------------------------------------
// RTL rendering
// ---------------------------------------------------------------------------

describe('RTL rendering', () => {
  beforeEach(() => {
    hoisted.lang.language = 'ar';
    hoisted.lang.dir = 'rtl';
    hoisted.lang.isRtl = true;
  });

  it('marks the section rtl with the right language', () => {
    renderCarousel();
    const region = screen.getByRole('region', { name: 'Services carousel' });
    expect(region.getAttribute('dir')).toBe('rtl');
    expect(region.getAttribute('lang')).toBe('ar');
  });

  it('flips the nav button labels in RTL', () => {
    const { container } = renderCarousel();
    // First (left-side) button becomes "Next" in RTL.
    const buttons = container.querySelectorAll('.pointer-events-auto.flex');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: 'Next service' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous service' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// robustness
// ---------------------------------------------------------------------------

describe('robustness', () => {
  it('unmounting during autoplay is clean', async () => {
    const { unmount } = renderCarousel({ autoScroll: true, autoScrollInterval: 50 });
    await sleep(120);
    expect(() => unmount()).not.toThrow();
    await sleep(120);
  });

  it('neighbor images load eagerly, distant ones lazily', () => {
    renderCarousel();
    // Center (Alpha) + immediate neighbors (Bravo, Foxtrot via loop) are eager.
    expect(screen.getByAltText('alpha photo').getAttribute('loading')).toBe('eager');
    expect(screen.getByAltText('bravo photo').getAttribute('loading')).toBe('eager');
    expect(screen.getByAltText('foxtrot photo').getAttribute('loading')).toBe('eager');
    // Far cards stay lazy.
    expect(screen.getByAltText('charlie photo').getAttribute('loading')).toBe('lazy');
    expect(screen.getByAltText('delta photo').getAttribute('loading')).toBe('lazy');
    expect(screen.getByAltText('echo photo').getAttribute('loading')).toBe('lazy');
  });

  it('reduced-motion + drag does not crash and still changes slides', async () => {
    hoisted.reducedMotion = true;
    const { container } = renderCarousel();
    await slowDrag(dragSurface(container), 500, 350);
    expect(activeTitle(container)).toBe('Bravo');
  });

  it('index stays consistent across mixed input: drag, dot, keyboard', async () => {
    const { container } = renderCarousel();
    await slowDrag(dragSurface(container), 500, 380); // -> Bravo
    fireEvent.click(dots()[4]); // -> Echo
    expect(activeTitle(container)).toBe('Echo');
    fireEvent.keyDown(screen.getByRole('region', { name: 'Services carousel' }), { key: 'ArrowRight' });
    expect(activeTitle(container)).toBe('Foxtrot');
    fireEvent.click(screen.getByRole('button', { name: 'Previous service' }));
    expect(activeTitle(container)).toBe('Echo');
  });

  it('a tiny jitter (2px wiggle) never moves the slide', async () => {
    const { container } = renderCarousel();
    const surface = dragSurface(container);
    fireEvent.pointerDown(surface, { clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 502, pointerId: 1 });
    await sleep(40);
    fireEvent.pointerMove(surface, { clientX: 499, pointerId: 1 });
    await sleep(40);
    fireEvent.pointerUp(surface, { clientX: 500, pointerId: 1 });
    expect(activeTitle(container)).toBe('Alpha');
  });
});
