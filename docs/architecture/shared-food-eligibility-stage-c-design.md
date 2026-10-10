# Shared Food Eligibility Stage C — All-Writer Compatibility

Status: DESIGN ONLY. Production/Staging/Main apply, merge and activation BLOCKED.
Source: PR #156 `d45b3fefbb9358438391d28a14e73c03e5621aa4`, tree
`b456c98aa987af4ec4a03b31424033aca0586ce6`; owner checkpoint
https://github.com/Tatianos7/POTOK/pull/156#issuecomment-6097859762.
This docs-only PR is stacked on #156 to avoid including implementation in its diff.
No changes to #154/#155/#156, existing consumers or Supabase. The local source SHA
is `9cb42d6317e99891b426e9fb30bf29dbdf08c0ee`, with the identical source tree.

## Confirmed facts versus unverified deployment

Rechecked tracked source, services, scripts, SQL drafts, triggers and RPC callsites
against the preceding complete writer inventory. No executable catalog TRUNCATE or
COPY loader found in Git. External administration, jobs, replication, Auth deletion,
deployed functions and effective grants cannot be inventoried from Git alone.
Supabase was NOT queried. No deployed default isolation, RLS, FORCE RLS or ACL claim.

Baseline independent checkpoint confirms PostgreSQL17.11/Node24.21 acceptance
42/42, no FAIL/SKIP/TODO (run38050086757), and 233 local regression passes.
Those are historical #156 results, NOT tests of Stage C wrappers or production.
Counterexamples show direct unsupported writers still deadlock. Retry is test-only.

Two additional repository discrepancies require deployed inspection:
- `supabase/foods_schema.sql` has expression unique index
  `(normalized_name, coalesce(normalized_brand,''))`; clients use
  `onConflict: normalized_name,normalized_brand`, and #156 fixture uses simple
  column uniqueness. These are not equivalent for NULL/empty brands or index
  inference. Do NOT claim deployed upsert parity or silently change normalization.
- Owner-apply draft uses `id_user/is_admin`, SECURITY DEFINER, search_path
  public,pg_temp and draft-row FOR UPDATE before catalog mutation. Other schema
  drafts use `user_id/is_admin`. Neither establishes trusted Staging authority.
  Main cannot inherit Staging authorization; no fallback or legacy RPC patch here.

## Proposed mandatory transaction protocol

Keep existing gate and identity; no foods_v2, new catalog IDs, entitlement ledger,
client authorization tokens or trusted GUC flags. Every supported mutation starts
with verified principal/authority locks (when applicable), then the transaction-level
catalog gate BEFORE any catalog root lock, then roots by UUID, old/new key locks,
registry roots/heads, evidence heads and dependent draft/receipt locks. Dependent
workflow locks must be inventoried: owner-apply must not lock a draft first then
enter a catalog transaction if another path uses catalog then draft. No new actor
scope acquisition after gate; repeated same-actor authority checks stay mandatory.
Mixed arbitrary DML/RPC transactions and client prelocking are unsupported.

READ COMMITTED is required, including inside PostgREST RPC transactions. Verify
actual per-role/per-function/database defaults; do not assume PostgREST defaults.
Gate-only repair does not make REPEATABLE READ/SERIALIZABLE safe. Keep global RC and
TRUNCATE denial, immutable claims, epoch, Phase1 wire/digests and ARCHIVED restrictions.
Statement triggers alone cannot establish transaction-entry order for prelocked rows.

Preferred API design: typed allowlisted operations, not arbitrary SQL/table/column
RPCs. Reuse existing functions where safe; separate private CRUD and trusted shared
catalog batch operations because their authority differs. Input contains business
payload, expected bindings and idempotency reference, never authoritative actor,
role, server time or freely editable source/ownership. Unknown fields reject.

Private operations: derive actor from verified live session; source=user and owner
are server constrained; no ability to upgrade to core/brand, change owner, registered
identity or shared key. Create+self-root in one transaction. UPDATE/DELETE require
ownership before mutation; retain identical read visibility. Do not expose foreign
row IDs/names through upsert conflict lookup, errors or receipt reads. Global
normalized-key collisions need generic conflict, not adoption of a foreign row.
Scope/index semantics need an explicit decision if current global uniqueness prevents
legitimate private products; Stage C must not silently change the foods model.

