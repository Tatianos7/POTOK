# Progress Daily Goal Game Layer Read-Only Period Metrics

- Date: 2026-08-17
- Branch: `master`
- Status basis:
  - `PROGRESS_DAILY_GOAL_GAME_LAYER_UI_FOUNDATION_READY`
  - `PROGRESS_DAILY_GOAL_GAME_LAYER_GOAL_LOGIC_FIX_READY`
  - `PROGRESS_DAILY_GOAL_GAME_LAYER_320PX_LAYOUT_FIX_READY`
  - `PROGRESS_DAILY_GOAL_GAME_LAYER_STREAKS_PERIODS_SPEC_READY`
- Verdict: **PROGRESS_DAILY_GOAL_GAME_LAYER_READ_ONLY_PERIOD_METRICS_READY**

## Scope

Implemented compact read-only period metrics inside the existing free Progress `Цель дня` card:

- `Серия`;
- `Неделя`;
- `Месяц`;
- one short conclusion line.

This remains the Free Progress Daily Goal/Game Layer. It is not Today, not paid content, not AI, not Plan Store, not Coach, and not payment logic.

## What Was Implemented

The existing `Цель дня` card now shows a compact period row below the checklist:

```text
Серия 3 дня · Неделя 4/7 · Месяц 18/30
```

The message area now uses the period conclusion when metrics are available.

Implementation points:

- `src/utils/progressDailyGoal.ts`
- `src/components/ProgressDailyGoalCard.tsx`
- `src/pages/Progress.tsx`
- `src/pages/ProgressHub.css`
- `src/services/progressHubService.ts`

## Data Sources

The metrics reuse already loaded read-only Progress data:

- nutrition history from `NutritionStats.dailyCalories`;
- daily calorie target from goal summary or nutrition summary;
- workout history from `WorkoutProgressSummary.workoutDates`.

No new per-day DB query loop was added for these metrics.

## Day Completed Definition

Historical objective day completion is:

```text
nutrition_in_range && workout_exists
```

Where:

- `nutrition_in_range` means logged calories are within `90-110%` of the daily calorie target;
- `workout_exists` means the date appears in workout diary history.

Historical metrics intentionally exclude:

- `Проверить Progress`, because it is UI-session only;
- water, because it is localStorage/current-device limited;
- habits/steps, because stable Progress sources are not confirmed.

## Streak / Week / Month Logic

- `Серия`: consecutive objective-completed days ending today, or ending yesterday if today is not complete yet.
- `Неделя`: objective-completed days in the last 7 days.
- `Месяц`: objective-completed days in the last 30 days.

The implementation sorts days by date and uses the fixed Progress 30-day window.

## Conclusions

The short conclusion is derived from objective data:

- sparse data: `Пока мало данных — начните с дневника питания или активности.`
- strong week: `Неделя идёт ровно. Продолжайте без рывков.`
- nutrition bottleneck: `Питание чаще всего мешает закрыть день.`
- workout bottleneck: `Добавьте хотя бы короткую активность.`
- neutral: `Каждый закрытый день помогает видеть реальный прогресс.`

Copy stays calm and avoids aggressive calorie/burn framing.

## Water / Progress-Check Limitations

Water remains today-only:

- today's checklist can complete `Выпить воду` from `DailyMeals.water`;
- water is not required for historical streak/week/month.

Progress check remains UI-only:

- today's checklist can complete `Проверить Progress` when Progress is open;
- Progress-check is not included in historical metrics;
- no previous Progress views are inferred or persisted.

## UI Behavior

- No new large card was added.
- The period metrics extend the existing `Цель дня` card.
- The metrics row uses small bordered cells and wraps on narrow screens.
- The existing 320px label/chip fix remains intact.
- The card stays compact and mobile-safe.

## Guardrails

- No DB/schema/storage changes.
- No migrations.
- No diary writes.
- No workout writes.
- No water writes.
- No new Progress calculation mutation.
- No Today logic.
- No AI, payment, Plans, or Coach logic.
- No PR.

## Tests

Targeted tests:

```text
npx tsx --test src/utils/__tests__/progressDailyGoal.test.ts src/components/__tests__/ProgressDailyGoalCard.test.tsx src/services/__tests__/progressHubService.test.ts
```

Result:

```text
tests 31
pass 31
fail 0
```

Coverage added:

- week count;
- month count;
- streak ending today/yesterday;
- sparse data conclusion;
- no Progress-check in history;
- water not required historically;
- compact period metrics rendering;
- mobile wrapping class coverage.

## Build

```text
npm run build
```

Result: passed.

Build produced existing maintenance warnings only:

- browser baseline data is old;
- Browserslist/caniuse-lite data is old;
- existing `mealService` dynamic/static import overlap warning;
- some chunks exceed 500 kB.

These warnings are not blockers for this package.

## Limitations

- Historical metrics depend on existing nutrition/workout range summaries.
- If `dailyCalories` is absent from nutrition stats, nutrition historical completion cannot be inferred.
- Water is not part of historical completion yet.
- Progress-check history is not persisted.
- Steps/habits remain out of scope.
- No browser screenshot artifact was captured in this package.

## Next Step

Recommended next package:

`PROGRESS_DAILY_GOAL_GAME_LAYER_PERIOD_METRICS_VISUAL_SMOKE_READY`

Suggested scope:

- owner/browser smoke for 320px, 375px, 390px, 430px;
- verify examples for sparse data, strong week, nutrition bottleneck, workout bottleneck;
- decide whether water needs a future persisted target before adding richer streak behavior.

## Final Status

Read-only period metrics are implemented safely in the existing `Цель дня` card. Historical completion is based only on objective diary/workout facts and does not add any new write-path.
