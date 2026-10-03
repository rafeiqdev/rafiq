import { beforeEach, describe, expect, it } from 'vitest';
import { TOURS } from './tours';
import { findTour, hasAnchoredStep, hasSeenTour, isTourBlocked, markTourSeen, resolveSteps, SEEN_KEY_PREFIX } from './tourState';
import ar from '../i18n/locales/ar.json';
import en from '../i18n/locales/en.json';
import fa from '../i18n/locales/fa.json';
import ru from '../i18n/locales/ru.json';

type Dict = Record<string, unknown>;
const LOCALES: Record<string, Dict> = { ar, en, fa, ru };

function mount(html: string, sized = true): Document {
  document.body.innerHTML = html;
  if (sized) {
    // jsdom has no layout: give every element a box unless it is display:none,
    // which is the one case resolveSteps must treat as "not on screen".
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      el.getBoundingClientRect = () =>
        el.style.display === 'none'
          ? ({ width: 0, height: 0 } as DOMRect)
          : ({ width: 40, height: 40 } as DOMRect);
    }
  }
  return document;
}

describe('findTour', () => {
  it('maps the tab destinations to their tours and nothing else', () => {
    expect(findTour('/')?.id).toBe('home');
    expect(findTour('/home')?.id).toBe('home');
    expect(findTour('/premium')?.id).toBe('chat');
    expect(findTour('/services/')?.id).toBe('services');
    expect(findTour('/requests')?.id).toBe('requests');
    expect(findTour('/profile')?.id).toBe('profile');
    expect(findTour('/auth')).toBeNull();
    expect(findTour('/onboarding')).toBeNull();
    expect(findTour('/services/res-tourist')).toBeNull();
  });
});

describe('resolveSteps', () => {
  const home = TOURS.find((t) => t.id === 'home')!;

  it('keeps the welcome card and only the tabs that are rendered (guest: map, not requests)', () => {
    mount(`
      <nav>
        <a data-tour="tab-chat"></a><a data-tour="tab-map"></a>
        <a data-tour="tab-services"></a><a data-tour="tab-profile"></a>
      </nav>`);
    const keys = resolveSteps(home, document).map((s) => s.key);
    expect(keys).toEqual(['welcome', 'chat', 'map', 'services', 'profile']);
  });

  it('drops a target that is in the DOM but has no box', () => {
    mount(`<a data-tour="tab-chat"></a><button data-tour="tab-map" style="display:none"></button>`);
    expect(resolveSteps(home, document).map((s) => s.key)).toEqual(['welcome', 'chat']);
  });

  it('a tour with only the welcome card has nothing to point at', () => {
    mount('<div></div>');
    const steps = resolveSteps(home, document);
    expect(steps.map((s) => s.key)).toEqual(['welcome']);
    expect(hasAnchoredStep(steps)).toBe(false);
  });
});

describe('seen state', () => {
  beforeEach(() => localStorage.clear());

  it('is per tour and survives as a plain flag', () => {
    expect(hasSeenTour('home')).toBe(false);
    markTourSeen('home');
    expect(hasSeenTour('home')).toBe(true);
    expect(hasSeenTour('chat')).toBe(false);
    expect(localStorage.getItem(SEEN_KEY_PREFIX + 'home')).toBe('1');
  });

  it('treats a missing storage as never seen and never throws on write', () => {
    expect(hasSeenTour('home', null)).toBe(false);
    expect(() => markTourSeen('home', null)).not.toThrow();
  });
});

describe('isTourBlocked', () => {
  it('waits for the consent strip and for any foreign modal, but not for its own dialog', () => {
    expect(isTourBlocked(mount('<div role="dialog" aria-labelledby="consent-title"></div>', false))).toBe(true);
    expect(isTourBlocked(mount('<div role="dialog" aria-modal="true"></div>', false))).toBe(true);
    expect(isTourBlocked(mount('<div data-tour-layer><div role="dialog" aria-modal="true"></div></div>', false))).toBe(false);
    expect(isTourBlocked(mount('<main></main>', false))).toBe(false);
  });
});

describe('copy', () => {
  const get = (dict: Dict, path: string): unknown =>
    path.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Dict)[k] : undefined), dict);

  it.each(Object.keys(LOCALES))('%s has a title and body for every step and every button', (lang) => {
    const dict = LOCALES[lang];
    for (const label of ['next', 'back', 'done', 'close', 'replay']) {
      expect(get(dict, `tour.${label}`), `tour.${label}`).toBeTypeOf('string');
    }
    for (const tour of TOURS) {
      for (const step of tour.steps) {
        for (const part of ['Title', 'Body']) {
          const key = `tour.${tour.id}.${step.key}${part}`;
          const v = get(dict, key);
          expect(v, key).toBeTypeOf('string');
          expect((v as string).length, key).toBeGreaterThan(0);
        }
      }
    }
  });

  it('never quotes a price — the tour sells the service, not the fee', () => {
    for (const dict of Object.values(LOCALES)) {
      expect(JSON.stringify(get(dict, 'tour'))).not.toMatch(/\d+\s*(TL|₺|TRY|\$|€|ليرة|лир)/i);
    }
  });
});
