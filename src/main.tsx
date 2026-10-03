import React from 'react';
import ReactDOM from 'react-dom/client';
import { i18nReady, langFromPath, resolveInitialLang } from './i18n';
import './index.css';
import App from './App';

// After a deploy the previous build's hashed chunks disappear. A tab (or a
// crawler) still holding the old index.html then fails with "Failed to fetch
// dynamically imported module" and lands on the error boundary — Google once
// indexed that error text as a page description. Reload once to pick up the
// fresh index.html. At most one reload per minute: if the chunks are really
// unreachable (outage, not a stale build) the error boundary shows instead of
// reloading forever.
window.addEventListener('vite:preloadError', (event) => {
  const key = 'rafiq_chunk_reload_at';
  try {
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    // Storage blocked: no way to guard against a loop, so let the error
    // boundary show instead of reloading forever.
    return;
  }
  event.preventDefault();
  window.location.reload();
});

// Every page lives under a language segment (/ar /en /ru /fa). Production
// 301s langless URLs at the edge (vercel.json); this covers dev and anything
// that slips through, BEFORE the router mounts so basename sees the prefix.
{
  const { pathname, search, hash } = window.location;
  if (!langFromPath(pathname)) {
    const suffix = pathname === '/' ? '' : pathname;
    window.history.replaceState(null, '', `/${resolveInitialLang()}${suffix}${search}${hash}`);
  }
}

// Locale bundles are async chunks now; wait for the initial language so the
// first paint is never a screen of raw translation keys. i18nReady resolves
// even when the fetch fails, so this cannot dead-end the app.
i18nReady.then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  // The static boot loader in index.html has done its job once React has
  // painted its first frame (which is the app's own loader when a chunk or the
  // session is still pending, so the hand-off is seamless). Fade, then remove.
  // A timer, not requestAnimationFrame: rAF never fires in a background tab,
  // which left the overlay in place until the tab was fronted.
  window.setTimeout(() => {
    const boot = document.getElementById('boot-loader');
    if (!boot) return;
    boot.classList.add('is-done');
    window.setTimeout(() => boot.remove(), 300);
  }, 0);
});

// Remove any previously-installed service worker (the /sw.js kill-switch clears
// caches + unregisters) so users always get the latest deploy — no stale cache.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((r) => r.update().catch(() => {})))
    .catch(() => {});
}
