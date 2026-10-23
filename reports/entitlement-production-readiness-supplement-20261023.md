# Entitlement RPC Production readiness — supplementary audit 2026-10-23

Status: NO-GO FOR PRODUCTION EXECUTION. Read-only inspection only; no cloud writes.

## Verified against live Production (dtsdnhbcwpbfrhcazqkb)
- Both public RPCs exist as SECURITY DEFINER owned by postgres; before migration effective EXECUTE for anon/authenticated/service_role is true.
- get_entitlements(uuid DEFAULT NULL) resolves coalesce(input,auth.uid()) without enforcing caller ownership; known-UUID cross-account access remains.
- get_paywall_state(text,uuid DEFAULT NULL) delegates to get_entitlements and preserves adaptation/explainability/spatial paywall response contract.
- entitlements columns: id uuid, user_id uuid, tier text, flags jsonb, updated_at timestamptz; RLS enabled, entitlements_owner policy auth.uid()=user_id; constraints include PK, FK, tier check.
- pg_depend function-dependent query returned zero additional dependent functions. This does NOT exclude dynamic SQL, PostgREST, external clients or application calls.
- information_schema.routines textual scan for get_entitlements showed get_paywall_state only. Not a comprehensive dynamic-dependency audit.

## Reviewed repository client and migration drafts
- src/services/entitlementService.ts obtains authenticated user via auth.getUser(), rejects userId mismatch, and passes current user ID to both RPCs. No service_role use in this file.
- Forward review-only SQL replaces get_entitlements with caller auth.uid() check and cross-account SQLSTATE 42501, revokes PUBLIC/anon/service_role, grants authenticated; paywall function body stays unchanged and delegates to guarded function. Transaction ends in ROLLBACK; never execute as deployment unchanged.
- Safe recovery review-only SQL revokes access to both RPCs, ending in ROLLBACK; intentionally disables feature checks rather than reintroducing vulnerable legacy body.
- GitHub search index returned zero results even for known present strings. Thus repository-wide consumer audit is NOT proven complete.

## Remaining mandatory gates
1. Complete repository-wide search on the exact deployment commit for both RPC names and indirect callers, including background/service-role consumers, with reproducible evidence.
2. Review and test emergency disable and recovery/re-enable procedure in a disposable parity environment; verify restore operator and backups without exposing data.
3. Verify current CI and deployment SHA, exact production definition/grants against forward candidate immediately before execution.
4. Confirm production change window, rollback operator, monitoring and explicit distinct owner authorization for cloud write.
5. Staging lacks legacy objects; no legacy staging migration. Stage parity remains NO-GO; do not introduce competing entitlement authority.

This report does not approve migration, merge, deployment or data changes.
