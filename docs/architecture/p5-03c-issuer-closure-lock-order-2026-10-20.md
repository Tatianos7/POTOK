# P5-03C — actual issuer closure-lock integration contract (review draft)

Status: **UNMOUNTED DESIGN / NO SQL ISSUER MODIFICATION / NO LIVE DB APPLY**.

## Existing verified lock order (inspected in current PR #182)

- `potok_food_evidence.authority_v1()` takes the existing actor/admin entitlement advisory lock and live Auth/session row SHARE locks.
- `public.food_evidence_review_v1(text)` starts with `authority_v1()`, then checks payload/receipt and eventually takes the food-scoped advisory lock.
- `public.nonfood_evidence_review_v1(text)` starts with `authority_v1()`, then takes a nonfood catalog advisory lock, and rechecks authority.
- The prototype `potok_closure_disposable.begin_closure` and `assert_active` share an account advisory lock, but do not execute inside the actual issuer functions.

**Mandatory writer lock order:**
1. Live authenticated user and trusted reviewer privilege, via existing `authority_v1()`.
2. Trusted account-level closure guard **for that exact actor**, verified under the same SQL transaction; acquire the account closure advisory lock then the state row lock; reject missing/CLOSING/CLOSED.
3. Existing food or nonfood catalog gate and any row/CAS locks.
4. Execute event/revision/receipt writes and existing authority rechecks. The account-level advisory lock must stay held until transaction COMMIT/ROLLBACK. Closure's transition must acquire locks in compatible order; no unsupported recursive RPC calls.
5. Deferred COMMIT-time authority/lifecycle checks must not introduce a new reverse lock order. Existing nonfood deferred authority guard currently needs coordinated lifecycle review. No consumer may mistake HTTP preliminary `ACTIVE` for a COMMIT-level guarantee.

**Required account-closure transition lock order:**
1. Trusted actor authorization and any shared actor/admin gate when applicable, consistent with the writer lock order. For end-user account closure, require a dedicated trustworthy authority contract; do not reuse admin-only `authority_v1()` as an end-user permission.
2. Same account closure advisory lock, then row lock.
3. Transition ACTIVE→CLOSING with exact closure key, journal, and commit. No actor-scoped write may acquire a product gate first.
4. Recovery/erasure worker is separate and must never blindly reset CLOSING→ACTIVE.

## Security gates before any live issuance

- Closure admission is enforced **inside the original SQL issuer function**, not only a gateway wrapper, a separate RPC or a client preflight. A call to the existing public RPC must not bypass the check.
- Concurrent issued-vs-closure transactions must be tested by invoking both real `public.food_evidence_review_v1` and `public.nonfood_evidence_review_v1` in independent PostgreSQL sessions, including replay, UNKNOWN, expiration, rollback, same actor with different catalog roots, and parallel reviewers.
- Missing closure infrastructure fails closed. An ACTIVE row created by client input cannot be trusted. Role grants, RLS, function owners, schema privileges and service-role behavior need independent review.
- Existing account records in pre-rollout state require an owner-approved state backfill/migration protocol, not an implicit ACTIVE fallback.
- Retention policy and real account erasure remain unresolved; raw receipt and event copies are identifying. Do not create new production history based solely on passing serialization tests.
- Real Supabase JWT/PostgREST/STAGING checks and DB apply require separate approval.

**Design scope conclusion:** Do not apply the standalone prototype or change existing issuer SQL in this PR until the end-user closure authority, owner-approved retention model, and global writer lock inventory are resolved. These constraints are release blockers; the P5-04 request/status Draft may proceed independently but cannot activate generation.
