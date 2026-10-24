# Entitlement Production preflight continuation — 2026-10-24

Status: **NO-GO for cloud execution; read-only checks advanced**. No Production/Staging writes.

## Verified directly in Production
- public.get_entitlements(uuid DEFAULT NULL) and public.get_paywall_state(text,uuid DEFAULT NULL) are SECURITY DEFINER, postgres-owned, search_path public,pg_temp; effective EXECUTE still granted to anon, authenticated, service_role.
- get_entitlements resolves coalesce(p_user_id,auth.uid()) without matching explicit UUID to auth.uid(): known-UUID cross-account exposure remains.
- get_paywall_state delegates to get_entitlements.
- public.entitlements columns id uuid, user_id uuid, tier text, flags jsonb, updated_at timestamptz, all NOT NULL. Defaults id gen_random_uuid(), flags {}, updated_at now().
- RLS enabled (not forced); entitlements_owner ALL policy uses auth.uid()=user_id for USING and WITH CHECK; SECURITY DEFINER bypass risk persists.
- Table has primary key, FK and tier CHECK; no UNIQUE constraint appeared in information_schema.table_constraints. Do not infer uniqueness of user_id without separate index inspection.
- pg_depend function-dependent query returned no entries; additional public pg_proc.prosrc text scan found get_paywall_state as the only public function mentioning these RPC names. This does not prove absence of application or dynamic callers.

## Client verification
- src/services/entitlementService.ts on branch audit/supabase-public-grants-20261021 obtains auth.getUser(), rejects mismatched supplied userId, calls both RPCs with current session user ID.
- This confirms the primary client wrapper uses own-account calls, not every repository consumer. GitHub default-branch code search returned no hits for get_entitlements/get_paywall_state/entitlementService/paywall, so treat global caller inventory as **unverified**, not as zero callers.

## Candidate and recovery review
- supabase/migration_drafts/entitlement_rpc_forward_candidate_review_20261023.sql preserves get_entitlements signature and JSON response, adds authenticated + caller ownership checks, revokes PUBLIC/anon/service_role and grants authenticated on both RPCs.
- supabase/migration_drafts/entitlement_rpc_safe_recovery_review_20261023.sql revokes both RPC EXECUTE (fail closed). Both scripts remain review-only, transaction ends ROLLBACK.
- Candidate uses auth.role(); Supabase skill flags auth.role() as deprecated. Require review of a nondeprecated role-check strategy that still explicitly denies anon and service_role, and retest exact candidate.
- Safe recovery is an outage/disable strategy, **not** a backup restoration. Backup/PITR availability, responsible operator, deployment window, and rehearsal remain unverified.

## Blocking gates
1. Full branch-aware repository-wide consumer search (including service_role/background workers) and exact deployment SHA.
2. Verify unique index / user_id cardinality assumption; inspect privileges, dependencies and app callsites.
3. Decide staging legacy parity strategy without creating conflicting Premium authority. Staging lacks legacy objects; no staging cloud DDL without separate approval.
4. Update and rerun exact migration fixture tests if auth.role() check is changed.
5. Establish tested backup/PITR, incident owner, monitoring and rollback drill; owner approval separately for staging and Production.

**Do not deploy, merge, or treat local CI PASS as cloud acceptance.**
