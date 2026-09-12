# Workout Diary FREE Foundation Current-State Audit

- Date: 2026-09-11
- Branch: `master`
- HEAD: `c2d0d4b plan workout diary free premium backlog`
- Source plan: `reports/workout-diary-free-premium-backlog-current-state-plan-2026-09-11.md`
- Target package: `WORKOUT_DIARY_FREE_FOUNDATION_CURRENT_STATE_AUDIT`
- Verdict: **WORKOUT_DIARY_FREE_FOUNDATION_CURRENT_STATE_AUDIT_READY**

## Scope

Read-only current-state audit of the Workout Diary FREE foundation after the FREE/PREMIUM backlog plan was committed.

This audit checks current routes/pages, components, service/data boundaries, user exercise lifecycle, snapshot/history assumptions, existing tests, existing reports, and the current FREE/PREMIUM separation.

This is audit/report-only. Runtime code was not changed, UI was not changed, Supabase SQL was not executed, staging was not mutated, production was not touched, Premium write paths were not touched, DB schema/RLS were not changed, API keys/secrets were not used, no PR was created, and no commit was created.

## Executive Summary

The Workout Diary FREE foundation is in a strong current state for the previously implemented MVP scope.

Current state:

- main Workout Diary route and history route exist and are protected;
- create/add workout flow exists through category selection, exercise list, selected-exercises editor, and `workoutService.addExercisesToWorkout`;
- edit workout entry flow exists through `EditWorkoutEntryModal` and `workoutService.updateWorkoutEntry`;
- delete single entry and delete workout day flows exist;
- repeat workout flow exists from history and is backed by `workoutService.copyWorkoutEntriesToDate`;
- user exercises have create/edit/archive/restore service and UI paths;
- active custom exercises are separated from archived custom exercises;
- archived custom exercises are blocked for add/repeat until restore;
- workout entry snapshots exist and are written on add/repeat;
- Workout Diary MuscleMap and Workout Progress MuscleMap are already implemented and covered by audit/regression tests;
- targeted local workout tests passed: 209/209.

Main gaps:

- no fresh interactive browser smoke was completed in this package;
- current audit is local/static plus targeted tests, not production/staging verification;
- whole-workout edit is intentionally absent/removed from the current main screen, so "Edit workout" as a day-level flow is not a current green feature;
- lifecycle still includes physical delete paths for workout entries/days, which are known destructive FREE diary actions and should remain product-confirmed;
- exercise catalog quality is well-tested in filters/mapping, but broader catalog duplicate/missing-metadata correction still needs a dedicated audit before data changes.

Recommended next implementation package:

- `WORKOUT_DIARY_REGRESSION_TEST_GAPS_READY`

Reason:

- the current foundation is not blocked by an obvious runtime defect;
- many service/utils tests are green;
- the safest next small package is to close the remaining UI/regression smoke gaps before deeper lifecycle/catalog work.

## Files Reviewed

Routes/pages:

- `src/App.tsx`
- `src/pages/Workouts.tsx`
- `src/pages/WorkoutHistory.tsx`
- `src/pages/ProgressWorkouts.tsx`
- `src/pages/ProgressWorkoutExercise.tsx`
- `src/pages/Progress.tsx`
- `src/pages/MuscleMapDemo.tsx`
- `src/pages/ImportExercises.tsx`

Components:

- `src/components/ExerciseCategorySheet.tsx`
- `src/components/ExerciseListSheet.tsx`
- `src/components/SelectedExercisesEditor.tsx`
- `src/components/CreateExerciseModal.tsx`
- `src/components/EditWorkoutEntryModal.tsx`
- `src/components/RepeatWorkoutModal.tsx`
- `src/components/WorkoutHistoryDayDetails.tsx`
- `src/components/WorkoutHistoryList.tsx`
- `src/components/WorkoutEntryCard.tsx`
- `src/components/WorkoutExerciseCardSheet.tsx`
- `src/components/WorkoutExerciseProgressView.tsx`
- `src/components/WorkoutProgressList.tsx`
- `src/components/WorkoutDayNoteBlock.tsx`
- `src/components/WorkoutEntryNoteComposer.tsx`
- `src/components/WorkoutEntryInlineNote.tsx`
- `src/components/muscle-map/MuscleMap.tsx`
- `src/components/muscle-map/MuscleMapSvg.tsx`
- `src/ui/components/ExerciseRow.tsx`
- `src/ui/components/ExerciseTableHeader.tsx`

