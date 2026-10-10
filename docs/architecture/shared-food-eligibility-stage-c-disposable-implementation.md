# Stage C first disposable implementation

Source: #156 d45b3fefbb9358438391d28a14e73c03e5621aa4, #157
03784301326887f973bf814fd57a9d17f5b86f83. New branch/PR only, no prior PR edits.
NO Supabase apply, merge, deploy, live user activation or owner workspace changes.

## Implemented boundary, not existing-consumer rollout

Typed private CREATE/UPDATE/DELETE SQL RPC: server-derived live-session actor,
source=user/owner fixed, create ID+self-root in ONE INSERT/transaction. UPDATE/DELETE
require exact opaque operational row CAS digest and ownership; unknown input fields
including source/owner/actor IDs reject. Payload is deliberately narrow: name,
nullable brand and four operational numeric(8,2) strings plus mandatory fiber
(string or explicit null). Unknown fiber stays SQL NULL, never zero; no silent rounding.
Caller normalizedName/normalizedBrand are rejected. DB normalize_food_text and the
foods_search_vector_update trigger are the only normalization authority; duplicate
batch validation and normalized root selection call the same DB helper. No Phase1
wire/digest changes.
CAS digest hashes a domain-prefixed PostgreSQL JSONB row text and is server-opaque,
NOT cross-runtime canonical evidence serialization or provenance. It binds numeric
operational fields without widening the Phase1 canonical-number policy.

Importer INSERT/UPSERT_ID/UPSERT_NORMALIZED: trusted potok_control attestation via
existing authority_v1, NOT service_role/is_admin fallback. Maximum200 rows/1MiB.
Unknown fields/duplicate targets reject. Actor/auth locks precede catalog gate;
gate precedes first catalog row lock; authorization checked after waits and before
return. Existing root/key/source/owner cannot be substituted on normalized conflict.
NULL and empty brand use the deployed COALESCE expression, not column-pair ON CONFLICT.
Batch result includes requested→actual food ID mapping for normalized conflicts; candidate IDs are not falsely reported as created roots. This result is NOT a durable commit receipt. No automatic ELIGIBLE status/evidence issuance. Complete RPC failure rolls back batch;
whole jobs can have prior committed batches. No generic SQL endpoint.

RPCs are narrow SECURITY DEFINER with pg_catalog search_path and explicit tenant/
trusted-admin checks. Disposable ownership is postgres, as in preceding draft;
production minimal role/FORCE-RLS/privilege proof remains BLOCKED. Do not treat these
functions as an approved deployed bypass. Private schema helpers are not exposed;
PUBLIC/anon/service_role RPC execution revoked; authenticated caller still must
pass live session/authority checks. Cryptographic JWT is assumed upstream protected
PostgREST claims, simulated by fixture, NOT verified by this SQL test.

Prospective ACL cutover removes table AND column direct-write grants for PUBLIC,
anon/authenticated/service_role while preserving SELECT and RLS. Inherited effective
write permission makes cutover fail closed. No real deployed role graph is claimed.
Legacy is_admin insert policy is kept in fixture to show ACL denial blocks that route;
trusted importer independently rejects an is_admin-only caller. SELECT visibility
still source=user/owner or shared core/brand. Index remains
(normalized_name,COALESCE(normalized_brand,'')); no index change migration.

## Fixture provenance and limitations

Confirmed supplied Staging metadata: PG17.6, RC default, foods RLS=true/FORCE=false,
expression unique index, owner predicate and legacy admin policy. CI uses PG17+,
not a claimed byte-for-byte Staging17.6 installation. Synthetic Auth/users/sessions,
IDs/text/macros only. Fiber matches supplied Staging metadata: numeric NULLABLE,
no default. Other numeric(8,2) columns come from repository schema, NOT a full live
column inventory. Sanitized normalize_food_text and foods_update_search_vector are
from supabase/foods_schema.sql; supplied deployed assignments agree. Full deployed
function bodies/hash, collation and complete trigger/role inventory remain unverified.
Prior #156 synthetic duplicate names are renamed ONLY within disposable cluster
before installing the expression index; no cleanup/backfill of real data implied.
No personal rows copied. Actual deployed trigger/role/PostgREST parity is BLOCKED.

## Outcome, retry and reconciliation

Reuse test-only catalogTransactionRetryV1: max4 attempts/15s, native engine classifier
and confirmed complete rollback. Business40001, auth failures, unknown native fields
and ambiguous COMMIT are not retried. Existing adapter/native rollback tests stay
mandatory. No automatic expectedDigest/epoch refresh. There is no durable catalog
receipt table and no exactly-once transport guarantee. catalogBatchOutcomeV1 models
COMMITTED only from a trusted commit acknowledgement, ABORTED only from confirmed
rollback, otherwise UNKNOWN/retryAllowed=false. It does not turn an SQL result before
COMMIT into a commit acknowledgement. No mounted gateway or retry runtime wiring.
Sequential runCatalogImportJobV1 validates pinned raw batches, preserves committed prefix, stops after ABORTED/UNKNOWN, and treats thrown/inconsistent transport results as UNKNOWN; it never retries or runs later batches. The injected adapter is not wired to live transport. Unknown batch stops job; inspect/reconcile read-only rather than blindly resend.
Real network COMMIT fault injection/recovery remains NOT VERIFIED.

## Compatibility matrix

| Path | Current status | Remaining gate |
|---|---|---|
| New typed private CRUD | Implemented/tested in disposable suite after real run | production role, full schema, live JWT/PostgREST, client adapter |
| New trusted operator batch RPC | Implemented/tested in disposable suite after real run | machine/operator rollout, durable reconciliation policy |
| #156 Evidence/Eligibility | Unchanged; full suite retained | separate existing rollout gates |
| foodService direct REST CRUD | NOT adapted, blocked by prospective write ACL | no runtime change; controlled client cutover required |
| core/ingestion/pipeline/seed writers | NOT adapted | narrow payload adapter and explicit job outcomes |
| owner-apply/maintenance/COPY/external writers | BLOCKED | independent deployed inventory and integration |
| resolver/search/diary/recipes/favorites | No integration/behavior change | existing regression tests; deployed E2E parity |
| archive/retention/account deletion | BLOCKED | lifecycle approval, no CASCADE evidence |

## Verification requirements / results location

Combined required-DB acceptance retains #156 tests and adds owner A/B isolation,
atomic create rollback, private/shared generic collisions, source promotion/unknown
fields, private CAS/delete, table/column/role bypass denial, trusted importer auth,
late batch rollback/bounds, opposite batches using DIFFERENT trusted reviewers,
normalized-key identity preservation, importer ABA/key claims, concurrent private
collision and post-gate JWT expiry. Gate waiter is observed via pg_stat_activity,
then row NOWAIT proves no catalog row lock acquired before gate.

Exact real CI HEAD/run/counts are recorded in PR after execution; no guessed PASS
here. Pure server tests cover strict shape/duplicates/precision and outcome model.
Parity regressions cover fiber null/zero CAS, private transitions, importer NULL,
forged normalized fields, DB trigger overwrite, case/punctuation, null/empty brand
uniqueness and DB-derived normalized upsert/duplicate targets. The pure decoder
does not try to reproduce DB normalization or certify normalized uniqueness.
Performance/real JWT/PostgREST/full deployed parity/machine authorization/owner-apply/
account deletion/archive/retention/external writers remain BLOCKED or NOT VERIFIED.
Next safe step: independent review and approved expansion of disposable schema/role
and transport fault-injection tests, not Staging apply or activation.
