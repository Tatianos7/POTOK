# Adaptive Nutrition Graph v2 persistence + atomic activation design v1

Date: 2026-09-27
Status: **PROPOSED / REVIEW READY / NOT APPLIED / RUNTIME NOT INTEGRATED**

This package defines how the already implemented pure `TrustedGenerationInputV1 →
GeneratedWeekPlanV1 → AdaptiveNutritionGraphV2` chain can become one immutable PLAN
revision. It is documentation only. It does not create SQL, a migration, an RPC,
roles, a candidate manifest, a server endpoint or any database row.

## 1. Recommendation

Use strategy A: store the complete canonical Graph v2 snapshot as the single PLAN
authority, with indexed revision/evidence columns on the existing immutable graph
revision row.

The authoritative representation is the exact canonical UTF-8 byte sequence plus
its server-computed SHA-256. An immutable `jsonb` copy in the same row is allowed for
read responses and inspection only after the server proves that it decodes to and
re-encodes as the stored canonical bytes. Indexed columns are bindings into the
snapshot, not an independent graph model.

Fully normalized day, slot and component tables are rejected as the v1 authority:

| Property | Canonical snapshot + metadata | Fully normalized graph |
|---|---|---|
| Atomic insert | One immutable row | Many rows and ordering constraints |
| Digest proof | Direct SHA-256 over exact bytes | Requires reconstruction rules |
| Read path | One receipt-bound row | Multi-table assembly |
| Partial-update risk | Small; immutable row | Larger surface and orphan risk |
| Historical fidelity | Exact original snapshot | Depends on join/rebuild behavior |
| Debug/query support | Indexed bindings + immutable JSON | Strong ad hoc querying |
| Schema/migration cost | Additive extension | New table family and migrations |

A normalized projection may be introduced later for analytics/search. It must be
rebuildable from canonical Graph v2 bytes, carry the source graph digest, and never
authorize activation or historical FACT resolution.

## 2. Reused deployed concepts

The design reuses these existing persistence concepts and legacy IDs:

- `public.user_premium_plan_selections`: one weekly instance and current PLAN head;
- `public.adaptive_nutrition_graph_revisions`: immutable canonical PLAN revisions;
- `public.adaptive_nutrition_operations`: durable account-scoped request/receipt
  ledger;
- `public.adaptive_nutrition_events`: future PLAN/FACT history references only; the
  initial Graph v2 activation inserts no event;
- `public.user_goals.goal_revision`: authoritative Goal CAS identity;
- the existing selection-to-graph head FK and graph/event immutable guards;
- the protected entitlement predicate and append-only entitlement audit lineage.

`contract_version=1` on a weekly selection is the weekly product contract. It is not
the Graph encoding version. A Graph revision therefore needs an explicit
`graph_contract`/`graph_contract_version` binding so Graph v1 and Graph v2 cannot be
confused.

## 3. Weekly instance state model

The stable logical identity is account + contract version + local Monday anchor. The
selection also pins its canonical IANA timezone. The existing uniqueness rule on
account/week/contract is intentionally stronger than including timezone in the
unique key: a timezone change must conflict and enter an explicit transition, not
create a second identity for the same Monday.

Minimal selection states are:

```text
pending_generation --explicit activation--> active
pending_generation --explicit retirement--> archived
active             --week ends/user action--> completed | paused | archived
paused             --explicit resume--------> active
```

`generated` is a generation-receipt state, not a persisted selection state. This
avoids a selection that claims a generated plan while no committed graph/head exists.
`superseded` is a graph-revision relationship, not a weekly-instance state. A new
adaptation creates and activates a successor graph while the same weekly selection
remains active. A distinct `cancelled` state is not required for v1; adding it needs
separate product semantics and compatibility review.

No transition is implicit. Goal, timezone, Monday rollover, entitlement change or
login never rewrites an existing weekly identity or graph.

## 4. Conceptual schema proposal

**Every item below is PROPOSED / NOT APPLIED. It is not executable migration SQL.**

### 4.1 Weekly selection

Retain `user_premium_plan_selections` as the only weekly instance/head table. Keep:

- `user_id`, `id`, `contract_version`, `week_anchor`, `timezone`;
- `status`, `plan_revision`, `goal_revision`, `history_revision`, `diary_revision`;
- `origin_kind`, `origin_lineage` and existing legacy/template identity fields.

