# Recipe resolver, source availability and save checkpoint

Continuation from local commit `4fed6b38eecfd636843e94fbbb1aaba7de62b722`.
**NO PUSH / NO DEPLOY / NO SQL EXECUTION / NO DB WRITES**.
These subsequent changes are local and uncommitted. They do not amend the
owner-approved 27-file commit or touch the 229 baseline owner files.

## Relevant historical cross-check

Only blocker-relevant reports/sections were reviewed, against current runtime.
This is not a mechanical reread of all 399 historical reports.

| Evidence | Runtime conclusion / disposition |
| --- | --- |
| `food-search-resolver-staging-smoke-report.md` | Its DB-level smoke did not establish runtime ambiguity handling. New exact resolver bypasses ranked-search dedup/limit, preserving distinct UUID candidates. The report's old fiber-to-zero finding is superseded by current `toNullableFiniteNumber` mapping. |
| `food-search-browser-staging-smoke-result.json` | Historical staging selection contains real UUIDs and macros, but no complete current stable-ID/review/searchability evidence. Do not transplant these UUIDs into today's sample. |
| `recipe-analyzer-save-to-recipes-fix-2026-07-19.md` | UUID propagation and recipe-before-diary combined save remain implemented and passing local tests. Historical “Expected Manual Smoke PASS” is expectation, not new observed production proof. |
| `recipe-analyzer-save-rpc-removal-fix-2026-07-19.md` | Deployed `recipe_uuid` versus local `recipe_id` argument names caused RPC 404. No explicit recompute call has been restored. |
| `recipe-analyzer-unit-normalization-production-fix-2026-07-19.md` | Existing grams/display-unit separation and unknown-unit rejection preserved; soup/piece/oil cases pass against the stricter resolver. |
| `docs/security/nutrition-recipe-remediation-plan.md` | Shadow JSON, graphless recipes and stored/live nutrition mismatches need individual review; no historical backfill/recompute authorized or executed. |
| `docs/security/recipe-recompute-trigger.md` and migrations 20260304/20260311 | Graph is intended composition truth. Trigger and atomic RPC source exist; current deployed definitions are unverified. Client compensation is not an atomic substitute. |
| `today-premium-data-model-staging-apply-retry-2026-08-25.md` | Historical staging schema apply is recorded. It is not authorization to reapply SQL and not proof of authenticated behavioral RLS. |
| `today-premium-staging-seed-post-apply-review-2026-08-27.md` | One “14-day” plan has only two seeded days, eight slots and six test recipes. Seed was explicitly not approved nutrition content. |
| `today-premium-read-only-runtime-final-status-2026-08-29.md` | Catalog reads/local selections exist; default/failure Today demo fallback still exists. Premium Recipes was separately hardened in the committed package. |
| `today-premium-rls-blocker-reentry-status-2026-08-31.md` | Actor env and visual acceptance were missing. Those historical gates remain unproven, not silently cleared by source tests. |
| `today-premium-owner-ideas-hybrid-architecture-review-2026-09-02.md` and product readiness map, relevant architecture/blocker sections | Approved internal catalogs, canonical portions, target-safe replacements and server entitlement are dependencies. External APIs/bot/ads/AI do not justify scope expansion now. |
| `premium-today-reference-alignment-audit-2026-09-14.md` | Its goal/global-key and route-gate findings have later code fixes; its missing workout actions, plan execution and persistence remain gaps. |
| `payment-entitlement-audit-2026-09-19.md` and monetization/profile SQL | Source-level privileged-write/RPC scope concerns remain. Provider choice and server mutation are not authorized. |
| `docs/release/phase8_public_mvp_gate.md` | Historical AI/coach-oriented gate does not replace current MASTER PROMPT launch criteria. Passing build alone is insufficient. |

## Implemented safe runtime package

- `canonicalFoodResolver` returns resolved / ambiguous / unresolved from exact
  normalized names plus exact aliases. It reads complete counted result sets;
  capped, failed or uncounted responses and missing alias targets are unavailable.
  No fuzzy, prefix, source-rank or first-row UUID selection. Duplicate appearances
  of the same UUID are deduplicated; distinct exact UUIDs stay ambiguous.
