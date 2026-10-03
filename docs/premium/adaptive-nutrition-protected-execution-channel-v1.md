# Adaptive Nutrition protected execution channel + trusted generation binding v1

Date: 2026-09-30
Status: **LOCAL REVIEW PACKAGE READY / NOT APPLIED / NOT DEPLOYED / GENERATOR OFF**

This note uses repository evidence, the owner-confirmed STAGING acceptance state and
previous owner-run metadata exports. It does not claim that an external service absent
from the repository cannot exist. No Supabase query or mutation was run for this review.

## 1. Current execution paths

| Channel | Runtime and location | Authentication/account binding | Protected Graph v2 writer access | Retry/idempotency | Verdict |
|---|---|---|---|---|---|
| Web/Android application | Vite SPA/Capacitor; `src/lib/supabaseClient.ts` and services | public key plus user JWT; existing user RPCs derive `auth.uid()` | None. `record_generated_week_v2` and `activate_generated_week_v2` deny authenticated callers | Existing v1 operations preserve keys, but no Graph v2 generation request exists | Valid client/read channel; never a trusted generator channel |
| Authenticated weekly provisioning RPC | `public.adaptive_nutrition_provision_current_week_v1` | user JWT and `auth.uid()` | Creates only the owned `pending_generation` identity | Durable provisioning receipt | Reusable prerequisite, not generation |
| Graph v1/v2 reads and approved v1 runtime actions | Existing authenticated RPC services | user JWT, own-account checks | Reads are allowed; Graph v2 writers remain unreachable | Existing lookup/read recovery where defined | Separate runtime contract; not a generation authority |
| `src/api/generateAdvice.ts` | Browser-side TypeScript stub | No independent server authentication | None | None | Not a backend route and must not be reused as trusted generation |
| GitHub Actions/Pages | `.github/workflows/deploy.yml` | GitHub workflow identity | Static build/deploy only | CI retry only | No application backend |
| Local operator scripts | `scripts/`; some unrelated food tools accept a local service-role environment value | Operator environment, not an end-user JWT | Graph v2 writers are revoked from `service_role` and hard-reject a non-postgres session | Tool-specific only | Not deployed runtime; must never be bundled into client code |
| Owner SQL Editor/migration session | Supabase Dashboard/Postgres owner session | Owner-controlled database session | Yes, as `postgres` owner | Manual only | This is how protected acceptance was possible; not a product channel |
| Postgres internal function chain | `potok_nutrition.*`, owner `postgres` | Function parameters plus server rechecks | Internal writers can call each other as owner | Durable generation/activation receipts after invocation | Strong DB boundary, but no external execution identity is bound |
| Edge Function/backend/worker/queue | Local disabled skeleton now exists at `supabase/functions/adaptive-nutrition-generate-v2`; no deployment, worker, queue config or server CI is proven. Earlier owner metadata found no deployed Edge Function | User JWT request/status client plus a separately constructed server-only gateway client; real generator and validator are null | Local calls are limited to three proposed gateways; no deployed access exists | Pure resume orchestration preserves the durable request identity | **Prepared locally, not deployed or activated**. Unknown external consumers remain OPEN |

The current exact product answer is therefore: protected Graph v2 mutations have no
runtime invoker. They have only been exercised through owner-controlled PostgreSQL
sessions and rollback acceptance.

## 2. Current writer access

All six functions below are owned by `postgres`, use `SECURITY DEFINER`, and have a
fixed `search_path=pg_catalog`. The accepted postcheck proves no EXECUTE path for
`PUBLIC`, `anon`, `authenticated`, or `service_role`.

| Function | Current caller model |
|---|---|
| `potok_nutrition.initialize_nutrition_authorities_v1` | postgres/internal owner only |
| `potok_nutrition.create_preference_successor_v1` | postgres/internal owner only |
| `potok_nutrition.create_safety_successor_v1` | postgres/internal owner only |
| `potok_nutrition.publish_candidate_manifest_v2` | postgres/internal owner only |
| `potok_nutrition.record_generated_week_v2` | postgres session only |
| `potok_nutrition.activate_generated_week_v2` | postgres session only |