Services/data/utils:

- `src/services/workoutService.ts`
- `src/services/exerciseService.ts`
- `src/services/workoutProgressService.ts`
- `src/services/userExerciseMediaService.ts`
- `src/services/workoutDayNotesService.ts`
- `src/services/workoutEntryNotesService.ts`
- `src/utils/workoutAddFlowNavigation.ts`
- `src/utils/workoutDiaryMutations.ts`
- `src/utils/workoutEditorState.ts`
- `src/utils/workoutEntryMetric.ts`
- `src/utils/workoutExerciseProgress.ts`
- `src/utils/workoutHistoryRange.ts`
- `src/utils/workoutHistorySelection.ts`
- `src/utils/workoutHistoryUi.ts`
- `src/utils/workoutInputValidation.ts`
- `src/utils/workoutMainScreenActions.ts`
- `src/utils/workoutMuscleKeyResolver.ts`
- `src/utils/workoutProgress.ts`
- `src/utils/workoutProgressCache.ts`
- `src/utils/workoutProgressPeriod.ts`
- `src/utils/repeatWorkoutFlow.ts`
- `src/utils/exerciseListFilters.ts`
- `src/utils/exerciseContentLookup.ts`
- `src/data/exerciseContent.ts`
- `src/data/exercisesSeed.ts`
- `src/data/muscles/types.ts`
- `src/data/muscles/muscleLabels.ts`
- `src/data/muscles/muscleMapRegions.ts`

Reports:

- `reports/workout-diary-progress-mvp-final-status-2026-07-25.md`
- `reports/workout-muscle-map-progress-visual-smoke-2026-08-15.md`
- `reports/workout-block-release-readiness-audit-2026-07-29.md`
- `reports/workout-lifecycle-hardening-audit-2026-07-27.md`
- `reports/workout-lifecycle-phase-1a-final-status-2026-07-29.md`
- `reports/workout-progress-ux-logic-readiness-audit-2026-07-30.md`
- `reports/user-exercise-archive-final-status-2026-07-27.md`
- `reports/user-exercise-restore-ui-final-status-2026-07-29.md`
- `reports/user-exercise-media-upload-smoke-final-status-2026-07-27.md`
- `reports/exercise-card-mvp-final-status-2026-07-27.md`
- `reports/exercise-catalog-new-user-bootstrap-fix-2026-08-01.md`

## Routes / Pages Found

### Workout Diary

Route:

- `/workouts`

Page:

- `src/pages/Workouts.tsx`

Current behavior:

- protected route;
- selected date from router state or today's date;
- quick week calendar and inline calendar;
- current workout list;
- empty/loading/error/offline/partial states;
- add workout entry flow;
- entry edit flow;
- single entry delete;
- full day workout delete;
- workout day notes;
- workout entry notes;
- current workout MuscleMap under the workout list when muscles resolve;
- bottom actions for history, add, and workout progress.

### Workout History / Repeat

Route:

- `/workouts/history`

Page:

- `src/pages/WorkoutHistory.tsx`

Current behavior:

- protected route;
- date selection with bounded history range;
- persisted read path through `workoutService.getWorkoutEntriesPersisted`;
- details rendered by `WorkoutHistoryDayDetails`;
- repeat entry point shown when selected historical day has entries;
- repeat uses `RepeatWorkoutModal`;
- repeat save calls `runRepeatWorkoutCopy` with `workoutService.copyWorkoutEntriesToDate`;
- repeat result navigates back to `/workouts` with selected date.

### Workout Progress

Routes:

- `/progress`
- `/progress/workouts`
- `/progress/workouts/:exerciseGroupKey`

