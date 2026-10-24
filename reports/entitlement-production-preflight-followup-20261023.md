# Production entitlement RPC migration — final preflight update (2026-10-23)

Status: **NO-GO for deployment pending operational owner approvals and full consumer inventory**. Read-only checks only; no cloud writes.

## Verified
- Production project: `dtsdnhbcwpbfrhcazqkb`. Live definitions: `get_entitlements(uuid DEFAULT NULL)` and `get_paywall_state(text,uuid DEFAULT NULL)`, both `SECURITY DEFINER`, owner postgres, `search_path=public,pg_temp`. Legacy entitlement function resolves `coalesce(p_user_id,auth.uid())` without ownership check; paywall delegates to it.
- Effective EXECUTE on both: anon/authenticated/service_role = true at preflight; migration still unapplied.
- `public.entitlements`: id UUID, user_id UUID, tier text, flags jsonb, updated_at timestamptz; RLS enabled, owner policy `auth.uid()=user_id`; primary key, foreign key, tier check present.
- `pg_depend` direct function dependency query returned no rows; separate `pg_get_functiondef` text scan of ordinary functions in `public` and `potok_control` returned no additional callers. These scans do **not** cover application, edge functions, jobs, other schemas, or dynamic calls.
- Branch `audit/supabase-public-grants-20261021`, `src/services/entitlementService.ts`: both RPCs use `auth.getUser()` and current session user ID, rejecting mismatched supplied ID. This client path is compatible with the proposed authenticated-own-account restriction.
- Four GitHub Actions passed on reviewed baseline and documentation commit `eaf117c897d96af8931357c8d9efdea8b5965839`.

## Required before approval
1. Complete repository-wide inventory of `get_entitlements` and `get_paywall_state` call sites (GitHub code search returned no results, which cannot establish absence); inspect server, Edge Functions, jobs, tests, deployment configuration and external consumers. Confirm no service_role-dependent runtime caller.
2. Confirm restore operator, tested backup/PITR or documented backup method, maintenance window, monitoring, and independent ability to apply fail-closed recovery. Safe recovery draft revokes EXECUTE; this is an emergency service disable, **not** a full data restore.
3. Review candidate `supabase/migration_drafts/entitlement_rpc_forward_candidate_review_20261023.sql` against current Production definitions and validate both RPC authorization through real Auth/PostgREST in an isolated matching environment. Staging schema is different (NO-GO for parity).
4. Approve **specific** Production execution in a separate owner decision. Current review-only forward and safe recovery SQL both end in `ROLLBACK`. Do not run unsafe legacy rollback.
5. At deployment, validate own-account free/pro, missing-row fallback, explicit self UUID, cross-account 42501, anon/service_role rejection, paywall semantics, PostgREST grants and telemetry. Fail closed on unexpected behavior.

## Additional security consideration
Forward draft checks `auth.role()='authenticated'` plus `auth.uid()`; Supabase deprecates `auth.role()` in RLS policy patterns. Before release confirm semantics for anonymous Auth users and role-impersonation/test claims, not merely SQL role grants.

## Decision
**NOT READY TO EXECUTE.** Security issue remains live in Production. This report does not authorize or implement migration.
