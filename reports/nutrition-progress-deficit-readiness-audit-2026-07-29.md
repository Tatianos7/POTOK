# Nutrition Progress Deficit Readiness Audit

- Timestamp: 2026-07-29T00:00:00Z
- Scope: read-only audit of Nutrition Progress calorie target/deficit calculation
- Context: Workout block release-ready; next roadmap item is Nutrition Progress deficit correctness
- Verdict: **NUTRITION_PROGRESS_DEFICIT_FORMULA_SCALES_DAILY_GOAL_WITH_DEFERRED_GOAL_HISTORY_RISK**

## Safety

- This is a read-only audit/report.
- Runtime code was not changed.
- Production DB schema was not changed.
- Storage buckets and policies were not changed.
- No migrations/import/backfill/recompute were run.
- Workout block, Food Core import/canonical data, recipes, user media, and exercise cards were not changed.
- No PR was created.

## Current Entry Points

Main Nutrition Progress route:

- `src/pages/ProgressNutrition.tsx`
- Opens from Food Diary through `/progress/nutrition`.
- Uses `progressNutritionService.getNutritionProgress(user.id, anchorDate, period)`.
- Supported UI periods: `day`, `week`, `month`, `year`.

Main service:

- `src/services/progressNutritionService.ts`
- Aggregates diary rows, current user goal, period coverage, calories, macros, top foods, and deficit.
- Also exposes `getNutritionProgressForRange(userId, startDate, endDate)` for custom/long period callers.

Related summary layer:

- `src/services/progressHubService.ts`
- Calls `getNutritionProgressForRange` for the 30-day Progress hub summary.
- Converts period target calories back to daily target by dividing `deficit.target_calories / totalDays`.

Types and tests:

- `src/types/progressDashboard.ts`
- `src/services/__tests__/progressNutritionService.test.ts`
- `src/services/__tests__/progressHubService.test.ts`
- `src/pages/__tests__/FoodDiaryProgressEntry.test.ts`

## Current Formula

Consumed calories:

- Service includes valid canonical diary rows.
- Service includes recipe-origin snapshot rows when `canonical_food_id` is null and `idempotency_key` contains `:recipe_`.
- Service excludes unresolved/fallback rows from totals.
- `total.calories` is the sum of included row calorie snapshots.

Period length:

- `day`: 1 day.
- `week`: trailing 7 days including anchor date.
- `month`: trailing 30 days including anchor date.
- `year`: trailing 365 days including anchor date.
- custom range: inclusive day count from `startDate` to `endDate`.

Target calories:

- Current user goal is read from `goalService.getUserGoal(userId)`.
- Daily calorie target is normalized to a positive number.
- Period target is calculated as `dailyTargetCalories * dayCount`.
- This means current code does not use the daily calorie goal as the whole week/month target.

Deficit/surplus:

- `deficit.value = periodTargetCalories - consumedCalories`.
- Positive value means deficit.
- Negative value means surplus.
- Zero means exactly on target.
- UI displays `Дефицит`, `Профицит`, or `Ровно по цели` based on the sign.

## Period Behavior

Week:

- Uses 7 calendar days, not a calendar week.
- Example from tests: anchor `2026-03-18` gives `2026-03-12` through `2026-03-18`.
- A 2000 kcal/day goal becomes a 14000 kcal period target.

Month:

- Uses trailing 30 calendar days, not a calendar month.
- Example from tests: anchor `2026-03-18` gives `2026-02-17` through `2026-03-18`.
- A 2000 kcal/day goal becomes a 60000 kcal period target.

Year:

- Uses trailing 365 days.
- A 2000 kcal/day goal becomes a 730000 kcal period target.

Custom/long periods:

- `getNutritionProgressForRange` uses the actual inclusive day count.
- Existing tests cover 14-day, 90-day, 182-day, and 365-day examples.
- Long periods do not collapse to 30 days.

## Edge Cases

Incomplete period:

- Multi-day deficit is hidden until coverage reaches `0.8`.
- Coverage is `days_with_data / periodDays`.
- UI shows `Недостаточно записей` when a calorie target exists but coverage is low.

Days without entries:

- Empty days still count in `periodDays`.
- Average calories/macros are divided by full period length, not only logged days.
- This is consistent with a period-level target, but it makes coverage messaging important.

Missing or invalid calorie goal:

- `deficit.target_calories = null`.
- `deficit.is_visible = false`.
- UI shows goal-missing state rather than a false deficit.

Zero-calorie logged rows:

- A valid zero-calorie row counts as data.
- This avoids confusing "no data" with real zero totals.

