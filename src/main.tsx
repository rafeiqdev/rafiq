import React from 'react';
import ReactDOM from 'react-dom/client';
import { i18nReady } from './i18n';
import './index.css';
import App from './App';

// Locale bundles are async chunks now; wait for the initial language so the
// first paint is never a screen of raw translation keys. i18nReady resolves
// even when the fetch fails, so this cannot dead-end the app.
i18nReady.then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});

// Remove any previously-installed service worker (the /sw.js kill-switch clears
// caches + unregisters) so users always get the latest deploy — no stale cache.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((r) => r.update().catch(() => {})))
    .catch(() => {});
}
