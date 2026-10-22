# Premium server-command implementation gate — 2026-10-22

Status: IMPLEMENTATION PREPARATION / NO-GO CLOUD. Scope: Draft PR #184 only.

## Verified starting point
- All four CI checks passed at commit `78d67afd27c813127c382129746a7271be085226`.
- Runtime scan reports 51 candidate references across five services; confirmed legacy direct writers include program generation, delivery, AI trust, diary and goals.
- `docs/premium/nutrition-plan-fact-adaptation-contract-v1-review.md` is PROPOSED, not approved.
- Existing SQL drafts `advance_program_adaptation_atomic` and `adapt_nutrition_program_atomic_v1` are review-only and must not be deployed as production implementation. The latter mutates future `program_days.targets` in place, leaves `program_sessions.plan_payload` unreconciled, reads live mutable goals and applies an unapproved 0.8 nutrition factor.

## Implementable sequence (no implicit owner-policy choices)
1. Create server-only, authenticated command DTO for generation and lifecycle with trusted entitlement, ownership, immutable request digest, expected revision, stable intent ID and typed errors. Do not use caller-provided trust score, nutrition targets or entitlement flags as authority.
2. Add disposable-only storage for intent receipts and immutable plan revision/slot history, based on verified real DDL. Do not mutate existing history as a shortcut.
3. Implement atomic generation and state transitions with one transaction each; CAS, replay and UNKNOWN receipt lookup. Separate user FACT from server-owned PLAN.
4. Implement **proposal only** for nutrition adaptation. Acceptance and nutrition-target mutation remain blocked pending explicit owner-approved nutrition bounds, freshness and acceptance UX policy.
5. Add local Auth/PostgREST tests: cross-user/anonymous denial; entitlement spoofing; same-key replay and mismatched payload; concurrent CAS; transaction failure rollback; plan payload preservation on skip; completed/skipped/consumed FACT immutability; Premium expiry preserving Free diary FACT.
6. Introduce feature-flagged client migration. Old client DML and new server commands cannot both be writable during cutover; prove schema parity and rollback before any grants revoke.

## API boundary (proposal, not deployed)
- `request_program_generation_v1`: user/program type, intent id, expected goal revision, allowed user preferences; no client-supplied authority.
- `set_program_execution_status_v1`: session id, intended FACT action, intent id, expected revision; immutable PLAN never overwritten.
- `propose_nutrition_plan_adaptation_v1`: per approved design document; read-only recommendation with receipt, no PLAN/FACT mutation.
- `accept_nutrition_plan_adaptation_v1`: BLOCKED pending owner policy and schema-backed implementation.

## Stop conditions
- Missing immutable week execution source of truth or receipts => stop, don't invent a parallel store.
- Mutable `entitlements` or client trust score still accepted as authority => stop.
- No atomic transaction or tested receipt replay => stop.
- Dual `program_days.targets` / `program_sessions.plan_payload` conflict => stop.
- New SQL must remain draft-only and must not apply to production/staging.

## Next concrete engineering deliverable
A verified schema dependency map (tables, FK, existing RPCs, authority and grants) plus disposable test fixtures for the first **non-nutrition-mutating** server transition. Then implement and run it before client cutover.

## Live read-only schema verification (POTOK production, 2026-10-22)
Queried `information_schema.columns` and `information_schema.table_constraints` without modifying any data.

