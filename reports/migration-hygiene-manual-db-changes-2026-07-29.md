# Migration Hygiene For Manual DB Changes

- Timestamp: 2026-07-29T00:00:00Z
- Scope: repo migration hygiene for manually applied production DB changes
- Verdict: **MANUAL_DB_CHANGES_TRACKED_IN_REPO_MIGRATIONS**

## Safety

- Production DB was not changed.
- Migrations were not applied.
- Runtime code was not changed.
- Storage buckets and policies were not changed.
- No migrations/import/backfill/recompute were run.
- Workout block runtime, Food Core, nutrition runtime, recipes, user media, and exercise cards were not changed.
- No PR was created.

## Audit Result

Manual production DB changes found in draft/reports but not in tracked migrations:

- `public.exercises.archived_at` for user exercise archive.
- `public.exercises` active custom exercise index `exercises_custom_owner_active_idx`.
- Hardened custom exercise insert/update/delete RLS policies.
- `public.workout_entries.exercise_id` FK changed from `ON DELETE CASCADE` to `ON DELETE RESTRICT`.

Repo state before this hygiene fix:

- `supabase/migration_drafts/20260727_user_exercise_archive_draft.sql` existed.
- `supabase/migration_drafts/20260727_workout_entry_exercise_fk_restrict_draft.sql` existed.
- Equivalent tracked files under `supabase/migrations` were missing.

Risk:

- Production was already correct, but new/staging/restored environments could miss `exercises.archived_at`.
- Runtime code that queries `archived_at` could fail in those environments.
- Restored environments could also regress `workout_entries.exercise_id` to cascade behavior if migrations were replayed without the Phase 1A FK hardening.

## Files Added

- `supabase/migrations/20260729_user_exercise_archive_lifecycle.sql`
- `supabase/migrations/20260729_workout_entry_exercise_fk_restrict.sql`

## Migration Contract

User exercise archive migration:

- Adds `public.exercises.archived_at timestamptz null` with `if not exists`.
- Adds `exercises_custom_owner_active_idx` with `if not exists`.
- Recreates custom exercise insert/update/delete policies with hardened checks.
- Does not change FKs.
- Does not backfill rows.
- Does not delete data.

Workout lifecycle Phase 1A FK migration:

- Finds the existing FK from `public.workout_entries.exercise_id` to `public.exercises.id`.
- Drops only that targeted FK.
- Recreates it as `workout_entries_exercise_id_fkey` with `ON DELETE RESTRICT`.
- Keeps `workout_entries.exercise_id` non-nullable.
- Does not touch `user_exercise_media`.
- Does not backfill rows.
- Does not delete data.

## Validation Guidance For Future Apply

After applying to a non-production/restored environment, validate:

```sql
select count(*) as archived_at_exists
from information_schema.columns
where table_schema = 'public'
  and table_name = 'exercises'
  and column_name = 'archived_at';

select count(*) as active_custom_index_exists
from pg_indexes
where schemaname = 'public'
  and tablename = 'exercises'
  and indexname = 'exercises_custom_owner_active_idx';

select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'exercises'
  and policyname in (
    'Users can create custom exercises',
    'Users can update their custom exercises',
    'Users can delete their custom exercises'
  )
order by policyname;

select
  tc.constraint_name,
  rc.delete_rule
from information_schema.table_constraints tc
join information_schema.referential_constraints rc
  on rc.constraint_schema = tc.constraint_schema
 and rc.constraint_name = tc.constraint_name
where tc.table_schema = 'public'
  and tc.table_name = 'workout_entries'
  and tc.constraint_type = 'FOREIGN KEY'
  and tc.constraint_name = 'workout_entries_exercise_id_fkey';
```

Expected:

- `archived_at_exists = 1`.
- `active_custom_index_exists = 1`.
- Three custom exercise policies present.
- FK `delete_rule = RESTRICT`.
- Table row counts unchanged.

## Final Status

The manually applied production DB changes are now represented by idempotent tracked migration files. They were not applied in this step.
