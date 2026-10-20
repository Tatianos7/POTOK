# Food Reviewed Evidence V1 — Phase 2B, Staging-first

Status: implementation/review package, **NOT APPLIED and NOT ACTIVATED**.
Base: master `33462c398db761ba30ff59007b7a928338b34bf6` after PR #153.
This package does not authorize a Staging apply, an Edge deployment, or production issuance.

## Authority and scope

The existing `potok_control.is_effective_entitlement_v2` and append-only
`access_attestations` are the only admin authority. No new entitlement table,
provisioning RPC, flag fallback, or inferred OWNER role is added. An admin decision
is represented as `role: ADMIN`; its `authorityReference` names the exact trusted
admin attestation. `user_profiles.user_id/admin_provenance_id/admin_valid_until`
must agree with that attestation. `is_admin` is never queried for authorization.

The unmounted gateway accepts only a publishable or legacy anon API-key format,
rejecting privileged-key configuration. This format classification is not token
authentication. It calls `auth.getUser(token)` and forwards the **same caller
JWT** to PostgREST. PostgREST verifies the token signature/issuer before providing
`auth.uid()/auth.jwt()`. SQL does not pretend that decoding JWT JSON verifies a
signature. SQL additionally requires the authenticated role, matching subject,
unexpired token, non-anonymous existing user, matching live `auth.sessions` row
and `not_after`, and an effective admin grant. A removed session cannot replay a
receipt. Deleted users cannot issue events. These checks run again after waits,
before issuance. Arbitrary privileged SQL/session impersonation by the database
owner is outside the client threat model.

Issuance is restricted to existing, searchable, not-needing-review core/brand
shared roots: `foodId = canonicalFoodId`, nonempty existing `stable_food_id`, no
`created_by_user_id`. This is global shared-catalog admin scope, not an invented
tenant or food identity. Private/user foods are denied. Receipts are actor-scoped;
an admin cannot use the lookup RPC to retrieve another actor's request. Current
shared artifact state is available only to verified admins, never public clients.

Main is unsupported. The preflight requires the reviewed Staging structure,
trusted functions/ACL/ownership, FORCE RLS and a bypass-capable reviewed postgres
owner. It does not repair Main, probe alternative column names, install another
authority, or change legacy RPCs. The owner must separately verify project ref
`ozidryfvhkcbtpnulakq` and acknowledge `staging:ozidryfvhkcbtpnulakq` in the migration
session using `potok_food_evidence.rollout_target`. This is an explicit rollout
target acknowledgement, not independent cryptographic proof of project identity.
The gateway also rejects any configured origin other than that Staging project.

## Why six tables

All six tables live in the unexposed `potok_food_evidence` schema:

| Table | Responsibility |
| --- | --- |
| `canonical_revisions_v1` | Immutable reviewed identity snapshots of existing food IDs |
| `nutrition_revisions_v1` | Immutable five-field exact nutrition, composite canonical ID/digest/food/state binding |
| `retained_sources_v1` | Exact source bytes and complete immutable Phase 1 source metadata/mappings |
| `review_events_v1` | Append-only approvals, rejected proposals and invalidations |
| `review_requests_v1` | Actor/key receipt, canonical request bytes/digest, exact raw proposal bytes/digest |
| `current_heads_v1` | Mutable transaction-controlled projection; never evidence by itself |

There is no separate proposal table: requests retain the complete original proposal.
No Storage bucket is necessary. Existing search queues/drafts describe search,
aliases and mutable draft products, not these immutable artifacts. Adaptive
Nutrition operations/events describe account/plan/FACT history and must not absorb
this food-catalog domain. Their reviewed duplicate parser, serializer and locking
patterns are reused without changing their wire/digest contracts.

## Requests, bytes and bindings

The new strict request contract is `potok-food-evidence-review-request-v1`.
It admits only APPROVED/REJECTED/INVALIDATION variants; all fields are required,
unknown fields and duplicate keys at every depth reject. Actor, authority, event
IDs, revision IDs and decision timestamps are forbidden in client requests.
`idempotencyReference` is supplied explicitly by the caller; it is never replaced.

Approval includes a strict canonical/nutrition proposal, its digest, an explicit
nullable `expectedHead: {revisionId,digest}`, and a verified retained source.
Canonical proposal identity must match the locked catalog snapshot exactly.
Aliases are the existing `foods.aliases` array; catalog NULL aliases means an
explicit empty snapshot array. Nothing writes aliases or creates alias identity.
Nutrition approval requires the exact live current canonical artifact, its
digest/root/state/applicability and all five scale-3 decimal strings. It does not
copy, round, calculate or update legacy numeric nutrition.

Rejection retains the complete proposal and reason, pins a typed proposal context,
and creates **no reviewed revision**. `retainedSource: null` must be explicit when
no source is applicable. Invalidations target an exact existing kind/revision/
digest/root, retain a source and reason, and carry CORRECTION or SAFETY_CRITICAL.
The source locator and caller's source capture time are retained claims; no network
lookup or external-provider authentication is claimed. Hash integrity is not provenance.

Three new INPUT digest domains are separate from the unchanged Phase 1 artifact
domains: `potok-food-evidence-review-request-sha256-v1`,
`potok-canonical-food-review-proposal-sha256-v1`,
`potok-nutrition-review-proposal-sha256-v1`. They hash canonical `{domain,payload}`
UTF-8 bytes. The request includes its proposal digest. Generated event fields are
not in request/proposal inputs. Revisions reference an event ID, never its digest.
There is no digest cycle. Literal raw negative zero is checked before jsonb/JSON
reserialization can erase it. Food-only safe integer normalization is used for
validated byteLength; the existing Adaptive serializer is unchanged.