The head remains the composite FK `(user_id, id, plan_revision)` to one committed
graph revision. Initial activation changes only `pending_generation/null` to
`active/new_plan_revision`. Later adaptation changes only the head revision after
the successor graph row has been inserted in the same transaction.

Required uniqueness stays one contract-v1 identity per account/week across every
state. Archived rows are not silently replaced with a new identity.

### 4.2 Immutable graph revision

Extend the existing `adaptive_nutrition_graph_revisions` concept rather than add a
second Graph v2 table. Existing primary/FK identities remain. The conceptual row is:

| Binding | Requirement |
|---|---|
| `(user_id, selection_id, plan_revision)` | immutable primary identity |
| `graph_contract`, `graph_contract_version` | exact decoder dispatch; v2 requires `adaptive_nutrition_graph_v2` / `2` |
| `graph_canonical_bytes`, `graph_snapshot` | exact authoritative bytes plus verified immutable JSON copy |
| `content_digest` | server SHA-256 of the exact Graph canonical envelope |
| `generated_week_plan_digest` | server SHA-256 of exact `GeneratedWeekPlanV1` canonical content |
| `generation_input_digest` | server SHA-256 of exact `TrustedGenerationInputV1` |
| `goal_revision`, `target_policy_revision` | pinned Goal target/bounds authority |
| `preference_revision`, `safety_revision` | pinned server-owned input revisions |
| `catalog_manifest_revision`, `candidate_manifest_digest` | protected candidate authority |
| four policy revisions | composition, validation, optimization and generation |
| `generation_operation_id`, `created_by_operation_id` | settled generation receipt and activation receipt |
| `supersedes_plan_revision` | nullable same-selection predecessor FK |
| `created_at` | server timestamp outside deterministic Graph content |

Conceptual constraints:

- the existing composite primary key remains;
- `(user_id, graph_contract, content_digest)` is unique for exact digest lookup;
- `generation_operation_id` and activation `created_by_operation_id` reference
  settled owned ledger rows with the expected action types;
- `supersedes_plan_revision` references the same account and selection;
- a partial unique successor constraint allows at most one direct successor of a
  revision;
- initial revision has null predecessor; later revision must point to the current
  head observed by CAS;
- all digest fields are exactly 32 bytes;
- Graph v2 rows require every listed revision/digest; Graph v1 historical rows keep
  their existing valid shape and are not backfilled with invented evidence;
- update/delete/truncate remain rejected, including for owner sessions except a
  separately reviewed disaster-recovery procedure.

Meal snapshots are stored once inside canonical Graph v2. There is no authoritative
meal-snapshot table. Their `mealSnapshotRevision`, component ordering and independent
recipe/portion/eligibility revisions remain digest-bound inside the Graph.

### 4.3 Durable receipt ledger

Reuse `adaptive_nutrition_operations`. Its account + idempotency-key primary key,
operation identity, canonical request bytes/digest, terminal outcome, result
references and timestamps remain the ledger foundation.

The proposal adds support for two protected action types:

- `PLAN_GENERATED_V2`: binds canonical `TrustedGenerationInputV1`, exact canonical
  `GeneratedWeekPlanV1` result bytes, generation-input/result/Graph digests and the
  proposed plan revision. It writes no graph or head.
- `PLAN_ACTIVATED_V2`: binds the settled generation operation, expected current head
  and complete CAS vector. Its accepted receipt points to the committed Graph v2 row
  and active head.

To support exact generation replay after process loss, terminal generation receipts
need immutable canonical result bytes or an immutable same-ledger result artifact.
Storing only a digest is insufficient to return the original generated output.
Adding one bounded `result_canonical` byte field and `result_digest` is preferred to
a parallel generation-artifact table. The ledger guard permits only the single
`in_progress → terminal` settlement and freezes all fields afterward.

`operation_id` must be globally unique, or the protected activation boundary must
receive the account from an already authenticated server context. A browser cannot
supply account authority. The preferred internal activation request references a
globally unique generation operation ID; the server derives account/selection from
that settled receipt and re-reads it after acquiring the account lock.

## 5. Protected candidate manifest

No workbook, mutable catalog row, display name or caller eligibility claim may
authorize Graph content. Activation loads the exact protected append-only manifest
revision bound by the generation receipt and independently verifies its canonical
digest.

