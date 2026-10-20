# Nutrition Integrity #170 — privileged Supabase read preflight and atomic read boundary

Status: **isolated code, not a live database adapter**. No migrations, SQL execution, RLS modifications, diary writes, runtime imports or production deployment.

## Read-only inspection (2026-10-20)

Using the connected Supabase project `dtsdnhbcwpbfrhcazqkb`, a read-only table listing for `public` and `nutrition_integrity_private` returned existing `public.foods` and `public.food_diary_entries`, but **no private reviewed-evidence tables**. The response does not demonstrate any live source of authoritative canonical/nutrition revisions, immutable approval/invalidation events, their complete history, or actor-at-event-time authorization. No writes or schema changes were executed. This is a table-list preflight only, not a complete schema/grant/RLS audit.

## New isolated code

`src/server/nutritionIntegrityAtomicReadPortV1.ts` defines the interface `AtomicReviewedEvidenceStoreV1.readComplete(foodId)`. A privileged future implementation must return either `UNAVAILABLE` or a `COMPLETE` snapshot. The pure boundary rejects missing identity, unavailable storage, incomplete payloads, invalid chains, unauthorized events, incorrect food identity, and exceptions. It delegates raw artifact/digest/approval/invalidation validation to the merged evidence adapter.

**This interface cannot prove completeness, atomicity or event issuance itself.** A malicious or broken adapter could present two valid approvals while hiding a later invalidation. `COMPLETE` is a privileged server/store assertion, **not** a field permitted in a browser request. Even a positive result is not authorization to write a diary row.

## Blocking implementation gates — separate approval required

1. Design and approve **immutable** canonical and nutrition revision storage, retained raw bytes, approval/invalidation event persistence and append-only semantics, current head and food-state binding, reviewer authorization and trusted issuance/audit trail. Do not reuse `foods.verified` as confirmation.
2. Implement a **transaction-consistent, exhaustive** query for both revisions and all relevant events, with no pagination omissions; verify SQL privileges/RLS/service roles and evidence visibility. Establish event-time actor authority **independently of signed-looking event fields or hashes**. Inspect exact live schema before proposing executable migrations.
3. Prove change isolation: concurrent invalidation, supersession, admin updates and writes must not produce stale `CONFIRMED`. The diary write gate must revalidate inside the same enforceable DB boundary; a read result from this module is never a reusable approval token.
4. Resolve provenance and ownership for user-declared foods, curated legacy basis and food-specific density/measure conversions. Unknown or ambiguous data stay UNKNOWN, no default ml = g.
5. Before any rollout, test direct PostgREST bypass, old clients, all diary writer paths, immutable historical snapshots, RLS, admin recompute functions, idempotency and rollback. Keep Premium PLAN separated from verified FACT.

The new tests exercise fail-closed behavior through synthetic stores, not a live Supabase connection. This PR may be merged only as unused groundwork after successful CI and owner authorization.
