# P5-03C — non-food reviewed issuer v1 (inactive/disposable)

Dependency: PR154 `codex/food-reviewed-evidence-v1-phase2b`, exact base
`b36f55500fc4b142bfa7b3029dc4c511a9d58c75`. Remote checked before implementation.
This package changes no dependency branch and does not combine PR155–164.

## Dependency audit and reuse

| Concern | Existing primitive at exact PR154 | Use in this package |
| --- | --- | --- |
| Authority | `potok_food_evidence.authority_v1()` in `food_reviewed_evidence_v1_phase2b.sql` | Same verified admin entitlement / `potok_control.access_attestations` / profile provenance, live non-anonymous Auth user and session; no new authority ledger |
| Transaction boundary | authority actor/admin advisory gate, Auth row SHARE locks, READ COMMITTED requirement | Initial, after private catalog wait, before return, plus deferred event trigger at actual COMMIT |
| Strict wire | duplicate-key parser, canonical JSON SAFE_INTEGER, retained-source decoder in `adaptiveNutritionWireV1` / `foodReviewedEvidenceV1`; SQL exact_keys/text/uuid/hash/applicability/source/reject_negative_zero | Reused; separate `potok-nonfood-review-request-v1`, no change to food wire |
| Immutable artifacts | SQL canonical_json/digest/artifact/reject_mutation | Reused domain-separated nonfood revision/event digests and statement immutability guards |
| Idempotency/CAS | Food actor/key raw bytes, immutable receipts and expected head | Same semantics, separate nonfood storage, deterministic catalog gate and exact definition revision binding |
| Currentness | Food exact revisions / current heads / invalidation | Separate nonfood reader/history; historical receipt never currentness proof |
| Gateway | verified user before and after dispatch and receipt verification | Unmounted injected adapter with byte-identical UNKNOWN intent and read-only recovery; no credentials/runtime route |
| Acceptance | PR154 own Unix-only PG17 cluster and real trusted entitlement drafts | Additive opt-in extension, no external DB URL; no stub returning authority=true |
| Retention | PR154 inventory/design (not approval) | New explicit inventory below; approval remains false |

The definition namespace has no FK or writer into `public.foods`/aliases. V1 deliberately
supports **non-nutritive** components only: all five mapped values must equal explicit
`0.000`; positive food nutrients cannot bypass canonical food approval. The generic
consumer representation does not constitute issuance. Publication can eventually carry
separate `nonFoodBindings`; its existing typed validators exclude definition IDs from
canonical food `ingredientIds`. This PR adds no publication adapter and manufactures no
usable `approvedNonFoodEvidenceRef`.

## Wire and lifecycle

Request bytes: valid UTF-8 strict JSON, at most 1,048,576 bytes; duplicate/foreign/missing
keys, negative zero, bad UUID/hash/state, caller actor/role/time/status fail closed.
`REVIEW_APPROVED` and `REVIEW_REJECTED` carry proposal, required expectedHead (null for
initial approval), retainedSource and reason (null for approval, nonempty for rejection).
`INVALIDATION` carries exact kind/definition/revision/digest, severity, reason and source.

Definition proposal: existing definition ID or null for new server-minted root; immutable
stableKey, displayName, exact applicability and sorted unique exclusions. A name/state
change creates a revision with exact expected-head CAS; stableKey cannot be reassigned.
Nutrition proposal: exact definition revision ID/digest, matching applicability,
PER_100_G_EDIBLE, explicit kcal/g units, five canonical decimal sourceValues and mapped
nutrition values. The supported policy versions explicitly distinguish source total
carbohydrate including fiber and available carbohydrate; integer-thousandths mapping
never silently recalculates calories. Five explicit fields are required, including fiber.

Retained-source snapshot preserves provider/document/revision/locator/time/media type,
UTF-8 text OR canonical base64 bytes, SHA-256, byte length and exact field/state mapping.
The inherited source validator proves byte and mapping integrity; it does **not** infer
scientific facts from prose. A trusted reviewer must assess applicability and each value.
No source bytes or real water evidence from PR164 are used in synthetic acceptance.

Public SQL entrypoints (only authenticated EXECUTE, still requiring verified authority):

- `nonfood_evidence_review_v1(text)`: authority → private catalog lock → authority again
  → actor/key exact-byte replay or conflict → CAS/exact definition/source → server-minted
  revision and append-only event → heads → actor-scoped receipt → authority → deferred
  authority guard at COMMIT. All writes roll back together.
- `nonfood_evidence_receipt_v1(uuid)`: actor-scoped historical operation lookup, authority
  before/after read; no mutation or generated replacement key.
- `nonfood_evidence_current_v1(uuid)`: under same catalog gate returns definition and
  nutrition revisions, exact heads, events and usable flags. Superseded definition leaves
  old nutrition historically retained but unusable; invalidation does not rewrite history.