Every `MealSnapshotV1.components[]` item must match exactly one manifest entry by:

```text
recipeId
recipeRevisionId
portionRevisionId
eligibilityRevisionId
```

The same entry must prove publication, canonical/nutrition/allergen/dietary evidence,
allowed meal type, role/anchor/companion metadata, HYBRID portion rules and immutable
recipe snapshot. Missing, duplicate, unresolved, unpublished or stale entries return
`BLOCKED_MISSING_EVIDENCE` or `MANIFEST_COMPONENT_MISSING` before any graph insert.

The prior Graph-v1 manifest draft is historical design evidence only. A Graph-v2
manifest contract must cover component-level eligibility and evidence. Whether it is
stored by extending one generic protected manifest table or by a new versioned row
contract requires deployed-schema review; two mutable authorities are forbidden.
No real candidate manifest is created by this package.

## 6. Generation receipt boundary

The trusted canonical-validator service, not the model and not the browser:

1. derives the authenticated account and owned pending selection;
2. loads all server-owned revisions and the protected candidate manifest;
3. strict-decodes raw generator output before JSON normalization;
4. reconstructs exact `MealSnapshotV1`, Graph v2 and GeneratedWeekPlan canonical
   bytes with the reviewed TypeScript implementations;
5. reruns meal/day/week validation and deterministic optimization checks;
6. recomputes every Graph, plan, input and validation digest;
7. verifies every component against the pinned manifest;
8. rechecks the generation CAS vector;
9. settles one durable `PLAN_GENERATED_V2` receipt with exact result bytes.

An untrusted generator-provided digest, account, entitlement flag, Goal revision,
manifest or policy revision is never authority. The generator has no database write
credential and cannot settle a trusted receipt.

## 7. Atomic activation transaction

The future internal boundary is conceptually:

```text
activate_generated_week_v2(
  generation_operation_id,
  activation_idempotency_key,
  expected_current_plan_revision
) -> ActivationReceiptV2
```

This is a signature proposal, not SQL. The trusted server channel supplies the
operation reference and original key; the database derives account, selection,
week, proposed revision and all evidence from the settled generation receipt and
authoritative rows. It accepts no client account, Premium flag, Goal/manifest/policy
authority or trusted digest.

One transaction performs:

1. locate the immutable settled generation receipt by globally unique operation ID
   only to derive its account; reject missing, foreign or non-generation rows;
2. acquire the account advisory transaction lock;
3. look up and lock the activation receipt by account + original idempotency key;
4. return exact settled replay, `SERVER_UNKNOWN_OUTCOME`, or
   `IDEMPOTENCY_PAYLOAD_MISMATCH` before authorizing a new paid effect;
5. re-read/lock the generation receipt and verify action, ownership, canonical input
   bytes, canonical result bytes and all stored/recomputed digests;
6. recheck effective verified Premium entitlement under the shared account lock;
7. lock the owned weekly selection and compare selection ID/revision, expected
   status, expected head, week and timezone;
8. lock/read Goal, preferences and safety authority and compare exact revisions;
9. read target, catalog manifest and composition/validation/optimization/generation
   policy revisions under stable protected snapshots;
10. strict-decode GeneratedWeekPlanV1 and embedded Graph v2; recompute their canonical
    bytes/digests and require the exact generation-receipt values;
11. rerun component-manifest membership and verify stored meal/day/week validation
    evidence; the protected validator remains the algorithm authority and the DB
    defensively verifies all immutable identities/digests it can derive;
12. compare the complete CAS vector and current head again;
13. insert the in-progress activation operation;
14. insert one immutable Graph v2 revision with initial null predecessor or the exact
    current-head predecessor;
15. CAS the same selection from `pending_generation/null` to `active/new head`, or
    from `active/expected head` to `active/successor head` for a future separately
    approved adaptation;
16. settle the activation receipt with exact graph/plan/input digests and revision
    identities;
17. commit once.

Any exception, failed insert, changed row count, revision mismatch, entitlement
failure, manifest failure or receipt settlement failure rolls back operation, graph
and head together. Initial activation inserts no `adaptive_nutrition_events` row;
the immutable graph and head transition are the PLAN record.

## 8. Complete CAS vector

