# Workout Diary Free/Premium Backlog Current-State Plan

- Date: 2026-09-11
- Branch: `master`
- HEAD: `f65bcaf test optional brand in custom product flow`
- Target package: `WORKOUT_DIARY_FREE_PREMIUM_BACKLOG_CURRENT_STATE_PLAN`
- Verdict: **WORKOUT_DIARY_FREE_PREMIUM_BACKLOG_CURRENT_STATE_PLAN_READY**

## Scope

Prepare the current-state audit and backlog plan for the next Workout Diary block after the current nutrition package. This plan separates FREE and PREMIUM workout scope and applies the owner correction: Workout MuscleMap and Workout Progress MVP are already implemented and must not be planned as new feature builds.

This is plan/report-only. Runtime code was not changed, UI was not changed, Supabase SQL was not executed, staging was not mutated, production was not touched, Premium write paths were not touched, DB schema/RLS were not changed, and no PR/commit was created.

## 1. Executive Summary

The current nutrition block is closed enough to move planning focus to Workout Diary.

Next focus:

- stabilize and audit the current Workout Diary;
- clearly separate FREE diary ownership from PREMIUM guided training;
- avoid rebuilding already implemented workout surfaces;
- use audit/regression for MuscleMap and Workout Progress, not new implementation planning;
- prioritize regression, hardening, user exercises, lifecycle, and catalog quality before new Premium workout write paths.

Owner correction applied:

- Workout MuscleMap is already implemented: audit/regression only.
- Workout Progress MVP is already implemented: audit/regression only.
- Exercise Card, User Exercise Media, and Restore flows were previously developed: verify current state only when relevant.

Recommended next package:

- `WORKOUT_DIARY_FREE_FOUNDATION_CURRENT_STATE_AUDIT_READY`

## 2. Product Boundary

### FREE

FREE is the user-owned workout diary.

The user can:

- manually keep a workout diary;
- create workouts;
- edit workouts;
- repeat workouts;
- delete/archive where the existing lifecycle allows;
- add exercises to a workout;
- edit sets, reps, weight, time, or other supported metrics;
- create user exercises;
- edit user exercises;
- archive user exercises instead of hard-deleting used history;
- view completed workout facts;
- view basic Workout Progress;
- see MuscleMap/muscles from completed workout facts.

FREE must preserve factual history:

- completed workouts are facts;
- user-created exercises remain private/owned;
- custom exercises must not pollute the core catalog;
- history must not silently recompute from later exercise edits.

### PREMIUM

PREMIUM is a guided training layer, separate from the diary fact layer.

POTOK can:

- propose a ready workout for today;
- adapt workout recommendations to goal and day state;
- offer guided actions:
  - `Выполнено`;
  - `Не подходит`;
  - `Сделать проще`;
  - `Заменить тренировку`;
  - `Заменить упражнение`;
- run weekly check-in;
- later support coach/AI/media analysis.

Premium planned workouts must not be mixed with completed diary facts:

- a planned workout is a recommendation;
- a completed workout is a diary fact;
- no Premium workout write paths should be introduced until the free diary lifecycle is audited and safe.

## 3. Already Implemented / Audit-Only

Audit-only blocks:

- Workout MuscleMap: already implemented; audit/regression only.
- Workout Progress MVP: already implemented; audit/regression only.
- Exercise Card MVP: previously developed; verify current state only if relevant.
- User Exercise Media: previously developed; verify current state only if relevant.
- User Exercise Restore/archive flows: previously developed; verify current state only if relevant.

Do not duplicate implementation planning for these blocks unless audit finds concrete gaps.

Known supporting context from current repo/reports:

- `src/pages/Workouts.tsx` renders current workout MuscleMap from workout entries.
- `src/components/muscle-map/MuscleMap` is already used in workout contexts.
- `src/services/workoutProgressService.ts` already computes Workout Progress summaries.
- `reports/workout-diary-progress-mvp-final-status-2026-07-25.md` marked Workout Diary + Workout Progress MVP production-ready for that scope.
- `reports/workout-muscle-map-progress-visual-smoke-2026-08-15.md` marked Workout Diary and Progress MuscleMap smoke-ready.
- user exercise archive/lifecycle reports already exist and should be treated as prior work, not a fresh feature plan.

## 4. FREE Backlog: Current Priorities

### A. Workout Diary Regression / Current State Audit

Audit the current diary from route to services and tests:

- create workout;
- edit workout;
- repeat workout;
- delete/archive behavior;
- add exercise;
- edit sets/reps/weight/time/distance where supported;
- save workout;
- empty states;
- mobile UI;
- current tests;
- known broken flows;
- local/offline fallback assumptions if any;
- sync events and cache invalidation.

Audit questions:

- Which flows are green today?
- Which flows only have service tests but no UI smoke?
- Which flows depend on production/staging schema assumptions?
- Which flows need owner manual smoke before further work?

### B. User Exercises Hardening

Audit and harden user-created exercises:

- create user exercise;
- edit user exercise;
- archive instead of hard delete for used exercises;
- restore archived user exercise where supported;
- owner-only visibility;
- active custom exercise list hides archived rows;
- archived rows remain available for history/detail contexts where needed;
- use in workout;
- use in MuscleMap;
- use in Progress;
- do not pollute core exercise catalog.

Important boundary:

- User exercises are private user content.
- Core exercise catalog remains separate.
- Used custom exercises should not be physically deleted if history would break.

### C. Workout Lifecycle Hardening

Audit the workout lifecycle for history safety:

