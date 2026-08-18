# Progress Daily Goal Game Layer Toggle Position Fix

- Date: 2026-08-18
- Branch: `master`
- Status basis:
  - `PROGRESS_DAILY_GOAL_GAME_LAYER_TOGGLE_UX_POLISH_READY`
- Verdict: **PROGRESS_DAILY_GOAL_GAME_LAYER_TOGGLE_POSITION_FIX_READY**

## Scope

Small layout fix for the `Вкл` / `Выкл` toggle in the `Цель дня` card.

No DB/schema/storage changes were made. No production data was changed. No diary, workout, or water write path was changed. Today, AI, payment, Plan Store, Coach, and PR work were not touched.

## Owner Screenshot Issue

The toggle visually shifted between states:

- disabled state: `Выкл` appeared higher;
- enabled state: `Вкл` appeared lower because the progress badge shared the same flex row.

This made the UI feel like the toggle jumped when switching state.

## Root Cause

The toggle and progress badge were competing inside one horizontal flex row. When the badge existed in enabled state but disappeared in disabled state, the right-side header group changed its visual balance and vertical position.

## Layout Change

- Header now uses a stable two-column grid:
  - left column: `Сегодня`, `Цель дня`, subtitle;
  - right column: fixed-width action column.
- The toggle is always first in the right column.
- The progress badge renders below the toggle only when enabled.
- The badge no longer affects toggle placement.

## Enabled / Disabled Behavior

Enabled:

- toggle remains top-right and shows `Вкл`;
- progress badge appears below the toggle;
- checklist, month, message, and `Настроить пункты` remain visible.

Disabled:

- toggle remains in the same top-right position and shows `Выкл`;
- progress badge is hidden;
- checklist, month, setup, and settings button are hidden;
- helper copy remains visible.

## 320px Behavior

For narrow screens, the header keeps the same grid pattern with a slightly narrower right column. The toggle stays pinned to the top-right action column, and the badge stacks below it only when enabled.

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

## Guardrails

- Completion logic was not changed.
- Month logic was not changed.
- Preferences/localStorage behavior was not changed.
- Setup behavior was not changed.
- No diary/workout/water writes were added.

## Final Status

The `Вкл` / `Выкл` toggle now has a stable top-right position in both enabled and disabled states, while the progress badge can appear below it without moving the toggle.
