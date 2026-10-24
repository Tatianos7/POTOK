# Production entitlement migration preflight — 2026-10-24

Status: PARTIAL PASS / PRODUCTION DEPLOYMENT NO-GO. Read-only inspection only.

## Production uniqueness (dtsdnhbcwpbfrhcazqkb)
- public.entitlements: total_rows=1, distinct_users=1, duplicate_rows=0.
- Unique btree index entitlements_user_idx(user_id) exists; entitlements_pkey(id) exists.
- RLS enabled, entitlements_owner policy restricts auth.uid()=user_id.
- Existing SECURITY DEFINER RPCs remain exposed to anon/authenticated/service_role; vulnerability still live.

## RPC consumers
- Reviewed src/services/entitlementService.ts on audit/supabase-public-grants-20261021: both get_entitlements and get_paywall_state use auth.getUser(), require same userId, and call client.rpc with session user ID.
- GitHub code search for get_entitlements, get_paywall_state, entitlementService and rpc(' returned zero results, despite known file existing: code search index is insufficient. Full repository-wide caller inventory NOT VERIFIED. Do not interpret zero results as no callers.
- pg_depend returned no dependent functions, but PL/pgSQL and application callers may not be represented.

## Recovery plan review
- Forward review candidate: supabase/migration_drafts/entitlement_rpc_forward_candidate_review_20261023.sql. Transaction ends in ROLLBACK; not executable as rollout without separate approval/review.
- Safe recovery review candidate: supabase/migration_drafts/entitlement_rpc_safe_recovery_review_20261023.sql. Revokes EXECUTE on both functions, fail closed, ends in ROLLBACK. Preserves guarded bodies. It is an emergency-disable plan, NOT a verified database backup or restore.
- Unsafe legacy rollback must NEVER be used; it restores cross-account access.
- Backup availability, snapshot timestamp, PITR eligibility, restore target, operator, RTO/RPO and rehearsal have NOT been verified. MCP integration exposes no backup listing or restore rehearsal capability.
- Before deploy: verify backups/PITR in Supabase Dashboard; confirm last restorable point, retention and permissions, designated operator, restore procedure on isolated project, application smoke tests and exact migration SHA; explicitly authorize deployment separately.

## Verdict
Uniqueness PASS. Known client service usage PASS for own-account check. Whole-codebase RPC inventory INCOMPLETE. Tested backup/restore INCOMPLETE. Production migration NO-GO. No Production/Staging writes made.