- snapshot-first workout history;
- preserve exercise name snapshot;
- preserve muscle/equipment/category snapshot if needed;
- verify FK hardening;
- use `SET NULL` only where history must survive detached references;
- ensure repeat workout after exercise edits behaves predictably;
- ensure archived custom exercises are blocked or clearly disabled in repeat flows;
- prevent historical recompute from live exercise changes;
- preserve user exercise media contract when repeating workouts.

Audit questions:

- Are workout entries safe if an exercise is edited later?
- Are workout entries safe if an exercise is archived later?
- Are progress observations snapshot-backed where needed?
- Are repeat flows safe for archived or detached entries?

### D. Exercise Catalog Quality

Audit catalog quality and filters:

- muscle filters;
- equipment filters;
- category filters;
- exercises without muscle mapping;
- duplicate exercises;
- incorrect muscle mapping;
- custom vs core exercise separation;
- localized labels and aliases;
- missing equipment/category metadata;
- impact on MuscleMap and Progress aggregation.

Recommended output:

- catalog quality findings;
- top missing mappings;
- duplicate/conflict examples;
- proposed correction batches;
- tests needed before catalog corrections.

### E. Audit-Only MuscleMap

Do not rebuild MuscleMap from scratch.

Audit:

- it still appears where expected;
- workout diary muscles highlight correctly;
- Progress MuscleMap still aggregates facts correctly;
- user exercises work;
- linked muscles on custom exercises resolve correctly;
- reset/empty state works;
- all muscle filters and supported muscle keys are covered;
- unknown/invalid muscle keys fail safely;
- mobile layout remains readable.

### F. Audit-Only Workout Progress

Do not rebuild Workout Progress MVP from scratch.

Audit:

- facts only;
- no planned workouts counted;
- period calculations;
- week/month/custom behavior;
- volume metrics;
- frequency metrics;
- muscle coverage metrics;
- empty states;
- repeated same-day entries handling;
- custom exercise snapshot behavior;
- archived/restored custom exercise behavior in historical progress.

## 5. PREMIUM Backlog: Separate From Diary

Premium should be planned after free diary facts and lifecycle are safe.

### A. Today Workout Plan Layer

Future Premium layer:

- ready workout for today;
- exercises, sets, reps, rest;
- start workout;
- confirm completed before writing diary fact;
- clear planned-vs-completed distinction;
- no automatic diary write from a recommendation.

### B. Premium Actions

Future actions:

- `Выполнено`;
- `Не подходит`;
- `Сделать проще`;
- `Заменить тренировку`;
- `Заменить упражнение`.

These actions belong to Premium recommendation UX, not the free diary fact model.

### C. Day State Adaptation

Future day states:

- `Обычный день`;
- `Нет сил`;
- `Нет времени`;
- `Готова работать`.

The day state should adapt a planned workout, not rewrite existing completed diary facts.

### D. Weekly Check-In

Future weekly check-in:

- training difficulty;
- adherence;
- energy;
- recovery;
- wellbeing;
- correction for next week.

Check-in output can influence future plans, not past workout facts.

### E. Media / AI Coach Later

Later only:

- photo/video upload;
- storage/privacy policy;
- future technique analysis;
- coach/AI feedback;
- media retention and deletion rules.

Not MVP now.

## 6. What Not To Do Now

Do not:

- rebuild MuscleMap from scratch;
- rebuild Workout Progress from scratch;
- mix planned workout with completed workout;
- create Premium workout write paths now;
- implement AI video analysis;
- build trainer marketplace;
- hard-delete user exercises by default;
- change SQL/RLS until audit justifies it;
- mutate staging or production during planning;
- create payment enforcement changes in the Workout Diary audit package.

## 7. Recommended Next Package

Recommended next practical package:

- `WORKOUT_DIARY_FREE_FOUNDATION_CURRENT_STATE_AUDIT_READY`

Scope:

- audit current workout diary routes/components/services/tests/reports;
- list current pass/fail status for core flows;
- identify exact gaps;
- recommend one implementation/fix package after audit.

Suggested files to review first:

- `src/pages/Workouts.tsx`;
- `src/services/workoutService.ts`;
- `src/services/exerciseService.ts`;
- `src/services/workoutProgressService.ts`;
- workout-related component tests;
- workout lifecycle and user exercise archive reports.

No implementation should start before this audit unless there is an obvious blocker already reproduced.

## 8. Tests To Inspect Or Add Later

Inspect or add tests for:

- workout create;
- workout edit;
- workout repeat;
- add exercise;
- set editing;
- weight/reps/time/distance editing;
- user exercise visibility;
- custom exercise archive behavior;
- custom exercise restore behavior;
- archived exercise blocked in new workout/repeat flows;
- MuscleMap mapping;
- Progress facts-only calculations;
- Progress period calculations;
- empty states;
- mobile smoke;
- history snapshots after exercise edits;
- no planned Premium workouts counted as completed facts.

## 9. Final Recommendation

Recommended order:

1. Current-state audit/regression.
2. User exercises archive/hardening.
3. Workout lifecycle hardening.
4. Exercise catalog quality.
5. Premium Today workout layer later.
6. Media/AI later.

Immediate next step:

- prepare `WORKOUT_DIARY_FREE_FOUNDATION_CURRENT_STATE_AUDIT` as a report-only/read-only audit package.

Keep the free diary factual and stable before adding Premium workout planning.

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
- no PR;
- no commit.

## Verification

- `git diff --check`
  - Result: passed.

## Final Verdict

**WORKOUT_DIARY_FREE_PREMIUM_BACKLOG_CURRENT_STATE_PLAN_READY**