Pages:

- `src/pages/Progress.tsx`
- `src/pages/ProgressWorkouts.tsx`
- `src/pages/ProgressWorkoutExercise.tsx`

Current behavior:

- progress hub links to Workout Progress;
- Workout Progress has period options and summary;
- Progress MuscleMap is built from `workoutProgressService.getWorkoutProgressSummary`;
- exercise progress rows are built from observations through `buildWorkoutProgressList`;
- detail route renders per-exercise progress with history/media context.

### Exercise Selection / User Exercises

The exercise selection flow is in-modal/sheet-based under `/workouts`:

- `ExerciseCategorySheet`;
- `ExerciseListSheet`;
- `SelectedExercisesEditor`;
- `CreateExerciseModal`.

User exercise handling:

- "Мои упражнения" category is represented in `Workouts.tsx` as a synthetic custom category;
- active/archived tabs are supported in `ExerciseListSheet`;
- create/edit custom exercise opens `CreateExerciseModal`;
- archive/restore actions call `exerciseService`.

### MuscleMap Usage

Workout context:

- `Workouts.tsx` builds current workout muscles through `buildCurrentWorkoutMuscleMapMuscles`;
- renders `src/components/muscle-map/MuscleMap` in the current workout card.

Progress context:

- `ProgressWorkouts.tsx` builds map muscles from workout summary muscle coverage;
- renders the same MuscleMap component for period coverage.

Dev context:

- `/dev/muscle-map` renders `MuscleMapDemo`.

## Components Found

### Diary / List Components

- `ExerciseRow`: row surface for workout entries.
- `ExerciseTableHeader`: compact workout table header.
- `WorkoutDayNoteBlock`: day-level note display.
- `WorkoutEntryInlineNote`: entry note display.
- `WorkoutEntryNoteComposer`: entry note editor.

Assessment:

- current diary list supports loading, empty, error/offline/partial, current entries, notes, edit, delete, media/card open, and current MuscleMap rendering;
- focused tests exist for row/layout and note utilities/components, but no fresh browser smoke was completed in this audit.

### Workout Form / Add Flow Components

- `ExerciseCategorySheet`;
- `ExerciseListSheet`;
- `SelectedExercisesEditor`;
- `CreateExerciseModal`;
- `EditWorkoutEntryModal`.

Assessment:

- create/add is a multi-step in-modal flow;
- selected exercises editor supports per-row metric types and units;
- validation blocks empty/zero/suspicious values;
- edit entry modal validates parsed values before save callback;
- current main screen no longer has a day-level whole-workout edit action.

### Exercise Picker / User Exercise Components

- `ExerciseCategorySheet`: category entry and My Exercises entry.
- `ExerciseListSheet`: search/filter/list/select/edit/archive/restore behavior.
- `CreateExerciseModal`: create/edit custom exercise surface.
- `ExerciseDefinitionSheet` and `WorkoutExerciseCardSheet`: exercise card/reference/user-media surfaces.

Assessment:

- custom exercise active/archived tabs exist;
- active list hides archived rows;
- archived list shows restore and no add selection footer;
- system exercises do not expose custom edit/archive entry points.

### MuscleMap / Progress Components

- `MuscleMap`;
- `MuscleMapSvg`;
- `WorkoutProgressList`;
- `WorkoutExerciseProgressView`;
- `WorkoutProgressMonthPicker`.

Assessment:

- MuscleMap is already implemented in workout diary and progress contexts;
- this package treats MuscleMap and Workout Progress as audit/regression only.

## Services / Data Layer Found

### `workoutService`

Important paths:

- `getWorkoutEntries`;
- `getWorkoutEntriesPersisted`;
- `getOrCreatePersistedWorkoutDay`;
- `addExercisesToWorkout`;
- `copyWorkoutEntriesToDate`;
- `updateWorkoutEntry`;
- `deleteWorkoutEntry`;
- `deleteWorkoutDay`;
- `getWorkoutHistoryDays`;
- `getWorkoutProgressObservations`;
- snapshot helpers such as `buildWorkoutEntrySnapshotFields`.