The transaction compares all of:

- server-derived account;
- selection ID and `planSelectionRevision`;
- expected selection state and exact current plan head (null initially);
- local Monday anchor and canonical timezone;
- Goal and target-policy revisions;
- preference and safety revisions;
- entitlement evidence revision and effective capability;
- catalog manifest revision and candidate-manifest digest;
- composition, validation, optimization and generation policy revisions;
- generation input, GeneratedWeekPlan and Graph digests;
- proposed plan revision and predecessor identity.

Any mismatch returns `CONFLICT_STALE_INPUT`. It never changes the Goal, timezone,
week, manifest, policies, proposed revision or input key and never regenerates inside
the activation transaction.

## 9. Receipt, idempotency and unknown outcomes

Activation request identity is account + activation idempotency key. Its canonical
request digest covers the generation operation ID, exact generation-input/result and
Graph digests, weekly identity, full CAS vector, proposed revision and expected head.

- no row: create one operation in the same transaction as graph/head;
- same key and same request, settled: return the original receipt (`EXACT_REPLAY`);
- same key and same request, in progress/unresolved: return
  `SERVER_UNKNOWN_OUTCOME` and retain the original key;
- same key with any changed byte/digest/revision: `CONFLICT_IDEMPOTENCY` with
  `IDEMPOTENCY_PAYLOAD_MISMATCH`;
- timeout after commit: lookup/replay returns the original settled receipt;
- timeout before commit: rollback leaves no operation, graph or head, so the same
  original request/key may be retried;
- a new key after success observes the changed head and conflicts rather than
  creating a duplicate initial graph.

The settled receipt includes account-scoped operation ID, selection ID,
plan/graph revision, predecessor, Graph contract/version/digest,
GeneratedWeekPlan/input digests, Goal/target/history/diary revisions, week/timezone,
manifest/policy revisions and committed server timestamp. No event IDs are emitted
for initial activation.

## 10. Immutable history and PLAN/FACT separation

Graph rows are append-only. A future confirmed replacement/adaptation uses:

```text
PROPOSE -> PREVIEW -> CONFIRM -> insert successor Graph v2 -> CAS head
```

The prior row is never updated. `supersedes_plan_revision` and the one-successor
constraint keep a linear chain. The active head always points to one committed row;
all historical rows remain addressable by revision and digest.

FACT remains a separate append-only event/diary boundary. A later consumed FACT
stores the exact selection, plan revision, meal snapshot revision and component
identity that existed at confirmation time. Moving the PLAN head does not recompute,
delete or redirect a FACT. Activation writes no diary row, consumed event, skip,
modified food, extra food, replacement event or shopping side effect.

## 11. Read model

Future read operations are:

| Read | Authority and result |
|---|---|
| Discover current week | own account from `auth.uid()`, verified Premium, one eligible selection |
| Current active head | selection plus exact committed graph revision/digest; Premium required |
| Exact revision by ID | own selection + plan revision; returns contract/version/digest and canonical snapshot |
| Exact revision by digest | own account + graph contract + digest; zero/one result |
| History | ordered predecessor chain with revision/digest/created receipt IDs |
| Receipt lookup | own account + original idempotency key; exact settled/unknown result |
| Exact replay | original canonical request digest must match before returning receipt |

The dispatcher reads `graph_contract` and version first. Graph v1 uses its unchanged
decoder and semantics. Graph v2 uses `decodeAdaptiveNutritionGraphV2`. Unsupported
or contradictory versions fail closed. There is no fallback decoder, lazy conversion
or write-on-read migration.

Current-head reads require active verified Premium. Own receipt-bound exact recovery
and historical references remain available according to the already accepted expiry
contract, without authorizing a new paid effect. Every response includes selection,
plan revision, graph contract/version/digest and receipt identity. A week that merely
looks current cannot prove activation success.

## 12. Concurrency and lock order

The STAGING metadata preflight proved that entitlement and Adaptive PLAN writers use
different advisory-lock namespaces. Before activation, a reviewed repair must make
every such writer acquire the same `potok-shared-account-gate-v1:<account>` resource.
Capability-specific entitlement locks may be acquired only afterward in canonical
order. Without that repair, revoke can race activation after the entitlement
predicate is read.

Fixed lock order:

