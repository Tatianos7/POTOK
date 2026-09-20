# Premium Adaptive Nutrition v1 — implementation map

Status: POTOK_PREMIUM_ADAPTIVE_NUTRITION_V1_IN_PROGRESS.
Owner contract received 2026-09-19 supersedes fixed 14-day nutrition as the target.
Current week means Monday–Sunday in the user's local calendar; next week is
provisional, never automatically activated. This is not an automatic diet reset.

| State | Existing evidence / smallest change |
| --- | --- |
| DONE / REUSE | `goalService.UserGoal`, `goalProjection`, exact `goal_<userId>` reads; keep persisted goals and historical formulas untouched until reviewed replacement |
| DONE / REUSE | `premiumCatalogService` recipe identities, catalog/Today adapter, strict canonical resolver, offline recipe validator; one curated catalog for collection/plan/replacement/shopping |
| DONE / REUSE | Diary snapshots and Progress actual-data readers; planned meals never become their input implicitly |
| LOCAL PREVIEW | `Today.tsx` now has an isolated weekly preview through the existing adapter. Legacy 14-day source records/routes remain; production does not activate the preview |
| CHANGE | Free `Recipes.tsx` collection tab removed; current-account private recipes/favorites remain. Saved relations are retained. Legacy private dietary heuristics are not curated catalog eligibility |
| CHANGE | Catalog shopping currently deduplicates recipe IDs before counting occurrences; future shopping must count every active slot and portion, and reflect confirmed replacements |
| NEW | Goal draft extension: POTOK/advanced, distinct athletic cut, training input, preferences, explicit safety review; no second goal store |
| NEW | Week projection, scoped confirmation intents, adaptation proposals with target/version references; no persistence or fact writer in the domain layer |
| NEW | Reviewed tags, ingredient-state/unit contract, owner-review names, target-safe replacement preview; never infer vegan/allergen safety from failed name searches |
| PARKED | Canonical food export: OPEN_EXTERNAL_DEPENDENCY. Names/contracts only; no invented UUIDs, macros or publishing readiness |
| PARKED | Recipe atomic-save metadata; failed CLI login-role initialization must not be retried. No SQL/DB access in this work |
| OWNER CHECKPOINT | Evidence-backed nutrition thresholds/formula activation, actual target/version persistence, clinical/sports review, catalog name approval before ingredient expansion, server/RLS/billing/import/deploy |

## Compatibility and implementation order

1. Add domain types around `UserGoal` and the existing catalog, not new storage or
   competing Goal/Recipe/Plan services. Unknown training context stays unknown;
   a legacy `training_place` does not prove workout frequency or load.
2. Preserve old 14-day catalog records, demo fixtures, IDs and day-N deep links.
   New week projection requires an explicit source start date, current local date,
   current user and goal version. Missing days remain missing. Never repeat day 1
   or mark a two-day seed as a complete week. Source 8–14 can appear as provisional
   dates, not an automatically approved next week.
3. PLAN/FACT: an intent records what the user wants to confirm. It is not a
   persisted completion or a diary row. Future confirmation endpoint must validate
   current account, plan/goal version, explicit action and idempotency before writing.
4. Adaptation: show unchanged plan as an option; positive/negative energy delta is
   descriptive only. No automatic debt, next-day deduction or goal update. Actual
   facts can be incomplete. A skipped meal does not prove zero intake for a day.
5. Catalog: one recipe ID; reviewed multi-tags and eligibility, scalable portions,
   canonical ingredient state, explicit units. Oil ml requires food-specific
   density evidence to compute grams; never default density to 1.
6. Prepare 100–150 recipe names for owner selection, then stop ingredient expansion
   until name approval. All nutrition/tags/allergens remain unvalidated at name stage.
7. Replacement/shopping and feedback/cycle contracts build on these scoped inputs;
   production UI/persistence follows verified content and approved server contracts.

## Nutrition safety boundary

