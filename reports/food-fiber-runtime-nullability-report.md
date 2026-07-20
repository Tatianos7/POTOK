# Food Fiber Runtime Nullability Report

- Timestamp: 2026-07-02T09:35:00Z
- Scope: preserve nullable Food Core fiber through browser runtime and diary DTO
- Target environment: staging
- Target project ref: `ozidryfvhkcbtpnulakq`
- Production/current live ref: `dtsdnhbcwpbfrhcazqkb`
- Final verdict: **DIARY_FIBER_SCHEMA_BLOCKER**

## Safety

- Food Core apply was not run.
- SQL was not executed.
- DB writes were not performed.
- Production was not used.
- Staging foods and aliases were not changed.
- food_diary_entries, recipes, recipe_ingredients, and favorite_products were not changed.
- Excel was not changed.
- NULL fiber was not replaced with 0.

## Root Cause

Browser smoke showed that DB `foods.fiber = NULL` became runtime `Food.fiber = 0`.

Root cause:

| File | Symbol | Previous handling | Classification |
| --- | --- | --- | --- |
| `src/services/foodService.ts` | `mapSupabaseRowToFood` | `fiber: Number(row.fiber) || 0` | COERCES_NULL_TO_ZERO |
| `src/services/mealService.ts` | `toDiaryCreateRequest` | `fiber: Number(entry.food?.fiber ?? 0)` | COERCES_NULL_TO_ZERO in DTO |

## Data Flow

| Step | Before | After |
| --- | --- | --- |
| Supabase `foods.fiber` | `NULL` | `NULL` |
| `foodService.mapSupabaseRowToFood` | `0` | `null` |
| `ProductSearch` selected food | `0` | `null` |
| `AddFoodToMealModal` selected `Food` | `0` | `null` |
| `mealService.toDiaryCreateRequest` | `0` | `null` |
| `DiaryCreateService.calculateDiarySnapshot` | already preserved null | preserves null |
| `DiaryInsertPayload.fiber` | calculated from DB food | `null` when DB food fiber is null |

## Type Contract

Runtime `Food.fiber` is now typed as:

```ts
fiber?: number | null
```

Legacy object literals may still omit `fiber`, but the canonical Supabase/search mapping emits explicit `null` when the DB value is `NULL`.

## Search Mapping

`src/services/foodService.ts` now uses:

```ts
toNullableFiniteNumber(row.fiber)
```

Contract:

| Input | Output |
| --- | --- |
| `null` | `null` |
| `undefined` | `null` |
| `''` | `null` |
| `0` | `0` |
| `'0'` | `0` |
| finite numeric string | number |
| invalid/NaN | `null` |

The helper is not used for required calories/protein/fat/carbs.

## Selection Mapping

Browser-selected Food Core rows now keep:

- `food.id` as UUID;
- `food.canonical_food_id` as UUID;
- `food.fiber = null` when DB fiber is null.

## Diary DTO Static Mapping

`mealService.toDiaryCreateRequest` now sends:

```ts
fiber: entry.food?.fiber == null ? null : Number(entry.food.fiber)
```

The canonical diary insert path still queries the canonical food row and computes snapshot server-side through `DiaryCreateService`.

## Diary DB Schema Audit

Code contract supports nullable diary snapshot fiber:

- `DiaryEntryRecord.fiber: number | null`
- `DiaryInsertPayload.fiber: number | null`
- `DiaryFoodRecord.fiber: number | null`
- `calculateDiarySnapshot`: `food.fiber == null ? null : scaled value`

Read-only staging PostgREST probe:

```json
{
  "select": "id,fiber",
  "ok": false,
  "error": {
    "code": "42703",
    "message": "column food_diary_entries.fiber does not exist"
  }
}
```

Source SQL status is mixed:

- `scripts/sql/staging-schema-setup-draft.sql` currently omits `food_diary_entries.fiber` in the staging table definition.
- `supabase/schema.sql` defines `food_diary_entries.fiber numeric(8,2) not null default 0`.
- Existing runtime code selects/inserts `food_diary_entries.fiber`, so the actual deployed schema must be verified before an approved diary write smoke.
- Actual staging currently does not expose `food_diary_entries.fiber`, so a diary write smoke is blocked until the diary snapshot fiber schema contract is decided.

No SQL was executed in this step.

## UI Rendering

Product search cards do not display fiber, so there is no visible `NaN`, `undefined`, `null`, or false confirmed `0` in the current search UI.

Selected product regression confirmed `fiber = null` in browser runtime.

