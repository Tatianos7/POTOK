# Production entitlement RPC — live read-only preflight (2026-10-23)

Status: PARTIAL PASS / PRODUCTION DEPLOYMENT NOT AUTHORIZED. No cloud writes were performed.

## Verified against Production dtsdnhbcwpbfrhcazqkb
- Both public.get_entitlements(uuid) and public.get_paywall_state(text,uuid) exist, are owned by postgres, SECURITY DEFINER, search_path public/pg_temp, and are currently executable by anon, authenticated and service_role. These grants are insecure and remain unchanged.
- get_entitlements defaults its UUID argument to null and coalesces it with auth.uid(), with no cross-account equality guard. get_paywall_state delegates to get_entitlements. Cross-account known-UUID access is therefore possible by function logic.
- public.entitlements columns: id uuid, user_id uuid, tier text, flags jsonb, updated_at timestamptz. All NOT NULL. Defaults: id gen_random_uuid(), flags {}, updated_at now().
- RLS enabled (not forced). entitlements_owner policy ALL to PUBLIC with auth.uid() = user_id for USING and WITH CHECK. This does not secure postgres-owned SECURITY DEFINER RPC.
- Primary key, tier CHECK, user_id FK present. pg_depend query found no dependent pg_proc objects. This does NOT rule out PL/pgSQL textual references, dynamic SQL, or application consumers.

## Repository review
- src/services/entitlementService.ts on audit/supabase-public-grants-20261021 calls auth.getUser(), rejects mismatched supplied userId, and calls both RPCs with the session user's UUID. Its methods are getEntitlements, getPaywallState, canRealtimePose, canGenerateProgram, canAdaptProgram, canExplain, load, refresh, revalidate, recover and explain.
- supabase/migration_drafts/entitlement_rpc_forward_candidate_review_20261023.sql preserves the RPC signatures and paywall body, adds auth.uid() own-account guard to get_entitlements and restricts both EXECUTE grants to authenticated. It remains BEGIN/ROLLBACK review-only.
- supabase/migration_drafts/entitlement_rpc_safe_recovery_review_20261023.sql revokes EXECUTE on both RPCs and remains BEGIN/ROLLBACK review-only. This is a fail-closed emergency containment, NOT a restoration of service. Never deploy the legacy rollback candidate.
- GitHub code search returned zero matches for get_entitlements, get_paywall_state and entitlementService; because the known file definitely contains those strings, search coverage is demonstrably incomplete. Therefore exhaustive caller inventory is NOT verified.
- Four CI workflows passed on eaf117c897d96af8931357c8d9efdea8b5965839 (latest checked report commit). New commit requires fresh CI confirmation.

## Remaining mandatory gates before GO
1. Exhaustive repository-wide caller search on the exact deployment SHA, including direct .rpc calls, SQL function references, server/background/service_role paths, and confirmation that no external consumers depend on anonymous/service_role EXECUTE.
2. Confirm actual database backups/PITR or restore readiness and responsible operator, and choose a deployment window. Fail-closed SQL is an emergency disable, not full rollback.
3. Resolve or explicitly scope Staging schema drift: shared Staging lacks these legacy RPC objects. Do not create a parallel legacy entitlement authority there.
4. Review auth.role() deprecated usage in the candidate, particularly anonymous-authenticated identities, and test intended behavior; do not weaken the own-account guard.
5. Fresh pre-deploy function hashes/grants, exact candidate SQL review, production API acceptance for own/cross-account/anon/service_role and paid/free paywall behavior, telemetry monitoring.
6. Separate explicit owner approval to perform Production writes. This read-only preflight is NOT deployment authorization.

## Verdict
Read-only schema/function preflight PASS for checked attributes; caller completeness and operational recovery NOT VERIFIED. Production GO = NO. No production or staging mutation.
