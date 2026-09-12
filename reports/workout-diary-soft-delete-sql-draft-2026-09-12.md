# Workout Diary Soft Delete SQL Draft

- Date: 2026-09-12
- Branch: `master`
- HEAD: `7d36084 plan workout diary soft delete retention`
- Source plan: `reports/workout-diary-soft-delete-archive-plan-2026-09-12.md`
- Source addendum: `reports/workout-diary-soft-delete-retention-policy-addendum-2026-09-12.md`
- SQL draft: `supabase/sql_drafts/workout-diary-soft-delete-draft-2026-09-12.sql`
- Target package: `WORKOUT_DIARY_SOFT_DELETE_SQL_DRAFT`
- Verdict: **WORKOUT_DIARY_SOFT_DELETE_SQL_DRAFT_READY**

## Scope

Create a SQL draft for the future Workout Diary soft-delete/archive implementation.

This package is SQL draft only. Runtime code was not changed, UI was not changed, the SQL draft was not applied, Supabase SQL was not executed, staging was not mutated, production was not touched, Premium write paths were not touched, DB schema/RLS were not actually changed, API keys/secrets were not used, no PR was created, and no commit was created.

## Executive Summary

The draft proposes additive schema support for the owner-approved soft-delete model:

- add `workout_entries.deleted_at timestamptz null`;
- add `workout_entries.deleted_by_user_id uuid null`;
- add partial active-read indexes where `deleted_at is null`;
- add a future cleanup lookup index where `deleted_at is not null`;
- keep `workout_days` untouched in the MVP draft;
- do not add cleanup jobs;
- do not actively change RLS policies in this draft.

The draft is intentionally conservative:

- no data delete;
- no backfill;
- no physical delete behavior;
- no active SQL apply;
- RLS changes are documented as a commented proposal only.

## Files Created

- `supabase/sql_drafts/workout-diary-soft-delete-draft-2026-09-12.sql`
- `reports/workout-diary-soft-delete-sql-draft-2026-09-12.md`

## Current Schema References Reviewed

Reviewed:

- `supabase/workout_schema.sql`
- `supabase/perf_indexes_1_5_1.sql`
- `supabase/phase7_4_1_training_units.sql`
- `supabase/migrations/20260531_workout_entry_snapshots.sql`
- `supabase/migrations/20260729_workout_entry_exercise_fk_restrict.sql`
- `supabase/migrations/20260729_user_exercise_archive_lifecycle.sql`
- `supabase/migration_drafts/20260727_workout_entry_exercise_fk_restrict_draft.sql`
- `supabase/workout_entry_notes_schema.sql`
- `supabase/workout_day_notes_schema.sql`
- `supabase/pose_schema.sql`
- prior workout lifecycle and soft-delete reports.

Current tracked base schema:

- `workout_days` has `id`, `user_id`, `date`, `created_at`, `updated_at`, and unique `(user_id, date)`;
- `workout_entries` has `id`, `workout_day_id`, `exercise_id`, `sets`, `reps`, `weight`, `created_at`, `updated_at`;
- later migrations add metric fields, idempotency key, snapshot fields, and FK hardening;
- existing perf indexes include `workout_entries_workout_day_id_idx`, `workout_entries_exercise_id_idx`, and `workout_entries_workout_day_created_at_idx`;
- no tracked schema field named `workout_entries.deleted_at` or `workout_entries.archived_at` was found.

## Schema Fields Proposed

Proposed fields:

- `public.workout_entries.deleted_at timestamptz null`;
- `public.workout_entries.deleted_by_user_id uuid null`.

Meaning:

- `deleted_at is null` means active workout entry;
- `deleted_at is not null` means soft-deleted entry hidden from active diary, default history, Progress, MuscleMap inputs, and repeat source entries;
- `deleted_by_user_id` records the user that requested the soft-delete when runtime sets it.

FK decision:

- the draft does not add a FK for `deleted_by_user_id`;
- project schemas often reference `auth.users`, but this lifecycle field needs production/staging validation and spoofing review before adding a constraint;
- runtime should set `deleted_by_user_id` from authenticated session state only, not arbitrary client input.

## Indexes Proposed

Active-read indexes:

- `workout_entries_active_day_created_at_idx`
  - columns: `(workout_day_id, created_at)`;
  - predicate: `where deleted_at is null`;
  - supports selected-day reads, repeat source reads, and day-level soft-delete target lookup.

- `workout_entries_active_day_exercise_idx`
  - columns: `(workout_day_id, exercise_id)`;
  - predicate: `where deleted_at is null`;
  - supports active history/progress aggregation and exercise-based grouping by day IDs.

Future cleanup index:

- `workout_entries_deleted_cleanup_idx`
  - columns: `(deleted_at, id)`;
  - predicate: `where deleted_at is not null`;
  - supports future batched cleanup eligibility scans.