## Calculation Risks

Remaining legacy/calculation fallback paths still use technical `0` for missing fiber outside the canonical Food Core search-to-diary-create path:

- `src/services/mealService.ts` recipe/manual legacy branches;
- `src/services/foodIngestionService.ts`;
- `src/utils/foodImportPipeline.ts`;
- `src/utils/foodNormalizer.ts` validation sum;
- legacy SQL recipe/diary recompute drafts using `coalesce(fiber, 0)`.

These are not changed in this step and should be handled in a separate nutrition semantics pass if fiber analytics become user-facing.

## Tests

Importer tests:

```bash
TS_NODE_TRANSPILE_ONLY=true node --loader ts-node/esm --test scripts/import-food-core.test.ts
```

Result: 22 passed, 0 failed.

Pure search smoke tests:

```bash
TS_NODE_TRANSPILE_ONLY=true node --loader ts-node/esm --test scripts/smoke-test-food-search-staging.test.ts
```

Result: 6 passed, 0 failed.

TypeScript check:

```bash
npx tsc --noEmit
```

Result: passed.

Fiber/diary runtime tests:

```bash
ESBUILD_BINARY_PATH=./node_modules/tsx/node_modules/esbuild/bin/esbuild npm run test:diary:bugfix
```

Result: 31 passed, 0 failed.

Note: the explicit `ESBUILD_BINARY_PATH` was needed because the default `tsx` process picked an older esbuild binary (`0.21.5`) while `tsx` expected `0.27.3`.

## Browser Regression

Command:

```bash
TS_NODE_TRANSPILE_ONLY=true node --loader ts-node/esm scripts/browser-smoke-fiber-nullability-staging.ts
```

Result: `FIBER_BROWSER_REGRESSION_PASS`

| Check | Result |
| --- | ---: |
| Browser selections preserving null fiber | 10/10 |
| Production requests | 0 |
| Write requests | 0 |
| Service-role exposed in browser | no |
| Console errors | 0 |
| Network errors | 0 |

Post-test counts:

| Table | Before | After |
| --- | ---: | ---: |
| public.foods | 2199 | 2199 |
| public.food_aliases | 3311 | 3311 |
| public.food_diary_entries | 0 | 0 |
| public.recipes | 0 | 0 |
| public.recipe_ingredients | 0 | 0 |
| public.favorite_products | 0 | 0 |

Full browser search smoke was also rerun after the mapping fix and passed:

- verdict: `BROWSER_SEARCH_STAGING_PASS`
- canonical: 10/10
- aliases: 10/10
- unresolved: 5/5
- ambiguous/manual selection: 5/5
- selection: 10/10
- selected rows now show `fiber: null`

## Ranking Warnings Deferred

Existing ranking/data warnings remain out of scope:

- `йогурт`: likely missing generic/base product or ranking/data issue.
- `овсянка`: likely missing generic/base product or query matching issue.
- `сыр`: over-specific ranking.
- `хлеб`, `чай`, `рыба`: ranking warnings.

No ranking logic was changed.

## Build

```bash
npm run build
```

Result: passed.

Warnings only:

- stale baseline-browser-mapping data;
- stale browserslist/caniuse-lite data;
- existing Vite dynamic/static import chunk warnings;
- existing large chunk warning.

## Final Verdict

**DIARY_FIBER_SCHEMA_BLOCKER**

Recommended next step:

Create a separate staging-only diary snapshot fiber schema decision/patch. The expected contract should be `food_diary_entries.fiber numeric nullable no default` if diary snapshots must preserve unknown fiber. Do not run diary write smoke until that contract is manually applied and validated.

Follow-up audit completed:

- Report: `reports/food-diary-snapshot-schema-contract-audit.md`
- SQL draft: `scripts/sql/staging-align-food-diary-snapshot-contract-draft.sql`
- Read-only checker: `scripts/check-diary-schema-contract-staging.ts`
- Current checker result before manual patch: `DIARY_SCHEMA_CONTRACT_FAIL` because `food_diary_entries.fiber` is missing.

Post-patch verification completed:

- `food_diary_entries.fiber` now appears in staging OpenAPI as numeric, nullable, with no default.
- Read-only checker result: `DIARY_SCHEMA_CONTRACT_PASS`.
- Payload compatibility mismatches: 0.
- Table counts remain unchanged: foods 2199, aliases 3311, diary 0, recipes 0, recipe_ingredients 0, favorite_products 0.
- Authenticated diary write smoke remains untested and must be a separate explicitly approved step.
