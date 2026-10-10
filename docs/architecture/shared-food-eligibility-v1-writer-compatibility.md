# Catalog writer compatibility — PR #156 review 5478372059

Source baseline: PR #156 HEAD `5b1d9155c0c313691b0b63755b3022282313f77a`,
local identical tree `7c7b56d90050f3737bc21e1719bf5dd19b404455`.
Review: https://github.com/Tatianos7/POTOK/pull/156#pullrequestreview-5478372059.
This follow-up changes tests/documentation only. NO guard relaxation or lifecycle
change; persistent apply/merge/runtime remains BLOCKED. #154/#155 unchanged.

## Inventory method and evidence limits

Searched the complete tracked repository (SQL/TS/TSX/JS/MJS/Python/shell), including
source, server, ingestion, scripts, maintenance drafts, schema/trigger definitions,
dynamic table-name paths, RPC call sites, seeds, tests and workflows. Searches used
multiline `.from('foods')` chains plus INSERT/UPDATE/DELETE/COPY/TRUNCATE and
transaction/isolation/retry/sort signatures. Comment-only mentions were excluded
as writers. Reads and writes to food_aliases/staging/diary/recipes are distinguished.
No persistent database, Supabase metadata or external scripts were inspected.
The inventory below is all executable catalog writer paths found IN THIS TREE,
not proof all deployed functions/operators/job schedules match it.

No application writer sets transaction isolation explicitly. Supabase JS calls
delegate transactions to PostgREST; READ COMMITTED is a platform expectation, NOT
verified deployed default. Plain BEGIN in SQL drafts inherits session/database
defaults; it does not guarantee RC. No production claim from synthetic CI.

## Writer compatibility matrix

| Writer / exact location | Operation / transaction boundary | Guard effect / verdict |
|---|---|---|
| src/services/foodService.ts:1125,1164 | private INSERT then separate self-root UPDATE | RC ownership CRUD should pass; multi-request operation is not atomic; RR/SERIALIZABLE globally rejected |
| src/services/foodService.ts:1258,1293 | private UPDATE/DELETE with owner/source predicates | RC private unregistered rows remain writable/deletable; claimed-key collision is denied; non-RC not compatible |
| scripts/import-food-core.ts:1065–1066 | batch INSERT or upsert on id; ordered by input, no canonical lock sorting | initial fresh inserts possible; registered id upserts have key-before-row inversion risk; error breaks batch loop, earlier batches committed |
| scripts/import-food-core.ts:1278 | explicitly no automatic retry | cannot call deadlock recovery implemented; C writer/retry adaptation required |
| scripts/run_food_ingestion.mjs:793,805,817 | batches of 200 INSERT / normalized-key DO NOTHING, then per-id UPDATE | each REST request commits separately, partial run possible; no explicit SQLSTATE retry/root order; registered identity mutations increment epoch and invalidate eligibility |
| src/services/foodIngestionService.ts:307 | batch normalized_name/normalized_brand upsert | id/key omitted: executor may take conflicting row only after insert trigger; explicit-key variants require lock review; no automatic bounded retry |
| src/utils/foodImportPipeline.ts:144 | normalized-key bulk upsert; throws error | same upsert/batch risk; no certified root/key ordering/retry |
| src/utils/seedFoods.ts:51 | normalized-key upsert; logs failure and continues batches | initial population does not need TRUNCATE; can leave partial population; no eligibility issuance; no certified multi-row recovery |
| supabase/migration_drafts/20260809_owner_apply_missing_food_draft_draft.sql:164; src/services/missingFoodDraftService.ts:275 | single-food INSERT in admin RPC, profile/admin legacy logic | no new eligibility authority conferred; fresh malformed/no-key food remains noneligible. Deployed body/default isolation NOT VERIFIED |
| scripts/sql/nutrition_zero_macro_exact_unique_autofix_draft.sql:373 | bulk nutrition/metadata UPDATE inside plain BEGIN | fields excluded from identity epoch, but global RC restriction still applies; unordered row locking can deadlock with another bulk writer |
| scripts/sql/nutrition_zero_macro_incident_fix_draft.sql:77 | same | same; execution not authorized here |
| scripts/sql/nutrition_zero_macro_referenced_hotfix_draft.sql:78 | same, fiber restoration | same; historical remediation is separate owner-approved work |
| scripts/sql/nutrition_zero_macro_restoration_autofix_draft.sql:104 | same | same |
| scripts/build_nutrition_repo_reference.mjs:355 | generates analogous SQL UPDATE artifact, not an automatic DB call | generated BEGIN inherits default; generated SQL writer has same bulk implications |
| supabase/foods_schema.sql:42–101; supabase/food_kb_2_1.sql:22–42 | BEFORE INSERT/UPDATE search-vector and updated-at triggers | nonidentity derived fields excluded; deployed trigger order/custom mutation bodies NOT VERIFIED |
| account/food deletion via external Auth/maintenance | foreign-key-driven DELETE/UPDATE possible | private unregistered RC paths unaffected by registry registration; referenced shared roots/auth audit actors remain deletion-blocked; external lifecycle NOT VERIFIED |
| external psql/admin/COPY/TRUNCATE/replication | not found as an executable catalog loading path in Git | outside inventory; RC and trigger participation must be explicitly attested before C rollout |

