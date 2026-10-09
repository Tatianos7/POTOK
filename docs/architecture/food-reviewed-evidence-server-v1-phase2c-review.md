# Phase 2C — security and architecture review

Reviewed source: `83775adab16c089f369246d1973c1d4039abc3a5`.
Source tree: `f11e59c9b3a52d1f01a973f13e0d9c2e7fdd3f96`.
Workspace: `/workspace/POTOK-phase2b`, existing Phase 2B branch.
All ten paths in that commit were reviewed against Phase 1 and the existing
trusted-entitlement package. No Supabase calls, database apply, deployment,
runtime activation, master changes, push or merge were performed.

## Verdict

**BLOCKED for a positive Staging rollout review/approval.** Local fixes and
static review are complete, but PostgreSQL acceptance and the deletion/retention
decision remain open. This is not a demonstrated authorization bypass; it is a
verification gap and an unresolved operational compatibility gate. The package
can be inspected by the owner now; it is not approved for migration apply.

## Findings and disposition

| ID | Severity | Location | Scenario and disposition |
| --- | --- | --- | --- |
| M1 | MEDIUM | SQL draft, `public.food_evidence_receipt_v1`; gateway `verifyFoodEvidenceReceiptV1` | Lookup returned five fields using the same receipt contract as the six-field review response. Missing `replayed` made recovery fail strict verification. Fixed lookup to return explicit `replayed: true`, without changing stored evidence or its digest. Added same-actor SQL lookup/binding checks and a passing pure receipt-shape regression. Actual SQL execution remains NOT VERIFIED. |
| M2 | MEDIUM | SQL draft, `public.food_evidence_current_v1` | A token could expire while the current-state reader waited for the food lock; only the mutator rechecked authority after such a wait. Added a fresh authority check after food/catalog locks. Added a real multi-session PostgreSQL expiry-after-wait test, presently SKIPPED. No claim of behavioral DB verification is made. |
| H1 | HIGH operational compatibility gate | SQL draft, FKs in canonical/nutrition revisions, events, requests and current heads | Referenced shared food roots cannot be deleted under RESTRICT, even after invalidation/supersession. Account deletion must retain or explicitly address event/request/attestation references. Keep RESTRICT pending an owner-approved retention/deletion policy; do not silently switch to CASCADE/SET NULL or disable immutable triggers. |
| V1 | Unverified rollout gate | Disposable DB runner and unmounted real SDK gateway | SQL compilation, actual grants/RLS, transaction rollback, races, and real Auth/PostgREST acceptance have not been demonstrated in this environment. Run the existing real PostgreSQL suite and review Staging metadata before approving apply; actual JWT signature/session behavior requires a separately approved server test. |

No Critical issue or confirmed client privilege-escalation path was found in
static inspection. This statement is bounded by V1; it is not a database security
acceptance PASS.

## Coverage of the original ten files

| File | Review result |
| --- | --- |
| `src/server/foodEvidenceReviewRequestV1.ts` | Duplicate-aware raw string parsing, exact variants/fields, no client authority/time defaults, exact scale-3 nutrition, frozen owned snapshots; retained-source decoder reused. Request/proposal domains are separate from artifact domains. |
| `src/server/foodEvidenceReviewGatewayV1.ts` | Real SDK `getUser(token)` and same-JWT RPC transport; publishable/legacy anon key classification is not authentication. Staging origin only, no service credential fallback, no mounted entrypoint. Receipt verification pins actor, request, source, proposal and target. |
| `src/utils/foodReviewedEvidenceV1.ts` | Only an additive strict retained-source decoder export. Existing Phase 1 artifact shapes, domains, bindings and serialization remain unchanged. Adaptive Nutrition source is unchanged. |
| `supabase/migration_drafts/food_reviewed_evidence_v1_phase2b.sql` | Static checks described below; M1/M2 fixed in code. H1/V1 open. Not applied or compiled by PostgreSQL. |
| `supabase/migration_drafts/food_reviewed_evidence_v1_phase2b.preflight.sql` | Matches the migration preflight; owner/roles/Staging columns/trusted function ownership/search path/attestation ACL/FORCE RLS/explicit target checks. No Main fallback or repairs. Target marker is an acknowledgement, not proof of project identity. |
| `supabase/migration_drafts/food_reviewed_evidence_v1_phase2b.postcheck.sql` | Read-only metadata queries only: owners, ACL, grants, RLS, function configuration and triggers. No user payload/source/token queries. Not executed against Supabase. |
| `src/server/__tests__/foodEvidenceFixturesV1.ts` | Explicitly synthetic data and authority strings; no production evidence, credentials or real JWTs. Hash fixture creation is not authorization. |
| `src/server/__tests__/foodEvidenceReviewServerV1.test.ts` | Negative raw boundary, source, decimal, authority-payload and receipt bindings; HTTP tests use labeled transport doubles. These do not prove server signature verification or SQL atomicity. M1 regression added. |
| `scripts/contracts/food-evidence-disposable-db-v1.test.ts` | Own Unix-socket-only cluster, no external DB URL, stripped PG environment, `psql -X`, actual trusted SQL loaded, real parallel sessions. No mock DB model. New recovery and expiry-after-wait cases added; whole DB suite SKIPPED. |
| `docs/architecture/food-reviewed-evidence-server-v1-phase2b.md` | Consistent inactive Staging-first scope; explicit limitations and rollout gates. Baseline test results now labeled historical; links to this review. |

