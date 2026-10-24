# Production entitlement RPC — final preflight findings (2026-10-24)

Status: **NO-GO FOR DEPLOYMENT** pending the explicitly listed operational gates. Read-only audit; no cloud writes.

## Verified
- Production project dtsdnhbcwpbfrhcazqkb: both public.get_entitlements(uuid) and public.get_paywall_state(text,uuid) remain SECURITY DEFINER, owned by postgres, and executable by anon, authenticated and service_role. The legacy get_entitlements function accepts p_user_id without enforcing caller ownership; paywall delegates to it.
- public.entitlements columns: id uuid, user_id uuid, tier text, flags jsonb, updated_at timestamptz. RLS enabled with entitlements_owner auth.uid()=user_id; SECURITY DEFINER still bypasses the intended per-user restriction.
- Production source bodies inspected on 2026-10-23. pg_depend inspection found no registered SQL-function dependents; this **does not** exclude dynamic SQL or application clients.
- Branch audit/supabase-public-grants-20261021: src/services/entitlementService.ts uses auth.getUser(), rejects mismatched explicit userId, and passes own session ID to both RPCs. Its canGenerateProgram/canAdaptProgram/canExplain/canRealtimePose and explain methods consume entitlements; any fail-closed emergency revocation will interrupt these clients.
- Forward candidate: supabase/migration_drafts/entitlement_rpc_forward_candidate_review_20261023.sql. Preserves signatures and JSON responses, guards get_entitlements by auth.uid and auth.role, and revokes anon/service_role/PUBLIC EXECUTE on both functions. Review-only ROLLBACK: **not deployable as-is**.
- Safe recovery candidate: supabase/migration_drafts/entitlement_rpc_safe_recovery_review_20261023.sql. Fail-closed EXECUTE revocation on both RPCs. Review-only ROLLBACK: **not deployable as-is**.
- GitHub Actions on eaf117c897d96af8931357c8d9efdea8b5965839: four workflows success.

## Open gates (do not mark PASS without evidence)
1. **Complete repository-wide consumer audit**, including default branch and this PR branch, server/background jobs, dynamic calls and direct REST endpoints. GitHub code search returned no matches for exact RPC names, so absence of other callers has **not** been proven. Need complete tree/clone-based ripgrep or equivalent.
2. **Production backup/PITR and restore operator**: confirm actual backup availability, restore drill, incident owner, and deployment window. No such operational evidence has been supplied or verified.
3. **Migration candidate hardening**: evaluate deprecated auth.role() usage and anonymous sign-ins; ensure signed-in user identity check is correct under deployed Auth settings. Validate both RPCs via actual Auth/PostgREST API, including cross-account 42501, anon and service_role rejection, own-account paid/free and missing-row fallbacks.
4. **Staging parity**: staging ozidryfvhkcbtpnulakq lacks the legacy RPC/table and uses a distinct Premium authority. No legacy objects should be created merely for test parity. Approve an isolated, faithful replay strategy or explicitly record the staging exception.
5. **Final deployment approval**: explicit owner authorization for Production write, exact SQL SHA, controlled transaction COMMIT and emergency recovery plan. Current owner instructions authorize preparation/checks, **not** cloud writes.

## Decision
Preflight has materially progressed; **not yet migration-ready**. Do not deploy the old rollback candidate (would reintroduce cross-account access). No changes to Production or Staging were made during this audit.