Read-only/nonwriter paths: canonicalFoodResolver, searchAdminReviewService,
import_recipe_ingredients_from_excel.ts (foods SELECT; writes recipe ingredients),
favorites, recipes/analyzer, meal/progress/program services; aliasApplyService and
apply_admin_approved_food_alias write food_aliases, not foods. Review/draft queues
do not insert foods until explicit owner-apply RPC. foodIngestionService calls
recompute_food_entries_for_food_ids AFTER catalog writes: no definition found here;
deployed body/transaction behavior NOT VERIFIED, never assumed safe.
No catalog food TRUNCATE, physical shared DELETE or COPY loader found in executable
Git paths. SQL mentions TRUNCATE for temporary reports do not target public.foods.

## Global guard and initial loading

Current trigger rejects ALL catalog mutations under RR/SERIALIZABLE, including
private/unregistered rows. Pure reads can still use those isolation modes.
Therefore no universal legacy writer parity claim is possible without verifying
actual defaults and external clients. Do not bypass with missing flags or admin role.

TRUNCATE is denied even with EMPTY registry. Empty initial bulk inserts/seeds can
load incrementally without resetting the table, but reset-and-reload maintenance
is incompatible. TRUNCATE CASCADE is not a safe cleanup shortcut: it can destroy
evidence/receipts/claims or violate their immutable triggers. Registered DELETE and
ID/key replacement remain prohibited. Owner must approve an archive/maintenance
strategy; disposable cluster destruction is the only current full reset.

## Lock conflicts, retries and rollback

UPDATE trigger starts with row lock then sorted old/new key gates. This does NOT
guarantee the same order for INSERT ON CONFLICT: BEFORE INSERT executes before the
conflicting existing row is locked. Thus upsert can hold key and wait row while an
eligibility transaction holds row and waits key. A deterministic two-backend test
reproduces this cycle and requires SQLSTATE 40P01. This is a BLOCKER reproduction,
not proof this writer is compatible. It preserves rather than weakens assertions.

Two bulk transactions taking roots in opposite order can also deadlock. Per-row
sorted key loops do not globally order multiple roots/keys. Test requires one
40P01 victim, checks complete victim rollback (including epoch), commits survivor,
then explicitly retries the complete transaction after ordered root acquisition.
That retry is test-only; existing importers do not implement it. Retrying just the
failed statement inside an aborted transaction is invalid. 40P01 retries need fresh
transaction/snapshot/binding; 40001 content/CAS conflicts must not be blindly replayed.
Already committed REST batches cannot be rolled back by retrying a later batch.

## Minimal proposals — NOT implemented/approved deployment

1. For the specific existing-ID upsert inversion, consider acquiring the existing
foods row by NEW.id FOR UPDATE BEFORE key gates in BEFORE INSERT. That aligns this
case with command order without skipping key checks. Must separately prove races
with newly inserted IDs, normalized-key conflicts (different/default NEW.id), key
replacement, multi-row statements and RLS; it is not a universal fix.
2. C writers should prelock all affected existing roots in deterministic UUID order,
then all old/new keys in deterministic order, and use explicit transactional APIs
with bounded whole-transaction deadlock retry and fresh CAS/epoch bindings. REST
input sorting alone does not certify database executor lock order.
3. A global/cooperative catalog gate is an alternative with throughput impact; a
BEFORE STATEMENT gate alone cannot fix transactions that already hold row locks.
Every decision/read-for-update/writer must acquire it before FIRST catalog row lock.
Do not introduce it as an undocumented workaround or new authority mechanism.
4. Keep non-RC fail-closed until all relevant writer/default-isolation paths are
verified or a separately proven equivalent enforcement is approved. Keep TRUNCATE,
ARCHIVED/clearance and persistent rollout blocked. No automatic exceptions for users.

## Actual test scope / verdict

Expanded required-DB suite tests empty-registry TRUNCATE denial; private ownership
CRUD/RLS and read/non-RC write distinction; opposite multi-root deadlock, epoch
rollback and full transaction retry; real upsert key/row inversion; bulk rollback.
All previous approval/identity/ABA/key/auth/idempotency cases remain enabled.
PG17/Node24 CI is required, no SKIP/TODO. A green test that EXPECTS a deadlock
confirms the blocker, not compatibility. Results and exact tested HEAD are recorded
in PR #156 and the delivery report after the run; no guessed PASS in this document.

GO: inventory and disposable counterexample/testing work.
BLOCKED: all-writer compatibility, merge, persistent Staging/Main apply and runtime.
Remaining gates: resolved upsert/bulk ordering/retry strategy; actual isolation and
external writer inventory; deployed trigger/ACL/RLS/PostgREST signature boundary;
real consumer parity; finite retention/account closure; C archive/maintenance policy.

