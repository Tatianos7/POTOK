# Production legacy entitlement fixture — independent verification gate

Status: REVIEW ONLY. No cloud writes.

## Finding
The existing disposable fixture in scripts/contracts/supabase-local-auth-fixture.sql starts with the **already guarded** get_entitlements body, rather than the exact vulnerable production legacy body. Consequently the current successful forward/recovery replay is useful but does not independently demonstrate a clean production-legacy-to-guarded migration.

## Verified production legacy behavior
Production get_entitlements(uuid) is SECURITY DEFINER, returns jsonb, coalesces p_user_id with auth.uid, and queries public.entitlements by UUID without ownership check. For a null resolved user it returns tier free and empty flags; for a missing entitlement row it returns tier free and the five default flags. Paywall delegates to it and maps adaptation/explainability/spatial to locked responses.

## Required isolated acceptance
1. Restore exact legacy function bodies from pg_get_functiondef in a disposable local fixture, not cloud.
2. Verify pre-patch known-UUID cross-account read is reproducible locally.
3. Apply exact reviewed forward SQL to the clean legacy fixture, not after unrelated broad Premium RPC changes.
4. Verify authenticated own-account free/paid results, cross-account denial, anonymous and service_role denial, paywall delegated denial, and grants for both RPCs.
5. Apply fail-closed recovery and verify both RPCs deny access; reapply guarded forward and verify restoration.
6. Record exact source hashes, GitHub Actions SHA and test results. Quarantine the unsafe legacy rollback; it must never be used in production.

## Decision
Do not create legacy entitlement objects in staging (which uses has_verified_entitlement_v2). Production rollout remains a separate owner-approval gate.
