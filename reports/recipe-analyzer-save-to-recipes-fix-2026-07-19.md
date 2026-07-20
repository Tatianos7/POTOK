# Recipe Analyzer Save To Recipes Fix

- Timestamp: 2026-07-19T00:00:00+03:00
- Scope: frontend/client save path only
- Production DB changes: none by Codex
- Migrations/import/apply/backfill/schema changes: not run
- Final verdict: **FRONTEND_BUILD_PASS_TEST_RUNNER_BLOCKED_BY_LOCAL_ESBUILD_MISMATCH**

## Root Cause

Recipe Analyzer resolved ingredients contained valid `canonical_food_id`, but `buildAnalyzerIngredients()` dropped that field before calling `recipesService.createRecipeFromAnalyzer()`.

`recipesService.saveRecipe()` requires resolved ingredient UUIDs before writing the normalized `recipe_ingredients` graph. Without those IDs, save to "Мои рецепты" could fail while the parallel diary/menu save still succeeded.

## Fix

- Analyzer recipe payload now includes `canonical_food_id` for each resolved ingredient.
- Combined save now runs recipe save first and skips diary/menu save if recipe save fails.
- Newly created recipe rows are cleaned up if graph ingredient insert or recipe recompute fails after the initial recipe insert.
- Added combined-save regression coverage for:
  - diary/menu save is skipped when recipe save fails;
  - recipe success is preserved when diary/menu save fails after it.

## Expected Manual Smoke

- Save to "Мои рецепты": PASS.
- Save to menu: PASS.
- Save to both:
  - recipe save runs first;
  - menu save runs only after recipe save succeeds;
  - no "menu saved, recipe failed" partial state.

## Verification

- `npm run build`: PASS.
- Local production bundle from build: `main-C-xsXPDS.js`.
- `npx tsx --test src/utils/__tests__/recipeCombinedSave.test.ts src/services/__tests__/recipeAnalyzerSaveContract.test.ts`: BLOCKED before assertions by local tooling mismatch:
  - host esbuild `0.27.3`;
  - binary esbuild `0.21.5`.