## Catalog gate repair — disposable implementation, comment 6097091074

The earlier deadlock counterexamples above remain enabled for UNSUPPORTED direct
writers. Participating transactions now acquire the private
`potok_food_evidence.catalog_gate_v1()` advisory transaction lock AFTER initial
trusted authority/auth locks and BEFORE the first catalog row lock. Evidence
review/current and Eligibility decide/current invoke this preamble; receipt-only
recovery does not lock catalog rows and needs no gate. Authority is rechecked after
waiting. Gate ACL grants NO new client/service_role access. No runtime wiring.

Supported test catalog entrypoint: a trusted disposable SQL transaction starts
`BEGIN ISOLATION LEVEL READ COMMITTED; SELECT potok_food_evidence.catalog_gate_v1();`
BEFORE any catalog row lock/DML, then executes one bounded atomic batch and COMMIT.
It is a prepared transaction protocol, NOT a deployed generic SQL execution RPC.
No SECURITY DEFINER arbitrary SQL endpoint or caller-controlled GUC bypass exists.
All participating operations serialize, including disjoint roots; UUID/key sorted
prelocks remain the contract for future finer-grained optimization. An existing
writer that already holds row locks before this preamble is NOT supported. No
claim the gate is automatically enforced for every direct foods writer.

Retry adapter `scripts/contracts/catalogTransactionRetryV1.ts` is TEST-ONLY. Four
attempts/15s monotonic deadline, full jitter 0–50/150/450ms, fresh entire transaction.
The adapter must enforce remaining time on connection/transaction/COMMIT and confirm
FULL rollback before setting rollbackConfirmed. PostgreSQL engine routine allowlist
plus SQLSTATE identifies retryable engine errors; business raises carry immutable
`POTOK_BUSINESS_CONFLICT_V1` DETAIL and never retry. Missing/unknown native metadata,
authorization, ambiguous COMMIT and business conflicts fail closed. This adapter
is not attached to REST/Gateway/importer runtime. Payload, actor, idempotency key,
CAS/epoch/proposal bindings do not change during retry; expected-head refresh is
not an automatic retry. Existing review/eligibility receipts retain exact replay.
Catalog operations without receipts retry only confirmed abort, never transport
uncertainty. Earlier committed batches are reported separately, not rolled back
or falsely declared an atomic whole import job.

| Path | Repair support | Remaining condition |
|---|---|---|
| Evidence review/current, Eligibility decide/current | Participating gate entrypoints | Disposable acceptance; deployed JWT/PostgREST remains unverified |
| Controlled SQL existing-ID/normalized-key upsert and bulk batch | Prepared private gate preamble, disposable owner role only | No public writer RPC/ACL rollout implemented |
| Private CRUD through existing direct REST | Legacy RLS regression only, NOT adapted | C protocol + ownership-preserving entrypoint/ACL review |
| Core importer, ingestion, pipeline, seeds | NOT adapted | Explicit atomic batch wrapper and retry/reconciliation semantics |
| Owner apply missing-food RPC | NOT adapted | Actual deployed body, authority and entry ordering audit |
| Macro maintenance/generator SQL and derived triggers | NOT adapted | RC + gate at transaction entry, triggers inventory |
| External COPY/admin/replication/account deletion | NOT VERIFIED/BLOCKED | Complete deployed inventory + lifecycle decisions |
| Resolver/search/diary/recipes/favorites reads | No new integration | Existing regressions, separate deployed parity |

C rollout plan (separate owner approval): enumerate deployed roles/RPCs/triggers,
verify RC/default isolation; adapt each writer to gate-before-first-row protocol;
use controlled bounded transaction entrypoints preserving ownership/RLS; prohibit
unsupported direct writes without giving arbitrary SQL capabilities; attest full
writer coverage; load-test gate contention; separately resolve maintenance and
retention/account deletion. BEFORE STATEMENT trigger alone is insufficient when a
transaction already holds root locks. No automatic new table/entitlement system.
Keep READ COMMITTED, TRUNCATE denial, epoch/claims, immutable evidence and Phase1
wire/digests unchanged. ARCHIVED and persistent rollout remain BLOCKED.

New acceptance assertions: participating existing-ID upsert/bulk opposite order
completes without 40P01; normalized-key conflict with different IDs resolves one row;
actual approval/mutation races use participating catalog preamble; native deadlock
victim rollback then bounded full retry; fail-closed classification/max-attempts/
deadline; measured disjoint-root gate contention; JWT expiry after gate wait.
A diagnostic latency is a contention sample, not a production throughput approval.
Real engine serialization under SERIALIZABLE is outside supported RC transactions;
its routine classifier is unit-verified, not asserted as DB acceptance coverage.
Exact CI results must be recorded in PR after execution, never inferred here.