Current behavior:

- uses Supabase when available and local storage fallback for local/offline behavior;
- writes workout day rows through upsert by `user_id,date`;
- writes workout entries with idempotency keys;
- supports metric schema fallback when `metric_type` columns are unavailable;
- normalizes metric type/unit/value;
- writes snapshot fields on add and repeat:
  - `exercise_name_snapshot`;
  - `exercise_category_id_snapshot`;
  - `exercise_category_name_snapshot`;
  - `canonical_exercise_id_snapshot`;
  - `primary_muscles_snapshot`;
  - `secondary_muscles_snapshot`;
  - `muscles_snapshot`;
- blocks archived custom exercises before add/repeat;
- delete entry/day paths still physically delete diary rows.

History assumptions:

- snapshot-first fields are present in current code;
- read/progress paths prefer snapshots where available;
- old entries without snapshots have live exercise/content fallback.

### `exerciseService`

Important paths:

- `getCategories`;
- `getExercisesByCategory`;
- `searchExercises`;
- `getCustomExercises`;
- `getArchivedCustomExercises`;
- `createCustomExercise`;
- `updateCustomExercise`;
- `archiveCustomExercise`;
- `restoreCustomExercise`;
- helper guards:
  - `canEditCustomExercise`;
  - `canDeleteCustomExercise`;
  - `canArchiveCustomExercise`;
  - `canRestoreCustomExercise`;
  - `isArchivedExercise`;
  - `isActiveExercise`.

Current behavior:

- shared exercise categories and core exercises are read paths;
- custom exercises are scoped to current session user;
- active custom list filters `archived_at is null`;
- archived custom list filters `archived_at is not null`;
- category/search paths filter archived rows;
- UI and service guards check `is_custom` and `created_by_user_id`.

### `workoutProgressService`

Important paths:

- `getWorkoutProgressSummary`;
- `buildWorkoutProgressSummaryFromEntries`;
- summary coverage helpers.

Current behavior:

- counts workout dates, exercises, sets, volume;
- calculates muscle coverage, top muscles, and undertrained muscles;
- uses snapshot muscles before live/content fallback;
- excludes cardio pseudo-muscle from visible coverage;
- unknown exercises fail safely.

### User Exercise Media / Notes

Related services:

- `userExerciseMediaService`;
- `workoutDayNotesService`;
- `workoutEntryNotesService`.

Current behavior:

- user exercise media is tied to `user_id`, `exercise_id`, and workout execution context where available;
- repeat workout does not copy media rows;
- day and entry notes are separate workout diary adjuncts.

## Existing Tests Found

### Workout Diary / Service

`src/services/__tests__/workoutService.test.ts`

Status: exists / strong service coverage.

Covers:

- single entry delete in local-only mode;
- whole day delete in local-only mode;
- day-level cascade contract for persisted path;
- edit updates only workout entry;
- metric type save/edit behavior;
- failed delete/edit does not mutate local state without persistence context;
- update patch behavior for weight/none/distance;
- metric schema cache/fallback behavior;
- snapshot fields for canonical exercise names and muscles;
- add exercises writes snapshot fields;
- add blocks archived custom exercises before local write;
- same exercise can be added again as a new entry;
- retry of same add operation is idempotent;
- progress observations mapping;
- snapshot name before live exercise name;
- repeat creates target entries;
- repeat blocks archived custom exercise;
- repeat preserves source historical day;
- repeat preserves sets/reps/weight;
- repeat does not replace target entries with same exercise;
- repeat does not copy user exercise media rows;
- workout history summary aggregation.

Gaps:

- no live Supabase/staging test in this package;
- no full browser add/edit/delete/repeat smoke in this package.

### Exercise Service / User Exercises

`src/services/__tests__/exerciseService.test.ts`

Status: exists / strong service and local fallback coverage.

Covers:

