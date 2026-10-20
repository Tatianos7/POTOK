# P5-03C real issuer / account closure integration — test-first gate

Status: REVIEW ONLY; NOT IMPLEMENTED; NOT APPROVED FOR DB APPLY.
Base: PR #182 head ff666f79af1583040bdc5adb9385ccbf55530de2.
This is a continuation checkpoint, not an activation or production migration.

## Verified implementation gap
- `public.food_evidence_review_v1(text)` calls `potok_food_evidence.authority_v1()` before parsing/replay and food-scoped advisory lock. It does not acquire an account closure lock.
- `public.nonfood_evidence_review_v1(text)` calls the same authority helper before the global nonfood catalog advisory lock. It does not acquire an account closure lock.
- `potok_food_evidence.authority_v1()` takes the actor/admin entitlement advisory lock, then SHARE locks on live `auth.users` and `auth.sessions`, and verifies effective admin entitlement and attestation.
- Existing `potok_closure_disposable.assert_active` and `begin_closure` prove an isolated lock protocol only; neither real issuer calls them.
- Existing `p5-03c-issuer-lock-order-v1.test.ts` explicitly asserts absence of closure wiring.

## Mandatory test-first implementation sequence
1. Build a **disposable-only** integration harness that installs both unchanged migration drafts and their real prerequisites in an isolated PostgreSQL 17+ cluster. Do not use a remote URL or Supabase secrets. Report prerequisite gaps rather than mocking away real SQL issuance.
2. Define trusted account state and actor-specific admission inside the *same transaction* as issuance. Actor must derive from verified Auth, not caller-supplied account ID. Missing or untrusted state fails closed.
3. Enforce lock order: existing entitlement/verified Auth gate → per-account closure advisory lock + state row lock → catalog/product locks → evidence mutations. The closure transition must acquire compatible gates without reentering an admin-only issuer helper as end-user authorization.
4. Exercise **actual** `public.food_evidence_review_v1` and `public.nonfood_evidence_review_v1` from two independent DB sessions, each in both serial orders with `ACTIVE → CLOSING`; assert no issuance commits after CLOSING. Include parallel reviewer actors and distinct catalog roots.
5. Exercise exact-byte same-key replay, different-key conflicts, lost-response UNKNOWN recovery, transaction rollback, stale/expired Auth, and closure after issuance COMMIT. Preserve existing receipt and raw/canonical digest semantics.
6. Audit direct RPC bypass, RLS/grants/SECURITY DEFINER ownership, missing-state fail-closed, lock inversions (including deferred authority checks), and deadlocks. Do not call a preliminary HTTP read-side `ACTIVE` observation an issuance authorization.
7. Only after passing the real-issuer harness, propose minimal **inactive** SQL draft changes and repeat all Food, Nonfood, closure, and PR CI suites. No activation or live SQL apply.

## Release blockers unchanged
Account-wide erasure journal, immutable identifying evidence/receipt retention, RESTRICT references to auth.users, backup/Storage/logs inventory, independently verifiable non-linkable shared catalog preservation, and genuine Supabase JWT/PostgREST staging acceptance are unresolved. The owner approved only the personal-erasure/shared-catalog separation principle, not retention periods, migration, staging apply, merge, or publication.

## Evidence and reporting rules
- A green isolated prototype test is not a real-issuer integration pass.
- Keep `ACCOUNT_CLOSURE_IMPLEMENTED=false` and `LIVE_ERASURE_VERIFIED=false`.
- Record exact SHA, test commands, environment, and failures; no fabricated PASS.
- PR #182 stays Draft; no master merge, live Supabase, or operational account deletion.
