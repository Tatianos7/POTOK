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

## Verified adaptation and lifecycle authority audit — 2026-10-22

Production read-only catalog introspection shows `program_feedback`, `program_sessions` and `ai_trust_scores` currently grant INSERT/UPDATE/DELETE (and other table privileges) to `anon` and `authenticated`. Grants alone do not establish exploitability; effective RLS and RPC policies still require review. The client currently relies on a local tier check in `submitFeedback`, but a client-side tier check cannot enforce `can_adapt` for direct PostgREST requests. `skipDay` invokes `adaptProgram` without the same tier check. `resumeProgram` and `completeDay` write `active` directly, and trust-score upserts ignore errors. Production `program_sessions` requires `session_type` and has `day_date` in addition to `date`; disposable fixtures do not yet mirror those constraints.

**Rollout decision: NO-GO.** Before removing direct writes, inventory the actual server adaptation endpoint and other consumers, then implement trusted server-side `can_adapt` authorization and transactional lifecycle commands. Preserve Free day completion and skip recording where appropriate, without silently granting paid adaptation. Add disposable RLS/permission tests for Free, Premium, foreign users, anonymous callers, and concurrency/rollback. Do not equate an entitlement row with a trusted subscription grant until the entitlement writer and policy are verified.

### Production RLS findings (read-only)
- `program_feedback_owner` limits records to owned nutrition/training programs but has **no can_adapt gate**. A Free owner can potentially write feedback directly if authenticated and permitted by other constraints.
- `program_sessions_owner` likewise limits ownership only; clients can directly change their own session status.
- `ai_trust_scores_modify_own` permits all actions on the caller's own score; thus the trust score is client-writable and must **not be treated as server-authoritative** until migrated to trusted writers.
- `entitlements_owner` is a FOR ALL policy permitting a user to write their own entitlement row, conditional on table grants. This makes any direct `entitlements.flags.can_adapt` authorization unsafe until the entitlement table's effective grants and all SECURITY DEFINER writers are hardened and tested.
- `nutrition_programs_owner` and `training_programs_owner` also allow all actions for the owner, enabling direct status updates when grants allow.
- No cross-account access was proven by these policies; ownership isolation is present. The risk is **self-service privilege escalation and bypass of protected transitions**, not necessarily access to other users.

## Confirmed critical entitlement escalation precondition — production read-only, 2026-10-22

`has_table_privilege('authenticated', 'public.entitlements', 'INSERT'/'UPDATE'/'DELETE')` returned **true for all three**, and `entitlements_owner` is a permissive `FOR ALL` owner policy. An authenticated user can therefore potentially self-assign `flags.can_adapt` and `flags.can_explain` on their own row via the Data API, defeating a capability check that merely reads `entitlements.flags`. This is a confirmed authorization-design defect (no exploit request was sent; no cloud data modified).

**Priority order:** (1) revoke client INSERT/UPDATE/DELETE on `entitlements` with a tested server-owned grant/revoke writer, (2) verify service_role-only entitlement issuance/revocation and every existing caller, (3) make adaptation execution enforce server-resolved `can_adapt` and program ownership, (4) remove direct client feedback/status/trust-score authority only after compatible transactional RPCs exist. The existing draft `public_api_privileges_hardening_review_20261021.sql` already proposes entitlement write revocation; do not duplicate a conflicting migration. The green local CI is not a production authorization proof.

## Trusted purchase/entitlement writer inventory — production read-only, 2026-10-22

Verified actual production `pg_get_functiondef`:
- `get_entitlements(p_user_id uuid)`: SECURITY DEFINER owned by `postgres`; accepts arbitrary `p_user_id` and returns that account's tier/flags. Review patch restricts caller to own account.
- `start_purchase(p_user_id uuid,p_provider text,p_plan text,p_idempotency_key text)`: SECURITY DEFINER, inserts `billing_events` with `event_type='purchase_started'`, returns `status='started'`. **No receipt verification and no entitlement grant**.
- `restore_purchase(p_user_id uuid,p_provider text,p_receipt text,p_idempotency_key text)`: SECURITY DEFINER, inserts `billing_events` with `event_type='restore'`, returns `status='restored'`. **No receipt verification and no entitlement grant**. `restored` is not proof of a verified purchase.
- No other public function with a name matching entitlement/premium/purchase/restore/subscription was found in this name-based inventory. This is not a complete inventory of Edge Functions, triggers, external writers or functions with unrelated names.

**Blocking requirement:** determine the actual trusted grant/revoke authority (including service role, triggers, Edge Functions, admin flows) and verify provider receipts and revocation semantics before enabling server adaptation. The already-proposed service_role-only execute restriction on purchase RPCs may break existing purchase UI until a compatible trusted gateway is provided. Keep Draft PR review-only and do not deploy.

## Adaptation implementation audit — 2026-10-22

Source review of `src/services/programGenerationService.ts` confirms `adaptProgram` calls `entitlementService.canAdaptProgram(sessionUserId)`, which calls client-accessible `get_entitlements` and reads `flags.can_adapt`. It does **not** run adaptation in a trusted server transaction. The client then reads the program by ID without an explicit `user_id=sessionUserId` predicate (RLS is the current ownership barrier) and writes session statuses, guard events, program versions, explainability, hierarchy and program status through multiple independent PostgREST calls. Partial failures can leave inconsistent state. This is **not** made server-authoritative merely by the initial capability check.

`skipDay` and `submitFeedback` both invoke that client-side adaptation. Consequently, the correct next implementation is a server-owned adaptation command (including ownership, trusted capability, locking, idempotency, atomic commit, and explicit Free behavior), not simply adding another frontend `can_adapt` check. The current grant-hardening draft revokes direct explainability writes, so the existing client adaptation path would break if deployed alone.

No changes to cloud databases were made. This is a deployment blocker until the trusted writer, exact schema-parity fixture, and integration tests are implemented.
