# Shared Food Eligibility V1 — final architecture review / implementation plan

Status: REVIEW ONLY, IMPLEMENTATION/APPLY NOT APPROVED.
Reviewed PR #154 source: b36f55500fc4b142bfa7b3029dc4c511a9d58c75.
Publication base master: 33462c398db761ba30ff59007b7a928338b34bf6. Separate documentation branch/PR.
This document refines shared-food-eligibility-contract-v1-design.md.
No SQL, runtime, Supabase or existing account deletion changes.

## Verdict and scope

GO for architecture review and synthetic disposable test preparation.
BLOCKED for persistent Staging/apply/runtime until decisions/gates below pass.
Production/Main BLOCKED: no trusted Main capability fallback.

Empty registry must deny NEW Food Evidence approval, not existing POTOK.
This isolation is achieved by no legacy read-path wiring, not by default ELIGIBLE.
It does not make legacy search an evidence-authoritative source.

### Audited consumers and evidence of non-interference

Paths/lines are from the reviewed PR source, not stale local implementation:
- canonicalFoodResolver.ts:78,86 reads foods and alias targets; :100 resolves.
- favoritesService.ts:81,91 invokes current resolver.
- recipesService.ts:76,91 and recipeAnalyzerReal.ts:46,48 invoke current resolver.
- foodService.ts:705,845,916,955,1002 reads foods for search/catalog.
- mealService.ts:283–338 and subsequent diary paths read/write food_diary_entries.
- foodEvidenceReviewGatewayV1.ts:99,148,158 defines the unmounted new handler/RPC.

Stage 1 modifies none of these existing service APIs, foods/diary RLS/SELECT
policies, views, search results, aliases, nutrition or saved recipe fields.
No registry FK is added to diary/recipe/favorite records, no default global
eligibility filter, no generator/manifest activation or auto backfill.
Private user-food operations remain outside shared registry.
Thus absence of registry entries has no path into those current read/write
decisions. This is a design/static dependency proof, NOT implemented runtime PASS.
Acceptance must snapshot existing results before/after empty registry installation
and exercise consumers; metadata-only table existence is insufficient.
New RESTRICT references can affect shared food/admin deletion: explicitly excluded
from blanket “no impact”; owner must approve retention. Never claim no impact
on support account deletion or privileged shared catalog writers.

## Operation matrix

| Operation | Stage 1 registry semantics | Later rollout |
|---|---|---|
| Eligibility decision writer/read for admin | Mandatory trusted JWT/attestation + exact identity/epoch/head binding | Scope never widened implicitly |
| Food Evidence REVIEW_APPROVED canonical/nutrition | Mandatory ELIGIBLE + live root, source, no owner, key, epoch and all existing evidence dependencies | Same strict gate |
| REVIEW_REJECTED | Exact proposal/shared root context + authority; absence/PENDING/noneligible not converted to revision | No requirement for ELIGIBLE; archive key/root historical context carefully verified |
| INVALIDATION | Exact retained immutable revision/source/digest + authority, independent of current eligibility | Must remain possible for HIDDEN/BLOCKED/ARCHIVED; missing live root does not authorize invented identity |
| Current-state evidence admin reader | Authorized historical artifacts + live predicate; noneligible => usability=false, not eligibility default | No public evidence authority implied |
| Receipt retry/history | Actor/request/proposal/artifact binding and live authorization; historical result only | Revocation prevents replay; never usable proof |
| Existing search/resolver/diary/recipes/favorites | NO registry dependency; old behavior preserved | Separate consumer rollout only after coverage, tests and approval |
| Importer/admin food writes | No grant of eligibility; content changes must invalidate effective binding via trusted epoch | Archive/C restrictions require independent guard approval |
| Archive command / identity reuse denial | Not callable in initial runtime | Only after C integrity/guard tests; terminal state authority unified registry |
| Main legacy RPC | Unchanged, new writes fail-closed | Separate trusted Main design required |

Safety-critical invalidation is append-only, severity monotonic. Blocking registry
is not automatically evidence invalidation. Separate command/domain and outcomes,
no Phase 1 new fields. Historical readers distinguish authorization from usability.
An operator must not be prevented from invalidating blocked food by an ELIGIBLE guard.

## Status transitions

Missing entry means UNKNOWN effective denial; creation ONLY explicit PENDING.
No automatic ELIGIBLE from source/flags/import, no direct client decision writes.

| From | Allowed commands |
|---|---|
| PENDING | approve eligibility -> ELIGIBLE; hide -> HIDDEN; block -> BLOCKED; archive -> ARCHIVED when C enabled |
| ELIGIBLE | hide/block/archive |
| HIDDEN | explicit reapprove -> ELIGIBLE; block/archive |
| BLOCKED | explicit documented clearance+reapprove -> ELIGIBLE; archive |
| ARCHIVED | No state transition; only authorized exact request replay |