- UUID roots, public core/brand plus exact own user foods, explicit hidden/review
  flags and the existing lentils-versus-sprouts rule are enforced. Optional flags
  missing from a deployed schema are not claimed as publishing approval. This
  runtime resolver is distinct from the stricter shared-catalog publishing gate.
- Analyzer and recipe-save fallback use the same resolver. Analyzer suggestions
  can show names only, never assign identity. Ambiguous/unavailable lookup stops
  morphological retry, excludes nutrition and blocks saving. Exact current user
  is passed into lookup; stale analysis results are invalidated and scoped to the
  originating account. Mounted browser switch proof remains outstanding.
- Recipe preflight rejects zero/nonfinite grams, blank names, invalid nutrients,
  numeric overflow, unresolved/ambiguous status even alongside a UUID. When a
  previously unlinked ingredient resolves, its macros are calculated from that
  resolved food, not retained from a different guess. Valid explicitly selected
  snapshots are preserved, not silently recalculated from current catalog data.
- Favorites name fallback uses the exact resolver; ambiguous/similar names retain
  no guessed UUID. Explicit identities retain their previous contract. Recipe
  and favorite session mismatch now fails rather than substituting another user.
- Premium catalog/Today adapter no longer render missing/blank nutrients as
  confirmed zero. Known zero is retained. No plan write or target formula changed.

Remaining resolver scope: manual diary choice and canonical write validation are
already separate contracts; import source IDs remain semantic TEXT. No claim that
all six source pathways have fresh end-to-end/browser/server verification.

## Canonical availability and local dry-run

Read-only spreadsheet inspection used `foods_import` in the existing Food Core
workbook. Source rows for ten ingredients are recorded with workbook/candidate
hashes in `recipe-local-availability-2026-09-19.json`.

Three incorrect candidate references were corrected to actual source semantic
IDs: `whole_buckwheat_groats`, `bulb_onion`, `cottage_cheese_5_percent`. Cooking
state and ordinary versus soft cottage cheese were checked explicitly. No catalog
row, alias, UUID, or canonical identity was changed.

| Candidate | Local kcal per serving | Local protein / fat / carbs, g | Canonical status |
| --- | ---: | --- | --- |
| Oatmeal with apple | 239.4 | 6.43 / 4.08 / 46.41 | rejected: UUID mapping absent |
| Buckwheat with carrot/onion | 277.2 | 9.16 / 7.14 / 46.06 | rejected: UUID mapping absent |
| Tomato omelet | 252.6 | 16.35 / 16.70 / 6.69 | rejected: UUID mapping absent |
| Cottage cheese 5% with apple | 228.5 | 26.20 / 7.90 / 12.50 | rejected: UUID mapping absent |

These are **local source arithmetic previews**, not validated canonical recipes,
dietary recommendations, complete meals for a target-aware plan or imported content.
Fiber is unknown. Finished cooked yield was not assumed. Strict canonical preflight
returns **0 valid / 4 rejected**, no partial canonical nutrition, `publishable=false`.

Other local CSVs do not close the gap: the 116-row canonical-with-barcode source
uses semantic food IDs; its mapped CSV has no UUIDs. Historical mapping/review CSVs
describe old-to-new candidates, not an authoritative current catalog export.

Two bounded REST GET attempts using the existing anon key were made against the
configured production public-food endpoint. First: 400 / 42703, `needs_review`
column missing. Second (existing columns): 401 / 42501, table permission denied.
Neither returned a usable export. No service-role retry, SQL, authentication
mutation or privilege change was attempted. Permission denial is not evidence
that the catalog is empty or that authenticated access is broken.

## Exact plan gaps (no new schema)

