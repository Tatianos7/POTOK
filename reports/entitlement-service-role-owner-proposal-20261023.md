# Entitlement service_role owner decision proposal — 2026-10-23

Status: PROPOSED, awaiting owner approval. No cloud writes.

## Evidence
- Checked-out GitHub Actions callsite inventory artifact 12479729986: 519 tracked source files; only application direct get_entitlements call at src/services/entitlementService.ts:33 and get_paywall_state at :45. The inventory's embedded commit was c5531ba9, so rerun for exact release HEAD.
- src/services/entitlementService.ts obtains auth.getUser() and passes the same session UUID.
- src/services/adminAccessService.ts calls has_verified_entitlement_v1, not get_entitlements.
- supabase/functions/adaptive-nutrition-generate-v2/index.ts uses anon key with forwarded user Authorization, not service_role.
- Production read-only pg_proc inspection found get_paywall_state(text,uuid) as the only other public SQL function referencing get_entitlements.
- Disposable local Auth/PostgREST forward/rollback/forward acceptance PASS at GitHub Actions run 39904704220.

## Proposed decision
For public.get_entitlements(uuid), support authenticated own-account reads only. Deny anon and deny service_role through this public user-facing RPC. Do not grant service_role EXECUTE merely as decoration; remove service_role from the forward candidate GRANT. A future legitimate trusted backend requirement should use a separately reviewed server-only interface with explicit service authentication and least privilege.

## Why
Current forward draft GRANTs service_role EXECUTE, while its auth.role() check rejects service_role. Align grants with behavior. Avoid privileged cross-user reads through a public-facing RPC. The absence of tracked callers does not prove absence of external integrations; confirm owner knows of none before staging.

## Approval request
Owner approval for authenticated-only public get_entitlements, no service_role support through this RPC; retain review-only state until accepted. Then update SQL candidates and acceptance tests to assert service_role denial explicitly.

## Risk
Do not deploy the existing forward candidate as final: its service_role grant is inconsistent. Rollback candidate restores vulnerable cross-account reads and is emergency-only. No production, staging or master modifications authorized.
