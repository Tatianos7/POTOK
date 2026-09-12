# Workout Diary Regression Test Gaps

- Date: 2026-09-12
- Branch: `master`
- HEAD: `b7d9266 audit workout diary free foundation`
- Source audit: `reports/workout-diary-free-foundation-current-state-audit-2026-09-11.md`
- Target package: `WORKOUT_DIARY_REGRESSION_TEST_GAPS`
- Verdict: **WORKOUT_DIARY_REGRESSION_TEST_GAPS_READY**

## Executive Summary

Small regression/test-gap package for the Workout Diary FREE foundation.

This package did not rebuild Workout Diary, MuscleMap, or Workout Progress. It added focused regression coverage around gaps identified by the current-state audit:

- add-workout sheet flow state remains exclusive through category/list/editor/root;
- create-exercise modal layer remains exclusive and returns safely to the add flow;
- single entry delete removes only the target row;
- full day delete clears the local entry list contract;
- entry edit updates only metric fields for the target row;
- repeat options dedupe repeated exercise rows while preserving archived custom-exercise restore reason;
- repeat copy returns the expected target-date success contract;
- repeat button stays hidden while history is loading.

Runtime behavior was not intentionally changed.

## Why This Package Exists

The current-state audit found a mostly green Workout Diary FREE foundation, with strong service/component utility coverage and 209 passing targeted tests.

Main remaining gap:

- no fresh full-flow UI/browser/mobile regression for the current build.

Because browser/mobile smoke was not available as a reliable automated path in this package, this work closes small high-value test gaps that are safe to automate locally and records the remaining manual smoke checklist.

## Audit Source

Source audit:

- `WORKOUT_DIARY_FREE_FOUNDATION_CURRENT_STATE_AUDIT_READY`
- committed in `b7d9266bf74fdbbc0d4b0a62460bc2933e836681`

Audit recommendation:

- next package: `WORKOUT_DIARY_REGRESSION_TEST_GAPS_READY`
- avoid large refactors;
- do not rebuild MuscleMap or Workout Progress;
- do not add Premium workout write paths.

## Files Changed

- `src/utils/__tests__/workoutAddFlowNavigation.test.ts`
- `src/utils/__tests__/workoutDiaryMutations.test.ts`
- `src/utils/__tests__/repeatWorkoutFlow.test.ts`
- `src/utils/__tests__/workoutHistoryUi.test.ts`
- `reports/workout-diary-regression-test-gaps-2026-09-12.md`

No runtime source files were changed.

## Tests Added / Updated

### Add Workout Flow

Updated:

- `src/utils/__tests__/workoutAddFlowNavigation.test.ts`

Added coverage:

- category/list/editor/root flow keeps exactly one sheet layer open at a time;
- create-exercise layer is exclusive;
- successful custom exercise create returns to the category flow.

Product risk covered:

- add-workout modal/sheet state should not leave overlapping category/list/editor/create layers open.

### Entry Edit / Delete

Added:

- `src/utils/__tests__/workoutDiaryMutations.test.ts`

Added coverage:

- single entry delete removes only the target entry;
- deleting a missing entry leaves the list unchanged;
- full day clear returns an empty list;
- entry edit updates only metric fields for the target row;
- editing a missing entry leaves the list unchanged.

Product risk covered:

- edit/delete state helpers should not mutate unrelated workout entries or exercise definitions.

### Repeat Workout

Updated:

- `src/utils/__tests__/repeatWorkoutFlow.test.ts`

Added coverage:

- repeated same-exercise rows dedupe to one repeat option;
- archived custom-exercise restore reason is preserved during dedupe;
- repeat copy returns target-date success message.

Product risk covered:

- repeat should not lose archived custom-exercise blocking information;
- repeat success/navigation contract remains target-date based.

### History Repeat Entry Point

Updated:

- `src/utils/__tests__/workoutHistoryUi.test.ts`

Added coverage:

- repeat button remains hidden while history day data is loading, even if stale entries are present.

Product risk covered:

- repeat entry point should not become actionable while the selected history day is still loading.

## Flows Covered

Automated in this package:

- add flow state transitions;
- create custom exercise modal return behavior;
- local entry delete helper;
- local workout day clear helper;
- local entry edit helper;
- repeat option dedupe;
- archived custom exercise repeat block reason retention;
- repeat success target-date contract;
- history repeat button visibility guard.

Already covered by existing tests and re-run in this package:

- workout add service snapshot writes;
- add idempotency;
- add archived custom exercise block;
- update workout entry service path;
- delete entry/day service path;
- repeat copy service path;
- repeat archived custom exercise hard-block;
- user exercise owner-only visibility and archive/restore guards;
- ExerciseList active/archived UI;
- SelectedExercisesEditor validation and layout;
- Workout Diary MuscleMap builder;
- Workout Progress summary and MuscleMap regression.

## Flows Still Manual-Only