## Active Read Query Support

The draft matches current `workoutService` query shapes:

- `getWorkoutEntries` and `getWorkoutEntriesPersisted`
  - current path gets one `workout_days.id`, then reads `workout_entries` by `workout_day_id`;
  - future runtime should add `deleted_at is null`;
  - `workout_entries_active_day_created_at_idx` supports this.

- `getWorkoutHistoryDays`
  - current path fetches day IDs by user/date range, then reads entries by `workout_day_id`;
  - future runtime should aggregate only active entries;
  - active partial indexes support the `.in('workout_day_id', dayIds)` path.

- `getWorkoutProgressObservations` and `getWorkoutProgressEntryDetails`
  - current path fetches day IDs by user/date range, then reads entries;
  - future runtime should filter `deleted_at is null`;
  - active partial indexes keep deleted rows out of the default progress path.

- `copyWorkoutEntriesToDate`
  - current path reads source entries through `getWorkoutEntriesPersisted`;
  - future runtime should copy only active entries;
  - filtering should happen in the read path, with repeat tests confirming deleted entries are not copied.

- current Workout Diary MuscleMap
  - uses active page entries;
  - once active reads filter deleted entries, MuscleMap inputs should be active-only.

## Retention Cleanup Index Support

Retention policy from the addendum:

- keep soft-deleted workout entries for 12 months after `deleted_at`;
- future hard cleanup eligibility:
  - `deleted_at is not null`;
  - `deleted_at < now() - interval '12 months'`;
- active rows where `deleted_at is null` are never eligible.

The draft adds:

- `workout_entries_deleted_cleanup_idx on (deleted_at, id) where deleted_at is not null`.

This supports a future batched cleanup job without creating that job now.

Future cleanup requirements remain:

- dry-run eligible row count first;
- batch size 500 to 1000 rows;
- idempotent stop/retry behavior;
- explicit note/media/FK retention review before enabling deletes;
- log cleanup counts.

## RLS / Update Impact

Current tracked `workout_schema.sql` has:

- `workout_days` RLS enabled;
- `workout_entries` RLS enabled;
- `Users can manage their workout entries` policy on `workout_entries FOR ALL`;
- the policy allows access when the linked `workout_days.user_id = auth.uid()`.

Assessment:

- if production/staging matches this broad `FOR ALL` owner policy, owner updates that set `deleted_at` should already be allowed;
- no active RLS policy changes are included in the SQL draft;
- if production has stricter update policies, a later package may need an explicit owner UPDATE policy.

Spoofing risk:

- `deleted_by_user_id` is nullable and has no FK in the draft;
- runtime must set it from authenticated user id;
- client-provided arbitrary `deleted_by_user_id` should not be trusted;
- a later DB trigger/RPC can be considered if owner wants DB-enforced assignment.

The SQL draft includes a commented proposed-only policy shape, not active SQL.

## Rollback Notes

The SQL draft includes commented rollback notes only.

Rollback guidance:

- drop indexes first;
- drop `deleted_by_user_id` and `deleted_at` only if no runtime depends on them;
- do not drop `deleted_at` after runtime starts writing soft-deletes unless a separate data retention and restore decision is approved.

No destructive rollback command was executed.

## What Was Not Done

Not done:

- no SQL execution;
- no Supabase mutation;
- no staging mutation;
- no production mutation;
- no runtime code changes;
- no UI changes;
- no migration file under `supabase/migrations`;
- no RLS active policy changes;
- no cleanup job;
- no hard delete;
- no `workout_days` schema change;
- no restore UI;
- no Premium write path.

## Next Package Recommendation

Recommended next package:

- `WORKOUT_DIARY_SOFT_DELETE_SQL_DRAFT_REVIEW_READY`

Review should confirm:

- index names and shapes;
- whether `deleted_by_user_id` should get an FK to `auth.users(id)`;
- whether production RLS already allows owner UPDATE on `workout_entries`;
- whether a DB trigger/RPC is needed to prevent `deleted_by_user_id` spoofing;
- FK behavior for `workout_entry_notes`, `workout_day_notes`, `user_exercise_media`, and pose tables before future cleanup.

After SQL draft review:

- runtime implementation can update reads/deletes/tests against the reviewed schema;
- SQL apply remains owner-controlled and separate.

## Verification

- `git diff --check`
  - Result: passed.

## Safety Confirmation

Confirmed for this package:

- SQL draft only;
- no SQL execution;
- no Supabase mutation;
- no staging mutation;
- no production mutation;
- no runtime code changes;
- no UI changes;
- no Premium writes;
- no payment enforcement;
- no API keys;
- no secrets;
- no DB schema actually changed;
- no RLS actually changed;
- no PR;
- no commit.

## Final Verdict

**WORKOUT_DIARY_SOFT_DELETE_SQL_DRAFT_READY**