Legacy `goalProjection` uses its existing BMR/activity/deficit/macro formulas;
legacy `goalValidation` has age/height/weight bounds. These are not newly approved
clinical evidence. In particular its zero-carb clamp can leave selected protein/
fat calories above the target. Do not reuse that clamp for advanced macro balance.
New draft math may reject negative remaining energy, but mathematical consistency
alone must never return clinical OK or activate a goal.

Safety states: OK, CAUTION, NOT_RECOMMENDED, BLOCKED. Production bounds, protein/
fat recommendations, deficit/surplus limits and cycling require authoritative
nutrition/sports medicine evidence and a reviewed policy version. No universal
1200-kcal rule, unsupported g/kg recommendation, or calorie-cycling formula here.
Athletic cut never includes dehydration, sodium manipulation or peak-week protocols.

Cycle context is opt-in and minimal, with explicit contraception context; no
phase-based calorie increments. Cycle disruption with deficit/load must not lead
to stronger restriction. No cycle fields are persisted or logged by this package.

## Local package delivered / remaining implementation

Implemented and tested locally: Goal/training/preferences/cycle contract types;
advanced macro arithmetic preview (cannot activate a goal); dated seven-day
projection in the existing Premium adapter; fact-confirmation intents and daily
review (no automatic compensation); approved-only curated filter metadata; explicit
ml-density conversion; active-week shopping preview counting each slot/portion;
Free recipe collection-tab removal with immediate current-account visibility. These are domain foundations, **not enabled production UI**.
No new store/service, DB payload, Goal formula or current Today route was replaced.

120 names are in `recipe-names-owner-review-v1.md` and the matching
`data/recipes/premium-name-candidates-v1.json`. They are names only, 30 per meal,
with no UUIDs, ingredients, nutrition or approved dietary eligibility.

### Weekly UI and replacement package — 2026-09-20

- `projectTodayNutritionWeeks` reuses existing Today display models for both legacy
  demo and catalog data. Seven active dates and seven provisional dates preserve
  source identity; no cycling, completion or new nutrient calculation.
- `NutritionWeekPreview` shows Monday–Sunday navigation, planned meals, empty
  missing days, four explicit food actions and six day states. Confirmation is an
  ephemeral review intent; save is disabled. No storage, diary writer or fetch.
- `TodayEntry` exposes explicit local/test preview input. Development-only route
  `/POTOK/today?weeklyPreview=demo` requires the existing current-account context;
  it labels legacy meals as unvalidated demo content. The production URL cannot
  activate it. Existing App routing does not supply preview props. No new login or
  authenticated staging session is required or created by this package.
- Account/plan/goal version/week/date keys reset interaction state. Stale actions,
  foreign-account weeks and provisional-as-active input fail closed. Future meals
  cannot be marked as eaten; selecting a new date clears the previous intent.
- Daily states: `normal`, `no_time`, `tired`, `hungry`, `training_day`, `rest_day`.
  They currently change local context/help text only, not calories or future food.
- Primary curated tags: `cut`, `bulk`, `vegan`, `high_protein`, `high_carb`, `keto`.
  Explicit compatibility aliases cover earlier unpersisted spelling; recipe names
  never imply eligibility. Free private recipes remain outside this contract.
- `previewNutritionReplacement` takes reviewed batch nutrition with explicit
  servings and revisions, never Today display strings. It validates dated slot,
  original recipe identity, account/version, approved plan eligibility and complete
  period totals; compares every macro for meal/day/week. Unknown/duplicate evidence,
  partial totals and overflow remain unavailable. The original graph is untouched.
  Restriction/allergen review, reviewed portion/safety policy and persistence always
  block application, even when arithmetic is available. No numerical tolerances.
- Shopping continues deriving only from explicitly supplied occurrences. A replacement
  preview never changes the committed shopping input or creates a fact implicitly.

