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