- view/direct row muscle mapping;
- local category fallback;
- user-owned custom exercises;
- active archived filtering;
- archived custom list;
- category/search filtering of archived exercises;
- custom muscles preserved;
- owner-only edit/delete/archive/restore guards;
- system exercise cannot be edited/deleted through custom path;
- edit replaces muscle links;
- definition card fallback behavior.

Gaps:

- no live RLS verification in this package;
- no fresh owner browser smoke for create/edit/archive/restore in this package.

### Workout Progress / MuscleMap

Files:

- `src/services/__tests__/workoutProgressService.test.ts`
- `src/pages/__tests__/ProgressWorkouts.test.ts`
- `src/utils/__tests__/workoutProgress.test.ts`
- `src/utils/__tests__/workoutProgressPeriod.test.ts`
- `src/utils/__tests__/workoutMuscleKeyResolver.test.ts`
- `src/utils/__tests__/muscleMap.test.ts`
- `src/components/__tests__/MuscleMap.test.tsx`

Status: exists / strong audit-regression coverage.

Covers:

- total exercises and sets;
- primary/secondary muscle weighting;
- mixed entries and top muscles;
- missing/undertrained muscles;
- unknown exercises safe handling;
- custom exercise linked muscle fallback;
- snapshot muscle precedence;
- old entries without snapshot fallback;
- cardio-only behavior;
- Progress recommendation states;
- Progress period labels;
- same-day best-row aggregation;
- time/distance display and base-unit comparisons;
- MuscleMap key normalization, invalid-key safety, and front/back split.

Gaps:

- no fresh production visual smoke in this package;
- broader catalog quality still needs data-oriented audit before correction batches.

### Workout Pages / Components

Files:

- `src/pages/__tests__/Workouts.test.ts`
- `src/pages/__tests__/WorkoutHistory.test.ts`
- `src/components/__tests__/ExerciseListSheet.test.tsx`
- `src/components/__tests__/SelectedExercisesEditor.test.tsx`
- `src/components/__tests__/RepeatWorkoutModal.test.tsx`
- `src/components/__tests__/EditWorkoutEntryModal.test.tsx`
- `src/components/__tests__/WorkoutHistoryReadSide.test.tsx`
- `src/components/__tests__/WorkoutExerciseCardSheet.test.tsx`
- `src/components/__tests__/ExerciseDefinitionSheet.test.tsx`
- `src/components/__tests__/CreateExerciseModal.test.tsx`

Status: exists / focused component and utility coverage.

Covers:

- current workout MuscleMap builder;
- whole-workout edit action removed;
- catalog category filtering;
- repeat snapshot source/target behavior;
- ExerciseList custom active/archive UI;
- archive/restore controls;
- selection contract and dedupe;
- muscle filters;
- selected exercises editor validation and layout;
- repeat modal subset/date/archived disabling;
- edit workout entry validation;
- exercise card and definition fallbacks.

Gaps:

- no single full-page integration test that clicks from `/workouts` through category/list/editor/save with mocked services;
- no fresh mobile browser smoke in this package;
- no current authenticated manual smoke for all old production-ready flows.

## Existing Reports Found

### Ready / Production-Ready / Smoke-Ready

- `reports/workout-diary-progress-mvp-final-status-2026-07-25.md`
  - Verdict: `WORKOUT_DIARY_PROGRESS_MVP_READY`.
  - Marked Workout Diary + Workout Progress MVP production-ready for current scope.
  - Confirmed add/edit/delete/repeat, idempotent add, delete-day cascade contract, Progress aggregation, tests/build, and production smoke.

- `reports/workout-muscle-map-progress-visual-smoke-2026-08-15.md`
  - Verdict: `WORKOUT_MUSCLE_MAP_PROGRESS_VISUAL_SMOKE_READY`.
  - Marked Workout Diary MuscleMap and Progress MuscleMap smoke-ready.
  - Confirmed owner screenshots, local targeted tests, build, and no blockers.

- `reports/workout-block-release-readiness-audit-2026-07-29.md`
  - Verdict: `WORKOUT_BLOCK_RELEASE_READY`.
  - Consolidated readiness for Workout Diary, Workout Progress, Exercise Card, user exercise media, custom exercise archive, repeat workout, and lifecycle hardening.

