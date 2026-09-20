# Adaptive Nutrition: PLAN / FACT domain contract

Owner semantics accepted 2026-09-20. Implementation is a pure **local simulation**,
not a server mutation, storage schema or activation of adaptive nutrition.

## Implemented boundaries

`NutritionRevisionContext` carries account, plan ID/revision, goal revision,
local Monday anchor and timezone. A dated slot carries an immutable recipe/portion
snapshot with recipe, portion and snapshot revisions. Snapshot nutrition describes
the explicitly supplied amount, never an inferred amount or parsed display string.
Food references in this contract are opaque; the simulator does not resolve them,
invent canonical IDs or claim that a live catalog validated them. Production
integration must supply verified snapshots and enforce its existing resolver rules.

The constructor validates the active local week, timezone, unique dated slots and
snapshot structure. It clones the read model. Reuse of a snapshot/portion revision
with contradictory content fails closed. Unknown actual amounts are not copied
from the plan, zero-filled or guessed.

| Command | Effect after explicit local confirmation | PLAN / FACT boundary |
| --- | --- | --- |
| CONSUMED_AS_PLANNED | Simulated diary snapshot of the exact reviewed slot snapshot | Plan itself does not count as consumed |
| CONSUMED_MODIFIED | Simulated diary snapshot of the explicit actual payload | No planned amount default |
| SKIPPED (DID_NOT_EAT) | Skip annotation | No zero-calorie consumed fact |
| EXTRA_FOOD | Independent actual snapshot with no planned slot | No change to later meals/days |
| REPLACE | Simulated plan graph replacement | No consumed fact |
| REVISE_FACT / EDIT | New snapshot superseding the currently effective event | Original retained |
| REVISE_FACT / UNDO | Retraction event superseding the currently effective event | No deletion, zero-food snapshot or resurrection of older facts |
| UNDO_ANNOTATION | Retraction of an effective skip annotation | No diary fact |

Restoring an older plan slot is a fresh explicitly reviewed REPLACE command using
the retained snapshot; the graph revision advances and both replacement events stay
in history. Historical diary snapshots keep the recipe/portion actually confirmed
at that time. A later plan replacement cannot rewrite them.

## State machine and conflicts

`PROPOSE → PREVIEW → CONFIRM` is required. Cancel discards only the pending local
proposal. Proposed or previewed commands do not change graph/history. Confirmation
rechecks account, expected versions, dated slot and snapshot revisions, preview
content and explicit consent. Future consumption and provisional-as-active weeks
are rejected. A second consumption of a slot requires an explicit fact revision.
Missing actual payload, stale concurrency or changed preview leaves input unchanged.

The state has `mode: local-simulation` and `networkWritesEnabled: false`. Its event
history is **not** a diary store and must not be supplied to Progress or actual-day
readers. `localSequence` is conservative local command concurrency;
`localPlanSequence` advances only for plan replacements. Neither is a server token.
The original server-read `planRevision` is never fabricated or incremented locally.
No network transport, RPC, localStorage, persistence callback or write adapter exists.

Idempotency is account scoped. Exact key + canonical command content replay is a
no-op returning the existing simulation result; changed content under that key
conflicts. Object key order does not change content identity; nonfinite/undefined
values are rejected. Fingerprints are local equality keys, not cryptographic
signatures or authorization. Callers must reuse the original command on retry.

## Replacement and shopping consistency

`getSimulationShoppingSelection` accepts the expected graph revision key and emits
each dated slot with its full recipe/portion snapshot. Pending replacement previews
do not affect it. After local confirmation it exposes the new graph; use of an old
shopping revision fails. Repeated recipe occurrences remain distinct. Diary actions
and undo do not silently alter the plan or shopping. This is a revision-bound
selection contract; it does not certify canonical quantities or activate a real
shopping writer. Existing canonical aggregation remains a separate validated step.

The earlier arithmetic replacement preview still cannot authorize a safe match:
restriction/allergen review, portion/safety policy and verified canonical evidence
are required. A simulation of confirmation does not approve any recipe or policy.
Goal/adaptation application remains blocked; no new formulas or clinical thresholds.

## Preview UX

The local weekly screen describes what each action would do. Modified/extra food
requires actual foods and portions; demo display strings cannot construct them.
Saving stays disabled. It neither fabricates an authoritative command envelope nor
connects the simulation to a real diary. Pure reducer tests and React SSR cover
these semantics. Browser gap is retained; discovery was not repeated in this package.

## Required future server boundary; storage deliberately undecided

Before any transport can be enabled, confirm the actual read/write protocol from
reviewed schema metadata and an approved server contract:

1. Authenticate account and entitlement on the server; do not trust client account
   IDs or local simulation flags. Read current plan, goal and snapshot revisions.
2. Authorize the dated slot and action; validate canonical/actual food payload and
   snapshot provenance. Server owns authoritative date/timezone assignment semantics.
3. Bind idempotency key to account and canonical business payload. An accepted exact
   retry returns its stored outcome without replaying writes; a changed payload
   conflicts. Simulation counters must never become server revision parameters.
4. Compare expected revisions and apply the entire effect atomically. Stale competing
   requests conflict, never overwrite. Return the authoritative new graph/fact
   revision. A timeout is unknown outcome, not permission to retry with a fresh key.
5. Preserve supersession/retraction history and snapshot contents. Edits target the
   latest effective fact revision; map simulation event identities to the reviewed
   authoritative history protocol. Define recovery/retention without destructive
   deletion. Multi-week/history editing needs a separately scoped history read model.
