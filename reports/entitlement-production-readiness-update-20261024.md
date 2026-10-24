# Production entitlement migration — readiness update 2026-10-24

Status: NO-GO for Production execution; owner authorized continued readiness work, but mandatory operational gates remain unverified.

## Verified live Production (read-only)
Project dtsdnhbcwpbfrhcazqkb: public.get_entitlements(uuid) and public.get_paywall_state(text,uuid) remain SECURITY DEFINER owned by postgres, with effective EXECUTE for anon, authenticated, service_role. Existing get_entitlements accepts arbitrary p_user_id without caller ownership enforcement; get_paywall_state delegates to it. Table public.entitlements has id,user_id,tier,flags,updated_at; RLS enabled, policy entitlements_owner uses auth.uid()=user_id. SQL dependency catalog returned no dependent functions, but this does not prove absence of dynamic/app consumers.

## Verified client consumer
src/services/entitlementService.ts on branch audit/supabase-public-grants-20261021 calls auth.getUser(), rejects supplied mismatching userId, and calls both RPCs with sessionUserId. This consumer is compatible with authenticated own-account restriction. Repository-wide caller enumeration and privileged/background consumers are not conclusively verified.

## Evidence
The reviewed forward candidate preserves function signatures and paywall JSON semantics, checks authenticated caller and auth.uid(), raises 42501 on cross-account, revokes PUBLIC/anon/service_role and grants authenticated only. The reviewed safe recovery revokes both RPC EXECUTE permissions (fail closed). Both files remain ROLLBACK review-only. Four GitHub Actions passed on commit eaf117c897d96af8931357c8d9efdea8b5965839.

## Open mandatory gates
1. Verified Production backup/restore point and authorized rollback operator/deployment window.
2. Full repository/server/background RPC caller inventory, including privileged jobs.
3. Revalidate exact Production function definitions and grants against execution candidate immediately before migration.
4. Staging drift: legacy objects absent in Staging, so no equivalent staging deployment acceptance. Use isolated production-schema clone or approved alternative; never create competing authority in shared Staging.
5. Post-deployment live API acceptance for own/free/paid, cross-account, anon, service_role, and paywall decisions.

## Decision
Do not execute migration or fail-closed recovery on Production until gates are resolved. Do not use insecure legacy rollback. No cloud changes made in this readiness update.