| Layer | Observed gap before a target-aware real 14-day plan |
| --- | --- |
| Content completeness | Historical seed contains days 1–2 only. Current adapter maps actual returned days and does not supply a real reviewed 14-day dataset. |
| Goal/target binding | Goal context reads exact current user, but plan/slot numbers are catalog values. No reproducible goal-version/target snapshot binding, accepted target tolerances or portion derivation. Goal formula remains untouched. |
| Canonical recipe basis | `premium_recipe_ingredients` stores ingredient names/grams, not food UUIDs; existing `recipe_ingredients` owns canonical composition. Bridge must be approved, not duplicated. |
| Portions/replacements | No approved servings/cooked-yield contract or validation that replacements preserve daily targets. Local replacement currently changes display state only. |
| Shopping | Current aggregation merges names and recipe grams, without canonical ingredient identity and personalized portion scaling. No shopping-check persistence. |
| Training | Display fields do not constitute a reviewed workout schedule, exercise snapshot or explicit start/complete flow. Rest days must remain possible. |
| State/persistence | Demo/local plan/day/meal selection, no confirmed versioned persisted execution. Planned content does not write completed facts. |
| Failure honesty | Today still has demo fallbacks for plan/day/meal/replacement/shopping. Further complete-state work is needed before a real paid flow; missing numeric values are now honest. |
| Security | Client PremiumRoute is UX only. Server paid-data policy and two-user RLS must be verified before enabling persistence. |

## Recipe save atomicity checkpoint

Current edit still updates the recipe row, deletes graph rows, then inserts their
replacement in separate requests. Failure can leave an edited header/empty graph.
New-recipe cleanup exists but does not make edits atomic and can itself fail.

Existing `replace_recipe_ingredients_atomic(uuid,uuid,jsonb,numeric,numeric)` source
is invoker SQL, replaces the graph transactionally, returns inserted count and
checks owner. It does **not** atomically cover the prior recipe header/snapshot
write, carry expected version/row locking, or reject every invalid input row
(its INSERT filters rows). Its `v_uid <> p_user_id` check needs explicit NULL
review together with deployed grants/RLS. Do not blindly enable it or restore
the historically broken recompute RPC.

Prepared artifact: `scripts/sql/recipe-save-contract-read-only-audit.sql` selects
only relevant RPC definitions/signatures, table metadata, constraints, policies
and triggers. **DRAFT / NOT EXECUTED.** Current instructions forbid executing it.

Proposed eventual fix, after evidence: one reviewed server transaction for recipe
metadata and the whole canonical graph, exact owner/auth scope, strict row-count
validation, optimistic version check under lock and consistent nutrition. It
must either commit all fields or leave the prior recipe intact. Existing tables
remain the source of truth. Exact migration/rollback must be drafted against the
observed deployment, not guessed here.

Impact: recipe edit/create service and reviewed recipe RPC/trigger contract.
Risk: owner lockout, lost concurrent edits or nutrition mismatch if scope/version/
trigger assumptions are wrong. No client-side compensating rewrite is proposed.
Rollback: revert the reviewed RPC/client pair while preserving existing recipes;
exact rollback SQL and fixture cleanup are required before an apply checkpoint.
Alternative: defer atomic writes, retain the present limitation, do not claim
safe production editing or launch readiness. No SQL/apply authorization requested
for an unspecified migration.

## Parked external checkpoint — OPEN_EXTERNAL_DEPENDENCY

**Parked by owner: authenticated read-only staging evidence or an owner-provided
current canonical export through a secure local file. No secrets in chat.**
No retry or workaround is part of the current local package. Premium Nutrition/
Plan implementation is also on hold pending the owner's separate new contract;
the earlier plan-gap table is historical context, not a current implementation spec.

Scope of authenticated evidence: an existing ordinary staging actor, anon/public
client key plus its secure session, GET-only food/alias reads restricted to the ten
listed core/brand stable IDs. No service role, user creation, write probes, SQL,
schema changes or production fallback. Capture project ref, timestamp, complete
counts, actual UUID/stable-ID roots, nutrition and real review/searchability policy.
If a requested field is absent, report that; do not default it to approved.

Why: neither local import TEXT IDs nor historical snapshots establish current
canonical UUID mapping. A local workbook cannot prove RLS. Exact ingredient scope
is the ten IDs in the JSON report; no user foods are needed. Read-only export has
no data rollback requirement; temporary authenticated session stays outside the
repo and is never printed or committed. Deferring access keeps all four candidates
rejected and blocks canonical sample/plan integration. An equivalent authenticated
owner export is an alternative to tool access.

