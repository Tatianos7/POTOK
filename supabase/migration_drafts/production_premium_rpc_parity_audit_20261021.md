# Production Premium RPC parity — read-only findings (2026-10-21)

Status: REVIEW ONLY / NO-GO. Source: live Production `pg_get_functiondef` read-only inspection on 2026-10-21; no cloud mutation.

## Confirmed live function behavior
- `get_entitlements(uuid)`: `coalesce(p_user_id, auth.uid())`; when resolved user is null, returns Free tier with **empty flags**; when no entitlement row exists, returns Free tier with five flags (`can_view_plan=true`, `can_adapt=false`, `can_explain=false`, `can_voice=false`, `can_spatial=false`); otherwise returns stored `tier` and `flags`. Uses `row_ent.id IS NULL` for missing row.
- `get_paywall_state(text,uuid)`: delegates to `get_entitlements`; adaptation and explainability require `pro`; spatial requires `vision_pro`; otherwise unlocked and returns tier.
- `start_purchase(uuid,text,text,text)`: inserts billing event `purchase_started`, `ON CONFLICT(idempotency_key) DO NOTHING`, returns started/plan; **no provider verification or caller check in function body**.
- `restore_purchase(uuid,text,text,text)`: inserts billing event `restore` with receipt payload, `ON CONFLICT(idempotency_key) DO NOTHING`, returns restored; **no provider verification or caller check in function body**.

## Parity observations and blockers
1. Earlier disposable fixture only tested adaptation. Updated fixture and acceptance now cover explainability and spatial (commits `9833a9d`, `31f6d12`); CI PASS on `31f6d12`.
2. Review hardening draft's `get_entitlements` changes the no-caller case from a Free/empty-flags result to a 42501 denial. This is intentional fail-closed behavior, **not behaviorally identical**; document and test callers before rollout.
3. The local fixture's entitlement table is simplified; Production function checks `entitlements.id` while fixture uses `IF NOT FOUND`. Full production DDL parity is **not yet established**.
4. `get_paywall_state` must retain all three business branches exactly; never replace it with the old adaptation-only fixture implementation.
5. Service-role-only purchase RPCs are a proposed trust boundary, **not proof of payment authorization**. Trusted backend verification, account mapping, and idempotency conflict semantics remain blockers.
6. Exact table-grant SQL replay in disposable Supabase passed, but full Production DDL + actual RPC-body replay is still pending.

## Next required verification
- Extract and compare complete Production DDL for the four affected tables (columns, defaults, constraints, indexes, RLS, triggers, grants) and all four RPC signatures/bodies.
- Inventory actual client/backend call sites for all four RPCs and profile/finance writes.
- Build a disposable production-shape fixture and run exact reviewed function hardening SQL with PostgREST/Auth tests; explicitly test unauthenticated/no-user behavior, full Free/paid feature flags, cross-account denial, and service-role behavior.
- Only then prepare environment-specific migrations with rollback and explicit Staging approval.

No migration to Staging or Production is authorized by this report.