The two Graph writers additionally require both `SESSION_USER` and `CURRENT_USER` to
equal `postgres`; otherwise they raise `PROTECTED_EXECUTION_CHANNEL_NOT_YET_BOUND`.
Consequently, merely granting a future wrapper or `service_role` direct EXECUTE would
still fail and is not an acceptable repair. Direct client or direct service-role grants
to these writers remain forbidden.

## 3. Recommended architecture

Use one **user-authenticated Supabase Edge Function orchestrator** named conceptually
`adaptive-nutrition-generate-v2`, backed by a durable generation request in the
existing `adaptive_nutrition_operations` ledger.

The browser/Android app calls the Edge Function with its user JWT and one stable client
request idempotency key. The function must use authenticated-user mode and first call a
new narrow request RPC under the user JWT. That RPC derives `auth.uid()`, verifies
Premium, finds the exact owned current-week `pending_generation` selection, pins all
authorities, and creates/replays `GENERATION_REQUESTED_V2`. The client never sends an
authoritative account, selection, revision, manifest, Graph or digest.

The same Edge invocation then uses a server-side secret client only against reviewed,
narrow gateway RPCs. It must not write application tables directly. The gateway derives
the account and every identity from the durable request operation, loads the protected
manifest, and invokes the existing owner-only record/activate logic. Internal Graph v2
writers keep no application-role grants.

Use the existing ledger for request and attempt audit before adding another job table:

- `GENERATION_REQUESTED_V2`: stable user request and pinned authority vector;
- `GENERATION_ATTEMPTED_V2`: append-only server attempt/outcome evidence when needed;
- existing `PLAN_GENERATED_V2` and `PLAN_ACTIVATED_V2`: authoritative phase receipts.

This ledger reuse is **PROPOSED** and must first pass a schema/constraint preflight for
the new action/outcome values and immutable recovery fields. If the deployed ledger
cannot represent them without weakening its current contract, implementation must stop
for a separately reviewed additive design instead of overloading existing semantics.

Claim work with a job/account advisory lock and exact operation lookup. If an Edge
instance stops, its transaction/lock ends and a repeated invocation with the original
key resumes from the ledger. `EdgeRuntime.waitUntil` may improve responsiveness, but
it is not the durable authority: hosted functions have wall-clock/CPU limits and can
shut down. No scheduler is required for v1; user retry can resume the same job.

Official platform references used for this recommendation:

- https://supabase.com/docs/guides/functions/auth
- https://supabase.com/docs/guides/functions/secrets
- https://supabase.com/docs/guides/functions/background-tasks
- https://supabase.com/docs/guides/functions/limits

## 4. Trust and data binding

### Loaded only from server authorities

- account from `auth.uid()` at request creation, then from the durable request row;
- owned selection, `pending_generation` status, null head and provision revision;
- canonical timezone and local Monday anchor already pinned by the selection;
- current Goal row/revision and reviewed nutrition target policy revision;
- effective Premium entitlement and exact evidence revision;
- current preference and safety heads/snapshots;
- published candidate-manifest revision, canonical bytes, digest and entries;
- composition, validation, optimization and generation policy revisions.

### Created once by the server and persisted before generation

- request operation ID and phase idempotency keys;
- proposed plan revision;
- attempt identity;
- exact `TrustedGenerationInputV1` canonical bytes and digest.

### Supplied by the generator as an untrusted proposal

- candidate choice, day/slot/component arrangement and optimization trace;
- proposed `GeneratedWeekPlanV1`/Graph content using only candidates supplied by the
  protected manifest view.

The generator receives no database credential and cannot publish a manifest, select
another account, choose authority revisions or settle a receipt.

### Recomputed by the trusted validator/server

- duplicate-aware raw decode and exact allowlists;
- meal/day/week composition, HYBRID portion and nutrition validation;
- Graph canonical bytes/digest;
- GeneratedWeekPlan canonical bytes/digest;
- generation-input digest and every recipe/component evidence binding;
- manifest membership and digest;
- full CAS vector immediately before record and again before activation.

