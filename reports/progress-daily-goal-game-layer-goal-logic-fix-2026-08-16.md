# Progress Daily Goal Game Layer Goal Logic Fix

- Date: 2026-08-16
- Branch: `master`
- Status basis:
  - `PROGRESS_DAILY_GOAL_GAME_LAYER_UI_FOUNDATION_READY`
  - owner visual review completed
- Verdict: **PROGRESS_DAILY_GOAL_GAME_LAYER_GOAL_LOGIC_FIX_READY**

## Scope

Applied a targeted logic fix for the free Progress Daily Goal/Game Layer after owner visual review.

This remains a free Progress motivation block. It is not Today, not paid content, not AI, not Plan Store, and not Coach.

No DB/schema/storage changes were made. No production data was changed. No diary, workout, or water write-path was changed. No PR was created.

## Owner Visual Feedback Summary

Owner confirmed that the `Цель дня` block looks good in general Progress and does not overload the screen.

Two logic issues were identified:

- Nutrition was completed too early when the user logged only breakfast.
- Water showed `Скоро` even though water is already visible in Food Diary.

## Nutrition Completion Logic

The checklist label changed from:

- `Записать питание`

to:

- `Питание в рамках цели`

Completion no longer depends on the mere existence of a food diary entry.

New derived logic:

- if calorie target is missing or invalid, nutrition remains not completed with `Недостаточно данных`;
- if logged calories are `0`, nutrition remains not completed;
- if logged calories are below the allowed range, nutrition remains not completed;
- if logged calories are above the allowed range, nutrition remains not completed;
- nutrition is completed only when today's logged calories are within the target range.

The card may show compact context like:

- `Записано 1850 ккал из 2000 ккал`

## Calorie Target Range

Chosen MVP range:

- lower bound: `90%` of daily calorie target;
- upper bound: `110%` of daily calorie target.

Reason:

- no narrower project-wide Daily Goal range was found for this lightweight checklist;
- `90-110%` is conservative enough to avoid completing the day after breakfast only;
- the range is used only for Daily Goal completion and does not change nutrition Progress, calorie deficit, or macro calculations.

## Water Investigation Result

Existing water state is available through the Food Diary day model:

- `mealService.getMealsForDate`;
- `DailyMeals.water`;
- `progressHubService.today.waterGlasses`.

The existing service comment notes that water is localStorage-only, not Supabase-backed. That makes it safe enough for read-only UI completion, but not suitable for new persistence or long-term analytics in this package.

## Water Behavior

Water is now read-only derived in the Daily Goal card.

Current MVP behavior:

- if `DailyMeals.water > 0`, `Выпить воду` is completed;
- if `DailyMeals.water = 0`, it remains pending;
- no water goal/target is enforced because no approved daily water target model was found;
- no water logs are created from Progress.

Known limitation:

- completion currently means water was marked in the existing day model, not that a target amount was reached.

## UI Copy Changes

Changed:

- `Записать питание` -> `Питание в рамках цели`
- empty copy now says: `Начните с простого: добавьте питание или активность.`

Water note:

- when water is completed, the compact note shows glass count, for example `2 ст.`;
- if water is unavailable in a future source failure, the item can still safely render as unavailable/disabled.

## Guardrails Confirmation

- No diary entries are created from the checklist.
- No workout sessions are created from the checklist.
- No water logs are created from the checklist.
- No DB/schema/storage changes were made.
- No production data was changed.
- Nutrition Progress calculations were not changed.
- Calorie deficit calculations were not changed.
- No Today logic was added.
- No paid gating was added.
- No AI, Plans, Coach, trainer marketplace, or payment logic was added.

## Tests Run

Targeted tests:

```text
npx tsx --test src/utils/__tests__/progressDailyGoal.test.ts src/components/__tests__/ProgressDailyGoalCard.test.tsx src/services/__tests__/progressHubService.test.ts
```

Result:

```text
tests 23
pass 23
fail 0
```

Coverage added/updated:

- breakfast-only / calories far below target -> nutrition not completed;
- calories within `90-110%` range -> nutrition completed;
- calories over upper bound -> nutrition not completed;
- missing calorie target -> nutrition not completed with insufficient data;
- zero calories -> nutrition not completed;
- water read-only state present -> water completed;
- water disabled state still renders safely;
- component still has no diary/workout write imports.

## Build Result

```text
npm run build
```

Result: passed.

Build produced existing maintenance warnings only:

- browser baseline data is old;
- Browserslist/caniuse-lite data is old;
- existing `mealService` dynamic/static import overlap warning;
- some chunks exceed 500 kB.

These warnings are not blockers for this logic fix.

## Known Limitations

- Water has no approved target yet; Daily Goal only checks that some water was marked.
- Water is still localStorage-backed via Food Diary day state.
- Steps and habits remain out of scope.
- `Проверить Progress` remains UI-session only and is not persisted.
- Daily Goal range is an MVP checklist range, not a nutrition Progress metric.

## Recommended Next Step

Recommended package:

`PROGRESS_DAILY_GOAL_GAME_LAYER_VISUAL_AND_METRICS_SMOKE_READY`

Suggested scope:

- quick owner/browser smoke of updated nutrition/water states;
- decide whether water needs an explicit target before week/month streaks;
- then add lightweight week/month/streak derivation from existing facts.

## Final Status

The owner visual review logic issues are fixed. The block now treats nutrition as goal-range completion instead of simple diary logging, and water is read-only derived from the existing Food Diary day model without adding any write-path.
