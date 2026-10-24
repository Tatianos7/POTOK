# Production entitlement preflight follow-up — 2026-10-24

Status: **NO-GO for deployment; read-only verification and client review complete in scope described.**

## Production observations (read-only)
- Project: dtsdnhbcwpbfrhcazqkb.
- public.entitlements: id uuid, user_id uuid, tier text, flags jsonb, updated_at timestamptz; all NOT NULL.
- RLS enabled, not forced; policy entitlements_owner applies auth.uid() = user_id for ALL, with matching WITH CHECK.
- get_entitlements(uuid) and get_paywall_state(text,uuid) are SECURITY DEFINER owned by postgres, search_path public,pg_temp. Effective EXECUTE for anon, authenticated, service_role all TRUE.
- Existing get_entitlements coalesces supplied UUID with auth.uid(), but does not enforce equality. Known-UUID cross-account entitlement read remains exposed.
- Existing get_paywall_state delegates to get_entitlements; paywall response depends on returned flags.
- pg_depend query for registered function dependents returned none. This does not prove absence of PL/pgSQL dynamic or application callers.
- Production function bodies and signatures inspected on 2026-10-23; no cloud mutation performed.

## Client review
- src/services/entitlementService.ts on PR branch uses client.auth.getUser(), rejects caller-supplied userId mismatch, and calls both RPCs with the session user ID.
- This specific client service is compatible with the own-account contract. It is not a full repository-wide caller audit. GitHub code search returned no indexed matches for RPC names, so no claim of exhaustive coverage.

## Reviewed candidate and recovery
- supabase/migration_drafts/entitlement_rpc_forward_candidate_review_20261023.sql keeps the functions' signatures, replaces get_entitlements with authenticated/own-account guard and revokes EXECUTE from PUBLIC, anon and service_role; grants authenticated only.
- supabase/migration_drafts/entitlement_rpc_safe_recovery_review_20261023.sql revokes EXECUTE on both RPCs; this is fail-closed and can disrupt Premium UX until repaired.
- Both scripts end in ROLLBACK and are review-only. Never apply the legacy rollback candidate, which reopens cross-account reads.
- Local disposable Supabase integration CI 4/4 passed on eaf117c commit, not a production acceptance result.

## Remaining hard gates before cloud write
1. Exhaustive repository-wide search of direct and indirect RPC callers, including background jobs, service-role and any edge functions; record owner for each.
2. Confirm exact forward candidate against live Production immediately before deployment, including all privilege grants and current SHA.
3. Obtain verified restore/backup point, operator, maintenance window, and explicit owner acceptance of fail-closed recovery impact.
4. Confirm cloud acceptance plan for authenticated own account, missing-row fallback, cross-account 42501, anon/service_role denial, paywall responses and monitoring.
5. Resolve or explicitly isolate Staging schema drift (legacy objects absent); do not install a competing authority in Staging.
6. Request separate explicit owner approval for Production deployment after all gates PASS.

**No Production or Staging changes were made by this audit.**
