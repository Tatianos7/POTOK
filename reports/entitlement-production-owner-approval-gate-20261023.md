# Entitlement Production rollout approval gate — 2026-10-23

Status: READY FOR OWNER REVIEW ONLY; NOT APPROVED FOR CLOUD EXECUTION.

## Verified local evidence
Commit 685ca99d5464255d29b49378482efa7d8679cdd4: all four GitHub Actions succeeded, including disposable Supabase local Auth/PostgREST integration. The test reproduces the legacy known-UUID cross-account entitlement read, then replays the reviewed guarded forward candidate and checks that cross-account entitlement and paywall reads are rejected. This does not establish cloud parity or production acceptance.

## Environment gate
Production dtsdnhbcwpbfrhcazqkb has legacy public.entitlements, get_entitlements(uuid), get_paywall_state(text,uuid). Staging ozidryfvhkcbtpnulakq lacks these objects and uses has_verified_entitlement_v2(text). Staging parity is NO-GO; do not create a competing legacy authority in shared Staging.

## Mandatory preflight (read-only, before approval)
- Capture fresh production pg_get_functiondef, pg_get_function_identity_arguments, owner, SECURITY DEFINER flag, search_path, effective EXECUTE for PUBLIC/anon/authenticated/service_role.
- Capture entitlements table columns, defaults, unique constraints, RLS policies, and dependent callers; ensure no drift from the reviewed forward candidate.
- Review the client entitlementService.ts and paywall callers for authenticated own-account usage. Confirm service_role and background jobs do not require the client RPC.
- Ensure a tested and approved backup/restore procedure, deployment window, and rollback operator. Never store user rows, payment records, secrets, or tokens in the review artifact.
- Check exact deployment SHA and verify no new changes since the 685ca99d baseline.

## Production proposal (requires distinct explicit owner approval)
- Execute reviewed forward SQL as a single transaction only after the review-only ROLLBACK is intentionally converted by an authorized operator. Do not execute this document.
- Preserve function signatures, return JSON, defaults, and paywall semantics; restrict both functions to authenticated, own-account only, with SQLSTATE 42501 for cross-account.
- Validate own-account free/paid, missing row fallback, explicit self UUID, cross-account UUID, anon, service_role, and paywall feature decisions through the actual API.
- Inspect PostgREST exposure and grants, error rates and application telemetry after release. Stop rollout if any unexpected consumer breakage or data-access regression occurs.
- Emergency recovery: revoke EXECUTE on both RPCs (fail closed), never restore the insecure legacy body. Record a separate authorized recovery operation.

## No-go conditions
- Staging parity assumed rather than demonstrated.
- Changed Production function body or table schema without re-review.
- Missing backup, unknown privileged consumers, unexpected grants, failed negative authorization checks.
- Unsafe legacy rollback candidate used as a fallback.

## Owner decision needed
Approve a production-specific migration execution **separately**, after a fresh read-only preflight and a reviewed operational runbook. This report and CI success are not authorization to deploy.

## Related files
- supabase/migration_drafts/entitlement_rpc_forward_candidate_review_20261023.sql
- supabase/migration_drafts/entitlement_rpc_safe_recovery_review_20261023.sql
- reports/entitlement-staging-schema-drift-gate-20261023.md
- reports/entitlement-clean-legacy-fixture-test-gap-20261023.md
