# POTOK launch readiness — 2026-09-18

## 1. CURRENT STATE

Current target contract is Premium Adaptive Nutrition v1 (2026-09-19): active
Monday–Sunday week, next week provisional. Earlier fixed-14-day backlog entries
below are historical compatibility context, superseded by
`docs/premium/adaptive-nutrition-v1.md`. Canonical export and recipe metadata audit
are PARKED; do not retry the CLI. Continue from the short `astra-resume.md`.

**NOT LAUNCH READY. Updated 2026-09-19 after local implementation and checks.**
Historical report review remains incomplete; no SQL/data/billing mutations or deployment were performed.

Branch `master`. Original audit baseline HEAD/local `origin/master`:
`3b891f2070e365fb84f88c4d177acef8787b489c`. Current local HEAD:
`4fed6b38eecfd636843e94fbbb1aaba7de62b722` (approved 27-file LOCAL commit; NO PUSH). The historical handoff workflow for this SHA succeeded
([run 35381218307](https://github.com/Tatianos7/POTOK/actions/runs/35381218307)).
The initial package is committed locally; subsequent resolver/source-review changes
remain uncommitted. Neither package has been pushed or deployed. The installed Git lacks `branch --show-current`;
`symbolic-ref --short HEAD` confirmed the branch.

Baseline: 229 pre-existing dirty/untracked files, including 14 tracked edits.
Their exact paths, statuses and SHA-256 hashes, plus tracked/staged diffs, are
saved outside the repository in `/tmp/potok-launch-audit-2026-09-18/`.
No baseline file is in the initial implementation allowlist.

Stack remains React 18 / TypeScript / Vite / Supabase, GitHub Pages and Capacitor
Android. No new architecture or data source is proposed. There is no applicable
AGENTS.md or `.openai/hosting.json` in this worktree.

Baseline checks on this dirty worktree (not a clean HEAD checkout):

- All 132 discovered src/scripts test files: 1025 tests, 1023 pass, 1 fail,
  1 skipped. Failure: salt ranking in `foodService.search-mapping.test.ts:410`.
- `npm run build`: PASS (includes TypeScript and Pages fallback generation).
- `npm run lint`: FAIL, 121 errors / 502 warnings, recorded before edits.
- Browser plugin initialized but returned `No browser is available`; discovery
  returned `[]`. **NOT_TESTED_BROWSER**. SSR/source assertions are not browser QA.
- Initial web-tool/network attempt failed. A later authorized read-only HTTP check
  returned 200 for the production entry and its JS/CSS. The deployed 404 fallback
  includes `spa=1` and `p`; direct `/today` and `/premium-recipes` return the expected
  Pages 404 HTML with that fallback. Browser restoration is **not verified**.
  No authenticated production or live DB verification is claimed.

Report coverage: 399 Markdown reports (3,322,268 bytes) inventoried. Current
workout soft-delete/regression, lifecycle, food identity/rollout/resolver,
recipe save, Premium readiness/RLS, route entitlement and goal-scoping reports
were read against runtime. This is **not** a claim that all 399 historical reports
have been read. Finish the remaining report cross-check before final launch
sign-off; old PASS labels below are supporting history, not fresh verification.

## 2. VERIFIED DONE (local scope)

- Goal lookup reads exact current-user key; `todayGoalSummary` tests pass.
- Client Premium gate covers `/today` and `/premium-recipes`; mixed-tier routes
  and Free paywall are preserved. Gate tests pass.
- Five-tab navigation and Free/Premium menu distinction have passing tests.
- Pages restoration requires `spa=1`; stale `p` alone is ignored; tests pass.
- Workout snapshots, active `deleted_at is null` consumers, archive filtering,
  repeat restrictions and MuscleMap have passing local regression tests.
- Canonical diary tests verify visibility, immutable replay snapshots, null
  fiber and idempotency conflict handling. Additional validation gaps below.

These are local implementation facts, not a production launch verdict.

## 3. IMPLEMENTED_NOT_VERIFIED

Fresh authenticated/mobile verification is outstanding for Free diaries,
measurements, Progress, workout media, Premium access and direct Pages routes.
Reported historical staging/production SQL applications require fresh schema
and policy verification. In particular, the early stable-identity draft report
says not applied, while later staging resolver smoke reports stable IDs: do not
reapply the draft based on its old status.

## 4. PARTIAL

Recipe save now uses a strict shared resolver but still has non-atomic graph replacement;
read-side graph failure can retain shadow JSON. Premium uses a separate accepted
read-only catalog, whose ingredients currently have names/grams without canonical
food references. Recipes, plan targets and shopping therefore cannot yet meet
the requested canonical ingredient and calculated-nutrition contract.

Today has demo plans, read-only staging adapters, local replacements and shopping
checks. Confirmation buttons are disabled. This correctly avoids completed
facts, but is not a persisted production execution flow.

## 5. NOT_STARTED

Validated/imported production recipe catalog; current full 14-day target validation;
verified paid execution/persistence and provider integration. Offline recipe
preflight and a payment architecture audit now exist; their external validation
and owner checkpoints remain open. Do not create substitute schemas.

## 6. BLOCKED

- Browser/mobile proof: no connected browser in this session.
- Live RLS evidence: two authenticated staging actors and secure environment
  readiness have not been verified. Never substitute service-role access for RLS.
- Premium persistence and canonical recipe integration: reviewed schema/content
  contract and approved staging package needed before DB mutation.
- Billing: owner provider/platform/scope decision, then implementation approval.
- Approved selective LOCAL commit of exactly 27 files completed as `4fed6b3`.
  Additional commits, push/deploy and all SQL execution remain unauthorized.

## 7. SECURITY / PRIVACY / DATA RISKS

1. Account race found and locally repaired: request revisions invalidate late
   session/profile results on sign-out/switch, including stale rejections and
   A→B→A. Profile service rejects an explicitly mismatched account. Mounted
   browser verification and a full service/cache isolation audit remain open.
2. Diary validation gaps locally repaired: impossible dates, nonfinite weight,
   missing/negative/nonfinite canonical macros and overflow now reject before
   insertion. Confirmed zero and null fiber remain distinct; replay snapshots
   remain immutable. Regression evidence is local.
3. Search now filters the combined result set, including alias results, to public
   core/brand plus exact own user foods before limit/ranking. Salt ranking regression
   repaired. Server RLS remains authoritative and unverified in this run.
4. Analyzer, recipe-save fallback and favorite name fallback now use exact counted
   name/alias reads and reject ambiguity/incomplete reads. The package is locally
   verified; authenticated/browser verification remains outstanding.
5. `recipesService.saveRecipe` deletes ingredients before replacement insert;
   failed edits can lose the old graph. Existing atomic RPC and current deployed
   trigger behavior need reconciliation before changing this write contract.
6. Premium catalog SQL permits authenticated reads; client route gate is not paid
   data enforcement. `has_premium`, RPC entitlements and local demo are distinct.
7. Demo access is browser-global by accepted existing contract. Do not silently
   treat it as server entitlement or change its lifetime.
8. Legacy ingestion can recompute historical food entries. Owner-maintenance
   gates are essential; never execute ingestion during this audit.
9. README no longer recommends RLS disabling or obsolete local auth. Legacy SQL
   files are retained but are not an approved bootstrap.
10. Monetization SQL has owner-write entitlement policies and caller-selected
    SECURITY DEFINER user IDs; profile upserts include privileged flags. Actual
    deployed grants/triggers must be checked. See the separate
    [payment/entitlement audit](payment-entitlement-audit-2026-09-19.md).

## 8. LEGACY / DEAD AREAS

- LEGACY: removed README local-auth/RLS-off guidance; `schema_fixed.sql`, `disable_rls.sql`;
  older food schema scripts are not a safe production bootstrap.
- LEGACY: recipe shadow JSON, demo food/recipe providers, mixed-tier MyProgram
  and AI/Pose paths; preserve unless a separate removal contract is approved.
- DEAD: no removal approved or conclusively proven. No deletion based on naming.

## 9. FIXED BACKLOG MATRIX

`DONE` below means the stated local contract has executable evidence; production
and browser gaps remain explicit. Every grouped row retains its constituent tasks.

| Fixed task | Status | Evidence | Gap | Next action |
| --- | --- | --- | --- | --- |
| Workout Diary regression | IMPLEMENTED_NOT_VERIFIED | workoutService, Workouts, repeat/mutation tests pass | full UI add/edit/delete/repeat smoke | mobile/browser staging QA |
| MuscleMap under My Workout | IMPLEMENTED_NOT_VERIFIED | Workouts builds snapshot map and renders below entries; MuscleMap tests | fresh mobile proof | verify mapped/unmapped/deleted cases |
| All muscle filters | IMPLEMENTED_NOT_VERIFIED | exerciseListFilters and exercise muscle tests | live catalog coverage | run browser filter matrix |
| Archived custom exercises | IMPLEMENTED_NOT_VERIFIED | active predicate, service archive/repeat tests; migration 20260729 | current RLS/runtime UI | two-user staging smoke |
| Workout lifecycle snapshot-first / FK / SET NULL | PARTIAL | snapshots; exercise FK RESTRICT; media workout FK SET NULL | remaining cascade relationships and fresh schema check | read-only FK audit; draft only if needed |
| Exercise image / technique / target muscles | IMPLEMENTED_NOT_VERIFIED | exerciseContent, WorkoutExerciseCardSheet, media validators/tests | content completeness and production assets | asset validator + mobile card smoke |
| Optional private photo/video / ownership / identity | IMPLEMENTED_NOT_VERIFIED | userExerciseMediaService, private bucket policy migration/tests | actual storage policies and upload evidence | approved staging media QA |
| Exercise Card quality | IMPLEMENTED_NOT_VERIFIED | card regression and existing UI | fresh visual QA | mobile smoke without redesign |
| Workout Progress exercise/map/recommendations/mobile/facts | IMPLEMENTED_NOT_VERIFIED | workoutProgressService + component tests pass | mobile and live read proof | account/deleted/planned smoke |
| Progress goal/measurements/nutrition/workouts | IMPLEMENTED_NOT_VERIFIED | progressHubService aggregation + tests | real authenticated execution | verify errors, empty periods, accounts |
| Habits as Progress contract | PARTIAL | habitsService exists; /progress/habits redirects; hub has no habits aggregation | accepted scope needs report reconciliation | clarify retained habits product contract |
| Nutrition deficit day/week/month/longer + target scaling | IMPLEMENTED_NOT_VERIFIED | progressNutritionService and baseline owner tests pass | owner dirty UI/test changes; fresh browser | preserve baseline; verify only |
| Completed only / no deleted workouts | PARTIAL | workouts active filters; Premium no-write tests | nutrition query lacks planned predicate; live schema uncertain | audit planned field before schema-dependent change |
| Food UUID/stable TEXT identity + staging patch | IMPLEMENTED_NOT_VERIFIED | import-food-core maps semantic IDs to stable_food_id; tests; historical staging smoke | current schema / baseline importer edits | read-only contract check, no SQL apply |
| Aliases/normalization/duplicates/verification/review/searchability/source | PARTIAL | food schemas, review/admin services, importer and tests | fresh data health and full visibility review | read-only audit, exact correction packages |
| Private user foods / catalog candidates after review | PARTIAL | manual create and merged-search visibility tests; candidate SQL draft | actual RLS and candidate workflow | authenticated staging isolation proof |
| Deterministic resolver all six sources / ambiguity | PARTIAL | strict analyzer/save/favorite resolver and ambiguity/count/visibility tests; explicit diary choice | fresh authenticated/browser proof of all source paths | read-only staging resolver comparison |
| Diary snapshot/visibility/idempotency/errors | IMPLEMENTED_NOT_VERIFIED | validation, missing nutrition, overflow, null fiber and immutable replay tests pass | browser/live server enforcement | authenticated staging smoke |
| Recipe diary kind/null canonical/totals | PARTIAL | dedicated recipe path, recipeId; canonicalFoodId null | no explicit entry_kind in current runtime | schema + historical semantics checkpoint |
| Food diary edit | IMPLEMENTED_NOT_VERIFIED | updateMealEntry and edit UI exist | snapshot/edit regression and browser proof | audit live-food recalc risk |
| Food diary notes | IMPLEMENTED_NOT_VERIFIED | mealEntryNotesService + modal tests | deployed optional schema/browser | verify |
| Quick repeat meal | IMPLEMENTED_NOT_VERIFIED | FoodDiary repeat UI and copyMeal runtime; service tests pass | authenticated browser repeat/snapshot proof | verify existing behavior; no new implementation needed |
| Recipe production model + graph macro truth | PARTIAL | recipes + recipe_ingredients + recompute migration | shadow fallback, atomic edits, Premium graph gap | reconcile existing models; no parallel schema |
| Recipe content contract / ingredient availability | PARTIAL | ten exact local source ingredients; report hashes and row references | live UUID mapping/review/searchability export unavailable | authenticated staging GET-only evidence or current owner export |
| Small sample / computed nutrition / validation | PARTIAL | four local source nutrition previews independently calculated; strict dry-run rejects all four without UUIDs | no canonical-approved sample or culinary acceptance | obtain canonical mapping; rerun strict preflight |
| Scale / dry-run / owner review / staging / production catalog | BLOCKED | legacy ingredient importer exists | content/model + approval before imports | staged workflow, never direct production batch |
| Premium Recipes entry/gate/categories/list/detail/portions | PARTIAL | honest unavailable/empty/error states; explicit labeled demo; SSR/async helper tests | category chips, validated content, browser proof | canonical content contract and mobile QA |
| Premium recipes Add to plan/diary | BLOCKED | disabled buttons | execution semantics + RLS | owner-reviewed explicit action contract |
| Five tabs / Free More / Premium More / Home Today | DONE | AppBottomNavigation, Dashboard and route tests | deployed mobile check separate | preserve and smoke |
| Paywall discovery / demo is not payment | DONE | Paywall copy/buttons and demo tests | real payment separate | preserve honest disabled purchase |
| Today goal context and exact account key | DONE | todayGoalSummary tests, App/Dashboard user prop, auth request guard | mounted switch proof; remote/local precedence intentionally separate | browser QA; keep formula |
| Today 14-day plan / days 1–14 / targets | PARTIAL | demo 14-day plan; adapter does not invent missing days | staging seed only 2 days; personalization/versioning | content/model checkpoint |
| Daily meals / recipes / grams / macros / portions / preparation | PARTIAL | Today adapters/detail screens | validated canonical recipe catalog | content pipeline |
| Daily workout / rest / ease / replace / start | PARTIAL | demo workout presentation, no completed writes | reviewed workout plan/action model | bounded contract; start != complete |
| Day states ordinary/tired/no time/ready | PARTIAL | demoSmartDayProvider and state UI | reviewed adaptation semantics | keep local preview only |
| Replacements preserve targets | PARTIAL | local replacement UI and adapter tests | nutritional validation + persistence | approved plan/portion contract |
| Shopping 1/2/3/7 days / portions / canonical dedup | PARTIAL | buildDerivedShoppingList; local checkboxes | aggregates names; no canonical ingredient identity | canonical graph mapping before persistence |
| Explicit meal/workout/day confirmations | BLOCKED | disabled no-write controls | reviewed semantics + RLS + idempotency | owner checkpoint |
| Plan identity/version/audit/reproducibility | PARTIAL | premium_plans IDs/days; schema draft | target-aware versioned generation | model audit then draft |
| Payment architecture/platform/provider/month/year/trial | PARTIAL | payment-entitlement audit and current official platform docs | merchant/markets, provider and first-launch scope decision | owner decision before integration |
| Server entitlement / data policy | BLOCKED | UI gate and authenticated catalog read policies | paid data enforcement not proven | policy design + owner approval + actor tests |
| Pages marker fallback / delayed redirect | DONE | route-restore and fallback generator tests | current deployed direct routes | HTTP/assets/browser verification |
| Mobile visual/safe area/theme/cards/actions | IMPLEMENTED_NOT_VERIFIED | shell safe-area spacing, responsive components | browser unavailable | visual QA later, no redesign |
| Exercise illustrations | LATER | established exerciseContent/media assets | content gaps need review | retain style; no random generated replacements |
| AI technique coach | LATER | separate Pose/AI surfaces | not launch scope | separate future block |
| Broad tests/build/lint/deploy/no blocker TODO | PARTIAL | latest: 1077 pass, 1 skip, build pass; historical deployment HTTP/assets verified | 121 lint errors / 491 warnings, no new diagnostics; browser; no new deployment | authenticated evidence and remaining release gates |

## 10. DEPENDENCY-ORDERED ROADMAP TO LAUNCH

1. Client account/diary integrity regressions; preserve all baseline owner work.
2. Strict resolver and recipe-save safety; reconcile snapshot/graph contracts.
3. Honest catalog states and content validation tooling; no DB writes.
4. Read-only live schema/data/actor evidence; complete historical report audit.
5. Recipe model/plan/confirmation/RLS draft and owner review; approved staging.
6. Small canonical sample, programmed nutrition and quality report; owner review,
   staging import/validation, then scale. No invented nutrition or UUIDs.
7. Persisted 14-day execution flow, target-safe replacements and shopping from
   canonical recipes, after the approved contracts are established.
8. Billing architecture decision or explicit exclusion from this launch stage.
9. Full mobile Free/Premium/account smoke, lint gate resolution, release package,
   approved push/deploy, workflow/commit/assets/direct-route verification.

## 11. OWNER CHECKPOINTS EXPECTED

No SQL, RLS, data migration/import or production write is authorized by this
audit. Each DB package needs exact draft, impact, risk, rollback, alternatives,
defer consequence and explicit decision before staging and again production.
Additional decisions: canonical Premium recipe graph, plan/confirmation semantics,
entitlement policy, provider/Android/web billing or payment exclusion. Avoid a
blanket approval for unspecified future changes.

## 12. FIRST SAFE IMPLEMENTATION PACKAGE

Implemented locally: account/session race guards; profile account mismatch rejection;
canonical diary validation and nutrition parsing; merged-search visibility and
salt ranking; honest Premium Recipes states; offline recipe preflight with four
unverified candidates. README dangerous setup guidance corrected. Goal formula,
identity model and historical snapshots preserved. Server authorization unchanged.

Payment/security source audit and metadata-only SQL inspection script prepared.
No schema apply, actual export, imported recipe catalog or payment integration.

### Initial 27-file commit package verification, 2026-09-19

- All 138 discovered test files: **1050 tests, 1049 pass, 0 fail, 1 skipped**.
  The skipped diary integration test requires a dedicated Supabase test environment.
- `npm run build`: **PASS** (TypeScript + Vite + Pages fallback).
- Separate TypeScript check of all new recipe scripts/tests: **PASS**.
- `git diff --check`: **PASS**.
- `npm run lint`: **FAIL**, 121 errors / 502 warnings. Comparing diagnostics
  by file/severity/rule/message against baseline shows **zero additions/removals**.
  This is existing debt, not a green lint gate.
- All **229** pre-existing dirty/untracked file hashes are unchanged.
- This verification preceded the approved LOCAL commit `4fed6b3`. No push/deployment made.
- **PASS_STATIC_ONLY / NOT_TESTED_BROWSER**: a repeat browser discovery still
  returned no browser. Auth helper/SSR tests do not prove mounted UI behavior.
- Read-only SQL inspection script is **NOT_EXECUTED / NOT_DB_VALIDATED**.
- Test logs, original fingerprints and HTTP results reside in
  `/tmp/potok-launch-audit-2026-09-18/`; these temporary logs are not committed.

### Exact commit allowlist

The following exact 27 files were selectively committed with owner approval in
`4fed6b38eecfd636843e94fbbb1aaba7de62b722`, excluding all baseline owner changes.
Both whitespace checks passed after removing a trailing blank report line; the
index was empty afterwards and all 229 original file hashes matched.
**LOCAL COMMIT ONLY / NO PUSH / NO DEPLOY.** SQL remains an unexecuted draft and
billing remains an audit. Commit authorization did not authorize DB application.

```text
README.md
data/recipes/recipe-candidates-v1.json
docs/recipes/recipe-content-preflight.md
reports/launch-readiness-audit-2026-09-18.md
reports/payment-entitlement-audit-2026-09-19.md
scripts/recipes/runRecipeDryRun.test.ts
scripts/recipes/runRecipeDryRun.ts
scripts/recipes/validateRecipeCandidates.test.ts
scripts/recipes/validateRecipeCandidates.ts
scripts/sql/premium-security-read-only-audit.sql
src/context/AuthContext.tsx
src/lib/supabaseClient.ts
src/pages/PremiumRecipes.tsx
src/pages/__tests__/PremiumRecipes.test.tsx
src/pages/__tests__/PremiumRecipesMountedAsync.test.tsx
src/services/__tests__/diaryCreateService.test.ts
src/services/__tests__/foodService.visibility.test.ts
src/services/__tests__/profileService.account-scope.test.ts
src/services/diaryCreateService.ts
src/services/foodService.ts
src/services/mealService.ts
src/services/profileService.ts
src/utils/__tests__/authRequestGuard.test.ts
src/utils/__tests__/premiumRecipeReadState.test.ts
src/utils/authRequestGuard.ts
src/utils/myProductsVisibility.ts
src/utils/premiumRecipeReadState.ts
```

Committed message: `fix: harden account and diary boundaries and recipe preflight`.
No subsequent commit was made. Additional package files are listed in `astra-resume.md`.

### Current continuation, 2026-09-19

After the authorized commit, continued safe runtime work: strict exact canonical
resolver shared by analyzer/save/favorite fallback; recipe preflight validation;
account-scoped analysis results; honest missing Premium nutrition. Completed a
focused historical blocker cross-check and local source availability inspection.
Four local source nutrition previews exist, but strict canonical preflight rejects
all four because the current UUID mapping is absent. No identity was invented.

Latest broad regression: **1078 tests, 1077 pass, 0 fail, 1 skipped** across 141 files.
Build passes. Lint remains **121 errors / 491 warnings**, zero new diagnostics and
11 removed warnings versus the original baseline. Last browser discovery returned
no connected backend: **NOT_TESTED_BROWSER**. All 229 baseline hashes are unchanged.

Canonical export is **PARKED / OPEN_EXTERNAL_DEPENDENCY** by owner instruction.
It still requires authenticated read-only staging evidence or a current
owner-provided canonical export. Anon REST reads could not export foods (missing
`needs_review`, then table permission denied). No service-role retry or SQL occurred.
Non-atomic recipe edits require a separately reviewed server/RPC contract; a new
metadata-only SQL artifact is drafted but has not been executed.

Resume from [astra-resume.md](astra-resume.md), not a fresh audit. Detailed evidence,
14-day plan gaps and exact external/server checkpoints:
[recipe-resolver-safety-checkpoint-2026-09-19.md](recipe-resolver-safety-checkpoint-2026-09-19.md).
Payment remains in launch scope unless the owner explicitly excludes it; no such
answer has been received. RLS, canonical sample/import, complete target-aware
plan/execution, payment, browser QA and approved deployment remain launch gates.

Current follow-up is complete locally: conflicting same-UUID snapshots now fail
closed; identical duplicates remain valid; alias targets require exact membership.
Recipe preflight preserves its input across async lookup and checks total weight
overflow; missing graph nutrients no longer become zeros on re-save. Entitlement
reads reject account mismatch before RPC. Focused tests: 36 passed. Extended
metadata/acceptance drafts remain unexecuted. Premium Nutrition/Plan implementation
is ON HOLD pending the owner's separate product contract. Next dependent task is
review current recipe/server metadata, then draft atomic save against that evidence.
The exact remaining checkpoints and 24 uncommitted paths are in the resume file.
MASTER PROMPT v2 remains incomplete. No new commit/push/deploy/SQL/DB writes.
