# Progress Daily Goal Game Layer Toggle UX Polish

- Date: 2026-08-18
- Branch: `master`
- Status basis:
  - `PROGRESS_DAILY_GOAL_GAME_LAYER_CUSTOMIZATION_READY`
- Verdict: **PROGRESS_DAILY_GOAL_GAME_LAYER_TOGGLE_UX_POLISH_READY**

## Scope

Small UX polish for the `Цель дня` toggle inside the free Progress Daily Goal/Game Layer.

No DB/schema/storage changes were made. No production data was changed. No diary, workout, or water write path was changed. Today, AI, payment, Plans, Coach, and PR work were not touched.

## Owner Issue

Owner screenshots showed two clarity issues:

- active state displayed `Выкл`, which could be read as the current state even though the block was enabled;
- disabled state duplicated the enable action with both a header toggle and an inner `Включить` button.

## What Changed

- Header toggle now shows current state:
  - `Вкл` when the block is enabled;
  - `Выкл` when the block is disabled.
- The toggle still switches the state.
- Disabled/collapsed state no longer shows the duplicate `Включить` CTA.
- Disabled state keeps only the helper text:
  - `Помогает отмечать базовые действия и видеть прогресс за месяц.`
- `Настроить пункты` remains visible only when the block is enabled.
- Checklist, month indicator, and setup remain hidden when the block is disabled.

## Behavior Preserved

- Completion logic was not changed.
- Month logic was not changed.
- localStorage preference key was not changed.
- Enabling from disabled state still opens the mini setup before saving enabled preferences.
- The checklist still does not write diary/workout/water data.

## Tests Run

Targeted tests:

```text
npx tsx --test src/utils/__tests__/progressDailyGoal.test.ts src/components/__tests__/ProgressDailyGoalCard.test.tsx src/services/__tests__/progressHubService.test.ts
```

Result:

```text
tests 43
pass 43
fail 0
```

## Build Result

```text
npm run build
```

Result: passed.

Existing non-blocking warnings remain:

- baseline browser mapping data age;
- Browserslist data age;
- existing `mealService` dynamic/static import overlap;
- large chunk warning.

## Final Status

The `Цель дня` toggle now reads as a state control, the disabled card has no duplicate CTA, and the customization layer remains scoped to the free Progress block.
