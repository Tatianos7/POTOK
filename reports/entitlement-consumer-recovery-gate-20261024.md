# Production entitlement RPC — consumer and recovery gate (2026-10-24)

Status: PARTIAL PASS / PRODUCTION NO-GO. Read-only review only; no cloud changes.

## Verified against branch audit/supabase-public-grants-20261021
- src/services/entitlementService.ts: getSessionUserId uses auth.getUser() and rejects a supplied userId differing from the authenticated user. getEntitlements and getPaywallState pass current session UUID; this client code is compatible with the proposed own-account RPC policy.
- The reviewed forward candidate preserves function signatures and JSON response semantics, enforces caller=auth.uid() and SQLSTATE 42501 for cross-account requests, and grants EXECUTE only to authenticated. Its auth.role() check should be reviewed for current Supabase recommendations and anonymous-sign-in implications before deployment.
- The reviewed safe-recovery candidate revokes EXECUTE on both RPCs. It is a fail-closed outage response, NOT restoration of service; it remains review-only (ROLLBACK), and has not been tested in Production.
- Fresh Production read-only inspection on 2026-10-23 confirmed existing functions remain SECURITY DEFINER and executable by anon/authenticated/service_role, and old get_entitlements accepts arbitrary p_user_id. RLS on public.entitlements is enabled, but SECURITY DEFINER bypass is the concern. pg_depend query returned no registered function dependencies; dynamic SQL and external clients are not excluded.
- 4/4 GitHub Actions PASS on eaf117c (review-document commit).

## Blocking gates
1. Complete repository-wide consumer search (including server jobs, edge functions, SQL and clients) and confirm no service_role/background consumer requires these RPCs. GitHub code search returned zero matches for the exact RPC names on default branch; this does NOT constitute a complete search of the PR branch.
2. Verify recovery SQL in disposable local integration and document restore/backups, operator, deployment window and acceptance steps.
3. Check branch HEAD and CI after any changes, plus live Production preflight immediately before execution.
4. Require separate explicit owner authorization for Production writes. Do not deploy this document or the review-only SQL.

Decision: NOT READY TO APPLY; no Production or Staging mutation performed.
