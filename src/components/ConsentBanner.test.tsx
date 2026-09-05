import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConsentBanner } from './ConsentBanner';

/**
 * Regression test for BOTH failure modes of this strip's bottom offset.
 *
 * It is fixed-bottom with a higher z-index than the mobile tab bar, so on the
 * screens that draw that bar it must lift by the bar's height or it hides the
 * whole bottom navigation until the visitor answers the cookie prompt.
 *
 * But the signed-out home page — the first screen every new visitor sees, and
 * therefore the one this banner actually appears on — has NO bar. The offset
 * used to be hard-coded, so there it left 56px of page showing underneath: a
 * box floating off the bottom edge. The offset now comes from measuring the
 * bar, so "no bar" means "flush with the bottom edge".
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

let mobile = false;
vi.mock('../hooks/useIsMobile', () => ({
  useIsMobile: () => mobile,
}));

const TAB_BAR_HEIGHT = 62;
const realRect = Element.prototype.getBoundingClientRect;

beforeEach(() => {
  localStorage.clear();
  mobile = false;
  // jsdom lays nothing out, so every rect is 0×0 — give the tab bar a real
  // height, the way a phone would.
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this.hasAttribute('data-mobile-tabbar')) {
      return { ...realRect.call(this), height: TAB_BAR_HEIGHT } as DOMRect;
    }
    return realRect.call(this);
  };
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = realRect;
  localStorage.clear();
});

function renderBanner({ withTabBar }: { withTabBar: boolean }) {
  render(
    <MemoryRouter>
      {withTabBar && <nav data-mobile-tabbar aria-label="tabs" />}
      <ConsentBanner />
    </MemoryRouter>,
  );
  return screen.getByRole('dialog');
}

describe('ConsentBanner bottom offset', () => {
  it('sits flush at the bottom on desktop', () => {
    mobile = false;
    expect(renderBanner({ withTabBar: false }).style.bottom).toBe('0px');
  });

  it('sits flush at the bottom on a mobile screen with no tab bar', () => {
    mobile = true;
    expect(renderBanner({ withTabBar: false }).style.bottom).toBe('0px');
  });

  it('lifts by the tab bar height instead of covering it', () => {
    mobile = true;
    expect(renderBanner({ withTabBar: true }).style.bottom).toBe(`${TAB_BAR_HEIGHT}px`);
  });
});
