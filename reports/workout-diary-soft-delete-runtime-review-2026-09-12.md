# Workout Diary Soft Delete Runtime Review

- Date: 2026-09-12
- Branch: `master`
- Target package: `WORKOUT_DIARY_SOFT_DELETE_RUNTIME_REVIEW`
- Reviewed implementation report: `reports/workout-diary-soft-delete-runtime-implementation-2026-09-12.md`
- Verdict: **WORKOUT_DIARY_SOFT_DELETE_RUNTIME_REVIEW_READY**

## Scope

Review the runtime soft-delete implementation for Workout Diary before commit.

Reviewed files:

- `src/services/workoutService.ts`
- `src/types/workout.ts`
- `src/pages/Workouts.tsx`
- `src/services/__tests__/workoutService.test.ts`
- `src/pages/__tests__/Workouts.test.ts`
- `reports/workout-diary-soft-delete-runtime-implementation-2026-09-12.md`

This review is runtime-code review plus one focused missing test. SQL was not executed, Supabase was not mutated, staging was not mutated, production was not touched, UI behavior was not redesigned, Premium write paths were not touched, no PR was created, and no commit was created.

## Executive Summary

No blocker was found in the reviewed runtime implementation.

The implementation matches the owner decision:

- user-facing delete removes entries from active diary views;
- technical delete is now soft-delete through `deleted_at`;
- single entry delete does not physically delete `workout_entries`;
- day delete soft-deletes active entries for the day and does not delete `workout_days`;
- normal diary, history, repeat source, progress observations/details, and current Workout Diary MuscleMap exclude soft-deleted entries;
- local fallback preserves tombstones while returning active entries to active views;
- `deleted_by_user_id` is set from the authenticated/session user path, not from arbitrary client payload;
- restore UI, retention cleanup, hard delete, notes/media cleanup, and Premium write paths are not included.

Production deploy gate:

- staging schema is ready;
- production runtime deploy must wait until production schema has `workout_entries.deleted_at`, `workout_entries.deleted_by_user_id`, and the soft-delete indexes.

## Blockers

No blockers.

## Non-Blockers

### 1. Production schema gate remains mandatory

Runtime code now reads and writes `deleted_at` / `deleted_by_user_id`.

This is correct for staging, where the schema has been applied, but production deployment before production schema apply would be unsafe.

Recommendation:

- keep runtime merge/deploy gated behind explicit production schema apply and verification.

### 2. UI active-list helpers still use removal wording

Some UI/local active-view helpers still describe visible removal semantics. This is acceptable because active diary behavior still removes rows from the visible list after service success.

Recommendation:

- avoid treating active-view removal helpers as persisted deletion semantics in future tests or reports.

## Delete Path Assessment

### `deleteWorkoutEntry`

Assessment:

- persisted path updates `public.workout_entries`;
- sets `deleted_at` to the current timestamp;
- sets `deleted_by_user_id` from `sessionUserId`;
- filters with `.is('deleted_at', null)` so already deleted rows are not re-deleted;
- does not call `.delete()` on `workout_entries`;
- updates local active cache after success;
- still marks the related AI training plan outdated.

Result: pass.

### `deleteWorkoutDay`

Assessment:

- persisted path fetches the owner-scoped workout day;
- updates active rows in `workout_entries` by `workout_day_id`;
- sets `deleted_at` and `deleted_by_user_id`;
- filters with `.is('deleted_at', null)`;
- does not delete `workout_days`;
- does not call `.delete()` on `workout_entries`;
- local fallback soft-deletes active local entries for the selected day.

Result: pass.

## Read Path Assessment

Active filters are present for:

- current diary persisted entry reads through `getWorkoutEntriesFromSupabase`;
- `getWorkoutEntriesPersisted`, via the same active persisted read path;
- `getWorkoutHistoryDays`;
- `getWorkoutProgressObservations`;
- `getWorkoutProgressEntryDetails`;
- repeat source reads, via `getWorkoutEntriesPersisted`;
- current Workout Diary MuscleMap input builder, which skips entries with `deletedAt`.

The pure `buildWorkoutProgressObservations` mapper also skips rows with `deleted_at`, which protects tests and legacy/fallback callers from accidentally counting deleted facts.

Result: pass.