- `reports/workout-lifecycle-phase-1a-final-status-2026-07-29.md`
  - Verdict: `WORKOUT_LIFECYCLE_PHASE_1A_PRODUCTION_READY`.
  - Confirmed production FK change for `workout_entries.exercise_id` from cascade to restrict, archived repeat UX, and no media copy on repeat.

- `reports/user-exercise-archive-final-status-2026-07-27.md`
  - Verdict: `USER_EXERCISE_ARCHIVE_PRODUCTION_READY`.
  - Confirmed DB-backed archive, active list hiding archived rows, history/progress/media intact, repeat blocked.

- `reports/user-exercise-restore-ui-final-status-2026-07-29.md`
  - Verdict: `USER_EXERCISE_RESTORE_UI_PRODUCTION_READY`.
  - Confirmed active/archive tabs and restore flow production-ready.

- `reports/user-exercise-media-upload-smoke-final-status-2026-07-27.md`
  - Verdict: `USER_EXERCISE_MEDIA_UPLOAD_READ_AFTER_RELOAD_PASS`.
  - Confirmed upload, row insert, read-after-write, read-after-reload, and signed URL render.

- `reports/exercise-card-mvp-final-status-2026-07-27.md`
  - Verdict: `EXERCISE_CARD_MVP_PRODUCTION_READY`.
  - Confirmed Exercise Card MVP and separation between reference media and user media.

- `reports/workout-progress-ux-logic-readiness-audit-2026-07-30.md`
  - Verdict: `WORKOUT_PROGRESS_AUDIT_READY`.
  - Confirmed current Workout Progress entry points and recommended UX cleanup.

- `reports/exercise-catalog-new-user-bootstrap-fix-2026-08-01.md`
  - Verdict: `EXERCISE_CATALOG_BOOTSTRAP_RUNTIME_FIX_READY`.
  - Confirmed global startup no longer tries to client-write shared exercise categories.

### Blocked / Requires Follow-Up

- `reports/workout-lifecycle-hardening-audit-2026-07-27.md`
  - Verdict: `WORKOUT_LIFECYCLE_HARDENING_REQUIRES_PHASED_DB_AND_RUNTIME_WORK`.
  - Earlier audit identified FK/delete cascade risks and snapshot-first hardening needs.
  - Phase 1A later addressed the highest-risk `workout_entries.exercise_id` cascade issue.

### Requires Repeat Verification

Repeat verification is recommended for:

- current mobile browser smoke for `/workouts`;
- create/add/edit/delete/repeat flows in the current build;
- archive/restore user exercise UI in the current build;
- MuscleMap and Workout Progress visual smoke after future layout changes;
- catalog quality after any future data correction batch.

## FREE / PREMIUM Boundary Confirmation

FREE current foundation:

- manual workout diary;
- user-owned workout facts;
- custom exercises;
- current workout facts;
- workout history;
- repeat completed workouts;
- Workout Progress based on completed facts;
- MuscleMap based on completed workout entries and snapshots.

PREMIUM future boundary:

- planned workout recommendations;
- guided actions such as `Выполнено`, `Не подходит`, `Сделать проще`, `Заменить тренировку`, `Заменить упражнение`;
- weekly check-in;
- AI/media coaching later.

Confirmed:

- this audit found no new Premium workout write path being introduced;
- Workout Progress and MuscleMap are fact/audit-regression surfaces, not planned-workout builders;
- future Premium planned workouts must remain separate from completed diary facts.

## Already Implemented / Audit-Only Confirmation

Workout MuscleMap:

- already implemented in Workout Diary and Progress contexts;
- current package treats it as audit/regression only;
- no new MuscleMap implementation is recommended.

Workout Progress MVP:

- already implemented;
- current package treats it as audit/regression only;
- no new Workout Progress MVP implementation is recommended.

Exercise Card:

- previously marked production-ready;
- verify only when relevant to exercise card/media flows.

User Exercise Media:

- previously production-smoke verified;
- repeat contract remains no media copy.

User Exercise Archive / Restore:

- previously production-ready;
- current audit confirms code paths and tests remain present.

## FREE Current-State Matrix

| Area | Status | Evidence | Gap / Note |
| --- | --- | --- | --- |
| Create workout | Green | Add flow exists through category/list/editor and `addExercisesToWorkout`; targeted service/component tests pass. | Needs fresh browser smoke in current build. |
| Edit workout | Partial | Entry-level edit exists through `EditWorkoutEntryModal` and `updateWorkoutEntry`. | Day-level whole-workout edit action is absent/removed; clarify product meaning before planning a new edit surface. |
| Repeat workout | Green | History repeat flow, modal, utility, and service tests pass; archived custom exercises blocked. | Needs fresh browser smoke in current build. |
| Delete/archive workout | Partial | Single entry delete and whole day delete exist and are tested; destructive confirmation exists. | Physical delete remains product-destructive; no workout archive model observed. |
| Add exercise | Green | Exercise category/list/editor flow exists; add service writes snapshots and supports idempotency. | Needs fresh full-flow UI smoke. |
| Edit sets/reps/weight/time/distance | Green | Metric editor and service update tests cover weight/bodyweight/time/distance and validation. | Needs browser smoke for visible editor ergonomics. |
| User exercise create/edit | Green | `CreateExerciseModal`, service guards, and tests exist. | Needs current authenticated manual smoke if owner wants release sign-off. |
| User exercise archive/restore | Green | Active/archive tabs, archive/restore service paths, guards, and tests exist; prior production reports ready. | Needs repeat verification after future changes. |
| Owner-only visibility | Green | `created_by_user_id` guards and custom list filtering exist in service/tests. | No live RLS test run in this package. |
| MuscleMap in workout | Audit-only green | Already implemented; current workout map builder tests pass; prior visual smoke ready. | No new implementation; repeat visual smoke only as needed. |
| Workout Progress MVP | Audit-only green | Progress service/page/utils tests pass; prior MVP status ready. | No new implementation; test gaps only around live/manual smoke. |
| Exercise catalog filters | Green / partial | Search/muscle/category filters and content mapping tests pass. | Broader duplicate/missing-metadata catalog quality audit remains separate. |
| Empty states | Partial | Workout diary empty copy, history empty state, archived empty state, progress empty recommendation tested in parts. | No end-to-end empty-state browser smoke in this package. |
| Mobile smoke | Unknown | Layout tests include 320px checks for selected exercises editor. | No controllable browser/mobile smoke was run in this package. |

## Blockers

No implementation blockers found in the read-only audit.

Smoke blocker:

- no interactive browser smoke was completed in this package, so current visual/manual status remains unverified for the full end-to-end flow.

## Non-Blockers

- Whole-workout edit should not be called green without a product decision; current code intentionally has no main whole-workout edit action.
- Physical delete of workout entries/day exists; this may be acceptable for current FREE diary but should be product-confirmed before lifecycle hardening.
- Local/offline fallback is present, but this audit did not validate sync reconciliation beyond targeted tests.
- Some prior reports reference production/manual checks from July/August; they are valuable context but not fresh September smoke.
- Build/test logs show expected missing Supabase env warnings in local test mode; tests still pass.

## Test Gaps

Required before the next release-level sign-off:

- UI integration test or browser smoke for `/workouts` add flow from add button to saved entries;
- UI smoke for entry edit and delete;
- UI smoke for repeat from `/workouts/history`;
- UI smoke for custom exercise create/edit/archive/restore;
- UI smoke for current workout MuscleMap and Progress MuscleMap in the current build.

Optional but useful:

- focused page-level test that mocks services and clicks through Workouts category/list/editor save;
- test for day-level delete confirmation and state refresh;
- test for workout day/entry notes around add/delete/update paths.

## Visual Smoke Gaps

Not completed in this package:

- desktop browser smoke;
- mobile browser smoke;
- owner authenticated smoke;
- screenshot capture.

