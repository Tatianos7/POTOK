# Workout Diary Soft Delete / Archive Plan

- Date: 2026-09-12
- Branch: `master`
- HEAD: `c9fafc8 test workout diary regression gaps`
- Source audit: `reports/workout-diary-free-foundation-current-state-audit-2026-09-11.md`
- Target package: `WORKOUT_DIARY_SOFT_DELETE_ARCHIVE_PLAN`
- Verdict: **WORKOUT_DIARY_SOFT_DELETE_ARCHIVE_PLAN_READY**

## Scope

Prepare a plan/report-only package for moving Workout Diary delete behavior from physical deletion to archive/soft-delete semantics.

Owner decision:

- user-facing delete actions may still look like delete/removal from the diary;
- technically, workout facts should not be physically erased;
- deleted entries should disappear from active diary UI;
- deleted entries should not count in Workout Progress;
- deleted entries should not drive current/day MuscleMap facts;
- notes, media links, history, and future restore options should remain preservable.

This is plan/report-only. Runtime code was not changed, UI was not changed, Supabase SQL was not executed, staging was not mutated, production was not touched, Premium write paths were not touched, DB schema/RLS were not changed, no API keys/secrets were used, no PR was created, and no commit was created.

## Executive Summary

Current Workout Diary delete behavior is still physical in the important persisted paths:

- `workoutService.deleteWorkoutEntry` calls `.from('workout_entries').delete()` for a single workout entry.
- `workoutService.deleteWorkoutDay` calls `.from('workout_days').delete()` for the selected day container.
- local fallback removes entries from the local workout list through `removeWorkoutEntryFromList` and `clearWorkoutEntriesForDay`.
- page UI immediately removes deleted rows from visible state after the service call.

The recommended direction is a phased soft-delete model:

- introduce nullable soft-delete metadata on `workout_entries`;
- make single-entry delete update `deleted_at` instead of deleting the row;
- make day-level delete mark all active entries for the date as deleted;
- filter deleted entries from active diary, history, repeat source, Progress, and MuscleMap fact inputs;
- keep restore UI as a later package, not part of the first runtime migration.

Recommended next package:

- `WORKOUT_DIARY_SOFT_DELETE_SQL_DRAFT_READY`

Reason:

- schema shape must be explicit before runtime queries are changed;
- the first package should draft and review SQL only, not apply it;
- runtime behavior can then be changed against a reviewed schema contract.

## Current Delete Paths Audit

### Single Workout Entry Delete

Files:

- `src/pages/Workouts.tsx`
- `src/services/workoutService.ts`
- `src/utils/workoutDiaryMutations.ts`

Current UI flow:

- `handleDeleteEntry(entryId)` is called from the workout entry row delete action.
- It confirms with `Удалить упражнение из тренировки?`.
- It calls `workoutService.deleteWorkoutEntry(entryId, user.id, selectedDate)`.
- On success it calls `removeWorkoutEntryFromList(workoutEntries, entryId)`.
- Runtime status becomes `active` if entries remain, otherwise `empty`.

Current service behavior:

- if Supabase is unavailable and `userId/date` are available, local storage is mutated by filtering out the entry;
- if session lookup fails and `userId/date` are available, local storage is mutated by filtering out the entry;
- in persisted mode it calls `.from('workout_entries').delete().eq('id', entryId)`;
- after deletion it updates local cache by filtering out the entry;
- after deletion it marks the related AI training plan outdated for that date.

Current implication:

- the workout entry row can be physically erased from Supabase;
- entry-level notes and user exercise media depend on FK behavior and may lose direct linkage depending on schema;
- future restore is impossible without backups/audit logs.

### Whole Workout Day Delete

Files:

- `src/pages/Workouts.tsx`
- `src/services/workoutService.ts`
- `src/utils/workoutDiaryMutations.ts`

Current UI flow:

- `handleDeleteWorkout()` is called from the whole-day delete action.
- It confirms with `Удалить всю тренировку за выбранный день?`.
- It calls `workoutService.deleteWorkoutDay(user.id, selectedDate)`.
- On success it clears visible entries through `clearWorkoutEntriesForDay()`.
- It also clears day-note UI state and sets runtime status to `empty`.

Current service behavior:

- if Supabase is unavailable, local storage entries for the day are replaced with `[]`;
- if session lookup fails, local storage entries for the day are replaced with `[]`;
- in persisted mode it fetches `workout_days.id` by `user_id/date`;
- if found, it calls `.from('workout_days').delete().eq('id', workoutDay.id)`;
- the existing test contract asserts day-level delete uses the `workout_days` delete and does not directly delete from `workout_entries`;
- after deletion it clears local cache and marks the AI training plan outdated.

Current implication:

