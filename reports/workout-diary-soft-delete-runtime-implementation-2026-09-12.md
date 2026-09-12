# Workout Diary Soft Delete Runtime Implementation

- Date: 2026-09-12
- Branch: `master`
- Staging schema prerequisites:
  - `WORKOUT_DIARY_STAGING_SCHEMA_BASELINE_APPLY_READY`
  - `WORKOUT_DIARY_SOFT_DELETE_STAGING_APPLY_READY`
- Target package: `WORKOUT_DIARY_SOFT_DELETE_RUNTIME_IMPLEMENTATION`
- Verdict: **WORKOUT_DIARY_SOFT_DELETE_RUNTIME_IMPLEMENTATION_READY**

## Scope

Implement runtime soft-delete behavior for FREE Workout Diary completed facts.

This package changes runtime delete/read behavior for Workout Diary only. It does not add restore UI, does not add a cleanup job, does not hard-delete workout facts, does not create SQL, does not apply SQL, does not touch production, does not change Premium write paths, and does not add automatic diary writes from Premium planned workouts.

## Executive Summary

Workout Diary delete behavior now uses soft-delete semantics:

- single-entry delete marks the entry deleted instead of physically deleting it;
- day-level delete marks active entries for the selected day deleted instead of deleting `workout_days`;
- normal diary/history/repeat/progress reads filter `deleted_at is null`;
- local fallback stores tombstones through `deletedAt` / `deletedByUserId` and emits active entries only;
- current workout MuscleMap ignores soft-deleted entries defensively.

The runtime keeps the existing user-facing behavior: deleted rows disappear from active UI state.

## Files Changed

Runtime:

- `src/services/workoutService.ts`
- `src/types/workout.ts`
- `src/pages/Workouts.tsx`

Tests:

- `src/services/__tests__/workoutService.test.ts`
- `src/pages/__tests__/Workouts.test.ts`

Report:

- `reports/workout-diary-soft-delete-runtime-implementation-2026-09-12.md`

## Delete Paths Updated

### Single Entry Delete

Updated:

- `workoutService.deleteWorkoutEntry`

Behavior:

- persisted path uses `workout_entries.update({ deleted_at, deleted_by_user_id })`;
- update is scoped by entry id and `deleted_at is null`;
- local active state hides the deleted entry;
- local raw storage keeps the tombstone;
- AI training plan outdated marker still runs for the workout date.

No physical `workout_entries.delete()` is used by this path.

### Whole Day Delete

Updated:

- `workoutService.deleteWorkoutDay`

Behavior:

- persisted path fetches the selected `workout_days.id`;
- active entries for that day are updated with `deleted_at` and `deleted_by_user_id`;
- `workout_days` is not physically deleted;
- local active state becomes empty;
- local raw storage keeps deleted entry tombstones;
- AI training plan outdated marker still runs for the selected date.

No physical `workout_days.delete()` is used by this path.

## Read Paths Updated

Persisted active filters were added to:

- `getWorkoutEntriesFromSupabase`;
- `getWorkoutEntriesPersisted` through `getWorkoutEntriesFromSupabase`;
- `getWorkoutHistoryDays`;
- `getWorkoutProgressObservations`;
- `getWorkoutProgressEntryDetails`;
- repeat/copy source through `getWorkoutEntriesPersisted`.

Filter:

- `deleted_at is null`.

Local fallback:

- raw local storage can keep soft-deleted rows;
- `getWorkoutsFromLocalStorage` returns only active rows;
- `workouts-synced` emits active rows only.

MuscleMap:

- `buildCurrentWorkoutMuscleMapMuscles` now skips entries with `deletedAt`.

## Tests Added / Updated

Updated tests:

- single local delete now asserts tombstone storage and active-state hiding;
- whole-day local delete now asserts tombstones and active empty state;
- persisted day delete source assertion now requires `workout_entries.update()` and no `workout_days.delete()`.

Added tests:

- progress observations exclude rows with `deleted_at`;
- repeat copy ignores soft-deleted source entries;
- persisted read paths include `deleted_at is null` filters;
- current workout MuscleMap ignores soft-deleted entries.

Existing regression coverage preserved:

- add workout;
- edit entry;
- repeat workout;
- archived custom exercise blocking;
- progress observations;
- current MuscleMap;
- Workout History / Progress page utility coverage.

## Verification

Focused workout tests:

- `npx tsx --test src/services/__tests__/workoutService.test.ts src/pages/__tests__/Workouts.test.ts src/utils/__tests__/workoutDiaryMutations.test.ts src/utils/__tests__/repeatWorkoutFlow.test.ts src/services/__tests__/workoutProgressService.test.ts src/pages/__tests__/WorkoutHistory.test.ts src/pages/__tests__/ProgressWorkouts.test.ts src/components/__tests__/RepeatWorkoutModal.test.tsx src/components/__tests__/EditWorkoutEntryModal.test.tsx`
  - Result: passed, 106 tests.

Extended workout suite:

- `npx tsx --test src/services/__tests__/workoutService.test.ts src/services/__tests__/exerciseService.test.ts src/services/__tests__/workoutProgressService.test.ts src/pages/__tests__/Workouts.test.ts src/pages/__tests__/WorkoutHistory.test.ts src/pages/__tests__/ProgressWorkouts.test.ts src/components/__tests__/ExerciseListSheet.test.tsx src/components/__tests__/SelectedExercisesEditor.test.tsx src/components/__tests__/RepeatWorkoutModal.test.tsx src/components/__tests__/EditWorkoutEntryModal.test.tsx src/utils/__tests__/repeatWorkoutFlow.test.ts src/utils/__tests__/workoutProgress.test.ts src/utils/__tests__/muscleMap.test.ts src/utils/__tests__/exerciseListFilters.test.ts`
  - Result: passed, 215 tests.

Build:

- `npm run build`
  - Result: passed.
  - Note: build logs included existing Vite/Browserslist/chunk-size warnings; no build failure.

- `git diff --check`
  - Result: passed.

## Risks / Non-Blockers

Staging data:

- staging schema is ready, but catalog seed is still deferred, so full add-flow browser smoke may still need catalog seed.

Production:

- production schema was not touched in this package;
- production runtime deployment must be coordinated with production soft-delete schema apply.

Local fallback:

- local tombstones preserve deleted rows in raw storage, but there is no restore UI yet.

Lifecycle:

- retention cleanup remains later only;
- notes/media lifecycle cleanup was not changed.

## What Was Not Done

Not done:

- no restore UI;
- no cleanup job;
- no hard delete;
- no catalog seed;
- no notes/media work;
- no SQL changes;
- no Supabase SQL execution;
- no staging mutation in this runtime package;
- no production changes;
- no Premium writes;
- no payment enforcement;
- no PR;
- no commit.

## Recommended Next Package

Recommended next package:

- `WORKOUT_DIARY_SOFT_DELETE_RUNTIME_REVIEW_READY`

Scope:

- review runtime diff before commit;
- verify no missed read paths;
- decide whether staging catalog seed is needed before browser smoke.

Follow-up after review:

- focused staging smoke for add/edit/delete/repeat/progress once catalog seed/parity is sufficient.

## Safety Confirmation

Confirmed for this package:

- FREE Workout Diary completed facts only;
- no planned Premium workout writes;
- no automatic diary writes from Premium plans;
- no SQL migration created;
- no Supabase SQL execution;
- no production mutation;
- no cleanup job;
- no hard delete;
- no API keys/secrets requested;
- no PR;
- no commit.

## Final Verdict

**WORKOUT_DIARY_SOFT_DELETE_RUNTIME_IMPLEMENTATION_READY**
