# Production entitlement RPC readiness — 2026-10-23 follow-up

Status: NO-GO for Production execution; read-only review progressed.

## Fresh Production evidence
- Both functions are SECURITY DEFINER owned by postgres, with search_path public, pg_temp; effective EXECUTE remains available to anon, authenticated, service_role.
- get_entitlements(uuid DEFAULT NULL) uses coalesce(p_user_id, auth.uid()) without an ownership assertion; known-UUID cross-account disclosure remains possible.
- get_paywall_state(text, uuid DEFAULT NULL) delegates to get_entitlements and inherits the issue.
- public.entitlements columns: id uuid, user_id uuid, tier text, flags jsonb, updated_at timestamptz; RLS enabled, owner policy auth.uid() = user_id, not FORCE RLS.
- PostgreSQL pg_depend search for dependent functions returned no rows. This does not cover dynamic SQL or application consumers.

## Client compatibility
- src/services/entitlementService.ts on this branch calls auth.getUser(), rejects mismatched userId, and invokes both RPCs with the session user UUID. The reviewed client wrapper is compatible with own-account-only behavior.
- GitHub repository-wide code search returned no indexed matches even for known filenames; therefore other call sites, server jobs and external consumers are NOT fully audited. Do not infer absence.

## Candidate review
- Forward draft preserves RPC signatures, default args, and JSON response semantics; adds authenticated and auth.uid() ownership checks; revokes PUBLIC/anon/service_role EXECUTE and grants authenticated.
- Forward draft uses auth.role() (deprecated in current Supabase guidance). Confirm role behavior and anonymous-user policy before Production authorization.
- Safe recovery draft revokes both RPCs (fail-closed) and does not restore the insecure legacy body. Recovery remains REVIEW ONLY and has not been replay-tested or operator-approved.
- Existing disposable local integration CI 4/4 PASS at eaf117c897d96af8931357c8d9efdea8b5965839; this is not a Production acceptance test.

## Outstanding gates
1. Complete comprehensive code/runtime consumer inventory, including server/background and direct RPC calls.
2. Replay-test fail-closed recovery, ensure backup/restore operator and deployment window.
3. Confirm role/anonymous-user semantics, exact deployment SHA, latest CI and database drift.
4. Separate explicit owner authorization for applying the forward migration. Never execute review-only SQL in Production without it.
5. Staging lacks legacy RPCs and is NO-GO for parity; do not introduce competing authority.

No Production/Staging changes were made during this review.