Reason:

- the package was primarily read-only static/local audit;
- no staging/production mutation was allowed;
- no browser backend was requested as a requirement for this report.

## Lifecycle / History Gaps

Current safe pieces:

- snapshot fields exist and are written on add/repeat;
- progress prefers snapshots where available;
- archived custom exercises are blocked for new add/repeat;
- Phase 1A prior report says `workout_entries.exercise_id` production FK was hardened to `ON DELETE RESTRICT`.

Remaining audit questions for later:

- should workout entry/day delete remain physical delete or move toward soft-delete/archive;
- are day notes and entry notes lifecycle rules exactly what product wants after delete;
- should any remaining exercise/catalog FK paths use `RESTRICT` or `SET NULL`;
- should historical progress be fully snapshot-backed for all display fields, not just key exercise/muscle fields.

## User Exercise Gaps

Current safe pieces:

- owner-only service guards;
- active/archived split;
- archive/restore service paths;
- archived exercise blocked for add/repeat;
- user exercise media contract is documented and previously smoke-verified.

Remaining gaps:

- fresh authenticated browser smoke for create/edit/archive/restore;
- review whether old direct delete custom exercise path should remain exposed anywhere;
- broader media retention/deletion policy is deferred.

## Catalog Quality Gaps

Current safe pieces:

- category/search/muscle filtering tests pass;
- dedupe helpers exist;
- content mapping tests ensure shown category filters have at least one exercise;
- MuscleMap supported keys and content keys are checked.

Remaining gaps:

- no fresh catalog data quality report listing missing muscle mappings;
- no duplicate/conflict correction batch prepared in this package;
- no SQL/RLS/catalog data changes were made or recommended for immediate application.

## Recommended Next Package

Recommended next package:

- `WORKOUT_DIARY_REGRESSION_TEST_GAPS_READY`

Scope:

- report and close the highest-value current regression gaps with focused tests/smoke only;
- do not redesign Workout Diary;
- do not start Premium planned workout writes;
- do not rebuild MuscleMap or Workout Progress;
- choose a small set:
  - Workouts page add flow smoke/test;
  - entry edit/delete smoke/test;
  - repeat workout smoke/test;
  - user exercise archive/restore smoke/test.

Why this package first:

- core services and utility coverage are already green;
- user exercise archive/lifecycle has previous production-ready context;
- a regression/smoke gap package lowers risk before deeper lifecycle or catalog changes.

Defer:

- `USER_EXERCISE_ARCHIVE_HARDENING_READY` until regression gaps confirm current UI remains healthy;
- `WORKOUT_LIFECYCLE_SNAPSHOT_HARDENING_READY` until product confirms delete/archive lifecycle direction;
- `EXERCISE_CATALOG_QUALITY_AUDIT_READY` until diary regression state is captured.

## Verification

- `npx tsx --test src/services/__tests__/workoutService.test.ts src/services/__tests__/exerciseService.test.ts src/services/__tests__/workoutProgressService.test.ts src/pages/__tests__/Workouts.test.ts src/pages/__tests__/WorkoutHistory.test.ts src/pages/__tests__/ProgressWorkouts.test.ts src/components/__tests__/ExerciseListSheet.test.tsx src/components/__tests__/SelectedExercisesEditor.test.tsx src/components/__tests__/RepeatWorkoutModal.test.tsx src/components/__tests__/EditWorkoutEntryModal.test.tsx src/utils/__tests__/repeatWorkoutFlow.test.ts src/utils/__tests__/workoutProgress.test.ts src/utils/__tests__/muscleMap.test.ts src/utils/__tests__/exerciseListFilters.test.ts`
  - Result: passed, 209 tests.
  - Note: local test logs included expected missing Supabase env warnings; no secrets were requested and no Supabase SQL was executed.
- `git diff --check`
  - Result: passed.

## Safety Confirmation

Confirmed for this package:

- audit/report-only;
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

## Final Verdict

**WORKOUT_DIARY_FREE_FOUNDATION_CURRENT_STATE_AUDIT_READY**