Goal changes:

- Current service applies the current goal to the whole selected period.
- There is no goal-history read model in Nutrition Progress.
- If a user changed calories during a week/month/custom range, historical days are not evaluated against the goal active on those days.
- This is the main remaining product accuracy risk.

Timezone/date boundaries:

- Service period math uses UTC date-only calculations.
- UI anchor date uses local day key from `getLocalDayKey`.
- This is mostly stable for date-only ranges, but DST/year-boundary UI tests would reduce regression risk.

## Risk Matrix

| Area | Risk | Severity | Release impact |
| --- | --- | --- | --- |
| Week/month target scaling | Current code scales daily goal by period day count | Low | No blocker found |
| Custom/long period scaling | Current code uses actual inclusive day count | Low | No blocker found |
| Low coverage periods | Deficit hidden below 80% coverage | Low | Product behavior is explicit in UI |
| Missing goal | Deficit hidden | Low | No blocker found |
| Goal changes inside selected period | Current goal is applied to all days | Medium | Safe deferred unless historical-goal accuracy is required for release |
| UI regression around labels | Service tests are strong; UI-specific deficit label tests appear lighter | Medium | Add targeted UI tests in implementation phase |
| Timezone/DST boundaries | Service uses UTC, UI labels use local date construction | Low/Medium | Add date-boundary regression tests |
| Data inclusion rules | Fallback/unresolved food rows excluded | Medium | Existing Food Core contract dependent; do not change in this fix without separate approval |

## Current Blocker Assessment

No release blocker was found for the specific suspected bug "daily calorie goal used as the target for the whole week/month/custom period."

Current code already calculates:

- week target = daily goal * 7;
- month target = daily goal * 30;
- year target = daily goal * 365;
- custom target = daily goal * actual inclusive day count.

The main deferred issue is goal-history accuracy when a selected period crosses a user goal change.

## Safe Implementation Plan

If production still shows an incorrect deficit:

1. Confirm the deployed bundle is current and the UI is reading `data.deficit.target_calories`, not a raw daily goal.
2. Add temporary diagnostic logging only in development/staging, or inspect service response in browser console/network:
   - `periodDays`
   - `periodStart`
   - `periodEnd`
   - `deficit.target_calories`
   - `total.calories`
   - `deficit.value`
   - `periodCoverage.days_with_data`
3. Add UI regression tests for `ProgressNutrition` labels:
   - week deficit;
   - week surplus;
   - month exact target;
   - low coverage;
   - missing goal.
4. Keep service formula as source of truth.
5. If historical goal changes must be correct, design a separate DB-backed goal history contract before implementation.

## Test Plan For Fix Phase

Service regression tests:

- week scales target by 7 days;
- month scales target by 30 days;
- custom period scales target by inclusive day count;
- long period does not collapse to 30 days;
- surplus produces negative `deficit.value`;
- low coverage hides multi-day deficit;
- day deficit still shows with target and data;
- missing goal hides deficit;
- date ranges across month/year boundaries remain correct.

UI regression tests:

- `ProgressNutrition` renders `Дефицит` with period target;
- `ProgressNutrition` renders `Профицит` for negative deficit value;
- `ProgressNutrition` renders `Недостаточно записей` for low coverage;
- `ProgressNutrition` renders goal-missing copy when no calorie goal exists;
- daily target display equals `target_calories / periodDays`.

Recommended commands for implementation phase:

- `npx tsx --test src/services/__tests__/progressNutritionService.test.ts`
- `npx tsx --test src/services/__tests__/progressHubService.test.ts`
- Add/run nearest `ProgressNutrition` page tests if available.
- `npm run build`

## Deferred Architecture

Goal history:

- Add a goal-history model only through a separately reviewed DB contract.
- A future period calculation could evaluate each day against the calorie goal active on that date.
- This would change product semantics and needs explicit approval.

Calendar period semantics:

- Current `week/month/year` are trailing windows.
- Calendar week/month support should be a separate product decision.

Data inclusion:

- Current logic intentionally excludes unresolved/fallback rows.
- Any change to include fallback food rows belongs to Food Core/Nutrition data quality work, not this deficit fix.

## Final Recommendation

Treat the suspected week/month/custom scaling bug as not reproduced in current code. The immediate safe next step is targeted UI/service regression coverage and, if production still shows wrong numbers, response-level diagnostics to confirm whether the deployed UI is using `deficit.target_calories` and `periodDays` correctly. Goal-history accuracy should remain a separate future architecture item unless explicitly promoted to release scope.
