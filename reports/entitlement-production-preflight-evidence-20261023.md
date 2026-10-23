# Production entitlement migration — final preflight evidence (2026-10-23)

Status: **CONDITIONAL NO-GO for deployment**. Read-only preflight advanced; no cloud mutation performed.

## Live Production evidence
Project: dtsdnhbcwpbfrhcazqkb. Both `public.get_entitlements(uuid)` and `public.get_paywall_state(text,uuid)` are SECURITY DEFINER owned by postgres, with `search_path=public,pg_temp`. Explicit ACL for each: PUBLIC, anon, authenticated, service_role have EXECUTE. Existing `get_entitlements` uses `coalesce(p_user_id,auth.uid())` without an own-account assertion; `get_paywall_state` delegates to it. Table `public.entitlements` has id uuid, user_id uuid, tier text, flags jsonb, updated_at timestamptz; all NOT NULL. RLS enabled, policy `entitlements_owner` checks `auth.uid()=user_id`, but SECURITY DEFINER bypasses the intended boundary. Registered pg_depend function dependency query returned no rows; this does not rule out PL/pgSQL dynamic or application callers.

## Repository review
`src/services/entitlementService.ts` on branch `audit/supabase-public-grants-20261021` calls `auth.getUser()`, rejects explicit mismatched user IDs, then calls both RPCs with the current session UUID. Its own-account behavior is compatible with the guarded candidate. However, GitHub code search of default branch returned no matches, so a repository-wide consumer audit is **not proven complete**; check other app, edge, scheduled and service_role callers before deployment.

Reviewed `supabase/migration_drafts/entitlement_rpc_forward_candidate_review_20261023.sql`: guarded `auth.uid()` equality, SQLSTATE 42501 for cross-account, preserved free fallback and JSON shape, revoke PUBLIC/anon/service_role, grant authenticated. The file intentionally ends with ROLLBACK. `supabase/migration_drafts/entitlement_rpc_safe_recovery_review_20261023.sql` is fail-closed: revoke EXECUTE for both functions and ends with ROLLBACK. Never use legacy rollback candidate because it restores the known-UUID vulnerability.

## Remaining release gates
1. Repository-wide call-site inventory, including background jobs and server callers; determine whether service_role access is needed and refactor before rollout if so.
2. Confirm owner/operator, deploy window, recovery access, and tested backup/restore procedure. Safe recovery revokes API access, which can interrupt premium features; communicate the impact.
3. Re-run local replay/CI at exact deployment SHA and perform immediate pre-apply definition/ACL drift check.
4. Obtain **distinct explicit owner approval for Production execution**. Preparation approval does not authorize SQL deployment.
5. Execute a separately reviewed transactional forward migration and run real API acceptance (authenticated self, explicit self, cross-account 42501, anon, service_role, free fallback, paywall) with no real user data in reports. Stop and fail closed on deviations.

Staging ozidryfvhkcbtpnulakq has different entitlement architecture and lacks these legacy objects; parity remains NO-GO. Do not create competing legacy authority in Staging.

## Verified CI
Commit `eaf117c897d96af8931357c8d9efdea8b5965839`: four workflow runs completed successfully. This is not Production acceptance.
