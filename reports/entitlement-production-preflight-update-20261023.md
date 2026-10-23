# Production entitlement RPC preflight update — 2026-10-23

Status: **NO-GO FOR CLOUD EXECUTION**; read-only production checks completed in part. No Production/Staging writes.

## Direct Production findings (project dtsdnhbcwpbfrhcazqkb)
- Both public RPCs exist, SECURITY DEFINER, owned by postgres, search_path public/pg_temp. Effective EXECUTE was true for anon, authenticated, service_role before migration.
- `get_entitlements(uuid)` accepts a supplied UUID via `coalesce(p_user_id, auth.uid())` without enforcing caller ownership, and reads public.entitlements with definer privileges. Confirmed known-UUID cross-account exposure in local replay.
- `get_paywall_state(text,uuid)` delegates to `get_entitlements` and is likewise callable by the same roles.
- `entitlements` columns: id uuid, user_id uuid, tier text, flags jsonb, updated_at timestamptz; all NOT NULL. Primary key, user foreign key, tier check present.
- RLS enabled (not forced); `entitlements_owner` ALL policy has auth.uid()=user_id in USING and WITH CHECK. SECURITY DEFINER bypass risk remains.
- pg_depend query for function-to-function dependencies returned none; PL/pgSQL and external dynamic/client calls are not exhaustively covered by this query.

## Client and SQL review
- Branch `src/services/entitlementService.ts` calls auth.getUser(), rejects a mismatched caller-supplied userId, and passes current session ID to get_entitlements/get_paywall_state. This is compatible with authenticated own-account enforcement, but other consumers are not yet exhaustively inventoried.
- Reviewed `supabase/migration_drafts/entitlement_rpc_forward_candidate_review_20261023.sql`: guarded own-account get_entitlements, SQLSTATE 42501 for denied calls, grants authenticated only on both functions, ends in ROLLBACK (review-only).
- Reviewed `supabase/migration_drafts/entitlement_rpc_safe_recovery_review_20261023.sql`: fail-closed revoke of EXECUTE on both functions, ends in ROLLBACK (review-only). Unsafe legacy rollback must never be applied.
- GitHub code search yielded no results for RPC names, so absence of additional consumers **cannot** be asserted. Search indexed default branch only; targeted file fetch was successful on PR branch.

## Remaining mandatory release gates
1. Exhaustive repository/branch inventory of all direct and indirect RPC consumers, including server and background jobs; verify none rely on anon/service_role access.
2. Verify deployment backup/PITR availability and restore procedure with named operator, release window, and on-call acceptance; do not run destructive restore as a test on Production.
3. Review exact deployment commit, live function definitions and grants immediately before deploy; verify staging drift remains explicitly documented (no legacy objects created in staging).
4. Obtain **separate explicit owner approval** for applying forward migration to Production. General permission to prepare is not authorization to deploy.
5. After deployment, run real authenticated/anon/service_role API acceptance and telemetry checks, with fail-closed recovery if unexpected behavior.

Conclusion: local CI 4/4 PASS and read-only production evidence support the candidate design, **not** release readiness. Do not apply migration yet.