Client/generator digests, entitlement flags, account IDs, revisions and manifest
claims are never authoritative.

## 5. Exact record-to-activate sequence

1. **Request accepted:** Edge verifies the user JWT; the user-scoped request RPC
   creates or replays one durable `GENERATION_REQUESTED_V2` operation.
2. **Trusted inputs loaded:** the protected gateway derives the account from that
   operation and returns the pinned input plus exact published manifest.
3. **Generation:** the unprivileged generator computes a deterministic proposal.
4. **Validation:** the trusted Edge validator strict-decodes and recomputes every
   canonical byte sequence, digest, total and evidence binding.
5. **Record:** a narrow server gateway invokes `record_generated_week_v2` with the
   server-persisted account/selection/key/input and validated result. This commits one
   `PLAN_GENERATED_V2` receipt in its own transaction.
6. **Fresh activation check:** reload Premium, selection/head, Goal, preference,
   safety, manifest and all policy revisions. Any drift stops activation.
7. **Activate:** a second narrow gateway call invokes `activate_generated_week_v2`
   with the settled generation operation and original activation key. Its existing
   transaction inserts graph + CAS head + settled activation receipt atomically.
8. **Read after write:** use the user-scoped exact Graph v2 read and require the exact
   selection, plan revision and Graph digest returned by the activation receipt.

Record and activate should remain separate protected transactions. External generation
cannot safely occur inside a database transaction. Keeping the generation receipt
durable makes a crash after record recoverable; a single wrapper transaction would
erase that checkpoint when activation fails.

## 6. Retry and fail-closed matrix

| Condition | Required behavior |
|---|---|
| Premium missing/expired/revoked before new request | deny; no job or paid effect |
| Premium expires after generation record | keep exact generation receipt; deny activation; no graph/head |
| User/account mismatch | reject before authority load; gateway derives account from job |
| Stale Goal, preference or safety revision | `CONFLICT_STALE_INPUT`; no activation |
| Stale manifest revision or digest mismatch | integrity/conflict failure; no record/activation |
| Candidate removed or no longer eligible | manifest-membership failure; no graph/head |
| Duplicate request key, identical canonical request | exact request/job replay |
| Duplicate request key, changed request | `IDEMPOTENCY_PAYLOAD_MISMATCH` |
| Same generation phase key/input after success | return original generation receipt and stored result |
| Same generation input but different regenerated output | never replace stored output; compare returned digest, mark deterministic-generator drift and use/inspect original receipt |
| Selection/status/timezone/week changed | stale conflict; no silent rebase |
| Plan head advanced | conflict; no second initial graph |
| Activation CAS lost | activation transaction rolls back graph/head/receipt together |
| Generator output malformed or validation fails | terminal rejected attempt; no generation receipt |
| Graph/canonical digest mismatch | reject before record or inside defensive DB validation |
| Protected channel unavailable before record | durable request remains resumable under original key |
| Crash after generation record | lookup original generation operation, then activate with original activation key |
| Crash after activation commit | lookup activation receipt and exact-read its revision/digest |
| Two workers race | shared job/account locks plus receipt idempotency yield one effect; loser replays/conflicts |

Unknown outcomes never cause a new key, new selection, authority rebase or guessed
success.

## 7. Client boundary

The client may request generation, poll request status and read the accepted result.
It may supply only a protocol version and stable request idempotency key. It may not
submit authoritative Graph bytes, account identity, authority revisions, manifest
digest, plan revision, activation command or entitlement proof.

No existing product client path violates the Graph v2 writer boundary because none is
wired. Existing Graph v1 annotation actions are a separate accepted contract. The
browser-side `generateAdvice` stub and demo/localStorage flows are explicitly
ineligible as generation inputs or Premium authority.

## 8. Required contract changes and blockers

A new orchestrator is required. The existing DB business validation is reusable, but
runtime binding needs a separately reviewed additive patch:

1. authenticated request/status RPCs deriving `auth.uid()` and using the existing
   ledger for `GENERATION_REQUESTED_V2`;
