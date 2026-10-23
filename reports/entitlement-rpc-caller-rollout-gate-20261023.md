# Entitlement RPC caller inventory and rollout gate — 2026-10-23

Status: REVIEW / NO DEPLOY.

## Evidence
GitHub Actions run 39899604444 uploaded `premium-rpc-callsite-inventory` (artifact 12478391605). The inventory reports 519 tracked source files, generated commit `41219b7b75014b90309861f0d923496511a7fce6` (not the exact reviewed commit `b9cd6cf`; refresh at rollout HEAD).
- `src/services/entitlementService.ts:33` is the only app-source direct `get_entitlements` RPC call detected; :45 is the only app-source `get_paywall_state` call.
- Other direct name references are in test scripts and SQL audit scripts.
- No app-source `start_purchase` or `restore_purchase` named call detected by this literal-string inventory.
- Dynamic construction, remote Edge Functions, and untracked code are outside this scan; do not claim exhaustive runtime coverage.

## Reviewed client
`EntitlementService.getSessionUserId()` uses `auth.getUser()`, rejects caller-supplied mismatched user IDs, and sends the session ID to both RPCs. Its helper methods require a logged-in user. Existing client paths are compatible with the own-account guard.

## Live production read-only check
`public.get_paywall_state(text,uuid)` delegates to `public.get_entitlements(p_user_id)`. This means the isolated change will also deny anonymous/cross-account paywall calls even without modifying the paywall function definition. This is desirable authorization-wise, but is a behavior change; check external consumers before release.

## Required next release criteria
1. Refresh exact HEAD caller inventory and check any server-side service-role usage. The isolated function explicitly requires `auth.role()='authenticated'`, so service-role calls could fail despite EXECUTE privilege.
2. Ensure anonymous paywall rejection is part of the documented error contract.
3. Create a forward migration and separately reviewed rollback based on live DDL, without changing unrelated RPCs or table grants.
4. Replay exact forward AND rollback on disposable local Supabase; test own reads, anonymous and cross-account denial, paywall delegation, service-role policy, and return schema.
5. Only after explicit owner authorization consider staging rollout. Production, staging, and master remain unchanged.
