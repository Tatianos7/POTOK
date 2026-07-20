# Recipe Analyzer Save RPC Removal Fix

- Timestamp: 2026-07-19T00:00:00+03:00
- Scope: frontend/client recipe save path only
- Production DB changes: none by Codex
- Migrations/import/apply/backfill/recompute/history mutations: not run
- Final verdict: **FRONTEND_BUILD_PASS_TEST_RUNNER_BLOCKED_BY_LOCAL_ESBUILD_MISMATCH**

## Production Failure

Manual production smoke failed while saving from Recipe Analyzer to "Мои рецепты".

Observed:

- `POST /rest/v1/rpc/recompute_recipe...` returned `404 Not Found`.
- Combined save correctly skipped diary/menu write after recipe save failed.

## Root Cause

`recipesService.saveRecipe()` inserted the `recipes` row and `recipe_ingredients` graph rows, then explicitly called:

```ts
supabase.rpc('recompute_recipe_totals', { recipe_id: saved.id })
```

The Food Core production catalog report recorded the production function signature as `recompute_recipe_totals(recipe_uuid uuid)`, while local migration drafts use `recipe_id uuid`. PostgREST RPC argument names are part of function resolution, so the client call can fail with a function-not-found 404 even when a similarly named function exists.

For Recipe Analyzer saves this RPC is not required:

- Analyzer already calculates totals from resolved canonical foods.
- `recipes` payload already stores total calories/protein/fat/carbs.
- `recipe_ingredients` graph rows are still inserted for read-side linkage.

## Fix

- Removed the explicit `recompute_recipe_totals` RPC call from the client save path.
- Kept `recipes` row insert/update with analyzer-calculated snapshot totals.
- Kept `recipe_ingredients` graph insert.
- Kept cleanup of newly created recipe rows if graph insert fails.
- Added a regression source-contract check that `recipesService` does not depend on `recompute_recipe_totals` RPC.

## Expected Manual Smoke

1. Save to "Мои рецепты": PASS.
2. Save to menu: PASS.
3. Save to both: PASS.

If recipe save fails, diary/menu save remains skipped.

## Verification

- `npm run build`: PASS.
- Local production bundle from build: `main-B-q4oQKx.js`.
- `npx tsx --test src/services/__tests__/recipeAnalyzerSaveContract.test.ts src/utils/__tests__/recipeCombinedSave.test.ts`: BLOCKED before assertions by local tooling mismatch:
  - host esbuild `0.27.3`;
  - binary esbuild `0.21.5`.
