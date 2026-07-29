# Nutrition Progress Deficit Regression Coverage

- Timestamp: 2026-07-29T00:00:00Z
- Basis: `reports/nutrition-progress-deficit-readiness-audit-2026-07-29.md`
- Scope: regression coverage for Nutrition Progress deficit/target calculation
- Verdict: **NUTRITION_PROGRESS_DEFICIT_REGRESSION_COVERAGE_PASS**

## Safety

- Calculation formula was not changed.
- Runtime behavior was not changed intentionally.
- Production DB schema was not changed.
- Storage buckets and policies were not changed.
- No migrations/import/backfill/recompute were run.
- Workout block, Food Core import/canonical data, recipes, user media, and exercise cards were not changed.
- No PR was created.

## Coverage Added

- Service test now asserts missing calorie goal keeps `target_calories = null`.
- Service test now asserts deficit sign:
  - positive value means deficit;
  - negative value means surplus.
- Low-coverage week test now asserts period target still scales to `daily goal * 7`, even while the visible deficit is hidden.
- UI source-contract test now asserts daily target display is derived from `target_calories / periodDays`.
- UI source-contract test now locks user-facing states:
  - `Дефицит`;
  - `Профицит`;
  - `Недостаточно записей`;
  - `Цель не задана`.

Existing coverage already confirmed:

- week target scaling;
- month target scaling;
- year target scaling;
- custom inclusive day count;
- long periods do not collapse to 30 days;
- low coverage hides multi-day deficit;
- no data state is safe for scaled periods.

## Files Changed

- `src/services/__tests__/progressNutritionService.test.ts`
- `src/pages/__tests__/ProgressNutritionDeficitUI.test.ts`

## Verification

- `npx tsx --test src/services/__tests__/progressNutritionService.test.ts src/services/__tests__/progressHubService.test.ts src/pages/__tests__/ProgressNutritionDeficitUI.test.ts src/pages/__tests__/FoodDiaryProgressEntry.test.ts`: **PASS**, `41/41`.
- `npm run build`: **PASS**.

Build notes:

- Vite reported existing chunk-size/dynamic-import warnings.
- Browser data warnings were also shown.
- No build failure.

## Final Status

Nutrition Progress deficit regression coverage is in place for the accepted current formula: period target equals daily calorie goal multiplied by the period day count. Goal-history accuracy remains deferred as a separate architecture item.
