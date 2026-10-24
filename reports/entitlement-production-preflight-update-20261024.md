# Entitlement Production preflight update — 2026-10-24

Status: **NO-GO for Production execution; read-only preflight advanced.**

## Verified directly against Production on 2026-10-23
- Project `dtsdnhbcwpbfrhcazqkb`: `public.get_entitlements(uuid)` and `public.get_paywall_state(text,uuid)` both exist, are SECURITY DEFINER, owner `postgres`, with `search_path=public,pg_temp`.
- Effective EXECUTE was TRUE for anon, authenticated and service_role on both functions. This is the current insecure baseline.
- `get_entitlements` uses `coalesce(p_user_id,auth.uid())` without asserting requested UUID equals caller; `get_paywall_state` delegates to it. The cross-account read is confirmed by function inspection, not by querying private account records.
- `public.entitlements` columns: id uuid, user_id uuid, tier text, flags jsonb, updated_at timestamptz; all NOT NULL. RLS enabled, not FORCE. Policy `entitlements_owner` applies `auth.uid()=user_id` to ALL. Primary key, user foreign key and tier check exist.
- Catalog `pg_depend` query returned no dependent pg_proc entries for these RPCs. **This does not establish absence of PL/pgSQL, application or dynamic-SQL consumers.**

## Reviewed GitHub branch `audit/supabase-public-grants-20261021`
- `src/services/entitlementService.ts`: getSessionUserId calls `auth.getUser()`, rejects supplied user ID mismatch, then passes the session ID to both RPCs. Client caller is compatible with own-account-only server contract.
- `supabase/migration_drafts/entitlement_rpc_forward_candidate_review_20261023.sql`: guarded get_entitlements; REVOKE PUBLIC/anon/service_role and GRANT authenticated for both RPCs; ends with ROLLBACK. Does not replace paywall body, so paywall delegates to the guarded entitlement function.
- `supabase/migration_drafts/entitlement_rpc_safe_recovery_review_20261023.sql`: emergency fail-closed REVOKE for both RPCs, also ends with ROLLBACK. The legacy rollback candidate is unsafe and must never be executed.
- GitHub Actions on commit `eaf117c897d96af8931357c8d9efdea8b5965839`: 4/4 success.

## Remaining gates
1. Exhaustive codebase and background-job RPC consumer inventory, including `get_entitlements`, `get_paywall_state`, `entitlementService`, service-role paths, and dynamically constructed calls. GitHub default-branch code search returned no matches; **this is not evidence of no callers on the PR branch**. Verify against full branch tree/checkout.
2. Confirm current Production function signatures, ACLs and DDL immediately before rollout; compare with reviewed candidate.
3. Confirm backup/restore operator, actual restore test or documented recovery drill, release window and monitoring/rollback owner. A fail-closed REVOKE is an outage-containment action, **not data restoration**.
4. Confirm deployment SHA and Production-specific API acceptance tests for authenticated self, cross-account, anon, service_role, paywall features and missing-entitlement fallback.
5. Obtain **separate explicit Production execution approval**. Do not infer this from a general instruction to continue work.

No Production or Staging mutation was performed for this report. Staging parity remains NO-GO; do not introduce legacy RPCs there merely to match Production.
