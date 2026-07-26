import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { ChatRedirect } from './LegacyRedirects';

/**
 * Regression suite for the duplicate-route cleanup: /chat and /account used to
 * mount the same components as /premium and /profile, so a fix applied to one
 * path silently missed the other. They are redirects now — these tests pin both
 * the hop and the thing that made the hop non-trivial (the query string).
 */

/** Reports the path + search of whichever route it lands on. */
function Landed() {
  const { pathname, search } = useLocation();
  return (
    <>
      <p data-testid="path">{pathname}</p>
      <p data-testid="search">{search}</p>
    </>
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/chat" element={<ChatRedirect />} />
        <Route path="/premium" element={<Landed />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('/chat -> /premium', () => {
  it('lands on the assistant', () => {
    renderAt('/chat');

    expect(screen.getByTestId('path')).toHaveTextContent('/premium');
  });

  it('preserves the query string so ?topic= still prefills', () => {
    // The service pages link to /chat?topic=<serviceId> and Premium seeds the
    // first message from it. Dropping the query would open an empty conversation.
    renderAt('/chat?topic=residency&x=1');

    expect(screen.getByTestId('path')).toHaveTextContent('/premium');
    expect(screen.getByTestId('search')).toHaveTextContent('?topic=residency&x=1');
  });

  it('adds no stray "?" when there was no query string', () => {
    renderAt('/chat');

    expect(screen.getByTestId('search')).toBeEmptyDOMElement();
  });
});

describe('the removed duplicate routes stay removed', () => {
  const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
  const lineWith = (text: string, needle: string) => text.split('\n').find((l) => l.includes(needle));

  it('/account redirects to /profile instead of mounting ProfilePage again', () => {
    // The real defect this fixed: /profile picked MobileProfilePage on phones,
    // /account never did — so "حسابي" served the desktop page on mobile.
    const line = lineWith(src('../App.tsx'), 'path="/account"');
    expect(line).toBeDefined();
    expect(line!).toMatch(/Navigate to="\/profile" replace/);
  });

  it('/chat is wired to the redirect, not to Premium', () => {
    const line = lineWith(src('../App.tsx'), 'path="/chat"');
    expect(line).toBeDefined();
    expect(line!).toMatch(/ChatRedirect/);
  });

  it('/smart has no route and no lazy import', () => {
    // Smart.tsx / MobileSmart.tsx stay on disk on purpose (the
    // profile-completeness ring may be reused) — only the routing is gone.
    const app = src('../App.tsx');
    expect(app).not.toMatch(/path="\/smart"/);
    expect(app).not.toMatch(/pages\/Smart|mobile\/MobileSmart/);
  });

  it('/smart is not listed as a mobile chrome-free route', () => {
    const line = lineWith(src('./Layout.tsx'), 'MOBILE_CHROME_FREE_ROUTES = ');
    expect(line).toBeDefined();
    expect(line!).not.toMatch(/'\/smart'/);
  });
});