- the day container can be physically erased;
- child rows may be erased by cascade depending on DB constraints;
- day notes linked to `workout_day_id` are at risk if the day row is removed;
- future restore of a day-level delete is not possible without backups.

### Related Notes And Media

Entry notes:

- `workoutEntryNotesService.deleteNote` physically deletes rows from `workout_entry_notes`;
- notes are keyed by `workout_entry_id`;
- soft-delete of workout entries should preserve the workout entry row so entry notes can remain linked unless the user explicitly deletes the note.

Day notes:

- `workoutDayNotesService.deleteNote` physically deletes rows from `workout_day_notes`;
- notes are keyed by `workout_day_id`;
- soft-delete of entries should not automatically delete day notes;
- deleting the `workout_days` row is the risky part for day-note preservation.

User exercise media:

- `userExerciseMediaService` stores media in `user_exercise_media`;
- previous lifecycle reports documented the repeat contract as not copying media rows;
- soft-delete should preserve media relationships by not deleting source workout entry rows.

### Existing Delete Tests

Current tests that will need intentional updates:

- `src/services/__tests__/workoutService.test.ts`
  - `single delete really removes workout entry and updates synced state in local-only mode`;
  - `whole day delete removes entries only for selected day in local-only mode`;
  - `whole day delete uses day-level cascade contract for persisted path`;
  - `failed single delete without persistence context does not mutate local state`;
- `src/utils/__tests__/workoutDiaryMutations.test.ts`
  - `single entry delete removes only the targeted workout entry`;
  - `whole day delete clears the local workout entry list`.

These tests currently encode physical-removal semantics. They should be replaced with active-view filtering expectations after the soft-delete runtime package.

## Product Semantics Proposal

User-facing behavior:

- UI copy may remain `Удалить` if product wants the simple mental model;
- confirmation copy should be reviewed because the technical behavior becomes archive/soft-delete;
- possible future copy:
  - `Удалить упражнение из тренировки?`;
  - `Удалить тренировку из дневника?`;
  - `Скрыть тренировку из дневника?`.

Technical behavior:

- single-entry delete marks the entry as deleted/archived;
- whole-day delete marks all active entries for that day as deleted/archived;
- normal diary views hide deleted entries;
- Workout History hides deleted entries by default;
- repeat flow cannot copy deleted entries;
- Workout Progress excludes deleted entries;
- Workout Diary MuscleMap excludes deleted entries because its source active entries are filtered;
- future restore can re-enable an entry by clearing the soft-delete metadata;
- notes and media remain linked unless explicitly deleted by their own note/media actions.

Important distinction:

- a completed workout fact remains historically recoverable in storage;
- an active diary fact is the subset where soft-delete metadata is null.

## Data Model Options

### Option A: `deleted_at` On `workout_entries`

Add nullable soft-delete fields to workout entries:

- `workout_entries.deleted_at timestamptz null`;
- optionally `workout_entries.deleted_by_user_id uuid null`.

Pros:

- matches user-facing delete language;
- simple query filter: `deleted_at is null`;
- supports entry-level delete directly;
- day-level delete can update all active entries for the day;
- Progress/repeat/history filtering is straightforward;
- preserves row IDs for entry notes and user exercise media.

Cons:

- day-level restore would need to restore a batch of entries;
- day-note visibility semantics need a clear rule if all entries are deleted but the day note remains;
- adding fields requires SQL migration and RLS review later.

### Option B: `archived_at` On `workout_entries`

Add archive metadata:

- `workout_entries.archived_at timestamptz null`;
- optionally `workout_entries.archived_by_user_id uuid null`.

Pros:

- aligns with existing user exercise archive language;
- future restore UI can reuse archive mental model.

Cons:

- user action is called delete, not archive;
- can confuse product semantics because user exercise archive and diary delete are different concepts;
- `archived_at` may imply an archive view is expected immediately.

### Option C: Status Field

Add status metadata:

- `workout_entries.status text not null default 'active'`;
- optionally `deleted_at` or `archived_at` for timestamp/audit.

Pros:

- extensible for future states;
- can represent `active`, `deleted`, `restored`, or other lifecycle states.

Cons:

- larger migration and app-surface change;
- requires stricter enum/check constraint design;
- overbuilt for the current MVP decision.

## Recommended MVP Model

Recommended MVP:

- add `workout_entries.deleted_at timestamptz null`;
- add `workout_entries.deleted_by_user_id uuid null` if safe and consistent with auth/RLS patterns;
- do not add a restore UI in the first runtime package;
- do not physically delete `workout_entries` for diary delete actions;
- for whole-day delete, mark all active entries for the date with `deleted_at`;
- keep `workout_days` physically untouched for the MVP unless the schema review proves day-level deleted metadata is required.

Optional day-level field:

- `workout_days.deleted_at timestamptz null` can be considered later if the product needs a true deleted-day object or a day-level restore UI.

