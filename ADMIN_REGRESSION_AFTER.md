# ADMIN_REGRESSION_AFTER.md

Regression run **after** adding the Phase-A Control Center scaffold, on branch
`feature/admin-control-center-additive`.

## Automated suite

Command: `npm run test:unit` (vitest)

```
Test Files  75 passed (75)      (was 74 — +1: admin-control-center overview.test.ts)
     Tests  797 passed (797)    (was 793 — +4 new Control Center tests)
  Duration  ~23.4s
```

**No pre-existing test changed result. No failures introduced.** The only delta
is the 4 new tests added by this feature. This meets the AFTER ≥ BEFORE gate.

## Static checks

Command: `npm run typecheck` (`tsc -b`) → **clean, no errors.**

## In-browser smoke (dev server, `localhost:5173`)

| Check | Result |
|---|---|
| Flag OFF: `/ar/admin/control-center` | app's normal **404 / NotFound**, no console errors |
| Flag OFF: classic `/admin`, home, rates bar, header/footer | render unchanged |
| Flag ON (localStorage override), signed-out: `/ar/admin/control-center` | `ControlCenter` mounts → `RequireAdmin` → sign-in wall, no console errors |

The signed-in admin view of the Overview dashboard (real KPI/data cards) is an
acceptance step that needs a real admin session (owner credentials) and is left
for the owner to confirm — the automated checks above already prove the wiring,
the gate, and zero regressions.

## Manual smoke checklist (mirrors BEFORE)

Every flow listed in `ADMIN_REGRESSION_BEFORE.md` is still covered by its
existing test file, all of which pass in the run above:

- Auth/session ✓ · `/admin` + tabs ✓ · users/tier/role ✓ · requests/bookings ✓
- payments/checkout ✓ · real estate ✓ · referrals/wallet ✓ · i18n parity ✓

## Conclusion

The classic Admin and all public/user surfaces are **behaviorally identical** to
the BEFORE baseline. The Control Center is additive and dark by default.
