# POTOK public program write-path audit — 2026-10-22

Status: PARTIAL / BLOCKED on exhaustive GitHub client-writer enumeration. Read-only inspection of production catalog; no data mutations.

## Confirmed production schema
- `nutrition_programs`: owner, goal_id, status, program_version, knowledge_version_ref.
- `program_days`: block_id, date, targets JSONB, session_plan JSONB.
- `program_sessions`: program_id, date, day_date, plan_payload JSONB, status.
- `program_versions`: program_id, program_type, version, snapshot JSONB, reason.
- `program_adaptations`: from_version, to_version, trigger, summary JSONB.
- `program_explainability`: version, decision_ref, knowledge_refs, guard_notes.
- `food_diary_entries`: owner, date, meal, nutrition snapshot and canonical food reference.
- `user_goals`: mutable owner goals/macros.
- `entitlements`: tier and flags JSONB.

## Verified access findings
- All above tables have RLS enabled.
- `entitlements`, `nutrition_programs`, `program_days`, `program_sessions`, `program_versions`, `program_adaptations`, `program_explainability`: `anon` and `authenticated` have INSERT/UPDATE/DELETE grants.
- Owner RLS policies for these tables use `FOR ALL` with owner-based checks. This restricts cross-owner access but does not enforce immutable server-owned versions, receipts, or entitlements for an authenticated owner.
- `food_diary_entries` grants authenticated INSERT/UPDATE/DELETE with owner-specific RLS; retain authorized user FACT editing workflows independently from Premium plan authority.
- `user_goals` grants authenticated INSERT/UPDATE with owner-specific RLS; adaptation must not silently update goals.
- A trigger `nutrition_programs_updated_at` calls `update_programs_updated_at`. No other user-defined trigger was returned for the audited table set.
- Public RPCs matching program/entitlement names are mainly readers (`get_active_program`, `get_program_days`, `get_program_day_details`, `get_program_status`, `get_program_explainability`, `get_program_phases`). `get_entitlements` is SECURITY DEFINER; audit EXECUTE grants and body before relying on it.

## Critical consistency gap
- `program_days.targets`/`session_plan` and `program_sessions.plan_payload` can be independently writable. The experimental `adapt_nutrition_program_atomic_v1` only updates `program_days.targets`, so it does not establish an authoritative, consistent PLAN representation.
- `program_versions.snapshot` exists but mutable table grants/policies do not enforce append-only semantics.
- Production catalog does not by itself prove where application code writes, or that a particular client path is active.

## Not yet verified — rollout blockers
1. Exhaustive GitHub search across actual branch for `from(...).insert/update/upsert/delete`, RPC and service-role writers, including Today, Free diary, Premium generation and admin flows. Connector code search returned zero results for exact table identifiers; this is **not evidence of zero writers**.
2. Source-of-truth and owner mapping for weekly execution instances, recipe/meal plan slots, FACT snapshots, receipt/outbox storage, and server gateways.
3. RLS + EXECUTE audit of SECURITY DEFINER `get_entitlements` and other privileged RPCs; explicit authenticated/anonymous PostgREST integration tests.
4. Compatibility matrix and rollback for removal of direct table writes, including Free FACT after Premium expiry.
5. Confirm whether existing architectural contracts in earlier PRs already specify exact writer ownership before introducing parallel schema.

## Decision
**NO-GO for cloud GRANT/RLS changes or nutrition replan deployment.** Continue read-only code-path inventory, then draft compatibility tests and staged server-owned write migrations. Preserve approved PLAN != FACT architecture. No production/staging/master modifications.

## GitHub Actions scanner evidence (run 39798556374, artifact 12433609457)
- Scanner succeeded: 137 files with table references, 210 candidate-write references. These are proximity matches, not 210 proven writes; includes compiled Android assets, SQL drafts, fixtures and tests.
- Confirmed production-source client writes:
  - `src/services/goalService.ts:270-274`: direct `user_goals.upsert` — preserve user-controlled GOAL workflow.
  - `src/services/mealService.ts:294-300,338-343,408-413,815-816,948-971,1213-1214,1269-1270,1367+`: direct diary INSERT/UPDATE/DELETE/UPSERT and bulk replacement. **High compatibility sensitivity:** avoid blanket removal of diary grants; check snapshot-first and idempotency on all paths.
  - `src/services/programGenerationService.ts:229-293`: direct phase/block/day/session INSERT and session UPDATE.
  - `src/services/programGenerationService.ts:353-474`: generation job INSERT/UPDATE, program INSERT, version and explainability INSERT.
  - `src/services/programGenerationService.ts:495-542,642-736,780-860`: program adaptation writes across sessions, guards, phases/days, version, adaptation, explainability and program status. Multiple client requests without demonstrated encompassing DB transaction; partial writes possible.
  - `src/services/programDeliveryService.ts:171-251`: direct session status and payload UPDATE, trust-score UPSERT, program status UPDATE; pause calls `pause_program_atomic` RPC.
  - `src/services/programDeliveryService.ts:261+`: feedback INSERT.
