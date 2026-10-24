# Production entitlement RPC migration readiness follow-up — 2026-10-24

Status: CONDITIONAL NO-GO; read-only review only. No Production/Staging writes authorized or executed.

## Evidence checked
- Production SQL catalog previously confirmed legacy functions public.get_entitlements(uuid) and public.get_paywall_state(text,uuid) are SECURITY DEFINER, owned by postgres, and effectively executable by anon/authenticated/service_role. Existing get_entitlements accepts arbitrary known user UUID without owner verification.
- Production entitlements columns: id uuid, user_id uuid, tier text, flags jsonb, updated_at timestamptz. RLS enabled; entitlements_owner policy uses auth.uid() = user_id; RLS alone does not constrain postgres-owned SECURITY DEFINER.
- Fresh Production source search via pg_proc.prosrc ILIKE on both RPC names (2026-10-24): only public.get_paywall_state mentions get_entitlements; no other matching stored function bodies. This is not an exhaustive check of dynamic SQL, triggers, Edge Functions, or application callers.
- Branch audit/supabase-public-grants-20261021: src/services/entitlementService.ts authenticates with client.auth.getUser(), rejects mismatched userId, and supplies current session ID to both RPCs. Forward candidate preserves JSON/free fallback and restricts get_entitlements to auth.role() authenticated plus auth.uid() own-account; both RPCs revoke broad EXECUTE and grant only authenticated.
- Safe recovery candidate revokes EXECUTE on both RPCs without reinstating insecure bodies. Both candidates currently end in ROLLBACK, not deployable migration scripts.
- Prior local CI 4/4 PASS on eaf117c; local disposable integration reproduces old known-UUID vulnerability and verifies guarded candidate.

## Outstanding release blockers
1. Exhaustively inventory repository consumers and privileged/background jobs. GitHub default-branch code search returned no results for get_entitlements/get_paywall_state/entitlementService, so it cannot establish absence on the PR branch. Inspect full PR-branch tree and deployed Edge Functions/builds before sign-off.
2. Confirm recent Production backup/PITR restore capability and responsible operator, deployment window, and acceptance monitoring. Do not assume a backup exists merely because Supabase is used.
3. Staging schema parity remains NO-GO: shared Staging lacks these legacy RPCs; do not create them to force parity. Local disposable Auth/PostgREST integration is the verified substitute, but owner must explicitly accept environment divergence.
4. Confirm exact deploy commit and repeat fresh schema/function/grant drift checks immediately before release. Confirm client access, any service_role consumers, and user-visible error behavior.
5. Run authenticated self/free/paid and cross-account, anon, service_role negative API acceptance after any separately approved deployment. Fail closed on unexpected behavior.
6. Forward uses auth.role() (deprecated in Supabase documentation); assess role-check semantics and test anonymous-sign-in cases. Do not weaken auth.uid() owner validation.
7. Recovery candidate is fail-closed outage response, not availability-preserving rollback. Explicitly approve operational trade-off; never use legacy rollback candidate.

## Decision
Not ready to execute Production migration. Owner's general instruction to prepare everything is authorization for review/preparation, not a separate approval to modify Production. Once the above gates are evidenced, request distinct production deployment authorization.
