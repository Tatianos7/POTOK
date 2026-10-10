# POTOK business / invariant error contract v1 — disposable repair

Stacked on PR159 `7ba58bf5ddc846e3d0a76add59f55c850d731c5d`, review5480025735.
Only SQL error classification, direct-driver deny rules, acceptance and CI change.
No wire/digest changes, runtime activation, Supabase apply, legacy-writer adaptation,
receipt table, retention/archive changes or performance claims.

## Audit and exact mapping

The full inventory finds18 explicit application RAISE40001 sites in the requested
Food Evidence/Eligibility/Stage C scope, all in three drafts:17 A, one B.
Locations below are exact BASE159 line numbers (repair preserves SQL line numbers).
Existing Adaptive Nutrition persistence interprets its own RPC40001 as recovery
conflict; it does not consume these catalog/evidence RPCs and is not changed.
Older architecture matrices describing business40001 are historical; this table
supersedes their error-contract assumptions, without changing their rollout scope.

| Base file:line | Stable symbolic message | Old SQLSTATE → category | New SQLSTATE / PostgREST HTTP / details |
|---|---|---|---|
| `supabase/migration_drafts/food_reviewed_evidence_v1_phase2b.sql:415` | `EXACT_TARGET_REQUIRED` | 40001 → A | PT409 / HTTP409 / POTOK_BUSINESS_CONFLICT_V1 |
| `supabase/migration_drafts/food_reviewed_evidence_v1_phase2b.sql:420` | `STORED_REVISION_INTEGRITY_FAILURE` | 40001 → B | PT500 / HTTP500 / POTOK_INVARIANT_FAILURE_V1 |
| `supabase/migration_drafts/food_reviewed_evidence_v1_phase2b.sql:478` | `IDEMPOTENCY_PAYLOAD_CONFLICT` | 40001 → A | PT409 / HTTP409 / POTOK_BUSINESS_CONFLICT_V1 |
| `supabase/migration_drafts/food_reviewed_evidence_v1_phase2b.sql:520` | `CURRENT_HEAD_CONFLICT` | 40001 → A | PT409 / HTTP409 / POTOK_BUSINESS_CONFLICT_V1 |
| `supabase/migration_drafts/food_reviewed_evidence_v1_phase2b.sql:522` | `CURRENT_HEAD_CONFLICT` | 40001 → A | PT409 / HTTP409 / POTOK_BUSINESS_CONFLICT_V1 |
| `supabase/migration_drafts/food_reviewed_evidence_v1_phase2b.sql:526` | `CATALOG_SNAPSHOT_CONFLICT` | 40001 → A | PT409 / HTTP409 / POTOK_BUSINESS_CONFLICT_V1 |
| `supabase/migration_drafts/food_reviewed_evidence_v1_phase2b.sql:539` | `LIVE_CANONICAL_BINDING_REQUIRED` | 40001 → A | PT409 / HTTP409 / POTOK_BUSINESS_CONFLICT_V1 |
| `supabase/migration_drafts/food_reviewed_evidence_v1_phase2b.sql:551` | `SOURCE_ARTIFACT_ID_CONFLICT` | 40001 → A | PT409 / HTTP409 / POTOK_BUSINESS_CONFLICT_V1 |
| `supabase/migration_drafts/shared_food_eligibility_v1.sql:110` | `STABLE_KEY_ALREADY_CLAIMED` | 40001 → A | PT409 / HTTP409 / POTOK_BUSINESS_CONFLICT_V1 |
| `supabase/migration_drafts/shared_food_eligibility_v1.sql:191` | `IDEMPOTENCY_CONTENT_CONFLICT` | 40001 → A | PT409 / HTTP409 / POTOK_BUSINESS_CONFLICT_V1 |
| `supabase/migration_drafts/shared_food_eligibility_v1.sql:213` | `IDENTITY_BINDING_CONFLICT` | 40001 → A | PT409 / HTTP409 / POTOK_BUSINESS_CONFLICT_V1 |
| `supabase/migration_drafts/shared_food_eligibility_v1.sql:219` | `DECISION_HEAD_CONFLICT` | 40001 → A | PT409 / HTTP409 / POTOK_BUSINESS_CONFLICT_V1 |
| `supabase/migration_drafts/shared_food_stage_c_disposable_v1.sql:69` | `FOOD_CONFLICT` | 40001 → A | PT409 / HTTP409 / POTOK_BUSINESS_CONFLICT_V1 |
| `supabase/migration_drafts/shared_food_stage_c_disposable_v1.sql:70` | `FOOD_CONFLICT` | 40001 → A | PT409 / HTTP409 / POTOK_BUSINESS_CONFLICT_V1 |
| `supabase/migration_drafts/shared_food_stage_c_disposable_v1.sql:80` | `FOOD_CONFLICT` | 40001 → A | PT409 / HTTP409 / POTOK_BUSINESS_CONFLICT_V1 |
| `supabase/migration_drafts/shared_food_stage_c_disposable_v1.sql:109` | `FOOD_CONFLICT` | 40001 → A | PT409 / HTTP409 / POTOK_BUSINESS_CONFLICT_V1 |
| `supabase/migration_drafts/shared_food_stage_c_disposable_v1.sql:111` | `FOOD_CONFLICT` | 40001 → A | PT409 / HTTP409 / POTOK_BUSINESS_CONFLICT_V1 |
| `supabase/migration_drafts/shared_food_stage_c_disposable_v1.sql:122` | `FOOD_CONFLICT` | 40001 → A | PT409 / HTTP409 / POTOK_BUSINESS_CONFLICT_V1 |