2. narrow server-only authority-load, record and activate gateways;
3. replacement of the two hard-coded `SESSION_USER=postgres` sentinels with a safe
   internal-call guard compatible with the gateways, while retaining no direct
   Graph-writer grants to `PUBLIC`, `anon`, `authenticated` or `service_role`;
4. EXECUTE only on the narrow gateways for the chosen server secret identity, with
   account derived from the durable request rather than an RPC account parameter;
5. explicit attempt/recovery/audit semantics and acceptance for a crash between record
   and activation.

The writer validation, shared account gate, entitlement/authority rechecks, Graph
insert, selection CAS and receipt settlement need no redesign. A direct postgres
credential in Edge, direct table writes, or direct grants on the six protected
functions are rejected.

Runtime remains blocked by the absence of the orchestrator/channel and by real
generator inputs: no reviewed published candidate manifest containing canonical,
generator-eligible recipes is proven here, and no production generation algorithm is
implemented. Synthetic acceptance content is not product content.

## 9. Production rollout boundary

Graph v2 must not move to production until all are true on STAGING:

- reviewed Edge/runtime source, secret handling and narrow gateway patch are applied;
- authenticated request, durable resume and account isolation acceptance pass;
- at least one real published manifest revision and eligible recipe set pass evidence
  review without invented identities;
- end-to-end request → generation → record → activate → exact read succeeds;
- direct client/service-role calls to internal writers remain denied;
- same-key replay, different-payload conflict and unknown-result recovery pass;
- Goal/preference/safety/manifest/entitlement/CAS failure matrix passes;
- crash after record and crash after activation recovery pass;
- rollback residue, Graph v1 reads and legacy IDs/data remain compatible;
- production-specific preflight, hashes and separate owner apply/deploy approval exist.

## 10. Local protected execution binding package

The local-only package is now prepared under
`docs/premium/drafts/20260930_adaptive_nutrition_protected_execution_binding_v1*`
and `supabase/functions/adaptive-nutrition-generate-v2/`. Nothing was applied or
deployed.

### Client request and status DTO

The POST body has exactly two fields:

```json
{
  "protocolVersion": "potok-adaptive-generation-request-v2",
  "idempotencyKey": "uuid"
}
```

The status lookup accepts only the opaque `requestOperationId`. Both responses use:

```json
{
  "contract": "potok-adaptive-generation-request-status-v2",
  "requestOperationId": "uuid",
  "status": "REQUESTED | GENERATING | GENERATED | ACTIVATING | ACTIVE | REJECTED | CONFLICT | UNKNOWN_RETRYABLE",
  "retryable": true,
  "reasonCode": null
}
```

No account, selection, revision, entitlement, manifest, Graph, digest or activation
instruction is accepted from the client. Raw POST JSON is scanned for duplicate keys
before parsing and then checked against the exact allowlist.

### Durable ledger and lifecycle projection

The existing operations ledger remains the authoritative receipt source:

- `GENERATION_REQUESTED_V2` stays `in_progress` through generation and settles only
  when the request becomes ACTIVE, REJECTED or CONFLICT;
- `GENERATION_ATTEMPTED_V2` records the one stable generation attempt identity;
- existing `PLAN_GENERATED_V2` and `PLAN_ACTIVATED_V2` remain the authoritative
  generated and activated receipts.

An additive protected lifecycle projection stores the pinned canonical trusted input,
server-generated phase keys and current state. Its immutable identities cannot be
rewritten. It has no application/table grants, uses RLS plus FORCE RLS and retains
delete/truncate guards. A separate empty policy-head table is required because the
deployed schema has no authoritative current target/composition/validation/
optimization/generation policy vector. An immutable Goal-target authority stores the
reviewed `GoalNutritionTargetV1` bytes/digest for an exact account, Goal revision and
target-policy revision. The request boundary validates that exact snapshot and never
invents hard corridors by copying a mutable Goal target into `min` and `max`. The
migration publishes neither a policy row nor a Goal-target row, so requests fail
closed until both are separately reviewed and published.

