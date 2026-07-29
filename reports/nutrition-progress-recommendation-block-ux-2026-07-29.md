# Nutrition Progress Recommendation Block UX

- Timestamp: 2026-07-29T00:00:00Z
- Basis: `reports/nutrition-progress-deficit-regression-coverage-2026-07-29.md`
- Scope: Nutrition Progress recommendation presentation
- Verdict: **NUTRITION_PROGRESS_RECOMMENDATION_BLOCK_READY**

## Safety

- Deficit formula was not changed.
- Service aggregation formula was not changed.
- Production DB schema was not changed.
- Storage buckets and policies were not changed.
- No migrations/import/backfill/recompute were run.
- Workout block, Food Core import/canonical data, recipes, user media, and exercise cards were not changed.
- No PR was created.

## UX Change

- Replaced split recommendation surfaces with one `Что сделать дальше` block.
- Removed visible `Что помогает` and `Что стоит поправить` blocks.
- Kept recommendation text short, data-based, and non-judgmental.
- Added a clear icon/accent state for good, warning, action, and neutral recommendations.

Recommendation priority:

- low period coverage;
- missing calorie target;
- calorie surplus;
- protein below target;
- fats above target;
- carbs above target;
- good/on-track state.

Product-source rules:

- Recommendations use only existing Progress data: deficit, coverage, macros, and `topFoods`.
- Product names are never invented.
- Top food hints use user-visible `topFoods` names already present in the Progress payload.
- Food keyword hints are limited to matching actual user product names.

## Verification

- `npx tsx --test src/services/__tests__/progressNutritionService.test.ts src/services/__tests__/progressHubService.test.ts src/pages/__tests__/ProgressNutritionDeficitUI.test.ts src/pages/__tests__/FoodDiaryProgressEntry.test.ts`: **PASS**, `43/43`.
- `npm run build`: **PASS**.

Build notes:

- Vite reported existing chunk-size/dynamic-import warnings.
- Browser data warnings were shown.
- No build failure.

## Final Status

Nutrition Progress now has one compact recommendation block built from existing Progress data. The calorie deficit formula remains unchanged.