6. Refresh confirmed graph/shopping from that returned revision; pending proposals
   must not update real facts, Progress or confirmed shopping caches.

Exact tables, transactional SQL/RPC and schema changes are intentionally not fixed.
Atomic metadata and canonical export remain PARKED. This document authorizes none
of SQL execution, DB/RLS writes, imports, payment, deployment or production activation.
The 120-name dataset is unchanged; expansion awaits owner name review.

## Read-model refresh / recovery package — implemented locally

`nutritionRecovery.ts` is a pure protocol simulator, tested with synthetic models
and outcomes. It has no transport or endpoint. Calendar/account binding validation
creates no placeholder server revision. The existing snapshot validator and
PLAN/FACT reducer validate each reviewed command before a simulated attempt.

- Each read ticket includes session generation, request generation and exact
  account/plan/local-week/timezone/date binding. Only the latest outstanding read
  may update the model. Account/calendar reset advances the session generation,
  including A→B→A transitions. The view projection hides foreign or outdated-bound
  models immediately; it does not expose retained continuity evidence or commands.
- A refresh of identical content may preserve a pending review. Any authoritative
  context change invalidates it. Failed/invalid reads clear the actionable model;
  missing days/content are not filled with demo or assumed valid.
- Previously observed plan/snapshot/portion revisions are immutable. Contradictory
  content or a return to a known retired context fails closed. Revisions remain
  opaque: latest-request binding cannot prove that an **unseen** server revision is
  newer. No lexical ordering, timestamps or revision numbers are invented. A future
  server read-consistency/successor contract is required for that guarantee.
- A simulated attempt requires the exact reviewed payload and explicit confirmation.
  The confirmed read model is not optimistically changed. A timeout means unknown
  outcome; even a subsequent graph matching the candidate cannot prove the write
  succeeded. While unresolved, a new operation/key is blocked.
- An explicit simulated retry uses the original key, payload and expected revisions;
  it never rebases silently onto a newly read plan. Attempt generation rejects late
  responses from earlier attempts. Mismatched account/plan/key/fingerprint outcomes
  remain unknown. There are no automatic retries or network calls.
- An accepted synthetic outcome is not a diary fact. It invalidates old read tickets
  and requires a fresh read matching the returned revision. Accepted replacement
  additionally requires a new plan revision and the exact replacement snapshot at
  its dated slot. An unproven later successor remains blocked rather than guessed.
  Conflicts require refresh and a new explicit review, never an overwrite.
- Account/calendar reset retains unresolved work in an account-scoped in-memory
  quarantine and also returns it explicitly as unknown. Returning A→B→A reattaches
  the original command/key under a new session generation; B never receives its
  payload through the view projection. Unresolved work from another week/timezone
  blocks new actions for that account until a future approved reconciliation flow;
  it is not silently dropped or retried with a new key. Settled key history also
  survives reset and stays account scoped. No storage or recovery across a process/
  browser restart is promised. No actual diary history is deleted.

The simulator does not validate server identity from a response body. Real receipt
provenance, endpoint/schema, monotonic/successor read guarantees and authoritative
history identities are still server-contract/metadata checkpoints. History edits
remain in the earlier local simulator until a verified history read model exists.
No local operation record is fed to diary/Progress or production shopping.

## Optional preview integration

`NutritionWeekPreview` accepts an explicit optional recovery scenario through the
existing Today preview input. The production App does not supply it and the normal
production URL cannot activate it. This is a controlled display integration, not a
fetching hook or a transport. No client-generated server revisions or receipt
fixtures are synthesized by UI controls.

The recovery projection checks current account, local date, week anchor, timezone,
plan/goal revisions and the exact dated slot/recipe identity set shown by the weekly
screen. Loading, unavailable, unknown, conflict and mismatched models hide stale
meal content and buttons. A matching recovered graph permits local intent controls
only; the save control remains disabled. The component states that requests and
diary writes are off. It never labels a synthetic outcome as a real saved fact.

Regression coverage includes success, out-of-order reads, failures, contradictory
revisions, known rollback, opaque unorderable revisions, timeout/retry, stale/foreign
receipts, exact accepted graph/snapshot reconciliation, account A→B→A, timezone/
week/date changes, goal/plan changes, quarantined work and React SSR visibility.
Browser/mounted interaction QA remains unavailable; no discovery retry occurred.

## Remaining concrete boundary / next safe step

The local recovery package is complete within its synthetic-input scope. Before a
real port is connected, the owner/backend must provide reviewable evidence for:

- authenticated receipt provenance and account/entitlement checks;
- authoritative graph/fact revisions and proof of fresh/successor reads (including
  previously unseen opaque revisions and changes racing an accepted mutation);
- idempotency outcome lookup using the original key/payload, including detached
  older-week/timezone operations and outcomes across a reload;
- non-destructive history read/edit identities and atomic conflict/rollback behavior.

Do not implement a client freshness oracle or map simulation event IDs to real
history rows by guess. Exact DB implementation remains parked with metadata.
The next safe work is to review a supplied read-only protocol/schema artifact
against this acceptance contract and then add matching synthetic contract tests.
Without that artifact, preserve the explicit boundary rather than enable a port.
If browser availability changes independently, preview-only mounted/mobile QA may
proceed; do not repeat discovery in the unchanged environment. Canonical export,
recipe name expansion, writes and activation remain separately blocked/unauthorized.
