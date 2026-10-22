# Premium server-command implementation gate — 2026-10-22

Status: IMPLEMENTATION PREPARATION / NO-GO CLOUD. Scope: Draft PR #184 only.

## Verified starting point
- All four CI checks passed at commit `78d67afd27c813127c382129746a7271be085226`.
- Runtime scan reports 51 candidate references across five services; confirmed legacy direct writers include program generation, delivery, AI trust, diary and goals.
- `docs/premium/nutrition-plan-fact-adaptation-contract-v1-review.md` is PROPOSED, not approved.
- Existing SQL drafts `advance_program_adaptation_atomic` and `adapt_nutrition_program_atomic_v1` are review-only and must not be deployed as production implementation. The latter mutates future `program_days.targets` in place, leaves `program_sessions.plan_payload` unreconciled, reads live mutable goals and applies an unapproved 0.8 nutrition factor.

## Implementable sequence (no implicit owner-policy choices)
1. Create server-only, authenticated command DTO for generation and lifecycle with trusted entitlement, ownership, immutable request digest, expected revision, stable intent ID and typed errors. Do not use caller-provided trust score, nutrition targets or entitlement flags as authority.
2. Add disposable-only storage for intent receipts and immutable plan revision/slot history, based on verified real DDL. Do not mutate existing history as a shortcut.
3. Implement atomic generation and state transitions with one transaction each; CAS, replay and UNKNOWN receipt lookup. Separate user FACT from server-owned PLAN.
4. Implement **proposal only** for nutrition adaptation. Acceptance and nutrition-target mutation remain blocked pending explicit owner-approved nutrition bounds, freshness and acceptance UX policy.
5. Add local Auth/PostgREST tests: cross-user/anonymous denial; entitlement spoofing; same-key replay and mismatched payload; concurrent CAS; transaction failure rollback; plan payload preservation on skip; completed/skipped/consumed FACT immutability; Premium expiry preserving Free diary FACT.
6. Introduce feature-flagged client migration. Old client DML and new server commands cannot both be writable during cutover; prove schema parity and rollback before any grants revoke.

## API boundary (proposal, not deployed)
- `request_program_generation_v1`: user/program type, intent id, expected goal revision, allowed user preferences; no client-supplied authority.
- `set_program_execution_status_v1`: session id, intended FACT action, intent id, expected revision; immutable PLAN never overwritten.
- `propose_nutrition_plan_adaptation_v1`: per approved design document; read-only recommendation with receipt, no PLAN/FACT mutation.
- `accept_nutrition_plan_adaptation_v1`: BLOCKED pending owner policy and schema-backed implementation.

## Stop conditions
- Missing immutable week execution source of truth or receipts => stop, don't invent a parallel store.
- Mutable `entitlements` or client trust score still accepted as authority => stop.
- No atomic transaction or tested receipt replay => stop.
- Dual `program_days.targets` / `program_sessions.plan_payload` conflict => stop.
- New SQL must remain draft-only and must not apply to production/staging.

## Next concrete engineering deliverable
A verified schema dependency map (tables, FK, existing RPCs, authority and grants) plus disposable test fixtures for the first **non-nutrition-mutating** server transition. Then implement and run it before client cutover.