Separate future decisions: permit the exact metadata-only staging SQL audit if
desired (currently forbidden), then review the resulting atomic SQL/RLS package;
approve target-aware plan/portion policy before persistence; select billing scope/
platform/provider per the payment audit. None is implicitly approved by local code.

Verification and exact continuation state are maintained in `astra-resume.md`.

## Independent local follow-up while canonical export is parked

- Resolver compares the identity, ownership, visibility/review, naming and nutrient
  fields of repeated UUID snapshots **before filtering**. Any contradiction returns
  `unresolved/unavailable` with no candidate payload. Separate name/alias reads can
  no longer silently select the last nutrition or access snapshot. Identical
  duplicates and consistent alias enrichment still resolve; distinct UUIDs remain
  ambiguous. Exact target-set membership is checked in addition to response count.
- Regression cases cover changed nutrients/owner/source/review/searchability,
  both response orders, identical duplicates, alias enrichment without input
  mutation, failed/capped/uncounted reads and missing/wrong/duplicate alias targets.
  Analyzer, recipe fallback and favorite fallback reject conflicting snapshots.
- Recipe preflight copies ingredient snapshots before async resolution, so editing
  the caller's draft cannot pair an old resolved name with a new amount/identity.
  Aggregate gram overflow is rejected alongside nutrient overflow.
- Graph mapping preserves missing/invalid nutrition as invalid, not zero. Re-save
  validation rejects missing foods, malformed relation arrays, missing/invalid
  nutrients and amounts. Numeric strings and confirmed zeros remain supported.
  No saved header totals, historical diary facts, graph source preference or DB
  records were rewritten. Existing read-error fallback to shadow JSON remains an
  unresolved completeness issue; this package does not claim to fix it.

The recipe metadata draft now includes numeric precision/scale, table RLS flags
and table grants. It remains **NOT EXECUTED**. JavaScript finite-value checks do
not prove compatibility with deployed numeric limits/rounding. Do not infer the
deployment from the local `numeric(10,2)` declaration or silently round gram values.

### Atomic-save acceptance draft (not an executable migration)

| Case | Required observation before approving a future server save implementation |
| --- | --- |
| Owner/session mismatch or null identity | Rejected before writes; existing recipe and graph unchanged |
| Missing/ambiguous/hidden/private canonical ingredient | Entire save rejected under actual caller access; no partial accepted rows |
| Invalid grams, nutrition, numeric precision or duplicate graph key | Rejected as a whole, before any committed header/graph update |
| Existing-recipe graph insertion/trigger failure | Original header, graph, derived totals and version retained together |
| New-recipe graph failure | No orphan header or partial graph committed; no compensating client delete relied on |
| Two edits with the same expected version | Exactly one succeeds; the other reports conflict under a server lock/version check |
| Old header version missing/deleted recipe | Explicit rejection behavior agreed; pre-read/upsert must not silently recreate an edited recipe |
| Response lost after commit / retry | Reviewed idempotency behavior; no duplicate graph or second unintended recipe |
| Unknown joined-food nutrition | No zero substitution or partial nutrition; legitimate zero still accepted |
| User B / anon direct access | Reviewed policy enforced by server, independent of client filters |

These are proposed acceptance requirements, **not observed transaction/RLS PASS**.
The local pre-read version check and delete/insert calls cannot satisfy them.
Next dependent action is obtain deployed metadata through owner-provided evidence
or separately approved metadata-only SQL, then draft exact RPC/client/rollback
changes for review. No apply-ready migration is justified by current evidence.

### Focused entitlement source reconciliation

No payment provider or Premium Nutrition policy was chosen. Additional concrete
source findings supplement the committed payment audit:

| Path | Observed source behavior | Consequence / missing evidence |
| --- | --- | --- |
| `entitlementService.getSessionUserId` | Previously warned and substituted session user; now rejects requested-user mismatch before RPC | Locally fixed with behavioral mock-client tests for reads and all capability helpers; not proof of RLS or mounted account-switch safety |
| `canGenerateProgram` / `get_entitlements` SQL | Client defaults missing `can_view_plan` to true; SQL explicitly grants that flag to Free with no entitlement row | Do not relabel historical Free generation as paid or change this policy while product scope is unresolved; distinguish missing response from valid Free response in a future reviewed adapter |
| `canRealtimePose` / `get_paywall_state('spatial')` SQL | Client allows voice flag or pro tier; SQL checks spatial flag | Client and server-source gates disagree for pro with spatial=false; authoritative capability policy needs reconciliation, not arbitrary tier expansion |
| Client flag parsing | `Boolean(...)` accepts nonempty strings such as `"false"` | Payload type validation is absent; source concern, not evidence of a live malformed response |
| `get_entitlements` SQL | Returns entitlement row without consulting subscription status or period end | No expiry/revocation enforcement is established by this function alone; deployed writer/reconciler evidence required |
| `get_paywall_state` SQL | Unknown feature text falls through to unlocked | Future server contract should define rejection for unknown features; TypeScript union does not constrain direct RPC callers |
| 20260311 security hardening | Sets these function search paths | Does not resolve caller ownership, capability disagreement, receipt verification or lifecycle policy |

Server mutation and paid-data visibility stay at the existing security checkpoint.
No SQL, direct RPC probe, purchase event or entitlement activation was performed.
The independent client mismatch fix is complete. Matching-account and legacy
implicit-current-account reads retain the existing capability policy. Missing or
failed authentication sends no RPC. No server authority, capability tier rule or
payment behavior was changed. All tests use an in-memory client, not staging.

## Parked staging metadata attempt after commit 4c441db


The approved artifact was manually inspected and checked before execution:
seven SELECT statements over PostgreSQL catalogs/information_schema only;
no DML/DDL, grants/revokes, transaction commands, fixture writes, policy changes
or application RPC calls. `pg_get_functiondef`, `pg_get_constraintdef` and
`pg_get_triggerdef` inspect definitions rather than execute those definitions.
Artifact SHA-256:
`059934a7f678d78a063cfb9946ff0c0380c2d6e488d9daf7265e666d35096777`.
The artifact itself remains unchanged from the reviewed committed version.

Local configuration checks (no secret values printed): worktree staging env and
both CLI project-ref / linked-project.json identify `ozidryfvhkcbtpnulakq`.
Pooler URL also identifies staging but contains no password. No DB/auth config
variables were present in the process environment; no .pgpass or .pg_service.conf
was present. No service-role key was loaded into the audit command. Production
env was not used. No credentials were created or requested.

Installed Supabase CLI 2.109.1 documents `db query --linked` as querying through
Management API. Following that help, one invocation used the unchanged artifact:

```text
supabase db query --linked --file scripts/sql/recipe-save-contract-read-only-audit.sql --output json --log-level error
```

Project refs and artifact hash were asserted immediately before invocation;
stdin was closed to prevent an interactive login. The actual CLI path unexpectedly
reported `Initialising login role...`, then HTTP **544**:
`Failed to create login role: Connection terminated due to connection timeout`.
Exit code 1; zero stdout/metadata returned. This preparatory role-creation attempt
is outside the metadata-only authorization. **Stopped immediately: no retry,
debug rerun, direct-connection workaround, login, service role or production access.**
The error does not establish that role initialization left no side effects;
no successful role creation was reported, but absence of changes is unverified.
Do not state that the CLI was proven fully non-mutating. Metadata SELECT execution
is not confirmed, and no actual table/column/precision/FK/trigger/RPC/RLS/grant/
version findings may be inferred from this failed attempt or from local migrations.

Restricted local stdout/stderr evidence:
`/tmp/potok-launch-audit-2026-09-18/staging-recipe-metadata.{stdout,stderr}`.
At that handoff only the resume was changed after commit; 229 owner hashes remained unchanged.

The atomic-save acceptance matrix remains a proposal, not staging validation.
Proposed invariants: one transaction for recipe header and full ingredient graph;
exact authenticated ownership; strict validation before mutation; locked expected
version check; authoritative nutrition/recompute within the same transaction;
failure preserves the prior header/graph/totals/version; no historical diary rewrite.
Actual RPC signature, supported version column, precision/rounding, trigger order,
create/retry idempotency and compatibility cannot be finalized without metadata.
**No guessed atomic SQL patch or client integration was prepared/applied.**