Same account/key/canonical request returns the original request. The same key with a
different canonical request raises `IDEMPOTENCY_PAYLOAD_MISMATCH`. A second request
for the same weekly selection is rejected rather than rebasing pinned authorities.

### RPC boundaries

Authenticated user boundary:

- `public.adaptive_nutrition_request_generation_v2(text,uuid)` derives `auth.uid()`,
  acquires the shared account gate, verifies Premium and the unique own current-week
  pending selection, pins all authorities, and creates/replays the durable request;
- `public.adaptive_nutrition_generation_status_v2(uuid)` exposes only own historical
  status and does not require current Premium for recovery.

Server-only boundary, executable by `service_role` and no other application role:

- `potok_nutrition.load_generation_request_v2(uuid)`;
- `potok_nutrition.record_generated_week_gateway_v2(uuid,bytea)`;
- `potok_nutrition.activate_generated_week_gateway_v2(uuid)`.

Each gateway accepts the opaque request operation identity. It derives account,
selection, phase keys and authority vector from protected state. The record gateway
accepts generated canonical bytes only as untrusted input and delegates defensive
verification to the existing writer. No gateway accepts account or revision arguments.

### Writer sentinel repair

`record_generated_week_v2` and `activate_generated_week_v2` become `SECURITY INVOKER`
while remaining postgres-owned, fixed-search-path functions. Their sentinel becomes
`CURRENT_USER = postgres`. A postgres-owned `SECURITY DEFINER` gateway therefore calls
them with effective user postgres. A direct `service_role` call is denied first by
function ACL and would still fail the invoker sentinel even if a future ACL drift
accidentally exposed EXECUTE. The other four internal authority functions and both
writers retain no `service_role`, authenticated, anon or PUBLIC EXECUTE grant.

### Validation split

The future Edge trusted validator must perform the full pure TypeScript validation:
strict decode, MealSnapshot composition, nutrition totals, Goal bounds, preference and
safety exclusions, HYBRID/discrete portions, candidate membership and all canonical
digests. It is currently explicitly `null`, so generation cannot run.

The database remains a defensive second boundary. It recomputes canonical Graph,
generation-input and result digests; checks envelope bindings, entitlement, selection/
Goal/calendar CAS, preference/safety heads, policy vector, current manifest integrity
and exact component membership; and keeps Graph insert + head CAS + activation receipt
atomic. The database function does not prove every pure meal/nutrition/portion rule,
so local TypeScript validation is not described as DB enforcement.

### Recovery

- crash before record: request and attempt identities remain reusable;
- crash after record: load observes the settled generation receipt and continues with
  the original activation key;
- crash after activation commit: user status plus receipt-bound Graph read proves the
  original result;
- two workers reuse the same attempt/record keys and shared account gate;
- stale authority or entitlement fails closed without allocating a replacement key;
- UNKNOWN never creates a new selection, request or phase key.

## 11. Remaining checkpoint

The generator and validator remain deliberately unbound, the policy head and Goal-
target authority are empty, and real candidate content is still unavailable. The next allowed external step is
only an owner-run SELECT-only preflight on STAGING after review of the exact artifact
hashes. Applying the migration, deploying the Edge Function, publishing policies or
manifest content, and running rollback acceptance each require later separate owner
authorization.

Status markers:

- `PROTECTED_EXECUTION_CHANNEL_DISCOVERY_COMPLETE`
- `TRUSTED_GENERATION_BINDING_DESIGN_READY`
- `GENERATOR_STILL_NOT_ACTIVATED`
- `NO_DB_MUTATION`
- `PRODUCTION_NOT_TOUCHED`
- `PROTECTED_EXECUTION_BINDING_PACKAGE_READY`
- `EDGE_ORCHESTRATOR_LOCAL_SKELETON_READY`
- `GENERATION_REQUEST_LEDGER_CONTRACT_READY`
- `NARROW_SERVER_GATEWAYS_READY`
- `GRAPH_WRITER_CHANNEL_SENTINEL_REPAIR_READY`
