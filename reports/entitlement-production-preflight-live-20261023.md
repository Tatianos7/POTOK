# Live Production entitlement preflight — 2026-10-23

Status: **NO-GO for Production execution**. Read-only evidence only. No Production or Staging writes.

## Verified directly against Production dtsdnhbcwpbfrhcazqkb
- `public.get_entitlements(uuid DEFAULT NULL)` and `public.get_paywall_state(text,uuid DEFAULT NULL)`: both SECURITY DEFINER, owner postgres, search_path public/pg_temp.
- Effective EXECUTE for anon, authenticated, service_role was TRUE for both. The legacy get_entitlements body resolves `coalesce(p_user_id, auth.uid())` without checking that supplied UUID belongs to caller; known-UUID cross-account disclosure remains.
- Paywall delegates to get_entitlements. No registered pg_depend function-to-function dependents returned; this does **not** rule out application/dynamic SQL callers.
- `public.entitlements` columns: id uuid, user_id uuid, tier text, flags jsonb, updated_at timestamptz; NOT NULL. Primary key, user FK, tier check; RLS enabled, not forced. Policy `entitlements_owner` ALL, USING/WITH CHECK auth.uid()=user_id.

## Application compatibility (branch audit/supabase-public-grants-20261021)
- Read `src/services/entitlementService.ts`: `getSessionUserId` calls `auth.getUser()`, rejects unauthenticated and mismatched supplied user ID; getEntitlements and getPaywallState pass current user ID. Compatible with authenticated own-account-only contract.
- Additional repo-wide RPC consumers, service-role jobs and dynamically constructed callers **not exhaustively verified**. GitHub code search returned no results even for known file; do not interpret as proof of absence.
- Forward candidate `supabase/migration_drafts/entitlement_rpc_forward_candidate_review_20261023.sql` preserves signatures and JSON, guards auth.uid and cross-account with 42501, revokes PUBLIC/anon/service_role, grants authenticated; review-only ROLLBACK. It currently uses auth.role(); verify anonymous-auth behavior and preferably replace deprecated auth.role with explicit request role check/contract-tested approach before approval.
- Safe recovery `supabase/migration_drafts/entitlement_rpc_safe_recovery_review_20261023.sql` revokes both endpoints, fail-closed, review-only ROLLBACK. It is a disablement plan, **not** restoration of Premium availability.

## Remaining hard gates
1. Exhaustive repository and deployed runtime caller inventory, including service_role/background jobs, plus tested compatibility.
2. Approved and tested backup/restore operator, maintenance window, observability and stop criteria; never deploy unsafe legacy rollback.
3. Review exact forward SQL and apply via explicitly authorized transaction only after distinct owner approval; perform authenticated own/other, anon, service-role and paywall PostgREST acceptance.
4. Staging parity remains NO-GO: staging lacks legacy objects. Do not manufacture them there.

## CI
Previous exact commit eaf117c897d96af8931357c8d9efdea8b5965839: four GitHub workflows SUCCESS. CI alone is not Production authorization.