```text
immutable generation receipt lookup (derive account; no mutable lock)
-> shared account advisory transaction gate
-> optional entitlement capability locks in lexical order
-> activation operation row by account/key FOR UPDATE
-> generation receipt FOR SHARE/UPDATE
-> weekly selection FOR UPDATE
-> current graph head/predecessor FOR SHARE
-> Goal row FOR SHARE
-> preference and safety authorities in stable identity order
-> entitlement lineage/head under the shared account gate
-> manifest and policy rows in canonical revision order FOR SHARE
```

No function may acquire these in another order. The account gate serializes two
activations, replacement/adaptation and entitlement change. Selection-head CAS is the
second defense. Goal/preferences/safety/manifest/policy changes after generation
produce stale-input conflicts. A stale client confirmation cannot advance the head.
No database lock is held while calling an external model or network service.

## 13. Security and privileges

- browser/application identity never writes selections, graph revisions, operation
  settlement or active heads directly;
- raw tables use RLS + FORCE RLS, have no `anon`/`authenticated`/`PUBLIC` write
  grants, and keep immutable guards;
- user reads go through narrow account-derived RPCs or equally narrow RLS policies;
- any future `SECURITY DEFINER` function has fixed `search_path`, exact allowlisted
  inputs, explicit `auth.uid()`/protected-worker authority checks and revoked PUBLIC
  execute by default;
- `TO authenticated` alone is never authorization;
- `service_role` is not a client or provisioning authority and receives no activation
  shortcut;
- the generator cannot read/write the database or choose manifest authority;
- trusted canonical validation and DB activation credentials are separate from the
  untrusted generation process;
- the final execution role/channel, secrets handling and operator grant/revoke path
  remain an external evidence checkpoint, not an assumed deployed capability.

## 14. Stable outcomes and reasons

Activation outcomes:

- `ACTIVATED`
- `EXACT_REPLAY`
- `CONFLICT_STALE_INPUT`
- `CONFLICT_IDEMPOTENCY`
- `ENTITLEMENT_DENIED`
- `BLOCKED_MISSING_EVIDENCE`
- `INVALID_GRAPH`
- `INVALID_GENERATED_PLAN`
- `SERVER_UNKNOWN_OUTCOME`

Stable reasons include:

- `ACCOUNT_BINDING_STALE`, `SELECTION_REVISION_STALE`, `PLAN_HEAD_CHANGED`,
  `WEEK_IDENTITY_STALE`;
- `GOAL_REVISION_STALE`, `TARGET_POLICY_STALE`, `PREFERENCE_REVISION_STALE`,
  `SAFETY_REVISION_STALE`, `ENTITLEMENT_EVIDENCE_STALE`;
- `CATALOG_MANIFEST_STALE`, `POLICY_REVISION_STALE`,
  `GENERATION_POLICY_STALE`;
- `ENTITLEMENT_REVOKED`, `ENTITLEMENT_EXPIRED`;
- `GRAPH_CONTRACT_UNSUPPORTED`, `GRAPH_DIGEST_MISMATCH`,
  `GENERATED_PLAN_DIGEST_MISMATCH`, `GENERATION_INPUT_DIGEST_MISMATCH`;
- `VALIDATION_EVIDENCE_MISMATCH`, `MANIFEST_COMPONENT_MISSING`,
  `MANIFEST_COMPONENT_AMBIGUOUS`, `PUBLICATION_NOT_APPROVED`,
  `CANONICAL_EVIDENCE_MISSING`;
- `PREDECESSOR_MISMATCH`, `IDEMPOTENCY_PAYLOAD_MISMATCH`,
  `OPERATION_UNRESOLVED`.

Validation/authorization outcomes are returned without writes. Internal integrity,
constraint or settlement failures abort the transaction and are surfaced as an
unknown server outcome until receipt lookup proves whether anything committed.

## 15. Synthetic transaction matrix

These are pure review scenarios. No live DB test has run.