- **Critical confirmed client-side contract conflict:** `programGenerationService.ts:759-766` calculates nutrition adjustment factors (including 0.9 on adherence drop and DELOAD_FACTOR) without a separate explicit user-acceptance step visible in this code. This conflicts with the agreed propose/accept Premium adaptation contract. Do not ship this as approved Premium nutrition logic.
- **Potential data loss:** `programDeliveryService.ts:212-213` updates `program_sessions.plan_payload` to `{reason}` when skipping, rather than preserving the original plan payload. Treat as plan snapshot destruction until tests prove otherwise.
- **Potential cross-write inconsistency:** program generation and adaptation mutate multiple tables sequentially; no single server-side atomic transaction is visible across the shown operations.
- `programDeliveryService.ts` read RPCs are not writes; separate them from writes in remediation.
- This is a targeted confirmed source-level classification, not an exhaustive manual review of every one of 210 candidates.

## Next implementation boundary
1. Keep current user-authorized diary/goal writes working while auditing every diary path for snapshot-first and idempotency.
2. Introduce server-owned generation/adaptation/delivery commands with explicit authorization, CAS, receipts, UNKNOWN lookup and atomic PLAN revisions; migrate callers before revoking table DML.
3. Prevent session status updates from overwriting PLAN payload; distinguish execution FACT/status from immutable PLAN.
4. Add compatibility tests for Free FACT after Premium expiry, concurrent acceptance, duplicate requests, blocked entitlements, historical immutability, and mid-transaction failure.
5. Re-run inventory excluding `android/app/src/main/assets`, SQL drafts and tests for a precise runtime-source matrix. Do not treat this initial scanner as a security proof.

## Runtime-only inventory — confirmed 2026-10-22
GitHub Actions run `39800894003` completed SUCCESS, artifact `12434539206`.
Source-only scan: **15 files containing target-table references, 51 proximity-classified candidate write references across five files**: `aiTrustService.ts`, `goalService.ts`, `mealService.ts`, `programDeliveryService.ts`, `programGenerationService.ts`. These counts are scanner output, not a count of independently proven mutations. The scanner only covers its named tables and `src`, so absence of another writer is not proven.

### Verified compatibility matrix
| Service | Direct mutation | Classification | Required treatment |
|---|---|---|---|
| `goalService.ts:270` | `user_goals.upsert` | User-controlled GOAL | Preserve existing goal editing; no automatic adaptation writes |
| `mealService.ts:294,338,408,815,948,959,970,1213,1269,1367` | Diary insert/update/delete/upsert | User FACT, Free-critical | Preserve functional access; independently test canonical snapshots, idempotency, history |
| `aiTrustService.ts:48` | `ai_trust_scores.upsert` | Server-authoritative derived trust | Move to validated server action; no client-authoritative trust score |
| `programGenerationService.ts:229-293,353-474,495-542,642-860` | Phase/block/day/session/program/version/guard/adaptation/explainability writes | Server-authoritative PLAN | Replace multi-request writes with atomic server transaction and immutable revision receipts |
| `programDeliveryService.ts:171-261` | Session status/payload, program status, trust score, feedback writes | Mixed execution FACT + authority | Split explicit user feedback from server-owned state transitions; preserve PLAN payload |
| `programDeliveryService.ts:84-161,239` | Read RPCs; pause RPC | RPC (not direct table write) | Audit function EXECUTE/ownership and result behavior separately |

### Blocking defects and rollout gates
1. `programDeliveryService.ts:212` replaces `plan_payload` with `{reason}` on skip: potential irreversible PLAN loss. Fix with server-side FACT/status action preserving immutable PLAN; do not simply patch a mutable snapshot and call it immutable.
2. `programGenerationService.ts:759-767` has direct nutrition adjustment factors. Must not execute as an approved Premium automatic plan change before explicit acceptance.
3. Client-side `ai_trust_scores.upsert` can be authority spoofing if grants/RLS permit; confirm grants and remove client authority only after server replacement.
4. Generation/adaptation across tables are not atomic as currently written. Need durable idempotency receipt, compare-and-swap, bounded UNKNOWN recovery and append-only revision.
5. DO NOT revoke authenticated table DML yet: existing client writers would fail. DO NOT enable proposed SQL drafts in production or staging.

### Implementation order
A. Introduce a **read-only compatibility guard** that fails CI when new direct writes to server-authoritative tables appear outside the existing legacy writer allowlist. Existing legacy writes are debt, not approval.
B. Design and implement the atomic server command boundary using existing reviewed contracts, with disposable-DB integration tests and a feature-flagged caller transition.
C. Only after green tests and owner rollout approval, restrict public DML and switch client writers; preserve Free FACT and user GOAL.
