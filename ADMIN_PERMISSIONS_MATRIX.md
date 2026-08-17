# ADMIN_PERMISSIONS_MATRIX.md

Granular permission design for the Control Center. **Additive over the existing
role system** — it never replaces `isAdmin` / `role` and never silently narrows
any current admin's capability.

---

## 1. Today (unchanged)

`profiles.role ∈ {user, admin, company, medical_coordinator}`. Admin access is a
single boolean (`is_admin()` in DB, `user.isAdmin` in the client). Medical has
its own coordinator role. There is **no granular permission system** yet.

## 2. Compatibility rule (the safety net)

- Existing behavior is untouched: `/admin`, `/admin/medical`, and every RPC keep
  their current `is_admin()` / role checks.
- The Control Center adds a permission layer **on top**. Until the (additive)
  permission tables exist and are populated, the resolver **falls back to: any
  `is_admin()` user has every Control Center permission.** So no admin loses
  access, and no sensitive capability is auto-granted to a *new* role that hasn't
  been explicitly assigned.
- New sensitive capabilities (reveal document, refund, approve commission,
  publish content, change role/tier) are **never** enabled purely by the fallback
  in Phase C — they require an explicit permission record once the layer is live.

## 3. Permission keys (Phase B introduces these, additively)

```
control_center.view
analytics.view            analytics.export
operations.view           operations.edit
crm.view                  crm.edit
notifications.view        notifications.send_test    notifications.publish
users.view                users.edit_role            users.edit_tier
payments.view             payments.verify            payments.refund
documents.view_metadata   documents.reveal           documents.download
content.view              content.edit               content.publish
real_estate.view          real_estate.edit
medical.view              medical.edit               medical.view_sensitive
referrals.view            referrals.approve_commission
system_health.view        audit.view
```

## 4. Default roles (Phase B — presets, not hard-coded gates)

| Role | Gets (summary) |
|---|---|
| `super_admin` | everything (maps to today's admin) |
| `operations_manager` | operations.*, crm.*, users.view, analytics.view |
| `finance_manager` | payments.*, referrals.approve_commission, analytics.view |
| `content_manager` | content.*, analytics.view |
| `real_estate_manager` | real_estate.*, analytics.view |
| `medical_coordinator` | medical.view/edit (+ medical.view_sensitive by explicit grant) |
| `support_agent` | operations.view, crm.edit, documents.view_metadata (NO refund, NO reveal) |
| `analyst_readonly` | analytics.view/export, *.view (NO edit, NO reveal, NO refund) |

## 5. Matrix (X = allowed)

| Capability | super | ops | finance | content | realestate | medical | support | analyst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| control_center.view | X | X | X | X | X | X | X | X |
| analytics.view | X | X | X | X | X | X | · | X |
| analytics.export | X | X | X | · | · | · | · | X |
| operations.view / edit | X | X | · | · | · | · | view | · |
| crm.view / edit | X | X | · | · | · | · | X | view |
| payments.view | X | · | X | · | · | · | · | view |
| payments.verify | X | · | X | · | · | · | · | · |
| payments.refund | X | · | X | · | · | · | · | · |
| documents.view_metadata | X | X | · | · | · | X | X | · |
| documents.reveal / download | X | · | · | · | · | grant | · | · |
| content.view / edit / publish | X | · | · | X | · | · | · | view |
| real_estate.view / edit | X | · | · | · | X | · | · | view |
| medical.view / edit | X | · | · | · | · | X | · | · |
| medical.view_sensitive | X | · | · | · | · | grant | · | · |
| referrals.view | X | X | X | · | · | · | · | X |
| referrals.approve_commission | X | · | X | · | · | · | · | · |
| users.edit_role / edit_tier | X | · | · | · | · | · | · | · |
| system_health.view | X | X | X | · | · | · | · | X |
| audit.view | X | X | X | · | · | · | · | X |

(`grant` = only by explicit per-user grant, never by role default.)

## 6. Enforcement (defense in depth)

- **UI:** hides/disables controls the caller lacks — convenience only, never the
  security boundary.
- **DB (the real boundary):** every new `cc_*` RPC/view checks `is_admin()` (Phase
  A) and, once live, the permission record (Phase B/C) — plus ownership where
  relevant. New tables get their own RLS policies; nothing relaxes an existing one.
- **Audit:** every sensitive action (reveal, download, export, verify, reject,
  refund, role/tier change, publish, permission change) writes to
  `admin_audit_log` via the existing `admin_audit_log_write()` (or a new
  `cc_audit_write` mirror), with actor stamped server-side.

## 7. Phase A status

Phase A ships **read-only** and uses the **existing `is_admin()` gate only** (via
`RequireAdmin` + RLS). The granular tables/resolver above are designed and
documented here but **not yet created** — so no existing permission is changed.
