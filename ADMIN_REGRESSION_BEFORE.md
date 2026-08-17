# ADMIN_REGRESSION_BEFORE.md

Baseline captured **before** any Control Center code was added, on branch
`feature/admin-control-center-additive` (created from `main`).

## Automated suite

Command: `npm run test:unit` (vitest)

```
Test Files  74 passed (74)
     Tests  793 passed (793)
  Duration  ~23.5s
```

Result: **ALL GREEN.** This is the floor — the "after" run must match or exceed
it (no failures introduced, same or higher pass count).

Note: `test:all` also runs `test:legacy-server` (`node --test server/test.mjs`)
against the legacy Express dev server. The Control Center does not touch
`server/`, so that suite is unaffected; the unit suite above is the relevant
regression gate for this frontend/DB-additive work.

## Manual smoke checklist (to repeat identically in AFTER)

These are the flows the brief lists as must-not-break. They are exercised by the
existing unit/integration tests (see the files below) and are to be re-confirmed
after the change:

| Flow | Covered by (existing tests) |
|---|---|
| Sign in / sign out / session | `src/context/AppContext.test.ts`, `src/lib/authProfileMissing.test.ts` |
| `/admin` opens, tabs switch via `?tab=` | `src/components/AdminNewRequests.test.tsx`, `src/components/AdminServicesManager.test.tsx`, `src/components/AdminListsFailLoud.test.tsx` |
| Users list + tier/role | `src/lib/adminCounts.test.ts`, `src/lib/adminRequestOwner.test.ts` |
| Requests / bookings | `src/components/ServiceRequestModal.test.tsx`, `src/lib/customerRequestsQuery.test.ts`, `src/lib/bookingSummary.test.ts` |
| Payments / checkout | `src/lib/checkoutConfig.test.ts`, `src/lib/checkoutSettings.test.ts`, `src/lib/checkoutValidation` |
| Real estate / listings | `src/lib/listingText.test.ts` |
| Referrals / wallet | `src/pages/Referrals.test.tsx`, `src/pages/Wallet.test.tsx` |
| Public pages / i18n parity | `src/i18n/locales.test.ts`, `src/i18n/index.test.ts` |

## Static checks

- `npm run typecheck` (`tsc -b`) — run in AFTER and compared. (Baseline: the
  repo builds; existing typecheck is expected clean.)