Receipts bind actor, key, canonical request digest, raw-byte SHA, event, revision,
linked definition and heads at the operation. Same key with different bytes conflicts,
even if canonically equivalent. Explicit business conflicts use PT409/details
POTOK_BUSINESS_CONFLICT_V1; integrity failure uses PT500. Engine errors are not rewritten.
The gateway treats every unconfirmed post-dispatch outcome conservatively as UNKNOWN,
retaining original actor/raw/key. Recovery validates original bytes/digest and account;
no blind retry or automatic new key. The caller must keep this account-scoped intent;
this unmounted server adapter is not a runtime mutation UI or persistent client store.

## Retention / FK inventory — policy NOT approved

All listed FKs are ON DELETE RESTRICT. Six immutable tables reject UPDATE/DELETE/TRUNCATE,
including owner DML; heads is a private mutable projection. Seven tables FORCE RLS,
no policies/client table grants, no service-role RPC grant. Superuser/DDL remains an
administrative boundary; immutability does not claim to defeat the DB owner.

| Table | Retained bytes/identity | Outbound FKs | Inbound dependencies |
| --- | --- | --- | --- |
| roots_v1 | minted definition ID, stable key | none | events, definitions, nutrition, heads |
| sources_v1 | complete source snapshot and exact original bytes | none | events.source_id |
| events_v1 | actor, authority attestation, request key, source, event JSON/canonical bytes | auth.users; composite access_attestations(account_id,attestation_id); roots (nullable for rejected new proposal); sources; composite receipts(actor_id,request_key), deferred | definitions/nutrition/receipts.event_id, deferred |
| definitions_v1 | exact identity/state/exclusions, source snapshot, revision JSON/canonical bytes/digest | roots; same-table supersedes; event (deferred) | nutrition exact composite(definition_id,revision_id,digest); next definition supersedes |
| nutrition_v1 | five source/mapped values, exact definition and source, revision JSON/canonical bytes/digest | roots; exact composite definition revision; same-table supersedes; event (deferred) | next nutrition supersedes |
| heads_v1 | definition/kind/revision/digest current projection | roots | none; polymorphic revisions validated by issuer and exact reader |
| receipts_v1 | actor/key, canonical request digest, complete raw request bytes, historical result JSON | auth.users; event (deferred) | events composite actor/key (deferred) |

Source snapshots also occur inside revisions, events, receipt JSON and raw requests.
Actor/attestation identifiers and potentially identifying source/request bytes survive
account deletion attempts; RESTRICT intentionally blocks referenced deletion. No TTL,
CASCADE, destructive purge, anonymization or claim of complete erasure is implemented.
Owner must decide retention periods/legal basis, account erasure versus immutable proof,
source licensing/redistribution/access, backups/logs and coordinated erasure semantics.
A future approved design must inventory every embedded copy and dependency first.
**RETENTION_POLICY_APPROVED=false; production rollout is blocked.**

## Disposable verification

Run from repository root with Node24 and PostgreSQL17+ binaries available as non-root:

```
POTOK_FOOD_EVIDENCE_REQUIRE_DB=1 node --import tsx --test --test-isolation=none scripts/contracts/nonfood-evidence-disposable-db-v1.test.ts
```

The wrapper invokes the unchanged dependency fixture plus additive opt-in subtests.
It creates/tears down its own Unix-only cluster (no TCP, no database URL). The package
requires `potok_nonfood.test_target=disposable-postgresql-only` and existing authority
primitives; unmarked application fails atomically. Separate preflight/postcheck assert
owner/dependency/ACL/RLS/FK boundaries. No supported persistent rollout target exists.
CI uses postgres:17 / Node24, no live secrets, a 15-minute job and bounded subprocesses.
Fixture JWT claims exercise actual SQL authority/session/entitlement logic; they are
not cryptographic Auth or PostgREST transport acceptance. No browser smoke is implied.

Local environment: Node v24.19.0, no usable initdb/pg_ctl/psql; Docker socket denied.
Unit/food evidence/publication tests: 99 PASS, 1 local PostgreSQL SKIP (fresh rerun pending
in final PR report). Project/standalone strict TypeScript and targeted ESLint PASS.
CI/disposable result must be reported from the actual run, not inferred from mocks.

## Readiness and next action

Contract, immutable history, receipt recovery and current reader are implemented in
inactive draft code; existing authority is reused. RETENTION_POLICY_APPROVED,
REAL_WATER_EVIDENCE_ISSUED, SUPABASE_APPLIED, CAN_BIND_PR164_WATER and CAN_ASSEMBLE
remain false. Disposable acceptance is true only after a successful real PG run.

Next action: independently review this isolated issuer, including its real disposable
acceptance and retention inventory, before separate owner retention/apply decisions.
Real-water source review, authorized issuance, publication binding/reader integration
and recipe/portion/safety/eligibility remain separate gates. PLAN != FACT.