Why entry-level first:

- all Progress and MuscleMap facts come from entries;
- repeat copies entries;
- single delete maps naturally to one entry;
- whole-day delete can be implemented as a batch update of entries;
- preserving `workout_days` helps keep day notes and references stable.

Default active fact rule:

- active workout entry = `deleted_at is null`;
- deleted workout entry = `deleted_at is not null`;
- current diary, history, repeat source, Progress, and MuscleMap should use only active entries by default.

## Query And Runtime Impact

Later runtime packages will need updates in `src/services/workoutService.ts`.

### Read Paths

`getWorkoutEntries` / `getWorkoutEntriesPersisted`:

- persisted query should add `deleted_at is null`;
- local storage fallback should either store deleted entries and filter active entries on read, or store active entries separately with a small tombstone model;
- saving Supabase results to local cache should avoid reintroducing deleted rows into active UI.

`getWorkoutHistoryDays`:

- entry aggregation should include only entries where `deleted_at is null`;
- days with only deleted entries should not appear as active history days unless a future archive/restore view requests them.

`getWorkoutProgressObservations` and `getWorkoutProgressEntryDetails`:

- queries should include only `deleted_at is null`;
- Progress summary should not count deleted entries, sets, volume, exercise frequency, or muscle coverage.

Workout Diary MuscleMap:

- current day MuscleMap is built from active `workoutEntries`;
- once `getWorkoutEntries` filters deleted rows, the current map should exclude deleted facts automatically;
- regression tests should make this explicit.

### Write Paths

`deleteWorkoutEntry`:

- should become a soft-delete update against `workout_entries`;
- should set `deleted_at` and, if available, `deleted_by_user_id`;
- should still update local visible state to hide the entry;
- should still mark related AI training plan outdated.

`deleteWorkoutDay`:

- should fetch the selected day ID;
- should update all active `workout_entries` for that day with `deleted_at`;
- should not delete `workout_days` in the MVP;
- should clear active local visible state;
- should still mark related AI training plan outdated.

`copyWorkoutEntriesToDate`:

- should only see active source entries if `getWorkoutEntriesPersisted` filters deleted rows;
- should not copy deleted entries;
- should continue preserving snapshots and not copying user media.

`addExercisesToWorkout`:

- can continue adding new active entries;
- no special undelete behavior should be introduced unless product explicitly wants "add same exercise after delete" to restore the old row.

`updateWorkoutEntry`:

- should not update a soft-deleted entry from normal active UI;
- service-level guard should be considered if direct calls can target deleted rows.

### Local Fallback

The local/offline fallback needs an explicit decision:

- MVP simple path: local delete continues removing from active local list while persisted mode uses soft-delete.
- Safer semantic path: local entries gain an optional `deletedAt` field and active reads filter it out.

Recommended runtime package behavior:

- mirror soft-delete semantics locally with an optional local-only field such as `deletedAt`;
- keep active view filtering centralized so tests do not depend on raw storage layout;
- emit `workouts-synced` with active entries only.

## UI Impact

No UI change is required in this plan package.

Later UI package recommendations:

- keep action labels simple unless owner wants archive language;
- confirmation copy can remain deletion-oriented because the visible outcome is removal from the diary;
- after delete, rows disappear from active diary just like today;
- full-day delete still leaves the day visually empty;
- do not add restore UI in the MVP runtime change;
- add restore UI only after the schema/runtime behavior is stable.

Potential future restore UI:

- an archived/deleted entries view;
- restore single entry;
- restore all entries from a day;
- clear `deleted_at` and `deleted_by_user_id`;
- refresh diary/history/Progress caches.

## Tests Needed

### Service Tests

Add or update tests for:

- single entry delete updates `deleted_at` instead of calling physical `.delete()`;
- persisted single entry delete still marks the related training plan outdated;
- whole-day delete updates all active entries for the day instead of deleting `workout_days`;
- whole-day delete does not physically delete `workout_days`;
- local fallback hides a soft-deleted entry from active reads;
- local fallback emits active entries only;
- deleted entry is excluded from `getWorkoutEntries`;
- deleted entries are excluded from `getWorkoutHistoryDays`;
- deleted entries are excluded from `getWorkoutProgressObservations`;
- repeat does not copy deleted source entries;
- add after delete creates a new active entry rather than restoring the old row, unless product decides otherwise.

### Utility Tests

Update or add tests for:

- active-list filtering helper if introduced;
- "remove from visible list" utility can remain UI-only but should not be mistaken for persisted deletion semantics;
- whole-day visible clear remains an active-view operation, not a storage erase.

### Component / Page Tests

Add or update tests for:

- entry delete path hides the row after soft-delete success;
- whole-day delete shows empty active diary after soft-delete success;
- entry notes are not intentionally deleted by deleting the workout entry;
- day note UI behavior after whole-day delete matches the product decision;
- current Workout Diary MuscleMap no longer receives deleted rows;
- Progress page/service summary does not count deleted rows.

### Regression Tests To Preserve

Keep existing coverage around:

- add workout;
- edit entry;
- repeat workout;
- user exercise archive/restore;
- snapshot fields;
- Workout Progress facts-only calculations;
- MuscleMap key resolution.

## Migration / Phased Rollout

### Phase 0: Plan Only

Current package.

Deliverable:

- this report;
- no SQL;
- no runtime changes;
- no UI changes.

### Phase 1: SQL Draft Only

Recommended next package:

- `WORKOUT_DIARY_SOFT_DELETE_SQL_DRAFT_READY`

Deliverable:

- draft SQL only, not applied;
- add nullable `deleted_at`;
- consider nullable `deleted_by_user_id`;
- indexes for active reads if needed;
- RLS review for update rights;
- rollback notes;
- owner review checklist.

Do not apply to Supabase in this phase.

### Phase 2: Staging Apply And Service Filters

After owner approval:

- apply migration to staging only;
- update service queries to filter `deleted_at is null`;
- update delete methods to soft-delete;
- update local fallback semantics;
- run focused tests and staging smoke.

### Phase 3: UI Behavior And Regression Tests

After service behavior is stable:

- keep active UI behavior visually equivalent;
- update confirmation copy only if owner approves;
- add focused page/component tests;
- verify MuscleMap and Progress exclude deleted facts.

### Phase 4: Optional Restore UI

Later only:

- design restore entry point;
- show deleted entries in a separate restore-only context;
- clear `deleted_at` on restore;
- add restore tests and smoke.

### Phase 5: Cleanup Old Physical Delete Helpers

Later only:

- remove old physical delete code paths once soft-delete is proven;
- keep direct note/media delete actions separate;
- ensure no tests assert physical diary deletion.

## Risks

Progress risks:

- deleted entries may continue to count if any query misses the `deleted_at is null` filter;
- cached local rows can reintroduce deleted entries into active summaries.

History risks:

- history day summaries may show days with only deleted entries unless aggregation filters active rows;
- product may later want an archive history view, which should be separate from active history.

Repeat risks:

- repeat may copy deleted source entries if it reads unfiltered source rows;
- repeat modal options may need disabled/deleted semantics if future archive view exposes deleted rows.

Local fallback risks:

- local-only mode can diverge from persisted semantics if it keeps physical removal;
- local cache invalidation must not overwrite active filtering.

Notes/media risks:

- day notes may remain after a whole-day active delete; this is likely good for restore but needs product confirmation;
- entry notes and media should remain linked when the workout entry is soft-deleted;
- explicit note/media delete actions can remain physical because they are separate user actions.

DB/RLS risks:

- adding `deleted_at` requires RLS update permissions to be reviewed;
- active query indexes may be needed if history/progress queries grow;
- `deleted_by_user_id` should only be set to the authenticated user.

Test risks:

- existing tests intentionally assert physical removal and must be rewritten;
- source-string tests checking `.delete()` should be retired or inverted to assert `.update()`.

## What Not To Do Now

Do not:

- apply SQL;
- create a migration in this package;
- change runtime code;
- change UI copy or layout;
- mutate staging;
- touch production;
- rebuild MuscleMap;
- rebuild Workout Progress;
- add Premium workout write paths;
- add automatic diary writes from planned Premium workouts;
- add restore UI before the soft-delete contract is reviewed;
- delete old code aggressively before tests and staged verification.

## Recommended Next Package

Recommended next package:

- `WORKOUT_DIARY_SOFT_DELETE_SQL_DRAFT_READY`

Scope:

- draft SQL migration only;
- do not apply SQL;
- review fields, indexes, RLS impact, rollback, and test plan;
- keep MuscleMap and Workout Progress as regression consumers, not rebuild targets.

Follow-up package after SQL draft approval:

- `WORKOUT_DIARY_SOFT_DELETE_RUNTIME_PLAN_READY` or `WORKOUT_DIARY_SOFT_DELETE_RUNTIME_IMPLEMENTATION_READY`.

## Safety Confirmation

Confirmed for this package:

- plan/report-only;
- no runtime code changes;
- no UI changes;
- no Supabase SQL execution;
- no staging mutation;
- no production changes;
- no Premium writes;
- no DB schema changes;
- no RLS policy changes;
- no payment enforcement;
- no API keys;
- no secrets;
- no PR;
- no commit.

## Verification

- `git diff --check`
  - Result: passed.

## Final Verdict

**WORKOUT_DIARY_SOFT_DELETE_ARCHIVE_PLAN_READY**
