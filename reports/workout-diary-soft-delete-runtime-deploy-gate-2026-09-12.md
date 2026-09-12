# Workout Diary Soft Delete Runtime Deploy Gate

- Date: 2026-09-12
- Branch: `master`
- Runtime commit: `0ba90c4a5d10c519a4f24c758444eefdac06f940`
- Production project ref checked: `dtsdnhbcwpbfrhcazqkb`
- Staging project ref restored/confirmed: `ozidryfvhkcbtpnulakq`
- Target package: `WORKOUT_DIARY_SOFT_DELETE_RUNTIME_DEPLOY_GATE`
- Verdict: **WORKOUT_DIARY_SOFT_DELETE_RUNTIME_DEPLOY_GATE_READY**

## Scope

Gate the committed Workout Diary soft-delete runtime for production deployment readiness.

This package checks:

- production schema readiness;
- runtime commit presence in `master`;
- GitHub Pages deploy status;
- focused workout tests;
- production build;
- safe smoke limitations.

This package does not change runtime code, UI, SQL, Supabase data, staging, production data, Premium write paths, or RLS. No cleanup, hard delete, PR, or commit was created.

## Executive Summary

Runtime deploy gate passed for schema/build/test/deploy status.

Confirmed:

- runtime commit `0ba90c4a5d10c519a4f24c758444eefdac06f940` is in `master`;
- production schema contains the required soft-delete columns;
- production schema contains the three required soft-delete indexes;
- RLS remains enabled on `workout_days` and `workout_entries`;
- no pending SQL requirement was found for the committed soft-delete runtime;
- GitHub Pages deploy workflow for the runtime commit completed successfully;
- focused workout tests passed;
- production build passed;
- git index has no unrelated staged files.

Live destructive smoke was not performed because no safe dedicated production test user/data was provided. Real workout facts were not touched.

## Production Schema Verification

Production ref:

- `dtsdnhbcwpbfrhcazqkb`

Tables and RLS:

- `public.workout_days`: exists, RLS enabled;
- `public.workout_entries`: exists, RLS enabled.

Columns verified:

- `workout_entries.deleted_at`
  - type: `timestamp with time zone`;
  - nullable: yes.
- `workout_entries.deleted_by_user_id`
  - type: `uuid`;
  - nullable: yes.

Indexes verified:

- `workout_entries_active_day_created_at_idx`
  - `(workout_day_id, created_at) where deleted_at is null`;
- `workout_entries_active_day_exercise_idx`
  - `(workout_day_id, exercise_id) where deleted_at is null`;
- `workout_entries_deleted_cleanup_idx`
  - `(deleted_at, id) where deleted_at is not null`.

Data safety observation:

- current rows with `deleted_at is not null`: 0.

Local Supabase link was restored and confirmed as staging after production read-only verification:

- `ozidryfvhkcbtpnulakq`.

## Deploy Readiness

Git:

- branch: `master`;
- runtime commit in `master`: yes;
- unrelated staged files: none.

Pending SQL:

- no pending production SQL requirement for soft-delete runtime was found after production schema verification.

GitHub Pages:

- workflow: `Deploy to GitHub Pages`;
- run: `34709746758`;
- title: `implement workout diary soft delete runtime`;
- branch: `master`;
- head SHA: `0ba90c4a5d10c519a4f24c758444eefdac06f940`;
- status: completed;
- conclusion: success;
- created: `2026-09-12T17:57:29Z`;
- updated: `2026-09-12T18:00:09Z`;
- URL: `https://github.com/Tatianos7/POTOK/actions/runs/34709746758`.

Assessment:

- automatic GitHub Pages deployment for the runtime commit completed successfully.
- no in-app build-time commit marker was found, so the deployed page itself was not independently version-asserted by a visible commit hash.

## Smoke Status

Automated live production smoke was not performed.

Reason:

- no safe dedicated production test user/workout data was provided;
- deleting a real workout entry would mutate completed workout facts;
- the package explicitly avoids touching real user data.

Manual owner smoke steps:

1. Sign in with a dedicated production test account.
2. Open `/workouts`.
3. Create or choose a disposable test workout entry.
4. Delete one workout entry.
5. Confirm the entry disappears from active diary UI.
6. Verify in Supabase that the row still exists and has `deleted_at` set.
7. Verify `deleted_by_user_id` matches the authenticated user.
8. Confirm the deleted entry does not appear in Workout History default view.
9. Confirm Repeat source excludes the deleted entry.
10. Confirm Workout Progress does not count the deleted entry.
11. Confirm current Workout Diary MuscleMap no longer uses the deleted entry.
12. Do not run cleanup or hard delete.

## Verification

Focused workout tests:

- `npx tsx --test src/services/__tests__/workoutService.test.ts src/pages/__tests__/Workouts.test.ts src/utils/__tests__/workoutDiaryMutations.test.ts src/utils/__tests__/repeatWorkoutFlow.test.ts src/services/__tests__/workoutProgressService.test.ts src/pages/__tests__/WorkoutHistory.test.ts src/pages/__tests__/ProgressWorkouts.test.ts src/components/__tests__/RepeatWorkoutModal.test.tsx src/components/__tests__/EditWorkoutEntryModal.test.tsx`
- Result: passed, 107 tests.

Build:

- `npm run build`
- Result: passed.
- Notes: existing browserslist/baseline data and chunk-size warnings only.

Git checks:

- `git diff --cached --name-only`
  - Result: no staged files.
- `git diff --check`
  - Result: pending final run after this report.

## Risks / Non-Blockers

Non-blockers:

- deployed site does not expose a visible build commit hash, so GitHub Actions status is the deployment evidence;
- live production smoke remains manual-only until a safe dedicated test user/data path is provided.

Risks:

- a real-user smoke delete would mutate completed workout facts, so it should not be done casually;
- restore UI is not available yet;
- retention cleanup is not available yet;
- notes/media behavior after soft-delete still requires later lifecycle hardening.

## FREE / PREMIUM Boundary

This gate covers FREE Workout Diary completed facts only:

- diary facts;
- history;
- repeat from completed facts;
- Workout Progress;
- Workout Diary MuscleMap.

No Premium planned workout write path was changed or exercised.

## MVP / Later Split

MVP ready:

- production soft-delete schema;
- committed runtime;
- automated deploy success;
- focused tests;
- build.

Later:

- owner/manual production smoke;
- restore UI;
- retention cleanup job;
- notes/media retention and restore policy;
- build-time deployed commit marker.

## What Requires Owner Approval

Requires owner approval:

- live production smoke that creates/deletes a test workout fact;
- restore UI;
- retention cleanup or hard-delete process;
- notes/media lifecycle changes;
- adding a visible build/version marker to the app.

## Safety Confirmation

Confirmed:

- production schema was checked read-only;
- no SQL apply was run in this package;
- no Supabase mutation;
- no staging mutation;
- no production data mutation;
- no runtime code changes;
- no UI changes;
- no cleanup;
- no hard delete;
- no Premium writes;
- no payment enforcement;
- no API keys or secrets requested in chat;
- no PR;
- no commit.

## Final Recommendation

Runtime deployment gate is ready from schema/build/test/deploy evidence.

Recommended next small package:

- `WORKOUT_DIARY_SOFT_DELETE_PRODUCTION_OWNER_SMOKE_READY`

Scope:

- use a dedicated production test account/data;
- validate active UI removal and DB soft-delete row preservation;
- verify History, Repeat, Progress, and MuscleMap exclude deleted entries;
- no cleanup or hard delete.

## Final Verdict

**WORKOUT_DIARY_SOFT_DELETE_RUNTIME_DEPLOY_GATE_READY**