- `program_sessions`: `id`, `program_id`, `date`, `session_type`, `plan_payload` (nullable JSONB), `status`, `created_at`, `day_date`. PK `id`; check constraints on `session_type` and `status`. **No foreign key from `program_sessions.program_id` to either program table appears in the inspected constraints.** Ownership must be checked explicitly against the correct program type, not assumed via FK.
- `program_days`: `id`, `block_id` FK to `program_blocks.id`, `date`, `targets`, `session_plan`, `constraints_applied`, `created_at`. No direct program_id. Ownership joins must traverse block → phase → program.
- `program_versions`: `id`, `program_id`, `program_type`, `version`, `snapshot` (non-null JSONB), `reason`, `created_at`. Inspected constraints show PK and program_type check, but **no FK or unique constraint on (program_id,program_type,version)**. CAS and append-only correctness require an explicit verified uniqueness/locking strategy.
- `nutrition_programs` and `training_programs`: both have `id`, `user_id`, `status`, `program_version`, `knowledge_version_ref`; `goal_id` references `user_goals.user_id`.
- `entitlements`: `id`, `user_id`, `tier`, `flags`, `updated_at`. Prior audit found client-facing DML grants, so its tier/flags cannot currently serve as trusted authorization until authority hardening is proven.
- `program_feedback` stores execution feedback, while `program_explainability` stores decision metadata. These are not substitutes for immutable execution receipts.

### Immediate engineering blockers
1. Establish program ownership for `program_sessions` across both program types and prove no cross-type UUID ambiguity.
2. Inspect indexes (not only constraints) and existing RPCs before adding uniqueness/receipt storage; do not assume no uniqueness solely from constraints.
3. Do not implement a SECURITY DEFINER mutation using `entitlements.flags` as trusted Premium proof while the privilege issue remains unresolved.
4. The first server status command must preserve `plan_payload` byte-for-byte/JSONB-equal, and must not accept arbitrary program status or nutrition factors.

**Outcome:** schema mapping advanced; first mutation remains blocked on authority and idempotency design. No SQL executed beyond SELECT.

## Read-only index and RPC privilege evidence — 2026-10-22
- `program_sessions` has a UNIQUE INDEX on `(program_id,date)`, plus its primary key. There is no `program_type` in the unique key: a command must resolve ownership/type explicitly and cannot assume a session FK to the intended program.
- `program_versions` has only a nonunique index `(program_id,program_type,version)` plus PK on `id`. A revision CAS must not rely on that index for uniqueness; add a unique constraint/index after duplicate audit and local tests.
- `entitlements.user_id` is uniquely indexed, but uniqueness does not make flags authoritative; earlier write grants still block trusted entitlement use.
- Public RPC inventory: `get_active_program`, `get_program_day_details`, `get_program_days`, `get_program_explainability`, `get_program_phases`, `get_program_status` are invoker; `get_entitlements` is SECURITY DEFINER. All seven currently report EXECUTE privilege for both `anon` and `authenticated`. This does **not** prove exploitable disclosure without reviewing each function body, but requires explicit API exposure review. `update_programs_updated_at` is also executable by both roles.
- No currently deployed `advance_program_adaptation_atomic` or `adapt_nutrition_program_atomic_v1` was returned in public function inventory. Existing SQL draft functions remain review-only.

**Next gate:** audit `get_entitlements` body for user scoping, and inspect version duplicates before disposable unique-index and atomic server transition tests. No cloud SQL modifications.

## Completed read-only checks — 2026-10-22
- Deployed `get_entitlements(p_user_id uuid DEFAULT NULL)` is SECURITY DEFINER. Its implementation selects `coalesce(p_user_id, auth.uid())` without checking that an explicitly supplied ID belongs to the caller. Earlier privilege inspection showed both anon and authenticated can invoke it. **Confirmed cross-user entitlement metadata disclosure risk** for a known user UUID; no evidence of data mutation from this function alone.
- Required remediation: restrict explicit user IDs to the authenticated caller, verify existing trusted callers, and test anonymous, self, cross-user and fallback cases before changing the deployed RPC. Review EXECUTE grants and function security mode. This is a security fix, not a Premium feature change.
- Read-only duplicate check on `program_versions` grouped by `program_id, program_type, version` returned **no duplicate groups**. The existing index on those columns is nonunique. A unique index, race tests and rollback checks are still necessary.
- No cloud database changes were made in these checks.
