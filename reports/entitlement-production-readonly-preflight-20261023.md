# Entitlement Production preflight continuation — 2026-10-23

Status: READ-ONLY EVIDENCE RECORDED; PRODUCTION DEPLOYMENT NO-GO.

## Live Production observations
Project: dtsdnhbcwpbfrhcazqkb. No mutations performed.
- public.entitlements: id uuid NOT NULL (gen_random_uuid()), user_id uuid NOT NULL, tier text NOT NULL, flags jsonb NOT NULL (default '{}'), updated_at timestamptz NOT NULL (now()).
- RLS enabled, FORCE RLS disabled. Policy entitlements_owner applies to PUBLIC for ALL with USING and WITH CHECK auth.uid() = user_id.
- Primary key, user_id foreign key and tier CHECK exist.
- public.get_entitlements(p_user_id uuid DEFAULT NULL): SECURITY DEFINER, postgres owner, search_path public, pg_temp. Effective EXECUTE: anon=true, authenticated=true, service_role=true. Definition MD5 3347fc40acf5348da0d38f16966e8611. Existing body resolves coalesce(p_user_id, auth.uid()) without enforcing caller ownership, so a supplied known foreign UUID can read another account's entitlement.
- public.get_paywall_state(p_feature text, p_user_id uuid DEFAULT NULL): SECURITY DEFINER, postgres owner, same search_path and effective role grants. Definition MD5 dfc234fd190f2bdbe6d3494a207ad019. Delegates to get_entitlements(p_user_id).
- pg_depend search for function-to-function dependencies returned no rows. This does NOT prove absence of PL/pgSQL, application, dynamic SQL, or external API callers.

## Repository evidence
- src/services/entitlementService.ts on audit/supabase-public-grants-20261021 authenticates with auth.getUser(), rejects mismatched userId, and sends the current session user ID to both RPCs. This supports intended own-account usage for this client path; it is not an exhaustive caller inventory.
- Review-only emergency recovery file supabase/migration_drafts/entitlement_rpc_safe_recovery_review_20261023.sql revokes EXECUTE for PUBLIC, anon, authenticated and service_role for both RPCs. It contains ROLLBACK and has NOT been executed in Production. Recovery is fail-closed; it would interrupt entitlement/paywall clients.
- Local GitHub Actions 4/4 PASS on prior reviewed commit; not a Production acceptance test.

## Outstanding release gates
1. Exhaustive source search of RPC references, backend/service_role consumers and deployed clients, including any non-repository callers.
2. Validate forward candidate against captured Production definitions and defaults; check auth/session semantics, PostgREST roles and grants.
3. Confirm operational owner, deployment window, backup/restore evidence, recovery operator, incident monitoring and stop criteria.
4. Obtain explicit separate owner approval for Production write; do not treat this report as permission.
5. Run post-migration authenticated self/foreign/anonymous/service-role tests and paywall behavior checks before declaring success.

## Decision
NO-GO for Production deployment. The security defect is confirmed in the current Production function body. Staging lacks the legacy objects and remains schema-drift NO-GO. No cloud changes were made.
