# Exercise Card / Media Foundation Audit

- Date: 2026-09-13
- Branch: `master`
- HEAD: `87ce2e4 improve workout progress exercise list mobile layout`
- Context: after `WORKOUT_PROGRESS_MVP_DONE`
- Target package: `EXERCISE_CARD_MEDIA_FOUNDATION_AUDIT`
- Verdict: **EXERCISE_CARD_MEDIA_FOUNDATION_AUDIT_READY**

## Scope

Audit the current Exercise Card and exercise media foundation after Workout Progress MVP completion.

This is audit/report-only. Runtime code was not changed, UI was not changed, SQL was not applied, Supabase was not queried or mutated, staging was not mutated, production was not touched, Premium write paths were not touched, DB schema/RLS were not changed, no PR was created, and no commit was created.

## Executive Summary

Exercise Card and media foundation already exists and is stronger than a blank slate:

- read-only Exercise Card exists in the exercise picker through `ExerciseListSheet` and `ExerciseDefinitionSheet`;
- workout-context exercise card exists through `WorkoutExerciseCardSheet`;
- local `exerciseContent` remains the MVP source of truth for technique text and reference images;
- DB foundation exists for future reference definitions/media through `exercise_definitions`, `exercise_definition_media`, and `exercise_definition_cards`;
- private user media foundation exists through `user_exercise_media` and private Storage bucket `user-exercise-media`;
- Workout Progress detail renders a separate `Фото/видео` block from user exercise media;
- prior reports mark Exercise Card MVP and user media upload/read-after-reload as production-ready for their original scope.

Main gaps:

- no fresh browser/mobile smoke was run in this package;
- reference DB definition/media tables are foundation/future and may be empty in production;
- reference videos are intentionally not part of the MVP because no validated reference video set exists;
- user exercise media is still entry-context-first, not exercise-wide gallery-first;
- lifecycle/FK risks remain around physical exercise deletion because definition/media tables still use cascade behavior in the schema foundation;
- soft-deleted workout entries are now excluded from Progress detail entry queries, which also means media attached only to deleted entries will not show in normal active Progress views until a future archive/restore/gallery view exists.

Recommended next small package:

- `EXERCISE_CARD_MEDIA_REGRESSION_SMOKE_READY`

Reason:

- the foundation is already implemented;
- the safest next move is not redesign, but a focused regression/smoke package covering the existing Exercise Card, workout card media, and Progress media surfaces after the recent Workout Progress and soft-delete work.

## Components And Pages Found

### Exercise Picker Card

Files:

- `src/components/ExerciseListSheet.tsx`
- `src/components/ExerciseDefinitionSheet.tsx`
- `src/services/exerciseService.ts`

Current behavior:

- tapping an exercise row opens `ExerciseDefinitionSheet`;
- `ExerciseListSheet` first sets the selected exercise as immediate render data;
- then calls `exerciseService.getExerciseDefinitionCard(exercise.id)`;
- `ExerciseDefinitionSheet` renders title, local/reference image, primary muscles, secondary muscles, MuscleMap, technique sections, fallback description/mistakes, and add-to-workout action;
- archived exercises can be shown in archived custom context but add-to-workout is disabled by caller state;
- reference video placeholders are intentionally not rendered.

### Workout Diary Exercise Card

Files:

- `src/pages/Workouts.tsx`
- `src/ui/components/ExerciseRow.tsx`
- `src/components/WorkoutExerciseCardSheet.tsx`
- `src/components/ExerciseMediaViewerOverlay.tsx`

Current behavior:

- current workout rows call `handleOpenWorkoutExerciseCard(entry.id)` from row open/media actions;
- `WorkoutExerciseCardSheet` renders current workout metric context;
- "Моя тренировка" block supports user photo/video upload for non-custom exercises;
- draft media preview exists before save;
- persisted media is listed by workout entry id;
- saved media is shown through signed URLs;
- delete media action removes DB row and Storage object through `userExerciseMediaService`;
- technique/reference details remain separate from user media.

### Workout Progress Exercise Detail

Files:

- `src/pages/ProgressWorkoutExercise.tsx`
- `src/components/WorkoutExerciseProgressView.tsx`
- `src/utils/workoutExerciseProgress.ts`
- `src/services/userExerciseMediaService.ts`

Current behavior:

- detail page loads active workout entry details through `workoutService.getWorkoutProgressEntryDetails`;
- matching entries are grouped by canonical exercise group key;
- media is loaded by matching workout entry IDs through `userExerciseMediaService.listWorkoutExerciseMediaForEntries`;
- `WorkoutExerciseProgressView` renders metric rows and a separate `Фото/видео` block;
- media is grouped by `workout_date` or fallback workout entry date;
- media empty state says the selected month has no photo/video for this exercise.

## Schema / Storage Files Found

Primary schema foundation:

- `supabase/migrations/20260409_exercise_definition_user_media_foundation.sql`

Tables/views:

- `public.exercise_definitions`
- `public.exercise_definition_media`
- `public.exercise_definition_cards`
- `public.user_exercise_media`

Storage:

- private bucket: `user-exercise-media`
- storage object policies:
  - select own by first path segment;
  - insert own by first path segment;
  - delete own by first path segment.

Service constants:

- bucket: `USER_EXERCISE_MEDIA_BUCKET = 'user-exercise-media'`;
- image max size: 10 MB;
- video max size: 50 MB;
- image types: `image/jpeg`, `image/png`, `image/webp`;
- video types: `video/mp4`, `video/quicktime`;
- signed URL TTL: 1 hour.

Important FK behavior from current schema foundation:

- `exercise_definitions.exercise_id -> exercises.id ON DELETE CASCADE`;
- `exercise_definition_media.exercise_id -> exercises.id ON DELETE CASCADE`;
- `user_exercise_media.user_id -> auth.users.id ON DELETE CASCADE`;
- `user_exercise_media.exercise_id -> exercises.id ON DELETE CASCADE`;
- `user_exercise_media.workout_entry_id -> workout_entries.id ON DELETE SET NULL`.

Assessment:

- `workout_entry_id ON DELETE SET NULL` matches media preservation after workout entry deletion;
- `exercise_id ON DELETE CASCADE` on user media remains a lifecycle risk if custom/system exercises are ever physically deleted;
- this risk was already called out in previous lifecycle reports and should remain a later hardening package, not part of this audit.

## Current "Фото/Видео" Usage

Workout Diary:

- `WorkoutExerciseCardSheet`
- label: `Загрузить фото/видео`;
- empty state: `Фото и видео для этого упражнения ещё не добавлены.`;
- persisted user media shown in workout exercise card.

Workout Progress detail:

- `WorkoutExerciseProgressView`
- section: `Фото/видео`;
- empty state: `За выбранный месяц для этого упражнения нет фото или видео.`;
- media grouped by progress date.

Exercise picker/detail:

- `ExerciseDefinitionSheet` shows reference image only;
- reference videos are intentionally hidden/not rendered;
- user media is not mixed into reference exercise card.

No broad app-wide media mixing was found in this audit.

## Existing Tests Found

Exercise Card:

- `src/components/__tests__/ExerciseDefinitionSheet.test.tsx`
- `src/components/__tests__/WorkoutExerciseCardSheet.test.tsx`
- `src/services/__tests__/exerciseService.test.ts`

User Exercise Media:

- `src/services/__tests__/userExerciseMediaService.test.ts`
- `src/utils/__tests__/workoutExerciseProgress.test.ts`
- `src/components/__tests__/WorkoutExerciseProgressView.test.tsx`

Covered behaviors include:

- read-only card content;
- no empty reference video placeholders;
- clean fallback empty states;
- MuscleMap in exercise card;
- workout exercise card technique/user-media separation;
- draft media selection/removal;
- persisted media load;
- read-after-write verification;
- upload timeout handling;
- file type/size validation;
- signed URL mapping;
- media grouping by date in progress detail.

## MVP Definition

### Read-Only Exercise Card MVP

MVP needs:

- exercise title;
- local/reference image when available;
- technique text from `exerciseContent`;
- fallback description/mistakes where available;
- primary/secondary muscles;
- MuscleMap when muscle keys are supported;
- clean empty states;
- no fake reference videos;
- no dependency on populated DB reference media.

