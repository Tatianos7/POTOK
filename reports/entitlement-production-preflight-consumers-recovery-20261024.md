# Production entitlement preflight 2026-10-24

Status: CONDITIONAL NO-GO; no cloud writes.

Verified: Production functions remain SECURITY DEFINER and old get_entitlements allows supplied UUID without caller ownership check. Paywall delegates to it. RLS enabled on entitlements but definer bypass risk remains. Existing grants allow anon, authenticated and service_role.

Client review: src/services/entitlementService.ts in audit/supabase-public-grants-20261021 obtains auth.getUser(), rejects mismatched userId and calls both RPCs with session UUID. This is compatible with own-account contract but not sufficient server authorization.

Forward SQL reviewed: supabase/migration_drafts/entitlement_rpc_forward_candidate_review_20261023.sql guards auth.uid() and UUID equality, revokes broad EXECUTE and grants authenticated. Ends in ROLLBACK; not deployed. Uses deprecated auth.role(), review before release.

Recovery SQL reviewed: supabase/migration_drafts/entitlement_rpc_safe_recovery_review_20261023.sql revokes access to both RPCs, fail-closed; ends in ROLLBACK. Legacy rollback is unsafe.

Four CI workflows PASS at eaf117c897d96af8931357c8d9efdea8b5965839. Catalog query found no registered dependent functions, but dynamic SQL and app callers are not excluded.

OPEN before migration: comprehensive caller inventory (GitHub code search returned no matches even for known matching source file); service_role/background caller check; backup/PITR and named recovery operator; deployment window; exact SHA/drift check; operational recovery rehearsal; explicit deployment authorization; real API acceptance after deployment.

NO Production or Staging changes were made.
