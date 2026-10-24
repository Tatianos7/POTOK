# POTOK Premium — Nutrition adaptation PLAN/FACT contract v1 (PROPOSED)

Status: REVIEW ONLY / NO-GO for deployment. Owner approval required for product policy. This document does not replace existing Premium contracts.

## Boundaries and ownership
- `GOAL`: user-approved objective and macro targets. A plan adaptation MUST NOT update `user_goals`, goal revisions, or the user's objective implicitly.
- `PLAN`: a versioned weekly execution instance and its future, unexecuted slots. A new adaptation produces an immutable plan revision; old revisions remain readable.
- `FACT`: diary entries, meal execution outcomes, food snapshots, and completed/skipped workout sessions. They are append-only/audited by their respective owners and MUST NOT be recomputed, deleted or silently overwritten by plan adaptation.
- `PROPOSAL`: suggested adjustment requiring explicit user acceptance where product policy changes goals or nutrition targets. Suggestion is not an applied plan.
- `RECEIPT`: durable result of a single adaptation intent, scoped to user/program/week and immutable request digest.

## Server command (design, not implemented)
`propose_nutrition_plan_adaptation_v1(program_id, week_instance_id, expected_plan_revision, intent_id, context_revision)`
- Authenticated caller owns program/week; trusted server entitlement is verified (not client-editable flags).
- Read consistent, immutable goal revision and active plan revision, not live mutable goals alone.
- Validate requested week and lock week execution instance; CAS on plan revision.
- Only server-derived bounded recommendations; no arbitrary client calories, macro factors, or mode that directly changes nutrition targets.
- Create immutable proposal and reason/evidence references; do not mutate PLAN or FACT.
- Return stable receipt. On retry with same intent/digest return the original result; changed payload with same intent is conflict.
- Fail closed for missing evidence, ambiguous identity, stale plan, invalid entitlement, and untrusted FACT.

`accept_nutrition_plan_adaptation_v1(proposal_id, expected_plan_revision, intent_id)` (design, not implemented)
- Explicit acceptance where required; recheck owner, trusted entitlement, freshness, CAS and proposal expiry.
- Atomically create new immutable plan revision, remap only future unexecuted slots, append audit evidence and receipt, advance active pointer.
- If any write fails, transaction rolls back entirely; recover UNKNOWN by receipt lookup, never blind retry with a new key.
- Completed, skipped, consumed or otherwise FACT-bound slots remain unchanged. No silent deletion/replacement of executed slots.
- Reconcile `program_sessions.plan_payload` and any other materialized plan representation before advancing the pointer; no dual conflicting sources of truth.
- Return revision identifiers, changed slot count, preserved FACT count, reason codes and receipt ID.

## Invariants / acceptance gates
1. PLAN != FACT; no adaptation SQL writes to diary FACT, immutable nutrition snapshots, goal records or completed/skipped sessions.
2. An adaptation is scoped to exactly one execution week and one active plan revision.
3. Immutable revisions, CAS, idempotency and receipts survive concurrent requests, retries and crash/UNKNOWN recovery.
4. Historical and executed slots never change; future slot replacement is atomic and traceable to source revision.
5. Calorie and macronutrient changes require an owner-approved, validated nutrition policy, including minimum bounds and macro-energy consistency. Never scale protein/fat/carbs by a blanket 0.8 factor.
6. No action from this contract may be exposed before trusted entitlements, public grants/RLS, client-writer removal, schema parity, and rollback drills pass.
7. Free-tier FACT remains usable after Premium expiry; expiry never deletes FACT.
8. Errors must be typed and stable: unauthorized, forbidden, entitlement_required, stale_revision, idempotency_conflict, proposal_expired, evidence_unavailable, plan_fact_conflict, no_eligible_slots, retry_unknown.

## Current Draft PR #184 gap assessment
- `adapt_nutrition_program_atomic_v1` currently updates `program_days.targets` in place, reads mutable `user_goals`, and applies unapproved blanket scaling. It is **not compliant** with this contract and MUST remain review/test-only.
- Existing test coverage for atomic rollback and idempotency is valuable but does not validate immutable PLAN revisions or FACT isolation end-to-end.
- Need read-only inventory of `program_days`, `program_sessions.plan_payload`, meal FACT owners, and weekly execution/receipt tables before any SQL implementation.
- Need owner decisions on adaptation policy, proposal/acceptance UX, freshness window, and historical retention. Do not invent defaults.

## Next implementation order
1. Read-only schema and writer audit; map authoritative PLAN, FACT, goals and revision ownership.
2. Draft DTO, typed errors, invariants and failure-mode tests against real schema.
3. Draft immutable week/revision/receipt storage and atomic acceptance as disposable-only SQL.
4. Run local Auth/PostgREST concurrency, cross-user, replay, rollback and FACT-preservation tests.
5. Owner review and separate explicit rollout approval. No cloud apply or merge.
