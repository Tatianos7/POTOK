# Shared Food Eligibility V1 — disposable implementation

Implementation source: PR #154 `b36f55500fc4b142bfa7b3029dc4c511a9d58c75`,
tree `e0dc5f3baa8fc47b6e3395eae4a0b3a3c3f474db` (locally reconstructed/verified).
Design: PR #155 `366be8f5ad8bdf1617cf98923dd39d70a77e7563` and
architecture comment https://github.com/Tatianos7/POTOK/pull/155#issuecomment-6087439316.
Separate implementation branch. Neither original PR is changed.

## Scope and gates

Disposable SQL only. No Supabase apply, existing consumer activation, deployment,
production or merge. An acknowledgement GUC is an accident-prevention mechanism,
not a security proof identifying the database. Do not use this draft on persistent DBs.
Persistent rollout remains BLOCKED by retention/account deletion and full C rollout.

Private tables: registered roots/key claims/epoch; immutable decisions; mutable
head projection; immutable actor-scoped receipts; immutable issuance epoch bindings.
Existing `foods.id`, canonical root and stable key remain identity. UUIDs newly
issued by the server identify decisions only. Food Evidence Phase 1 wire/digests
are unchanged. All history FK deletions RESTRICT; no CASCADE evidence erasure.
These draft FKs deliberately do not implement account deletion; applying them
persistently before an approved erasure lifecycle would be unsafe.

UNKNOWN/empty registry denies NEW approvals, never defaults to ELIGIBLE.
Explicit first registration PENDING; transitions PENDING -> ELIGIBLE/HIDDEN/BLOCKED,
ELIGIBLE -> HIDDEN/BLOCKED, HIDDEN -> ELIGIBLE/BLOCKED.
Same-state commands rejected except exact actor/idempotency replay.
BLOCKED clearance is disabled pending its authority/clearance policy.
ARCHIVED is not accepted by decoder, SQL command or table constraint. No archive
activation is claimed. Identity reassessment after drift can use HIDDEN -> ELIGIBLE;
it never restores old issued evidence after ABA.

## Trust and consistency

Server uses the reviewed existing `potok_food_evidence.authority_v1`, whose
entitlement source is `potok_control`, verified session and profile provenance.
No parallel entitlement, no `is_admin`, flags, client actor/time/authority fallback.
JWT cryptography is a PostgREST/gateway prerequisite, not performed by SQL or the
synthetic DB harness. Admin authorization is rechecked after lock waits and before
decision insertion. Private schema/table/function access revoked from public,
anonymous, authenticated and service-role callers; FORCE RLS without client policies.
Only narrowly granted public SECURITY DEFINER RPCs; qualified pg_catalog search_path.
Database owner/DDL privileges are outside the caller threat model.

Requests: exact duplicate-aware raw JSON, 16KiB UTF-8 cap, all fields mandatory.
Counters are canonical decimal integer strings up to signed bigint, no numbers or
defaults. New domains separate input digest and exact identity fingerprint. SQL/TS
digest equivalence is in acceptance. Reasons may contain PII: finite retention and
erasure proof are UNAPPROVED, not treated as solved by private RLS.
Head CAS requires decision ID AND version, with identity fingerprint AND epoch.
Actor/key gate serializes same-actor retries; conflicting canonical content fails.
Different actors serialize on food row and one wins the expected head CAS.

Common order for new decision/Food Evidence writers/readers:
actor/admin gate -> live Auth rows -> foods row -> stable-key gate (decision/mutation)
-> registry -> evidence head/receipt. Food Evidence no longer takes the incompatible
food advisory gate. Root row is FOR UPDATE throughout each operation.
Mutation trigger begins after row lock, then sorted old/new key gates; it never
acquires actor gates. Existing grant/revoke serialization means a revocation is
linearized with an in-flight command, not retroactively applied to its transaction.
Clock/session/entitlement expiry is checked again after waits.
Arbitrary multi-row catalog transactions are NOT certified deadlock-free: caller
must order root rows deterministically; DB deadlock abort is fail-closed. Full
importer/admin writer integration and retry policy belong to C rollout.

## Epoch and key protection — exact claimed boundary

For registered roots only, trigger increments epoch on changes to exact identity
fields, root/source/owner, ordered aliases (NULL differs from []), including A->B->A.
Nonidentity nutrition fields do not alter identity epoch. Bigint overflow aborts.
Registration takes row/key locks, denies malformed roots or existing duplicate keys.
INSERT/UPDATE trigger serializes claimed-key collisions even across different roots.
Registered ID/key changes, registered root deletion, and foods TRUNCATE are denied.
Unregistered duplicates are NOT repaired; onboarding refuses them.
Catalog mutation trigger requires READ COMMITTED, including unregistered writes:
a stale repeatable snapshot could otherwise miss a newly committed key claim.
This writer compatibility restriction is disposable-only and requires C review
before persistent deployment; it is not silently imposed on deployed consumers.
Unregistered private-food behavior is not otherwise promoted to shared eligibility.
This is protection while the draft triggers are installed in the disposable DB,
not proof every deployed writer/replication/admin DDL participates. No global
catalog backfill/unique-index deployment, importer rollout, archive tombstone or
terminal ID reuse policy is claimed.

Approved evidence gets an additional private issuance binding to decision, epoch
and fingerprint. Current usability and nutrition canonical dependencies verify
it. Restoring identity bytes and reapproving registry cannot revive pre-ABA artifacts.
No digest cycle; the extra metadata is not inserted into Phase 1 artifacts.
Rejection doesn't require eligibility/revision; invalidation requires exact existing
revision and source but not current eligibility. Authorized history returns false
usability on HIDDEN/BLOCKED/drift; exact receipt replay is historical, never access proof.

## Isolation and acceptance

No resolver/search/diary/recipe/favorite code, read policy or view is changed.
Empty registry DB snapshots and legacy service regression tests are separate checks;
synthetic SQL reads are NOT a deployed Supabase/browser end-to-end parity proof.
Deletion/truncate/claimed-key write behavior is deliberately affected by disposable
guards and excluded from a blanket legacy-writer compatibility claim.

Dedicated suite ports the 22-test Food Evidence baseline into a Staging-shaped
schema without is_searchable/needs_review, then exercises registry/ABA/CAS/key races,
history, role ACLs and immutability. It creates its own Unix-socket cluster, accepts
no external DB URL, uses actual trusted-entitlement SQL and cleans up the cluster.
`POTOK_FOOD_EVIDENCE_REQUIRE_DB=1` makes unavailable infrastructure FAIL, not SKIP.
Run Node 24/PostgreSQL17+:

    POTOK_FOOD_EVIDENCE_REQUIRE_DB=1 node --import tsx --test --test-isolation=none scripts/contracts/shared-food-eligibility-disposable-db-v1.test.ts

Local Cloud has no initdb/pg_ctl/psql: local attempt FAIL (infrastructure), zero SKIP.
Real PostgreSQL result must be taken from the separate implementation PR CI at its
exact HEAD; original PR #154 22/22 is only a baseline, not this implementation PASS.
CI uses postgres:17, Node24, contents:read, no deployment/credentials/persistent DB.

Remaining gates: real JWT/PostgREST test; deployed metadata/ACL audit; complete
writer/locking/replication coverage; finite retention/account closing/erasure;
BLOCKED clearance; archive C; real consumer parity and explicit activation approval.
No safe persistent rollback by deleting audit/key history. Disposable rollback is
destruction of the test cluster only. Persistent rollout stays BLOCKED.