## Security and transaction model: static evidence

- Auth claims come from the verified PostgREST boundary, not request fields.
  Actor is `auth.uid()`, authority reference is the exact effective admin
  attestation, and issuance time/IDs are server-generated. Session/user existence,
  anonymous status, token/session expiry and profile provenance are checked.
  No `is_admin` or user metadata fallback exists in the new SQL.
- The existing entitlement-v2 actor/admin gate is shared with grant/revoke writers.
  No duplicate entitlement ledger is created. Main-shaped infrastructure fails
  preflight; missing trusted infrastructure is never synthesized.
- All six private tables enable and force RLS, with no client policies. Schema,
  table and helper EXECUTE privileges are revoked from PUBLIC/anon/authenticated/
  service_role. Only three public authenticated RPCs are granted EXECUTE; each
  verifies authority internally. Postgres-owned SECURITY DEFINER with qualified
  objects and `search_path=pg_catalog` is intentional, not proof of isolation by
  itself. Database owner/privileged DDL is outside the client threat model.
- READ COMMITTED is required. Actor serialization protects actor/key receipt
  uniqueness; a food-scoped gate also serializes different reviewers. Head CAS
  checks ID and digest, including first-head absence. Errors roll back the source,
  revision, event, head and terminal receipt together. Revoked authority cannot
  replay a receipt; changed canonical bytes conflict instead of creating another
  event. These mechanisms are present in code; real concurrency remains V1.
- Phase 1 domains/encoding are retained. Nutrition binds canonical ID/digest/
  food/state; source text XOR base64, canonical bytes, length/SHA and complete
  field/applicability mappings are checked. No normalization of nutrition, digest
  cycle, second food identity, importer authority or generator activation exists.
- Five immutable tables reject UPDATE/DELETE/TRUNCATE, including ordinary owner
  DML. Heads are a mutable internal projection. Invalidation is append-only,
  severity cannot downgrade, supersession is independent and historical
  invalidation does not restore a prior head. Privileged DDL can disable guards;
  this package does not claim protection from a malicious database owner.

## Deletion and retention impact

Shared-root food deletion receives new RESTRICT references from four evidence
tables. That is a real operational behavior change after apply, despite the lack
of food-row DML. Invalidation does not release those references. External cleanup
jobs/admin SQL outside Git have not been inspected.

`src/services/foodService.ts:1280` deletes only source=user foods owned by the
session user; such foods cannot enter this shared-root issuance contract. Thus
that specific delete path is not newly referenced by valid evidence.

The existing trusted-entitlement-v2 package already has an auth.users RESTRICT FK
(`20260921_trusted_entitlement_v2.sql:58`). Do not attribute all existing admin
account-deletion restrictions to Phase 2B. The new event/request FKs add retention
dependencies that still need an approved account-erasure/tombstone policy and
an integration test. No deletion test was executed against actual account data.

