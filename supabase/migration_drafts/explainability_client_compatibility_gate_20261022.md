# Explainability client compatibility — rollout blocker (2026-10-22)

Status: **NO-GO**. Review only. No cloud changes.

## Verified call sites (branch audit/supabase-public-grants-20261021)

- `programDeliveryService.getProgramExplainability`: calls `get_program_explainability` only when client `canExplain` is true. Proposed server RPC adds independent capability + ownership checks.
- `programDeliveryService.pauseProgram`: updates program status, inserts `program_guard_events`, then **directly inserts** `program_explainability`. Existing `public_api_privileges_hardening_review_20261021.sql` revokes client INSERT. Applying this draft alone would cause a silent evidence-write failure: current code does not inspect the insert error.
- `programDeliveryService.submitFeedback`: directly inserts `program_feedback` and calls adaptation. Client tier check is not server authorization. Separate `can_adapt` enforcement and feedback write contract required.
- `getMyPlanDTO` exposes `day.explainability_summary` from `getProgramDays`: must verify whether summary is sensitive Premium data and gate at the server source.

## Required before rollout

1. Replace client-origin explainability INSERT with an **atomic trusted server pause command** that verifies JWT identity, program ownership and allowed transition, persists status + guard event + explainability evidence in one transaction, and returns an idempotent receipt. Do not trust client-supplied program_type, reason or knowledge refs without validation.
2. Preserve user-facing pause for Free: `can_explain` gates reading detailed Premium evidence, **not** the ability to pause or record safety/audit evidence.
3. Route the client to the new command only after its server implementation and disposable Auth/PostgREST acceptance are ready. Deploy coordinated server/client changes; do not revoke old INSERT ahead of the compatible client.
4. Audit all `program_explainability` writes and alternate readers (views/RPCs), then test Free/Premium/other-user/anonymous access, pause and retry.
5. Audit `program_feedback` write privileges, `can_adapt` and adaptation execution separately.

## Deployment guard

Do not merge/deploy the review SQL or client changes based on green CI alone. This report documents a functional incompatibility; no server writer is implemented here.

## 2026-10-22 implementation progress

- Added `program_pause_atomic_review_20261022.sql`: owner-scoped, row-locked, transactional pause RPC draft. Production schema columns were inspected read-only.
- This SQL is **not included** in disposable replay, has **no passing integration acceptance**, and the client still calls direct INSERT. **NO-GO remains**.
- Next: extend disposable fixture with real pause schema, replay the exact draft SQL, test own/foreign/anonymous/concurrent/retry and failed-write rollback, then coordinate client migration and removal of direct INSERT.

## Verified implementation and residual compatibility audit — 2026-10-22

- **Implemented in this Draft PR (not deployed):** `pauseProgram` now invokes `pause_program_atomic`; the former direct client INSERT into `program_explainability` has been removed. Exact SQL review draft is replayed in disposable local Supabase. The 3/3 GitHub Actions checks passed at `e69d84c`, including foreign/anonymous denial, retry idempotency, concurrent pause and forced transactional rollback. These results supersede the outdated implementation-progress paragraph above.
- **Additional call sites found by direct source review:** `startDay` and `completeDay` update `program_sessions` directly; `completeDay` also upserts `ai_trust_scores` and updates program status to active; `skipDay` updates `program_sessions`, upserts trust scores and invokes adaptation; `resumeProgram` directly updates program status to active. Several of these writes do not inspect Supabase errors. None is covered by the atomic pause RPC acceptance.
- **Security/consistency implications:** `resumeProgram` and `completeDay` can bypass the new pause transition command by writing `active` directly; `skipDay` can request adaptation independently of the feedback tier check; `submitFeedback` checks a client-resolved tier, but the server-side `can_adapt` authority and direct `program_feedback` INSERT privileges still require verification. These are potential bypasses/partial-write paths, not proven exploits.
- **Data exposure still unverified:** `getMyPlanDTO` forwards `day.explainability_summary` returned by `get_program_days` without a `can_explain` check. The actual production RPC implementation and server-side redaction must be inspected before any conclusion about exposure.
- **Deployment dependency:** The client now requires `pause_program_atomic`, which is absent from the deployed environment until a separately authorized server rollout. **Never ship this client change ahead of its RPC.** Server grants/revokes and client deployment need a coordinated compatibility gate.
- **Remaining NO-GO requirements:** inventory server/edge/SQL writers and direct-table readers, review actual production schemas and function bodies read-only, design trusted server commands for resume/day lifecycle/feedback/adaptation, prove `can_adapt` enforcement and summary redaction, and prepare a versioned rollout/rollback plan. Green disposable CI is necessary but insufficient for cloud deployment.

## Production read-only RPC inspection — 2026-10-22

Catalog introspection (no cloud mutation) confirms:
- `get_program_days(uuid)` is **SECURITY INVOKER** and directly SELECTs `program_explainability` in `latest_explain`, then returns `decision_ref` and `guard_notes.reason_code` as `explainability_summary`. It contains **no explicit can_explain entitlement check**. Thus the summary is a real alternate reader and potential Free-tier exposure, subject to current table RLS/grants.
- `get_program_day_details(uuid,date)` is **SECURITY INVOKER** and returns full `program_explainability` rows under `explainability`, with **no explicit can_explain check**. This is a more serious alternate read path.
- Proposed direct SELECT revocation on `program_explainability` may cause both RPCs to fail for ordinary users because they run as invoker. They must be redesigned with ownership and capability-aware server-side output, preserving non-Premium day data, before revocation.
- `get_program_status(uuid)` is SECURITY INVOKER and references `program_guard_events` for blocked state. Verify its existing grants/RLS and compatibility when changing guard-event permissions.
- `get_active_program(text)` filters by `auth.uid()` and is SECURITY INVOKER; it does not itself expose explainability.

**Confirmed rollout blocker:** server-side redaction and compatibility of both day RPCs are required, not merely client gating. Do not deploy the current grants draft or client before these are resolved.
