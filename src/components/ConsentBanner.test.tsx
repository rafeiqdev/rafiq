import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConsentBanner } from './ConsentBanner';

/**
 * Regression test: nearly every mobile screen renders a persistent
 * fixed-bottom-0 tab bar (src/components/MobileTabBar.tsx, 56px content +
 * safe-area inset). ConsentBanner is also fixed-bottom-0 with a higher
 * z-index, so on phones it used to render directly on top of that bar and
 * hide the entire bottom navigation (Home/Chat/Requests/Services/Profile)
 * until the visitor dismissed the cookie prompt.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

let mobile = false;
vi.mock('../hooks/useIsMobile', () => ({
  useIsMobile: () => mobile,
}));

beforeEach(() => {
  localStorage.clear();
  mobile = false;
});

afterEach(() => {
  localStorage.clear();
});

describe('ConsentBanner clears the mobile tab bar', () => {
  it('sits flush at the bottom on desktop', () => {
    mobile = false;
    render(<ConsentBanner />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toMatch(/bottom-0/);
    expect(dialog.style.bottom).toBe('');
  });

  it('lifts above the mobile tab bar height instead of covering it', () => {
    mobile = true;
    render(<ConsentBanner />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).not.toMatch(/bottom-0/);
    // jsdom's CSS parser reorders/mangles env() when serializing style.bottom
    // back out, so this checks the meaningful pieces rather than the exact
    // string — the offset must clear MobileTabBar's 56px content height plus
    // the safe-area inset, not just an arbitrary fixed pixel value.
    expect(dialog.style.bottom).toContain('56px');
    expect(dialog.style.bottom).toContain('safe-area-inset-bottom');
  });
});
