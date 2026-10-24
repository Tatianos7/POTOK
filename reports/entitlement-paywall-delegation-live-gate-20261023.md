# Paywall entitlement delegation live gate — 2026-10-23

Status: REVIEW / NO-GO for rollout pending paywall grant decision.

## Production read-only evidence
- public.get_entitlements(uuid) exact body: resolved_user := coalesce(p_user_id, auth.uid()); returns free + empty flags for null UUID, otherwise reads entitlements by supplied UUID without caller ownership check. Existing forward candidate preserves non-null fallback flags and adds authenticated own-account guard.
- public.get_paywall_state(text,uuid) exact body: calls public.get_entitlements(p_user_id), reads tier/flags and returns locked responses for adaptation, explainability, spatial, otherwise unlocked tier. Does not mutate state.
- Effective EXECUTE on BOTH RPCs: anon=true, authenticated=true, service_role=true as of inspection. No production writes performed.
- Because paywall delegates to entitlement RPC, the guarded body should deny anonymous/cross-account callers. However its broad EXECUTE grants remain unnecessary and can be confusing.

## Proposed additional decision
Align public.get_paywall_state(text,uuid) EXECUTE to authenticated-only (REVOKE from PUBLIC,anon,service_role; GRANT to authenticated), matching the approved get_entitlements policy. This is a grant-only change; do not alter paywall behavior, feature mapping or response JSON. Add disposable local privilege assertions for both functions and Auth/PostgREST negative cases. Requires explicit owner approval because previous scope was only get_entitlements.

## Additional release risks
- SECURITY DEFINER may permit call chains even when caller lacks direct EXECUTE on delegated get_entitlements; check in real Auth/PostgREST tests and avoid assuming grant alone secures the chain.
- An emergency fail-closed recovery of get_entitlements may not be sufficient if other SECURITY DEFINER functions can access entitlement data independently.
- No cloud migration until separate owner approval, staging verification and exact HEAD CI PASS.
