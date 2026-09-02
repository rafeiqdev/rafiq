import React from 'react';
import ReactDOM from 'react-dom/client';
import { i18nReady, langFromPath, resolveInitialLang } from './i18n';
import './index.css';
import App from './App';

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