Current status:

- implemented and previously production-smoke verified.

### User Photo/Video MVP

MVP needs:

- private user-owned upload from workout exercise card;
- image/video validation;
- private Storage bucket;
- DB row in `user_exercise_media`;
- read-after-write verification before success;
- signed URL rendering;
- read after reload;
- display in workout exercise card;
- display in Progress exercise detail for active completed facts.

Current status:

- implemented and previously production-smoke verified for current scope.

### Deferred

Defer:

- DB-backed reference definition/media population;
- reference videos;
- exercise-wide user media gallery;
- detached/deleted-entry media archive view;
- orphan Storage cleanup;
- media retention policy;
- FK/lifecycle hardening for `user_exercise_media.exercise_id`;
- admin tooling for reference media;
- Premium coach/media analysis.

## Gaps

Current gaps:

- no fresh browser/mobile smoke after the recent Workout Progress and soft-delete packages;
- no current production read-only schema verification in this audit;
- no exercise-wide gallery for media detached from a deleted workout entry;
- no restore/archive media view for soft-deleted workout facts;
- no fresh check that production `exercise_definition_cards` remains populated and reference media remains empty/expected;
- no Storage orphan cleanup or retention policy;
- no DB-backed reference content seed/import plan for `exercise_definitions` and `exercise_definition_media`;
- no reference video product/design contract beyond "do not render fake placeholders".

## Risks

Data lifecycle risks:

- physical exercise deletion can cascade user media through `user_exercise_media.exercise_id`;
- reference definition/media rows cascade with exercises, which is acceptable for true catalog purge but risky if catalog cleanup is ever broad;
- soft-deleted workout entries are excluded from normal Progress detail, so media attached only to deleted entries will be hidden from active Progress unless a later archive/gallery surface is added.

Storage risks:

- true orphan Storage objects need a later conservative cleanup design;
- Storage backup/restore consistency with `user_exercise_media.file_path` remains an operational concern;
- signed URLs are temporary, so UI must continue regenerating them on read.

Product risks:

- mixing reference media and user media would confuse technique guidance vs personal workout evidence;
- adding reference videos before real content exists would create empty/noisy UI;
- changing media limits from per-exercise to per-entry would require an explicit DB trigger decision.

## Minimal Next Package

Recommended next package:

- `EXERCISE_CARD_MEDIA_REGRESSION_SMOKE_READY`

Scope:

- no redesign;
- no SQL;
- no DB/storage mutation unless owner explicitly asks for a test upload smoke;
- run focused tests for:
  - `ExerciseDefinitionSheet`;
  - `WorkoutExerciseCardSheet`;
  - `WorkoutExerciseProgressView`;
  - `userExerciseMediaService`;
  - `workoutExerciseProgress`;
  - `exerciseService`;
- optionally perform manual/browser smoke using a safe test workout:
  - open Exercise Card from picker;
  - open Workout Exercise Card from diary;
  - verify user media empty state;
  - verify upload/read if owner approves mutation with a test user;
  - verify Progress detail media empty state/read path.

Reason:

- the foundation is already implemented;
- regression confidence is the safest next step before any new media/gallery/schema work.

## Owner Approval Needed

Owner approval is required for:

- any production/staging media upload smoke;
- any SQL/schema/storage policy change;
- DB-backed reference content import;
- reference video support;
- exercise-wide media gallery;
- orphan cleanup or retention policy;
- FK lifecycle hardening around `user_exercise_media.exercise_id`;
- Premium media coaching or AI analysis.

## What Not To Do Now

Do not:

- redesign Exercise Card;
- mix user media into reference media;
- add fake reference video UI;
- apply SQL;
- mutate Supabase/staging/production;
- change Storage policies;
- change Premium write paths;
- add coach/media AI;
- run cleanup jobs;
- hard-delete media or workout facts.

## Verification

- `git diff --check`
  - Result: passed.

## Final Verdict

**EXERCISE_CARD_MEDIA_FOUNDATION_AUDIT_READY**
