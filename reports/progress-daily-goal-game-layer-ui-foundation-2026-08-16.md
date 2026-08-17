# Progress Daily Goal Game Layer UI Foundation

- Date: 2026-08-16
- Branch: `master`
- Status basis:
  - `POTOK_FREE_PROGRESS_AND_PAID_TODAY_STRUCTURE_READY`
  - `TODAY_FOUNDATION_AUDIT_AND_SPEC_READY`
  - `WORKOUT_MUSCLE_MAP_PROGRESS_VISUAL_SMOKE_READY`
- Verdict: **PROGRESS_DAILY_GOAL_GAME_LAYER_UI_FOUNDATION_READY**

## Scope

Implemented the first UI foundation for the free Progress Daily Goal/Game Layer in the general Progress screen.

This is not Today, not a planner, not AI, not a paid block, not Plan Store, and not a trainer workflow.

No DB/schema/storage changes were made. No production data was changed. No PR was created.

## Product Decision Summary

The free self-guided user path stays in POTOK Free:

- goal;
- food diary;
- workout diary;
- Progress;
- hints;
- lightweight daily motivation/game layer in Progress.

Today remains a paid execution mode for concrete daily plans from POTOK AI, POTOK Plans, or POTOK Human Coach. Self-guided mode is no longer treated as Today.

## Placement

The new `Цель дня` card is placed at the top of the general Progress route, before the detailed Progress analytics.

Implementation points:

- `src/pages/Progress.tsx`
- `src/components/ProgressDailyGoalCard.tsx`
- `src/utils/progressDailyGoal.ts`
- `src/services/progressHubService.ts`
- `src/pages/ProgressHub.css`

## Data Sources Used

The layer uses existing read sources only:

- Food completion: today's `mealService.getMealsForDate` data through `progressHubService`.
- Workout/activity completion: today's `workoutService.getWorkoutEntries` data through `progressHubService`.
- Water: current day water value can be observed, but the checklist item is disabled because the water flow is still weak/localStorage-only.
- Progress check: UI-session fact from the loaded Progress screen; no persistence.

No new DB tables, schema, storage, RPC, or persistence layer were added.

## Automatic / UI-Only / Disabled

| Item | Behavior |
| --- | --- |
| `Записать питание` | Automatic read-only completion when today's food diary has meal entries. |
| `Провести тренировку / активность` | Automatic read-only completion when today's workout diary has entries. |
| `Выпить воду` | Disabled placeholder with `Скоро`; no water logs are created. |
| `Проверить Progress` | UI-session completion when Progress data is loaded; not persisted. |

Disabled items do not block the soft success message for all currently available actions, while the visible score still remains honest, for example `3/4`.

## Implemented UI Behavior

- Compact Progress-first card titled `Цель дня`.
- Subtitle: `Держаться в рамках питания и выполнить активность`.
- Checklist with four Russian labels.
- Visible progress score such as `0/4`, `1/4`, `2/4`, `3/4`, `4/4`.
- Empty state copy when no completion facts exist.
- Gentle partial-progress copy without aggressive calorie/burn framing.
- Soft success copy when all available actions are complete.
- Mobile-safe card styling aligned with the existing Progress visual system.

## Guardrails Confirmation

- No diary entries are created from the checklist.
- No workout sessions are created from the checklist.
- No water logs are created from the checklist.
- Progress calculations and calorie deficit calculations were not changed.
- No paid Today logic was added.
- No AI recommendations were added.
- No POTOK Plans logic was added.
- No trainer or coach workflow was added.
- No payment/subscription logic was added.
- No DB/schema/storage/runtime production data changes were made.

## Tests Run

Targeted tests:

```text
npx tsx --test src/utils/__tests__/progressDailyGoal.test.ts src/components/__tests__/ProgressDailyGoalCard.test.tsx src/services/__tests__/progressHubService.test.ts
```

Result:

```text
tests 19
pass 19
fail 0
```

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

These warnings did not block the build and are not specific blockers for this Progress layer.

## Known Limitations

- Water is disabled until a safe approved persistence/read model exists.
- Steps are not included because a first-class steps source was not confirmed.
- Habits are not included in this P0 UI foundation.
- `Проверить Progress` is UI-session only and is not saved across sessions.
- Week/month completion and streak metrics are not implemented yet.
- No browser screenshot smoke was run in this package.

## Non-Blocking Polish

- Add derived week/month completion and streaks after the basic layer proves stable.
- Decide whether water should remain local-only or get an approved persistence path.
- Add visual screenshot smoke for mobile/desktop once the next UI pass starts.
- Consider chunking cleanup separately if `mealService` import warnings become a performance concern.

## Recommended Next Step

Recommended next package:

`PROGRESS_DAILY_GOAL_GAME_LAYER_V1_DERIVED_METRICS_PACKAGE`

Suggested scope:

- derive lightweight streak/week/month completion from existing diary/workout data;
- keep Progress as Progress, not Today;
- keep all checklist actions read-only or UI-only unless persistence is separately approved;
- add visual smoke for mobile and desktop;
- add no-autowrite regression coverage around Progress.

## Final Status

The free Progress Daily Goal/Game Layer UI foundation is implemented and verified. It is safe to continue with derived metrics or visual polish before returning to paid Today foundation work.