Still requiring browser/manual smoke:

- desktop `/workouts` add workout from button to saved entry;
- mobile `/workouts` add workout from button to saved entry;
- edit entry through UI modal;
- delete single entry through confirmation UI;
- delete workout day through confirmation UI;
- repeat from `/workouts/history` through modal to target day;
- create user exercise through UI;
- edit user exercise through UI;
- archive user exercise through UI;
- restore user exercise through archived tab;
- MuscleMap visible after a workout with mapped muscles;
- Workout Progress still shows completed facts and does not count planned Premium workouts.

Manual smoke checklist:

1. Open `/workouts` as an authenticated user.
2. Tap `ДОБАВИТЬ`.
3. Choose a category and an exercise.
4. Confirm selected exercise values and save.
5. Confirm the workout row appears.
6. Confirm MuscleMap appears when the exercise has mapped muscles.
7. Edit the row and save changed sets/reps/metric.
8. Delete the row and confirm only that row is removed.
9. Add at least one row again, then delete the whole day and confirm the day clears.
10. Open `/workouts/history`, choose a historical day, repeat to a target date, and confirm navigation back to `/workouts` with the target date.
11. Open `Мои упражнения`, create a custom exercise, edit it, archive it, verify it is hidden from active view, switch to archived view, restore it.
12. Open `/progress/workouts` and confirm completed workout facts remain visible.

## Browser / Mobile Smoke Limitation

No controllable browser/mobile smoke was completed in this package.

Reason:

- this package focused on local regression tests and report-only smoke checklist;
- no staging or production mutation was allowed;
- no secrets were requested.

The limitation is a remaining smoke gap, not an implementation blocker found by this package.

## FREE / PREMIUM Boundary Confirmation

Confirmed:

- no Premium workout write path was added;
- no automatic diary write from a Premium recommendation was added;
- Workout Diary remains a FREE completed-fact diary surface;
- Workout Progress remains fact-based;
- planned Premium workout behavior remains future work.

## MuscleMap / Progress Confirmation

Confirmed:

- MuscleMap was not rebuilt;
- Workout Progress MVP was not rebuilt;
- existing audit/regression coverage was re-run;
- current changes are test-only around Workout Diary regression gaps.

## Safety Confirmation

Confirmed for this package:

- regression/test-gap package;
- no intentional product behavior change;
- no redesign;
- no MuscleMap rebuild;
- no Workout Progress rebuild;
- no planned Premium workout writes;
- no automatic diary write from Premium plan;
- no Supabase SQL execution;
- no staging mutation;
- no production changes;
- no API keys;
- no secrets;
- no DB schema changes;
- no RLS policy changes;
- no payment enforcement;
- no PR;
- no commit.

## Verification

- Focused new/updated tests:
  - `npx tsx --test src/utils/__tests__/workoutAddFlowNavigation.test.ts src/utils/__tests__/workoutDiaryMutations.test.ts src/utils/__tests__/repeatWorkoutFlow.test.ts src/utils/__tests__/workoutHistoryUi.test.ts`
  - Result: passed, 27 tests.
- Extended workout regression suite:
  - `npx tsx --test src/services/__tests__/workoutService.test.ts src/services/__tests__/exerciseService.test.ts src/services/__tests__/workoutProgressService.test.ts src/pages/__tests__/Workouts.test.ts src/pages/__tests__/WorkoutHistory.test.ts src/pages/__tests__/ProgressWorkouts.test.ts src/components/__tests__/ExerciseListSheet.test.tsx src/components/__tests__/SelectedExercisesEditor.test.tsx src/components/__tests__/RepeatWorkoutModal.test.tsx src/components/__tests__/EditWorkoutEntryModal.test.tsx src/utils/__tests__/repeatWorkoutFlow.test.ts src/utils/__tests__/workoutProgress.test.ts src/utils/__tests__/muscleMap.test.ts src/utils/__tests__/exerciseListFilters.test.ts src/utils/__tests__/workoutAddFlowNavigation.test.ts src/utils/__tests__/workoutDiaryMutations.test.ts src/utils/__tests__/workoutHistoryUi.test.ts`
  - Result: passed, 231 tests.
  - Note: local test logs included expected missing Supabase env warnings; no secrets were requested.
- `npm run build`
  - Result: passed.
  - Notes: existing Vite/Browserslist/chunk-size/dynamic-import warnings remained; no build failure.
- `git diff --check`
  - Result: passed.

## Final Recommendation

Proceed to review/commit this test-gap package if `git diff --check` passes.

Recommended next step after this package:

- run owner/browser visual smoke using the manual checklist above;
- only then choose between lifecycle hardening, user exercise archive hardening, or exercise catalog quality audit.

Do not start Premium workout write paths before the FREE diary smoke state is verified.

## Final Verdict

**WORKOUT_DIARY_REGRESSION_TEST_GAPS_READY**