A = expected domain/precondition conflict, not engine serialization. EXACT_TARGET
includes unknown/replaced revision bindings, not corrupted stored bytes. LIVE_CANONICAL
is an expected state dependency. Foreign/private and normalized collisions retain
FOOD_CONFLICT and reveal neither the other owner's identity nor their data.
B = stored trusted revision bytes/contract/state/digest violate internal integrity.
It requires investigation; retrying the same request cannot repair corruption.

PT409 and PT500 use PostgREST's documented PTxxx HTTP mapping and are NOT PostgreSQL
serialization_failure. Stable machine discriminator is native DETAIL / HTTP details;
message is a fixed symbolic error identifier, not localized human text. Do not
parse arbitrary message text. PT500 is a server failure, never a user409 outcome.
Both are non-retryable for native and HTTP clients. PT500 emits only fixed identifiers,
not corrupt payloads, SQL, actor IDs, keys or credentials. No blanket remapping of
other validation/auth/internal errors occurs. 22023/42501 remain non-retryable.
Food Evidence/Eligibility/Stage C app code never RAISEs40001; actual PostgreSQL errors retain their native SQLSTATE.

## Out-of-scope legacy SQL inventory (not a repository-wide repair)

Full repository SQL search additionally identifies66 explicit40001 sites in older
Adaptive Nutrition drafts. They are NOT migrated in this narrow Food Evidence PR:

| File under docs/premium/drafts | Explicit40001 count |
|---|---|
|20260921_adaptive_nutrition_persistence_v1.sql|5|
|20260921_adaptive_nutrition_runtime_activation_v1.sql|6|
|20260927_adaptive_nutrition_graph_v2_authorities_activation_v1.sql|25|
|20260930_adaptive_nutrition_protected_execution_binding_v1.sql|25|
|20261002_adaptive_nutrition_protected_execution_auth_contract_v1.repair.sql|5|

These legacy writers/contracts/classifiers need a separately approved audit/repair;
no repository-wide40001 elimination or all-writer safety is claimed. Own DB fixture
extracts ONLY json_has_duplicate_keys_v1/canonical_jsonb_text_v1 from the older
runtime draft, not its40001-bearing mutation RPCs. New catalog/evidence entrypoints
do not call those legacy RPCs. This exclusion is not permission to deploy them.