No arbitrary reset to PENDING, BLOCKED->HIDDEN loophole, direct resurrect or
ARCHIVED->ELIGIBLE. Same-state changed content is not exact retry; define a separate
reassessment append event/CAS if needed, owner approval first.
All transitions require existing trusted ADMIN attestation, verified actor/session,
server time, explicit expected decision version and typed reason.
BLOCKED clearance has explicit reason/source/expected version, not automatic
is_admin or different idempotency key. Whether clearance requires second reviewer
is an owner decision; no invented role/entitlement is granted by this proposal.
Archive permanent marker retains original food ID/stable key and no raw PII by
default. Minimal audit checkpoint linkability/retention must still be reviewed.

## Fingerprint, epoch and immutable history

Fingerprint envelope: explicit new contract/encoding/domain version, root food ID,
canonicalFoodId, exact foodStableId, source, createdByUserId=null, identitySnapshot
(name, nullable nameOriginal, normalizedName, nullable brand/normalizedBrand/barcode,
ordered exact aliases). Exact UTF-8, no trim/coercion/rounding, no implicit fields.
Alias ordering changes conservatively invalidate. No synonym UUID/second identity.
Domain separate from Phase 1; hash integrity != reviewer provenance.

Eligibility binding includes fingerprint AND trusted catalogIdentityEpoch.
Epoch private nonnegative monotonic integer stored/updated only by trusted database
mutation enforcement for registered roots, not user timestamp/food nutrition_version.
Identity write changes epoch even if bytes later return to original (ABA).
Define initial register epoch atomically under root lock. Pure nutrition changes
do not silently mutate identity decisions; evidence nutrition validity separate.
Safety metadata extensions require versioned binding scope review.

History decisions never rewritten to “match” new root. Content/epoch mismatch gives
effective DENY until explicit reassessment. Source/key/owner structural drift also
DENY. Supersession, archive and invalidation remain distinct.
No existing diary/recipe nutrition rewrite, no cascade of historical evidence.

## Locks and stable-key claims

Candidate unified lock discipline: existing actor/admin gate -> foods row lock
-> sorted stable-key gates/claims -> eligibility head -> evidence heads/receipts.
All batch roots and old/new stable keys use deterministic ordering.
A existing advisory-before-row implementation must be reviewed/refactored before
integration; do not claim this change is already present.

Food mutation trigger starts with its already-held row lock, then key gates/epoch,
never tries to take actor gate. Decision commands acquire root row first too.
Importer cannot update eligibility head. Root row lock held through transaction
prevents issuance using a moving snapshot; recheck authority after waits.
Reader FOR SHARE pins current root/head predicate; no split cached authority reads.

Unique private key claim binds existing stable key to one root; terminal archive
claim survives retry/retention. root ID and stable-key recreation both denied.
Root-scoped lock alone is insufficient for two different IDs sharing one stable key.
All catalog INSERT/UPDATE paths must cooperate with key uniqueness/guard; merely
adding UNIQUE to registry does not prevent duplicate unregistered foods.
Existing duplicates/malformed keys must block onboarding, not be auto-repaired.
Global uniqueness index/guard deployment and importer failure semantics require
separate approval; existing rows are never rewritten to make the constraint pass.
Protected ID/key deletion/recreation and TRUNCATE guards belong to C rollout.
There is no safe activation of ARCHIVED without those guards.

## RLS, scope, Supabase and retention compatibility

Private schema ENABLE/FORCE RLS, no direct client/service-role CRUD/TRUNCATE/helper
access; qualified owner functions, search_path=pg_catalog, explicit EXECUTE.
Public/admin endpoints authorize per operation, not merely authenticated role.
Public future reader exposes only minimum eligibility projection, not audit PII.
Shared root access determined by canonical source/scope policy, not caller true.
Main fails preflight without trusted Staging-compatible boundary; no flags fallback.

Existing trusted grant/revoke ledger remains sole rights foundation.
New actor UUID references must not introduce indefinite account deletion blockers.
Personal decision envelopes/receipts/reasons require approved finite retention;
no unapproved original-UUID audit anchor, no evidence CASCADE or mutable hash rewrite.
Food/nonpersonal archive identity guard and personal review envelope have separate
retention classifications. Proof of authority after erasure must be explicit.
Account closing/revocation must fence new eligibility decisions and Food issuance
using approved lifecycle, not a second entitlement system.
Whole Auth/Storage/offline deletion remains separate B, NOT implemented by registry.