SECURITY INVOKER is preferred if safe gate access and actual RLS permit it. The
private gate currently denies clients, so wrappers cannot simply assume invoker
EXECUTE works. If a narrow SECURITY DEFINER wrapper is needed, fixed pg_catalog
search_path, fully qualified objects, minimal non-superuser owner, explicit principal
and ownership checks and verified FORCE RLS behavior are required; no BYPASSRLS
workaround. Revoke PUBLIC/anon and unneeded service_role EXECUTE, allow only intended
principals. No generic SQL endpoint and no caller-supplied privileged JWT claims.
Actual wrapper ownership and RLS feasibility are a pre-implementation gate.

Shared/admin operations: retain potok_control trusted attestation and live verified
JWT/session, recheck after gate wait and immediately before commit-critical writes.
Importer credentials using service_role are NOT proof of admin/eligibility authority.
Prefer verified approved operator route with bounded batch. Unattended machine auth
needs a separately approved existing-principal integration; do not invent entitlement
or assume is_admin/service_role is sufficient. Import never issues evidence or sets
ELIGIBLE automatically. Catalog nutrition writes never rewrite diary/historical values.

## Writer compatibility matrix (Git inventory; all C adaptations PROPOSED)

| Existing path | Boundary/authority today | Required C change | Risk/test / GO condition |
|---|---|---|---|
| foodService.ts:1125,1164 | private REST INSERT then separate root UPDATE | narrow atomic private create; gate before row; derive owner | half-create, foreign/normalized collision; owner-A/B isolation and atomic rollback |
| foodService.ts:1258,1293 | owner/source REST UPDATE/DELETE | typed private mutations + gate, preserve field allowlist | ownership/source escalation; unauthorized no-op/leak and existing cache behavior tests |
| import-food-core.ts:1065–1066,1278 | REST id-upsert/insert batches; no retry | typed controlled atomic batch, verified operator, stable request manifest | inverse order/upsert races, rollback/reconciliation; previous committed batches explicit |
| run_food_ingestion.mjs:793,805,817 | service-role insert/normalized DO NOTHING/per-id update | same bounded batch adapter; explicit operation modes | privileged bypass/partial run; all modes + stable-key collision + rejection tests |
| foodIngestionService.ts:307,352 | normalized upsert, then recompute RPC | controlled batch; separately inventory recompute body | null/empty brand and RPC side effects; exact deployed index and no historical rewrites |
| foodImportPipeline.ts:144; seedFoods.ts:51 | normalized bulk upsert; throw or log/continue | shared adapter; no false whole-job success | duplicate rows/batches, initial seed without TRUNCATE, bounded resumability |
| missingFoodDraftService.ts:275; owner apply draft SQL:164 | Main-shaped legacy definer, draft locked first | separately reviewed trusted Staging route; catalog gate before dependent locks | draft/catalog inversion, replay, foreign principal; deployed legacy unchanged until approved |
| nutrition_zero_macro_exact_unique_autofix_draft.sql:373 | bulk UPDATE/plain BEGIN | controlled maintenance transaction with RC+gate | overlapping writers, rollback; macro-only no identity epoch changes |
| nutrition_zero_macro_incident_fix_draft.sql:77 | same | same | same; remediation authorization is independent |
| nutrition_zero_macro_referenced_hotfix_draft.sql:78 | same | same | same; historical diary never altered by C |
| nutrition_zero_macro_restoration_autofix_draft.sql:104 | same | same | same |
| build_nutrition_repo_reference.mjs:355 | generates maintenance UPDATE SQL | generate approved preamble/bounds | generated SQL snapshot+execution acceptance |
| foods_schema.sql:42–101; food_kb_2_1.sql:22–42 | derived search/updated-at triggers | inventory deployed body/order; no reverse dependency locks | extra writer/trigger recursion; real DDL fixture and derived-field parity |
| Evidence review/current; Eligibility decide/current | #156 authority→gate→root | retain protocol; certify wrapper/role integration | cross-package mutation/expiry/CAS/idempotency tests |
| account/Auth FK-induced foods mutations | deployed flow unknown; Git has SET NULL FKs | separate retryable deletion lifecycle; integrated lock order | auth/profile/catalog inversions, PII/history conflicts; remains BLOCKED |
| external SQL/COPY/replication/admin/jobs | unknown, may bypass triggers/ACL | inventory, disable/quarantine or audited controlled protocol | missing writer coverage blocks all-writer verdict; no trigger-disable exceptions |
| resolver/search/diary/recipes/favorites, recipe-ingredient import | reads foods; writes other tables | no eligibility/gate integration for ordinary reads | regression/E2E parity; PLAN != FACT remains unchanged |
| aliasApply and review queues | aliases/queues, not foods until owner apply | audit transitive locks and deployed RPC bodies | catalog-backreference lock inversion; no evidence authority escalation |

