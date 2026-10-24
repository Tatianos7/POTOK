# Production entitlement RPC — predeployment consumer and recovery review (2026-10-23)

Status: **NO-GO for deployment**; read-only review completed in this session, no cloud writes.

## Live production evidence
- public.get_entitlements(uuid) and public.get_paywall_state(text,uuid) are SECURITY DEFINER owned by postgres, with broad effective EXECUTE for anon/authenticated/service_role.
- get_entitlements resolves coalesce(p_user_id, auth.uid()) without checking equality; a supplied other user's UUID can disclose entitlement. get_paywall_state delegates to it.
- public.entitlements columns: id uuid, user_id uuid, tier text, flags jsonb, updated_at timestamptz. RLS enabled; owner policy auth.uid() = user_id, but postgres-owned SECURITY DEFINER bypasses that protection.
- PostgreSQL pg_depend function dependency query returned no rows; this does not establish absence of application or dynamic-SQL consumers.

## Client inspection
- src/services/entitlementService.ts invokes both RPCs only after auth.getUser(), checks optional userId equals current session user, and sends sessionUserId as p_user_id. Direct client usage is compatible with the owner-approved own-account-only contract.
- GitHub code search for get_entitlements/get_paywall_state/entitlementService returned no results (index limitation); **repository-wide consumer inventory NOT established**. Search all branches/files and server/edge/background jobs before rollout.

## Candidate and recovery review
- Forward: supabase/migration_drafts/entitlement_rpc_forward_candidate_review_20261023.sql (BEGIN / ROLLBACK; review only). Restricts both RPC grants to authenticated; entitlement function validates auth.uid and rejects cross-account 42501. Preserves existing paywall body.
- Improvement required: avoid deprecated auth.role() reliance; enforce effective database role and non-null auth.uid(), consider anonymous-authenticated sessions explicitly.
- Recovery: supabase/migration_drafts/entitlement_rpc_safe_recovery_review_20261023.sql revokes EXECUTE from all listed client roles, fail-closed, but currently review-only ROLLBACK. **Recovery was inspected, NOT exercised against a disposable database in this session.** The legacy rollback candidate must never be used because it restores vulnerability.
- Existing 4/4 GitHub Actions PASS on eaf117c, but this is not proof of production acceptance.

## Outstanding deployment gates
1. Repository-wide consumers including edge functions, service_role and background workers, plus actual API behavior.
2. Improve auth.role guard and re-run local tests.
3. Test safe recovery in disposable local environment and validate restore of guarded forward version.
4. Confirm backup/restore operator, recovery procedure and release window.
5. Fresh Production preflight and explicit separate owner approval for cloud write.
6. Staging drift remains NO-GO; do not create legacy objects in staging to fake parity.

No Production/Staging schema or data changed.