## Actual verification

Node: 24.19.0. No PostgreSQL `initdb`, `pg_ctl`, `psql` or server binaries found.
Docker is installed, but daemon access to `/var/run/docker.sock` returned
`connect: operation not permitted`; no container was started and no image pulled.
No attempt was made to bypass sandbox restrictions.

Executed:

```sh
node --import tsx --test --test-isolation=none \
  src/server/__tests__/foodEvidenceReviewServerV1.test.ts \
  src/utils/__tests__/foodReviewedEvidenceV1.test.ts \
  scripts/contracts/food-evidence-disposable-db-v1.test.ts
```

Result: **29 PASS, 0 FAIL, 1 SKIP** (15 server tests, 14 Phase 1 tests; DB SKIP).

Re-ran the same fifteen related regression files as Phase 2B: Food Canonical,
review/alias/missing-food services/page, curated/reviewed recipe evidence,
Adaptive authorities/graphs/activation/server/persistence/today-runtime.
Result: **274 PASS, 0 FAIL, 0 SKIP**.

```sh
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/tsc --noEmit --strict --skipLibCheck --target ES2020 \
  --lib ES2020,DOM,DOM.Iterable --module ESNext --moduleResolution bundler \
  --allowImportingTsExtensions scripts/contracts/food-evidence-disposable-db-v1.test.ts
./node_modules/.bin/eslint src/server src/utils/foodReviewedEvidenceV1.ts \
  scripts/contracts/food-evidence-disposable-db-v1.test.ts --ext ts --max-warnings 0
git diff --check
```

All completed successfully. SQL execution/RLS/atomicity/parallel-session assertions
and live JWT verification are **NOT VERIFIED**, not PASS. Node 18/Deno remain
unverified. Static scope and limited secret-pattern scanning do not replace DB
acceptance or a dependency audit.

## Next safe action

Run the disposable PostgreSQL 17+ suite in an authorized local environment with
pgcrypto; resolve any actual SQL failures there. Review trusted Staging metadata,
function definitions and client-role grants without data mutation. Obtain the
owner's shared-root deletion and account-retention decision, and agree resource/
timeout/rate limits and synthetic-test cleanup before a separate rollout apply
approval. Do not activate users or apply this draft as part of this review.


## PostgreSQL acceptance update — 2026-10-09 (Draft PR #154)

**Authoritative later result (supersedes the earlier cloud-environment NOT VERIFIED statement for the disposable PostgreSQL suite only):** GitHub Actions run [#9](https://github.com/Tatianos7/POTOK/actions/runs/37973469179) completed successfully on PR head `50390548a48367a86ed862564a1a90dd7910c813`. Workflow: `Food Evidence disposable PostgreSQL acceptance`; PostgreSQL 17 container, Node 24, required disposable DB mode. TAP result: **22 tests, 22 pass, 0 fail, 0 skipped**. The top-level real database test executed (not skipped).

Confirmed tested areas include SQL migration/preflight compilation, role/ACL/FORCE RLS restrictions, synthetic JWT/session/admin denial, canonical bytes/digests, idempotent replay and conflicting requests, multi-session same-key and cross-reviewer CAS races, nutrition exact-target binding, atomic rollback, immutable history, invalidation semantics, FK retention blockers, and post-lock JWT expiry recheck. This is evidence of the tested disposable database scenarios, **not** a claim that all deployed integrations have passed.

**Still BLOCKED / NOT VERIFIED:** real Supabase Auth JWT signature verification and PostgREST boundary; deployed Staging metadata drift and real gateway integration; complete account closure/erasure and archive lifecycle (Phase 2C B/C); storage/backups/offline deletion, resource/rate budgets and operational rollback; owner-approved retention/erasure policy and separate Staging apply authorization. Existing synthetic JWT claims are not cryptographic JWT verification. Do not merge, activate runtime, apply migrations to Staging/Main or claim production readiness based on this CI result alone.

The PR head now contains follow-up SQL/test repairs not present in the earlier original worktree. Preserve the exact tested commit SHA in any later rollout review; rerun acceptance if implementation changes. Historical earlier verification notes above remain as a record of the original cloud environment, not the current acceptance verdict.
