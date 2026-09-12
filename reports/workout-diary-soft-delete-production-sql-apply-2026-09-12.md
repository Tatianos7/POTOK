# Workout Diary Soft Delete Production SQL Apply

- Date: 2026-09-12
- Production project ref: `dtsdnhbcwpbfrhcazqkb`
- Staging project ref restored after apply: `ozidryfvhkcbtpnulakq`
- SQL applied: `supabase/sql_drafts/workout-diary-soft-delete-draft-2026-09-12.sql`
- Runtime commit waiting on schema: `0ba90c4a5d10c519a4f24c758444eefdac06f940`
- Target package: `WORKOUT_DIARY_SOFT_DELETE_PRODUCTION_SQL_APPLY`
- Verdict: **WORKOUT_DIARY_SOFT_DELETE_PRODUCTION_SQL_APPLY_READY**

## Scope

Apply the additive Workout Diary soft-delete SQL draft to production only.

Allowed production change:

- add nullable soft-delete metadata columns to `public.workout_entries`;
- add partial indexes for active reads and future retention cleanup lookup.

Not allowed and not done:

- no runtime code changes;
- no UI changes;
- no backfill;
- no workout row updates;
- no cleanup;
- no hard delete;
- no Premium writes;
- no PR;
- no commit.

## Executive Summary

Production apply succeeded.

Applied only:

- `supabase/sql_drafts/workout-diary-soft-delete-draft-2026-09-12.sql`

Production is now schema-ready for the committed Workout Diary soft-delete runtime:

- `workout_entries.deleted_at` exists and is nullable;
- `workout_entries.deleted_by_user_id` exists and is nullable;
- active-read soft-delete indexes exist;
- future cleanup lookup index exists;
- RLS remains enabled on `workout_days` and `workout_entries`;
- existing workout rows were not backfilled;
- row counts stayed unchanged.

Local Supabase link was restored to staging after apply:

- `ozidryfvhkcbtpnulakq`

## Pre-Apply Check

Target confirmation:

- production ref targeted: `dtsdnhbcwpbfrhcazqkb`;
- staging ref `ozidryfvhkcbtpnulakq` was not targeted for apply.

Tables:

- `public.workout_days`: exists;
- `public.workout_entries`: exists.

RLS:

- `workout_days`: enabled;
- `workout_entries`: enabled.

Soft-delete columns before apply:

- `workout_entries.deleted_at`: absent;
- `workout_entries.deleted_by_user_id`: absent.

Soft-delete indexes before apply:

- `workout_entries_active_day_created_at_idx`: absent;
- `workout_entries_active_day_exercise_idx`: absent;
- `workout_entries_deleted_cleanup_idx`: absent.

Pre-apply row counts:

- `workout_days`: 66;
- `workout_entries`: 250.

## Apply

Command scope:

- applied only `supabase/sql_drafts/workout-diary-soft-delete-draft-2026-09-12.sql`;
- no additional SQL changes were executed outside the draft.

Draft behavior:

- additive columns only;
- additive partial indexes only;
- no DML;
- no RLS policy changes;
- no cleanup job.

## Post-Apply Verification

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

RLS verified:

- `workout_days`: enabled;
- `workout_entries`: enabled.

Post-apply row counts:

- `workout_days`: 66;
- `workout_entries`: 250.

Data mutation check:

- rows with `deleted_at is not null`: 0;
- no existing workout rows were backfilled;
- no workout rows were updated;
- no cleanup was run;
- no hard delete was run.

## Runtime Readiness

Production schema is now ready for runtime commit:

- `0ba90c4a5d10c519a4f24c758444eefdac06f940`

Runtime deploy should still be handled as a separate package with focused production smoke/verification.

## Risks / Non-Blockers

Non-blockers:

- `deleted_by_user_id` remains nullable and without FK by current MVP design;
- future DB-enforced assignment can be considered later if owner wants stricter audit guarantees.

Risks:

- runtime deploy still needs careful release sequencing;
- restore UI is not implemented yet;
- retention cleanup is not implemented yet;
- notes/media retention rules remain later.

## What Was Not Done

Not done:

- no runtime code changes;
- no UI changes;
- no backfill;
- no row updates;
- no cleanup job;
- no hard delete;
- no RLS changes;
- no Premium writes;
- no payment enforcement;
- no API keys or secrets requested in chat;
- no PR;
- no commit.

## Next Recommended Package

Recommended next small package:

- `WORKOUT_DIARY_SOFT_DELETE_RUNTIME_DEPLOY_GATE_READY`

Scope:

- confirm production schema remains ready;
- run focused production/runtime smoke if deployment is in scope;
- verify delete/read behavior against completed workout facts only;
- do not add restore UI or cleanup.

## Verification

- production pre-check: passed;
- production apply: passed;
- production post-check: passed;
- local Supabase link restored to staging: `ozidryfvhkcbtpnulakq`;
- `git diff --check`: pending final run after this report.

## Safety Confirmation

Confirmed:

- production apply was explicitly owner-approved for this additive SQL only;
- only `supabase/sql_drafts/workout-diary-soft-delete-draft-2026-09-12.sql` was applied;
- no staging mutation;
- no runtime code changes;
- no UI changes;
- no data backfill;
- no workout row mutation;
- no cleanup;
- no hard delete;
- no actual RLS policy change;
- no Premium writes;
- no payment enforcement;
- no API keys or secrets requested in chat;
- no PR;
- no commit.

## Final Verdict

**WORKOUT_DIARY_SOFT_DELETE_PRODUCTION_SQL_APPLY_READY**
