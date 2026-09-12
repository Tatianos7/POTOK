# Workout Diary Soft Delete Production Owner Smoke DB Check

- Date: 2026-09-12
- Production project ref checked: `dtsdnhbcwpbfrhcazqkb`
- Staging project ref restored after check: `ozidryfvhkcbtpnulakq`
- Target package: `WORKOUT_DIARY_SOFT_DELETE_PRODUCTION_OWNER_SMOKE_DB_CHECK`
- Verdict: **WORKOUT_DIARY_SOFT_DELETE_PRODUCTION_OWNER_SMOKE_DB_CHECK_READY**

## Scope

Read-only production DB verification after owner/manual Workout Diary soft-delete smoke.

Owner smoke context:

- owner created a test exercise/workout entry for `2026-09-12`;
- owner deleted the workout entry from "Моя тренировка";
- UI active diary became empty.

This package verifies that the deleted workout entry still exists in `public.workout_entries` and is excluded from active reads by `deleted_at is null`.

No SQL mutation was executed. No rows were updated, deleted, cleaned up, or backfilled.

## Executive Summary

DB check passed.

The production test workout entry was found:

- exercise name: `тестовая тренировка`;
- date: `2026-09-12`;
- entry id: `10b844e9-5949-4412-b30d-fb300cf8268d`.

The row still exists in `public.workout_entries`.

Soft-delete fields:

- `deleted_at`: populated;
- `deleted_by_user_id`: populated.

Active exclusion:

- the row does not match the active condition `deleted_at is null`;
- active match count for this row/test entry: `0`.

This confirms the owner smoke deleted the active diary entry through soft-delete, not physical delete.

## Found Test Row

Production row:

- `entry_id`: `10b844e9-5949-4412-b30d-fb300cf8268d`
- `workout_day_id`: `2337e51b-7dc8-45d2-9acc-7adecb13091b`
- `user_id`: `68878a0f-73db-48b7-9452-89b22a89d3de`
- `date`: `2026-09-12`
- `exercise_id`: `ce5c6465-8d26-4d5d-97ce-73fe9c40663d`
- `exercise_name`: `тестовая тренировка`
- `live_exercise_name`: `тестовая тренировка`
- `sets`: `4`
- `reps`: `15`
- `weight`: `10.00`
- `metric_type`: `weight`
- `created_at`: `2026-09-12 18:59:38.534045+00`
- `updated_at`: `2026-09-12 19:07:11.785511+00`
- `deleted_at`: `2026-09-12 19:07:09.851+00`
- `deleted_by_user_id`: `68878a0f-73db-48b7-9452-89b22a89d3de`
- `is_active`: `false`

## Checks

### Row Exists

Result: passed.

Evidence:

- the row was returned from `public.workout_entries` joined through `public.workout_days` for `2026-09-12`.

### Soft Delete

Result: passed.

Evidence:

- `deleted_at is not null`;
- `deleted_by_user_id is not null`.

### No Physical Delete

Result: passed.

Evidence:

- the deleted workout entry row still exists in `public.workout_entries`.

### Active Exclusion

Result: passed.

Read-only active condition check:

- condition: `deleted_at is null`;
- active match count for the found row/test exercise: `0`.

This means normal active reads should exclude this deleted entry.

## What Was Not Done

Not done:

- no update;
- no delete;
- no cleanup;
- no hard delete;
- no backfill;
- no runtime code change;
- no UI change;
- no schema change;
- no RLS change;
- no Premium write;
- no PR;
- no commit.

## Risks / Non-Blockers

Non-blockers:

- this DB check proves row preservation and active exclusion for the owner-created test entry.

Remaining smoke items still need UI-side owner confirmation if not already captured:

- History does not show the deleted entry;
- Repeat does not include the deleted entry;
- Progress does not count the deleted entry;
- MuscleMap no longer uses the deleted entry.

## FREE / PREMIUM Boundary

This check covered only FREE Workout Diary completed facts.

No Premium planned workout write path was touched.

## MVP / Later Split

MVP confirmed:

- UI delete produced a persisted soft-delete row;
- physical delete did not occur;
- active read predicate excludes the row.

Later:

- dedicated automated production smoke account;
- restore UI;
- retention cleanup;
- notes/media lifecycle checks.

## Verification

- Production DB read-only row lookup: passed.
- Production active exclusion SELECT: passed.
- Local Supabase link restored to staging: `ozidryfvhkcbtpnulakq`.
- `git diff --check`: pending final run after this report.

## Safety Confirmation

Confirmed:

- read-only DB check only;
- no SQL mutation;
- no production data mutation;
- no staging mutation;
- no code changes;
- no schema changes;
- no RLS changes;
- no cleanup;
- no hard delete;
- no Premium writes;
- no API keys or secrets requested in chat;
- no PR;
- no commit.

## Final Verdict

**WORKOUT_DIARY_SOFT_DELETE_PRODUCTION_OWNER_SMOKE_DB_CHECK_READY**