Phase 1 wire/digests unchanged. Eligibility metadata stays outside artifact payloads.
Phase 2B .sql/.preflight move together only after equivalent gate exists; deployment
must not fall back to relaxed shared_food_v1 if registry missing.
New rejection/invalidation/current/history separation needs regression tests.
Supabase Data API exposure, owner/ACL/function signatures must be verified separately;
schema presence alone doesn't establish trusted authorization.

## Phased implementation and acceptance

| Stage | Exact future scope | PASS criterion | BLOCKED condition / rollback |
|---|---|---|---|
| 0 Design | These two docs only | Owner accepts operation boundary, statuses, epoch/key/retention decisions | No apply; revise design |
| 1 Disposable registry/core | Proposed private registry SQL draft, server decision contract, dedicated real PG17 suite | Empty/unknown deny; roles/ACL/JWT boundary; all CAS/races and ABA tests pass without SKIP | No real DB PASS or incomplete epoch/key enforcement => stop; discard synthetic cluster only |
| 2 Food Evidence adapter | Existing phase2b.sql/.preflight + disposable suite; new eligibility writer/reader | Approvals require explicit decision; rejection/invalidation/history work noneligible; Phase 1 bytes unchanged | Missing registry/trust => preflight/operation fail-closed; deactivate NEW RPCs, no DROP/history erasure |
| 3 Controlled Staging review | Separately approved metadata/apply/synthetic test plan, no users | Existing consumer parity with empty registry; trusted live JWT/PostgREST tests; retention approved | No authorization or parity proof => no apply/activation; retained artifacts forward repair only |
| 4 Archive C | Shared-food writer guards/key claims/tombstones, importer handling | Resurrection/TRUNCATE/identity/lock tests pass, history conserved | No archive command enabled until full enforcement; no rollback by deleting marker |
| 5 Existing consumer rollout | canonicalFoodResolver.ts + favorites/recipes/analyzer/search only explicitly chosen paths | Coverage policy, exact/alias ambiguity/count/cache tests, feature/scope approval | Empty/incomplete coverage => DO NOT SWITCH; if enabled fail-closed outage, not permissive legacy fallback |
| 6 Production/Main | Separate trusted infrastructure + operational approval | Own deployment and privacy/security acceptance | No master merge/deploy by this proposal |

Prospective files (not SQL created now):
supabase/migration_drafts/shared_food_eligibility_v1.sql and preflight/postcheck;
src/server/sharedFoodEligibilityV1.ts + tests;
scripts/contracts/shared-food-eligibility-disposable-db-v1.test.ts;
approved repair existing food_reviewed_evidence_v1_phase2b.sql/preflight/test;
C guard draft and importer/resolver changes only in their approved phases.

Required tests: empty registry legacy parity; private food unaffected; UNKNOWN and
all status transitions/forged flags; hidden/blocked/archived invalidation; history/
receipt scope; exact bytes/head conflicts and multi-reviewer races; expiry/revoke/
closure after waits; ABA and root mutation; duplicate key two-ID races; malformed/
duplicate existing keys denied onboarding; archive stable-key/ID reuse/TRUNCATE;
old history/digest/diary macros unchanged; rollback conserves all terminal events;
full resolver count/alias/variant/ambiguity regression; no audit PII exposed.

Existing A Actions #9 22/22 PASS is supplied baseline, not eligibility acceptance.
No new executable tests are run for this documentation-only proposal.
Rollback of already activated consumer cannot re-admit denied identities:
disable new selections/feature scope fail-closed; historical reads remain authorized.
Before any consumer activation, owner accepts potential outage and recovery runbook.
Restoring legacy behavior on NEVER-activated scope is not an eligibility bypass;
post-activation fallback admitting hidden/blocked/archive is prohibited.

## Owner approvals still required

1. Registry choice and first-stage Food-only isolation; consumer scope/coverage policy.
2. BLOCKED clearance, admin powers and optional second-review policy.
3. Trusted epoch mutation trigger, stable-key uniqueness and all writer lock refactor.
4. Rejection/invalidation/historical reader behavior for noneligible roots.
5. Archive guards/terminal state deployment; no automatic unarchive.
6. Finite personal audit retention/authority proof, account closure integration;
   no original actor UUID anchor approved.
7. Explicit Staging apply/test authority and later consumer/production rollout.

## Evidence limits

Current source paths read via Connector at pinned PR HEAD; no live client/browser
or deployed schema execution in this review. Local documentation workspace is not
treated as current implementation branch. Static isolation argument is contingent
on implementation diff containing no legacy registry wiring/policies/views.
Acceptance must prove that invariant before apply. No promise that all external
scripts, exports or backups are inventoried. Existing code noninterference does
not imply deployed migration privilege/trigger side effects are already safe.