| # | Scenario | Expected proof |
|---:|---|---|
| 1 | First valid activation | one activation receipt, one Graph v2 row, one head move, no event/FACT |
| 2 | Exact idempotent replay | original receipt and digests returned, zero new rows |
| 3 | Same key, changed payload | `CONFLICT_IDEMPOTENCY`; no writes |
| 4 | Stale plan head | `PLAN_HEAD_CHANGED`; no graph insert |
| 5 | Goal changed | `GOAL_REVISION_STALE`; no silent rebase |
| 6 | Target policy changed | `TARGET_POLICY_STALE` |
| 7 | Preferences changed | `PREFERENCE_REVISION_STALE` |
| 8 | Safety revision changed | `SAFETY_REVISION_STALE` |
| 9 | Premium revoked/expired | new activation denied; settled replay still readable |
| 10 | Catalog manifest changed | `CATALOG_MANIFEST_STALE` |
| 11 | Validation policy changed | `POLICY_REVISION_STALE` |
| 12 | Graph digest mismatch | `INVALID_GRAPH/GRAPH_DIGEST_MISMATCH` |
| 13 | Generated-plan digest mismatch | `INVALID_GENERATED_PLAN` |
| 14 | Component absent from manifest | `BLOCKED_MISSING_EVIDENCE/MANIFEST_COMPONENT_MISSING` |
| 15 | Two simultaneous attempts | account lock serializes; one activates, other replay/conflict |
| 16 | Timeout after commit | original-key lookup returns exact settled receipt |
| 17 | Timeout before commit | no receipt/graph/head residue; same original key may retry |
| 18 | Historical Graph v1 read | unchanged v1 decoder and bytes; no conversion |
| 19 | Exact Graph v2 historical read | revision/digest-bound v2 response |
| 20 | Successor Graph v2 | new row/head; predecessor bytes unchanged |
| 21 | FACT references old revision | FK remains valid after head moves |
| 22 | Injected failure before settlement | transaction rollback leaves no partial graph/head/receipt |
| 23 | Foreign-account receipt read | denied/no leakage |
| 24 | Current active head invariant | exactly one selection head references one committed revision |
| 25 | Real catalog mutation attempt | absent from contract; no recipe/manifest mutation occurs |

Future DB acceptance must execute these in a rollback-only transaction against a
reviewed staging schema, then run a separate SELECT-only zero-residue postcheck.
Local pure/static checks are not evidence of PostgreSQL locks, RLS or rollback.

## 16. Compatibility and rollback plan

Graph v1 rows, functions and historical receipts remain untouched. A future schema
patch must be additive and allow existing Graph v1 rows to retain null v2-only
metadata under an explicit versioned check constraint. The read dispatcher must be
deployed and accepted before any v2 activation privilege exists.

Before activation enablement, rollback is removal of the not-yet-granted v2 execute
path and unused additive objects only. After the first accepted v2 graph, immutable
rows must not be deleted or rewritten; rollback means disable new v2 activation,
retain exact reads/history, and ship a forward repair. Production enablement is a
separate checkpoint after staging structural and behavioral acceptance.

## 17. Remaining evidence blockers and owner checkpoints

The design is review-ready, but runnable implementation remains blocked on:

1. owner approval to turn the observed deployed metadata and the pure authority
   design in `adaptive-nutrition-graph-v2-missing-authorities-design-v1.md` into a
   runnable-but-not-applied draft;
2. implementation and database acceptance of the approved dedicated candidate-
   manifest v2 authority;
3. implementation and database acceptance of explicit preference/safety immutable
   histories and their protected current head;
4. implementation and concurrency acceptance of the shared account-gate repair;
5. selection of the protected canonical-validator execution channel and least-
   privilege role without `service_role` client authority;
6. review of the additive schema/RPC draft, followed by separate approval for a
   SELECT-only staging preflight; only later may staging apply be considered.

The next safe package is an owner-reviewed, runnable-but-not-applied additive schema
and RPC draft plus SELECT-only preflight and rollback-only acceptance artifacts. It
must be based on fresh deployed metadata and must not make any current recipe eligible.

`ADAPTIVE_GRAPH_V2_PERSISTENCE_DESIGN_READY`
`ATOMIC_PLAN_ACTIVATION_CONTRACT_V1_READY`
`GRAPH_V1_V2_COEXISTENCE_CONTRACT_READY`
`DURABLE_GENERATION_RECEIPT_CONTRACT_READY`
`IMMUTABLE_PLAN_HISTORY_CONTRACT_READY`
`SCHEMA_PROPOSAL_NOT_APPLIED`
`RUNTIME_NOT_INTEGRATED`
`GENERATOR_NOT_ACTIVATED`