## Retry boundary

Controlled direct-driver adapter: after CONFIRMED FULL rollback, genuine native
40P01/DeadLockReport or40001/allowlisted engine routine MAY retry a fresh whole
transaction. Existing helper caps4 attempts/15s; adapter must enforce remaining
budget across connection/SQL/COMMIT. No retry from SQLSTATE alone, localized message,
app exec_stmt_raise or unknown native routine. PT409/PT500 and both machine markers
are denied even with misleading engine-shaped metadata. Auth/validation failures
and UNKNOWN COMMIT never retry. No partial result is published between attempts.

PostgREST RPC: client automatic retry DISABLED for every error. Its JSON omits the
native routine. Four-attempt/15s helper is NOT a guarantee for HTTP RPC. Supported
catalog calls require READ COMMITTED plus catalog gate before catalog locks. Native
40001 here is exceptional/fail-closed; do not resend or infer controlled retry.
PostgREST13.0.7 owns its engine40001 internal transaction retries. A real two-session
SSI probe must observe a native engine40001 plus TWO successful HTTP responses;
this explicitly measures internal recovery, not error fidelity or bounded attempts.
Comparative16.4 lane expects one success and one surfaced native40001; neither lane
establishes the deployed Supabase version or linked-library build identity.

## Acceptance and evidence requirements

- Actual stored-revision corruption in owner-only disposable transaction: PT500 +
  invariant detail; rollback restores bytes AND immutable trigger. A mismatched
  target produces PT409 + business detail. No transport-accessible corruption RPC.
- Fixed TEST-ONLY trigger on synthetic create name (no additional public RPC): real PostgREST HTTP500/PT500,
  native error exactly once and no inserted row. This proves transport mapping, not live corruption.
- Real stale catalog CAS via HTTP: HTTP409/PT409/FOOD_CONFLICT + business detail,
  exactly ONE native error/exec_stmt_raise and zero engine errors/repeated executions.
  Native observer runs below PostgREST; no client request retry or backend termination
  is necessary on the passing path. Required HTTP deadline fails a hidden retry.
- Registry/evidence authorization, CAS/idempotency, stable claim, epoch/ABA,
  immutable history and full rollback suites remain required. No SKIP/TODO accepted.
- Static executable audit protects every mapped application raise and forbids new
  hand-raised40001 across supabase SQL drafts and related server/test scripts (not unrelated legacy Adaptive SQL).
- Pinned official release SHA256, own Unix cluster, loopback proxy, Node24 and PG17+;
  no external database options or credential logging. Exact CI counts belong in PR.

UNKNOWN semantics are unchanged for all COMMIT fault cases. MATCH/ABSENT/DIFFERENT
observations are state evidence, never causality/operation receipt. No blind retry,
no durable receipt table. Persistent causal reconciliation remains BLOCKED.

## Compatibility / readiness

| Boundary | Change | Remaining gate |
|---|---|---|
| Shared Eligibility / Phase2B / catalog SQL |17 domain raises PT409;1 integrity raise PT500| disposable proof + independent review |
| Direct-driver helper | explicit non-retry code + discriminator deny | full rollback and fresh transaction adapter |
| PostgREST13 | business does not trigger engine retry; engine retry observed | no externally controlled RPC retry budget |
| PostgREST16.4 | comparative contract lane | NOT evidence of Supabase version |
| Phase1 wire/digests / private owner / gate / ACL / consumers | unchanged | all previous rollout gates retained |
| UNKNOWN / real JWT-JWKS / all-writer / performance / lifecycle | not solved | persistent rollout BLOCKED |

GO only for this narrow disposable repair if ALL required checks actually PASS.
Staging/Main/production/runtime activation remain BLOCKED. Next safe step is
independent review of mapping and real CI evidence; no merge/apply/deploy here.