Validated with pure domain/reducer tests and actual React SSR. This is not mounted
interaction/mobile visual QA; runtime discovery returned no connected browsers on
2026-09-20, so browser coverage remains an explicit gap. Production
Today/Goal behavior is not migrated to adaptive execution by this package.

Next functional integration checkpoint: confirm authoritative dated plan/goal
versions and meal-action persistence semantics before wiring save or production
activation. Requirements are recorded in the current resume below. Independent
local review may cover the preview's mounted/mobile behavior; do not retry parked
DB/metadata access or infer approval for a new persistence implementation.
Free legacy collection/favorite relations were not deleted or published into Premium.

### Replacement, shopping and feedback design boundary

- Replacement preview takes the current user, plan/goal versions, exact dated
  slot, reviewed recipe identity, portions, complete canonical nutrition, meal
  type, day kind and restrictions. Unknown allergy/eligibility/portion limits
  require review, not a safe-match label. Compare all macros and whole-day/period
  effects. Never use a hardcoded calorie-only tolerance. A stale version invalidates
  confirmation. Local proposal is distinct from applying it or writing a meal fact.
- Shopping is derived from each selected slot occurrence and its actual portion
  in the requested 1/2/3/7-day window. Repeated recipe IDs still count repeatedly.
  Aggregate confirmed canonical identities and compatible states/units; unresolved
  entries stay separate review items. Do not merge raw/cooked products or use title
  matching as identity. No shopping from a merely provisional next week by default.
- Weekly feedback uses sufficiently covered actual diary/workout/measurement
  evidence and dated goal versions, not planned totals or missing days as zero.
  The 7–14-day review interval is product scheduling, not a hardcoded physiological
  response model. No automatic goal update; target-change proposal and confirmation
  require an approved calculation policy and persistence contract.

Evidence retrieval state is in `nutrition-safety-evidence-v1.md`. Numeric clinical
policy and production activation remain unimplemented. MASTER PROMPT is incomplete.

New catalog ingredient rule: meat/poultry/fish are raw before cooking; grains are
dry; vegetables/fruit distinguish raw/frozen; oil preferably ml with explicit
density evidence for gram-based nutrition. Future recipe UI copy:
“Вес мяса и рыбы указан до приготовления, круп — в сухом виде.”
The generic `cooked` state exists for compatibility, not permission to silently
change new catalog weighing rules. Existing candidate validation remains v1; a
state-aware versioned extension is still needed before new ingredient expansion.

## Exact uncommitted package

29 paths; not staged or newly committed.

```text
data/recipes/premium-name-candidates-v1.json
docs/premium/adaptive-nutrition-v1.md
docs/premium/nutrition-safety-evidence-v1.md
docs/premium/recipe-names-owner-review-v1.md
reports/astra-resume.md
reports/launch-readiness-audit-2026-09-18.md
reports/recipe-resolver-safety-checkpoint-2026-09-19.md
src/components/NutritionWeekPreview.tsx
src/pages/Recipes.tsx
src/pages/Today.tsx
src/pages/__tests__/TodayNutritionWeekPreview.test.tsx
src/services/__tests__/premiumNutritionWeek.test.ts
src/services/premiumTodayAdapter.ts
src/test/nutritionWeekPreviewFixture.ts
src/types/adaptiveNutrition.ts
src/utils/__tests__/adaptiveNutrition.test.ts
src/utils/__tests__/nutritionAdaptation.test.ts
src/utils/__tests__/nutritionReplacement.test.ts
src/utils/__tests__/nutritionShopping.test.ts
src/utils/__tests__/nutritionWeekPreview.test.ts
src/utils/__tests__/privateRecipeVisibility.test.ts
src/utils/adaptiveNutrition.ts
src/utils/curatedRecipeEligibility.ts
src/utils/nutritionAdaptation.ts
src/utils/nutritionReplacement.ts
src/utils/nutritionShopping.ts
src/utils/nutritionWeek.ts
src/utils/nutritionWeekPreview.ts
src/utils/privateRecipeVisibility.ts
```