## Retry and reconciliation

Keep provisional four attempts/15s total, full jitter 0–50/150/450ms; each attempt a
fresh bounded whole transaction, including connection and COMMIT budgets. Preserve
actor, exact payload/digest, idempotency key and expected CAS/epoch/proposal. Native
40P01/serialization 40001 requires reliable driver metadata AND confirmed complete
rollback. Business DETAIL POTOK_BUSINESS_CONFLICT_V1, auth, integrity, unknown native
metadata and unknown COMMIT are not automatic retry. No automatic CAS refresh.
PostgREST may omit engine routine: classify as nonretryable unless transport/version
integration proves a trustworthy discriminator. Never trust a client error envelope.

Reuse Evidence requests and Eligibility receipts only for their existing typed
operations. Owner-apply applied state can reconcile its own draft transaction, not
arbitrary batches. Catalog writers currently lack an immutable catalog receipt.
Until approved durable reconciliation exists: retry only confirmed abort, and stop
on transport ambiguity; inspect expected IDs/bindings read-only, not blind replay.
For future exactly-once batch recovery propose minimal typed receipt extension only
after proving existing stores cannot safely represent catalog requests, with separate
PII/retention review. Do not insert catalog payloads into Evidence event tables.

A job manifest pins batch boundaries/digests/IDs and tracks committed/aborted/unknown
batches. It is not authority or database commit proof. Counts advance only on
verified receipt/commit. Duplicate IDs or conflicting normalized keys within a batch
reject deterministically before writes. Whole jobs spanning batches are not atomic.
Staging rollout needs a decision on durable receipt versus fail-stop unknown outcome.

## Contention and unsupported paths

A global gate serializes disjoint roots AND sensitive current reads. Baseline
252.4ms wait with 200ms holder is one diagnostic, not throughput approval. If average
gate hold is H seconds, a rough upper service capacity is 1/H; retries and I/O worsen
it. Do not hold gate during network/source acquisition, UI interaction or backoff.
Prepare source outside transaction, validate again inside. Record no PII in metrics.
Queue saturation, slow batches and long auth waits need deadlines/backpressure.

Load matrix: concurrency1/2/8/32, disjoint/overlapping roots, batches1/10/50/200,
private-heavy and importer-heavy mix; compare no-mutation/read baseline, gate wait,
hold, p50/p95/p99, throughput, timeout/retry/exhaustion counts. Provisional starting
batch cap200 and lock2s/statement5s are proposals, not production-approved limits.
Owner must choose private write/current-read SLO and acceptable importer throughput.
Do not replace gate with sharding absent new ordering/identity proof.

TRUNCATE stays forbidden even empty registry; initial load uses bounded INSERTs.
Registered shared roots cannot be physically deleted/key-reused. Archive guard,
ARCHIVED activation and account privacy-safe deletion remain separate approval gates;
no CASCADE evidence erasure. Missing lifecycle is not solved by nulling actor IDs.
External non-RC/prelocked/trigger-disabled writers must be disabled or adapted before
activation, never grandfathered through security exceptions.

Rollback after cutover: pause affected writes/jobs and retain guards/claims/history;
read-only consumer paths may continue. Do not restore unsafe direct grants, remove
triggers, rewind epoch, delete receipts/history or re-enable old importer versions.
Rollback must be tested as a forward fail-closed operation, not schema teardown.
