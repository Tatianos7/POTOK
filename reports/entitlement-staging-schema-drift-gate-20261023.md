# Entitlement rollout: staging schema drift gate — 2026-10-23

Status: STAGING NO-GO; local CI 4/4 PASS on f168928cdbab80be254897eed7845fab66aa1bcb.

## Read-only live audit (no cloud writes)
Production project dtsdnhbcwpbfrhcazqkb:
- public.entitlements exists.
- public.get_entitlements(uuid) and public.get_paywall_state(text,uuid) exist, SECURITY DEFINER, owner postgres, search_path public,pg_temp.
- get_paywall_state delegates to get_entitlements.
Staging project ozidryfvhkcbtpnulakq:
- public.entitlements **absent** (to_regclass null).
- public.get_entitlements and public.get_paywall_state **absent** (exact pg_proc lookup empty).
- public.user_profiles exists in both environments.
- Staging has 2 other public functions with names containing entitlement; these are not evidence of API parity.

## Consequences
The approved forward migration uses CREATE OR REPLACE FUNCTION get_entitlements returning a composite row of public.entitlements and changes grants on get_paywall_state. Running it directly in current staging cannot be accepted as representative and likely fails due to missing dependencies. DO NOT use production as a substitute test target.

## Required safe sequence
1. Identify staging's purpose and whether the missing legacy entitlement/paywall objects are intentionally excluded; inspect their migration provenance and any conflicting entitlement APIs.
2. Prepare a **review-only** staging parity fixture/migration, including public.entitlements and both RPCs with production-equivalent signatures, grants, and representative data. Do not clone real user data, payment records, tokens, or secrets.
3. Validate parity fixture on disposable local Supabase, including owner/default/ACL and negative cross-account/anon/service_role cases.
4. Request distinct owner approval for any staging DDL or data writes; use a reversible, reviewed rollout with backups.
5. After parity is proven, apply the approved forward candidate to staging only with explicit approval, run Auth/PostgREST acceptance and recovery drill, and record exact SHA/results.
6. Only then consider a separately authorized production migration. Existing review files end with ROLLBACK by design; they are not executable deployments.

## Security boundaries
- Owner approved authenticated-only policy for get_entitlements and get_paywall_state; not a cloud deployment.
- Legacy rollback restoring cross-account reads is unsafe; emergency response must be fail-closed.
- Never weaken production ACLs or use a privileged service_role bypass to compensate for staging drift.

## Verdict
Local CI passed, but staging readiness blocked by structural drift. Not yet safe to declare full security plan complete or resume plan generation on that basis.