Request digests/idempotency compare canonical semantic bytes: key order, harmless
JSON whitespace and integer spellings like `1.0` do not manufacture another
operation. Exact original proposal JSON bytes are retained separately. Source
UTF-8/base64 bytes, length, SHA, XOR and field/applicability mappings are validated.
All three issued artifact forms use the existing Phase 1 encoding/domains; gateway
receipt validation independently runs the existing decoders and pins the original
request/proposal, authenticated actor, retained source and supersedes reference.

The server request transport is capped at 1 MiB, rejects malformed UTF-8/BOM and
does not truncate. PostgreSQL jsonb cannot represent inline U+0000. Supply such
source bytes as canonical base64; inline NUL metadata/text is explicitly rejected,
never silently rewritten. PostgreSQL UTC date representation also cannot express
year 0000. These are server-input restrictions, not changes to the Phase 1 pure
artifact decoder. No fallback/polyfill or source nutrition normalization is added.

## Transactions and current state

The mutator shares the existing `potok-entitlement-v2:<actor>:admin` advisory gate
with trusted grant/revoke writers. Every actor/key has one immutable terminal
receipt. RPCs require READ COMMITTED and fail closed under other transaction
isolation, ensuring fresh statement snapshots after advisory-lock waits.
Exact authorized retry returns the same event/artifacts; changed content
raises `IDEMPOTENCY_PAYLOAD_CONFLICT`. Revocation denies even an exact retry.
There are no committed in-progress rows. Database errors roll back the entire
request/source/revision/event/head/receipt transaction. Lost-response retries must
keep the original key and content; the gateway never retries automatically.

A second, food-scoped transaction gate serializes **different reviewers** of a
shared root. Approval CAS checks both head ID and digest, including first-head
absence; supersedes is derived from that verified head. Food rows are locked for
read so a legacy catalog writer cannot change the observed snapshot during issuance.
Sources sharing an artifact UUID must match all retained metadata and exact bytes.

Invalidation never restores an older head. Effective severity aggregates all
invalidations of that exact revision; CORRECTION cannot downgrade SAFETY_CRITICAL.
Historical invalidation does not replace a newer head. Canonical invalidation,
supersession or catalog drift makes dependent current nutrition unusable without
rewriting its immutable payload or generating synthetic invalidation events.
Only a new explicitly reviewed approval can establish a new head. `canonicalUsable`
and `nutritionUsable` are admin audit projections, not generator admission or
activation. Stored revision shape, canonical bytes and self-digest are checked
when resolving targets/current state.

Direct table/schema/private-function access is revoked from PUBLIC/anon/
authenticated/service_role. Every table has ENABLE/FORCE RLS and no client policy.
Only the three authenticated public RPCs have EXECUTE, with trusted checks inside
each. The reviewed postgres-owned SECURITY DEFINER boundary is deliberate;
search_path is pg_catalog and object references are qualified. Immutable tables
reject UPDATE/DELETE/TRUNCATE, including ordinary owner DML. Projection updates
are internal. FKs use RESTRICT: retention/account-erasure and deletion of referenced
food rows require separate review before apply; no silent cascade is allowed.

## Verification and rollout gates

Run local request/transport/Phase 1 tests and related regressions with repository
tsx/TypeScript/ESLint. Transport unit tests use explicitly labeled doubles; they
do **not** prove Supabase JWT signature checks or PostgreSQL atomicity.

`node --import tsx --test --test-isolation=none scripts/contracts/food-evidence-disposable-db-v1.test.ts`
starts its own Unix-socket-only temporary PostgreSQL cluster, loads the actual
reviewed trusted-entitlement package and shared parser/serializer, and exercises
real multi-session races, RLS/EXECUTE, source/digest bindings, rollback, immutable
history and legacy-row conservation. No supplied database URL/PG environment is
used. PostgreSQL 17+ and pgcrypto are required by the existing prerequisite package.
Absent binaries explicitly SKIP with NOT VERIFIED. Do not treat a skipped suite
or a test-file process exit as database acceptance PASS.

Cloud: local PostgreSQL/Supabase CLI unavailable; Docker permission probe was
interrupted. SQL execution/compilation, DB authorization, FORCE RLS, concurrency,
and live Auth/PostgREST behavior are **NOT VERIFIED**. Node 24 is available;
Node 18/Deno/server-host deployment is not verified. The gateway has no serve()
entrypoint, route mount, workflow, client import or activation flag.

Phase 2B baseline verification on Node 24.19.0: 14 server request/gateway tests and 14 Phase 1
tests passed; the disposable PostgreSQL suite explicitly skipped (28 PASS, 1 SKIP).
274 related Food Canonical/review/alias, recipe evidence and Adaptive Nutrition
regression tests passed. Repository strict `tsc --noEmit`, separate strict checking
of the disposable test script, targeted ESLint and diff whitespace checks passed.
The static scope/secret-pattern scan is not a database security acceptance test.

The subsequent Phase 2C review and fixes are recorded in
`food-reviewed-evidence-server-v1-phase2c-review.md`. Receipt lookup now returns
the mandatory `replayed: true` field, and current-state reads recheck authority
after food/catalog lock waits.

Before any Staging rollout: separately approve the apply, export metadata for
exact functions/versions/owners/ACL/RLS/profile protection/session schema and
existing food fields; run the disposable DB suite; review FK/retention impact,
resource/timeout limits and metadata drift. Supabase CLI must create the actual
migration filename from this draft in the rollout workspace. Run the prepared
read-only preflight and inspect it before any DDL. After an approved Staging apply,
run the read-only postcheck and real gateway JWT/expired/revoked-session and
multi-account behavioral tests with synthetic records and an explicit cleanup
plan. No production data or real evidence is authorized by this package.
