# ADMIN_BACKWARD_COMPATIBILITY.md

How the Admin Control Center is added **without changing the old system**, and
how to switch it off / roll it back instantly.

- **Branch:** `feature/admin-control-center-additive`
- **Kill-switch:** `VITE_ADMIN_CONTROL_CENTER_ENABLED="false"` (build-time) or
  `localStorage.rafiq_cc_enabled="false"` (per-browser). **Default: ON** — the
  owner asked for the surface to be visible, so the flag is now an off-switch
  rather than an opt-in.

---

## 1. The kill-switch, proven

With the flag switched **off** (`="false"`):

- The `/admin/control-center` route is **never registered** in the router
  (`App.tsx` wraps it in `{isControlCenterEnabled() && <Route .../>}`), so the
  URL falls through to the existing `*` → NotFound route.
- The discovery link in the classic Admin sidebar is **not rendered**.
- Nothing else in the app references the module at runtime (the component is a
  lazy import — its chunk isn't even downloaded).

Verified in-browser on the dev server:

| Flag | `/ar/admin/control-center` renders | Console |
|---|---|---|
| OFF | app's normal **404 / NotFound** | no errors |
| ON (default), signed-out | `ControlCenter` mounts → `RequireAdmin` → sign-in wall | no errors |

So "flag off ⇒ site + classic Admin behave exactly as before" is not a claim,
it's observed behavior — and it stays one command away at any time.

---

## 2. New files (added — safe by construction)

All new code lives in one isolated module, `src/admin-control-center/`:

```
src/admin-control-center/
  flag.ts                     feature flag (env + localStorage), default off
  i18n.ts                     module-local ar/en dictionary (+ RTL) — no shared locale files touched
  sections.ts                 section registry (only `overview` implemented)
  ControlCenter.tsx           entry: RequireAdmin gate + ?section= routing
  components/
    CCShell.tsx               header + internal sidebar + breadcrumb + back-to-Admin
    CCState.tsx               loading / error / empty wrapper (error ≠ empty)
  pages/
    Overview.tsx              REAL data, read-only, per-card loading/error/empty
    Placeholder.tsx           honest "in progress" for reserved sections (no mock data)
  api/
    overview.ts               read-only service layer (delegates to lib/api.ts)
    overview.test.ts          unit tests for the null-safe KPI rollup
```

Plus documentation at repo root (the `ADMIN_*.md` / `DATABASE_*.md` set) and
`.claude/launch.json` (local dev-server preview config, not shipped).

## 3. Existing files touched (minimal, additive-only)

| File | Change | Why it's safe |
|---|---|---|
| `src/App.tsx` | +1 import, +1 lazy import, +1 **conditional** route after `/admin/medical` | Route only exists when flag on; nothing existing reordered or removed |
| `src/pages/Admin.tsx` | +1 import, +1 **conditional** sidebar link appended after the medical link | Rendered only when flag on; appended last, no existing entry moved/restyled |
| `.env.example` | +1 documented var (`VITE_ADMIN_CONTROL_CENTER_ENABLED`) | Required by the env-parity test; empty = on, `"false"` = kill-switch |

No existing component, table, column, RPC, RLS policy, route path, permission,
or copy string was modified, renamed, or removed.

## 4. Isolation rules honored

- New components live only under `src/admin-control-center/`.
- New data reads go through a dedicated read-only service layer
  (`admin-control-center/api/`) that **delegates to existing** `lib/api.ts`
  functions — it introduces no parallel query for data that already has one, so
  numbers can't silently diverge.
- The Control Center never calls a classic-Admin mutation or alters its state.
- Control Center strings are module-local (Arabic + English), so the four shared
  `src/i18n/locales/*.json` files — and their parity test — are untouched.

## 5. How to disable / roll back

- **Disable (needs a redeploy):** set `VITE_ADMIN_CONTROL_CENTER_ENABLED="false"`
  in the Vercel environment. The surface vanishes; classic Admin is unchanged.
- **Disable instantly for one browser (no deploy):**
  `localStorage.setItem('rafiq_cc_enabled','false')`.
- **Full rollback:** the whole feature is on its own branch and the only edits to
  existing files are 3 small additive hunks. `git checkout main` (or revert those
  three hunks) removes every trace. No database change is required to roll back —
  Phase A adds **no** DB objects (it only reads existing tables). Phase B/C DB
  objects are all `cc_*`-namespaced and `DROP`-able independently (see
  `DATABASE_ADDITIVE_MIGRATIONS.md`).