## Local Fallback Assessment

Local fallback now distinguishes raw storage from active views:

- raw local entries can retain tombstones with `deletedAt` and `deletedByUserId`;
- active `getWorkoutEntries` local reads filter deleted entries;
- local single delete marks the target entry deleted instead of removing it;
- local day delete marks active entries deleted instead of clearing raw storage;
- `workouts-synced` emits active entries only;
- `saveWorkoutsToLocalStorage` preserves existing deleted tombstones not present in incoming active rows.

Result: pass.

## `deleted_by_user_id` Assessment

Persisted delete paths set `deleted_by_user_id` from `sessionUserId`.

Local fallback uses the known local `userId` only when Supabase/session is unavailable.

No reviewed path accepts `deleted_by_user_id` from arbitrary delete payload.

Result: pass.

## Tests Assessment

Existing and updated tests cover:

- local single-entry delete soft-deletes and active reads hide the row;
- local day delete soft-deletes selected-day active entries only;
- persisted day delete source shape updates entries and does not delete `workout_days`;
- persisted single-entry delete source shape updates entries and does not physically delete rows;
- progress mapper excludes soft-deleted rows;
- repeat copy ignores soft-deleted local source entries;
- persisted read sections include `deleted_at is null`;
- current Workout Diary MuscleMap ignores soft-deleted entries.

One minimal missing test was added during review:

- `single entry delete soft-deletes entry and does not physically delete persisted row`.

Result: pass.

## Production Safety

Safe for commit as runtime implementation after owner review.

Not safe for production deploy until:

- production schema apply is explicitly approved and verified;
- production has `deleted_at` and `deleted_by_user_id`;
- production has compatible indexes;
- production RLS/update behavior is verified for owner soft-delete updates.

## Verification

- Focused workout tests:
  - `npx tsx --test src/services/__tests__/workoutService.test.ts src/pages/__tests__/Workouts.test.ts src/utils/__tests__/workoutDiaryMutations.test.ts src/utils/__tests__/repeatWorkoutFlow.test.ts src/services/__tests__/workoutProgressService.test.ts src/pages/__tests__/WorkoutHistory.test.ts src/pages/__tests__/ProgressWorkouts.test.ts src/components/__tests__/RepeatWorkoutModal.test.tsx src/components/__tests__/EditWorkoutEntryModal.test.tsx`
  - Result: passed, 107 tests.
- Extended workout suite:
  - `npx tsx --test src/services/__tests__/workoutService.test.ts src/services/__tests__/exerciseService.test.ts src/services/__tests__/workoutProgressService.test.ts src/pages/__tests__/Workouts.test.ts src/pages/__tests__/WorkoutHistory.test.ts src/pages/__tests__/ProgressWorkouts.test.ts src/components/__tests__/ExerciseListSheet.test.tsx src/components/__tests__/SelectedExercisesEditor.test.tsx src/components/__tests__/RepeatWorkoutModal.test.tsx src/components/__tests__/EditWorkoutEntryModal.test.tsx src/utils/__tests__/repeatWorkoutFlow.test.ts src/utils/__tests__/workoutProgress.test.ts src/utils/__tests__/muscleMap.test.ts src/utils/__tests__/exerciseListFilters.test.ts`
  - Result: passed, 216 tests.
- `npm run build`
  - Result: passed.
  - Notes: existing browserslist/baseline data and chunk-size warnings only.
- `git diff --check`
  - Result: pending final run after this report.

## Safety Confirmation

Confirmed for this review package:

- review-only package with one focused test addition;
- no SQL execution;
- no Supabase mutation;
- no staging mutation;
- no production mutation;
- no runtime behavior beyond the already scoped soft-delete implementation;
- no UI redesign;
- no Premium writes;
- no payment enforcement;
- no API keys;
- no secrets;
- no PR;
- no commit.

## Final Recommendation

Commit the runtime implementation only after owner approval, with the production deployment gate clearly preserved.

Recommended next small package:

- `WORKOUT_DIARY_SOFT_DELETE_RUNTIME_COMMIT_READY`

Follow-up after commit:

- production schema apply/review package before production runtime deploy.

## Final Verdict

**WORKOUT_DIARY_SOFT_DELETE_RUNTIME_REVIEW_READY**
