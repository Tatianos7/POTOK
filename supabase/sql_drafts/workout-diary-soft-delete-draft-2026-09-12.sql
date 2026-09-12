-- Workout Diary soft-delete/archive SQL draft
-- Date: 2026-09-12
-- Status: DRAFT ONLY. Do not apply without explicit owner approval,
-- staging review, RLS/update verification, and runtime implementation.
--
-- Scope:
-- - Add nullable soft-delete metadata to public.workout_entries.
-- - Add partial indexes for active diary/history/progress/repeat reads.
-- - Add a partial cleanup lookup index for future retention cleanup.
--
-- Safety:
-- - Draft SQL only.
-- - Do not run on staging or production as-is.
-- - No data deletes.
-- - No backfill.
-- - No workout_days physical delete behavior.
-- - No cleanup job.
-- - No RLS policy changes are active in this draft.
-- - No Premium write-path changes.
--
-- Product contract:
-- - User-facing delete sets deleted_at later in runtime.
-- - Active diary/history/progress/repeat should use deleted_at is null.
-- - Workout Diary MuscleMap should receive active entries only.
-- - Future hard cleanup is allowed only after 12 months:
--   deleted_at is not null and deleted_at < now() - interval '12 months'.
-- - Active rows where deleted_at is null are never eligible for cleanup.

begin;

-- ============================================================
-- 1) Columns
-- ============================================================

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'workout_entries'
      and c.relkind = 'r'
  ) then
    alter table public.workout_entries
      add column if not exists deleted_at timestamptz null,
      add column if not exists deleted_by_user_id uuid null;

    comment on column public.workout_entries.deleted_at is
      'Null means active. Non-null means the workout entry is soft-deleted and hidden from active diary, default history, progress, MuscleMap inputs, and repeat sources.';

    comment on column public.workout_entries.deleted_by_user_id is
      'User id that requested soft-delete. Nullable draft field without FK until auth/user FK pattern is validated for this lifecycle.';
  else
    raise notice 'public.workout_entries not found, skipping workout diary soft-delete columns';
  end if;
end
$$;

-- Note on deleted_by_user_id:
-- This draft intentionally does not add a FK constraint yet. The project uses
-- auth.users FKs in many places, but this lifecycle field needs production/staging
-- validation and RLS-spoofing review before a constraint is approved.
-- Runtime must set deleted_by_user_id from the authenticated user, not from
-- arbitrary client input.

-- ============================================================
-- 2) Indexes for active reads and soft-delete updates
-- ============================================================

-- Supports active entry reads by workout_day_id, including:
-- - getWorkoutEntries/getWorkoutEntriesPersisted for selected day;
-- - repeat source reads;
-- - day-level soft-delete update target lookup.
create index if not exists workout_entries_active_day_created_at_idx
  on public.workout_entries (workout_day_id, created_at)
  where deleted_at is null;

-- Supports active history/progress aggregation by day ids and exercise.
-- Existing code fetches workout_days by user/date, then reads entries by
-- workout_day_id. This partial index keeps deleted rows out of the active path.
create index if not exists workout_entries_active_day_exercise_idx
  on public.workout_entries (workout_day_id, exercise_id)
  where deleted_at is null;

-- Supports future cleanup lookup by deletion age.
-- Future cleanup must batch rows from this eligible set and must never touch
-- deleted_at is null rows.
create index if not exists workout_entries_deleted_cleanup_idx
  on public.workout_entries (deleted_at, id)
  where deleted_at is not null;

-- ============================================================
-- 3) RLS/update impact review, proposal only
-- ============================================================

-- Current tracked workout_schema.sql has a broad owner policy:
--
--   create policy "Users can manage their workout entries"
--     on workout_entries for all
--     using (
--       exists (
--         select 1
--         from workout_days wd
--         where wd.id = workout_day_id
--           and wd.user_id = auth.uid()
--       )
--     )
--     with check (
--       exists (
--         select 1
--         from workout_days wd
--         where wd.id = workout_day_id
--           and wd.user_id = auth.uid()
--       )
--     );
--
-- If production/staging still has this broad FOR ALL policy, setting deleted_at
-- on an owned workout entry should be covered by existing UPDATE permissions.
--
-- No active RLS changes are included in this draft.
--
-- If a stricter production policy exists, a later reviewed package may need an
-- explicit UPDATE policy for owner soft-delete. Do not add it blindly here.
--
-- Spoofing risk:
-- - deleted_by_user_id must not be trusted from arbitrary client payload.
-- - Runtime should set it from auth session user id.
-- - A future DB trigger/RPC can be considered if owner wants DB-enforced value.

-- Proposed-only policy shape if needed later; intentionally commented out:
--
-- drop policy if exists "Users can soft-delete their workout entries" on public.workout_entries;
-- create policy "Users can soft-delete their workout entries"
--   on public.workout_entries
--   for update
--   using (
--     exists (
--       select 1
--       from public.workout_days wd
--       where wd.id = workout_day_id
--         and wd.user_id = auth.uid()
--     )
--   )
--   with check (
--     exists (
--       select 1
--       from public.workout_days wd
--       where wd.id = workout_day_id
--         and wd.user_id = auth.uid()
--     )
--   );

-- ============================================================
-- 4) Retention cleanup notes, not implementation
-- ============================================================

-- No cleanup job is created in this draft.
--
-- Future cleanup eligibility:
--   deleted_at is not null
--   and deleted_at < now() - interval '12 months'
--
-- Future cleanup must:
-- - run in batches, recommended 500 to 1000 rows per run;
-- - be idempotent and safe to stop/retry;
-- - dry-run count eligible rows before delete;
-- - verify FK behavior for workout_entry_notes, workout_day_notes,
--   user_exercise_media, pose sessions, and any future linked tables;
-- - log cleanup counts;
-- - never touch active rows where deleted_at is null.

commit;

-- ============================================================
-- Post-apply validation queries, for future approved apply only
-- ============================================================
--
-- 1) Confirm columns exist.
--
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'workout_entries'
--   and column_name in ('deleted_at', 'deleted_by_user_id')
-- order by column_name;
--
-- 2) Confirm indexes exist.
--
-- select indexname, indexdef
-- from pg_indexes
-- where schemaname = 'public'
--   and tablename = 'workout_entries'
--   and indexname in (
--     'workout_entries_active_day_created_at_idx',
--     'workout_entries_active_day_exercise_idx',
--     'workout_entries_deleted_cleanup_idx'
--   )
-- order by indexname;
--
-- 3) Confirm no row counts changed by this additive schema draft.
--
-- select 'workout_entries' as table_name, count(*) from public.workout_entries
-- union all
-- select 'workout_days' as table_name, count(*) from public.workout_days;
--
-- 4) Future dry-run cleanup count. Do not delete in this draft.
--
-- select count(*) as eligible_for_future_cleanup
-- from public.workout_entries
-- where deleted_at is not null
--   and deleted_at < now() - interval '12 months';
--
-- 5) Future active-row safety check. Active rows must never be cleanup eligible.
--
-- select count(*) as active_rows
-- from public.workout_entries
-- where deleted_at is null;

-- ============================================================
-- Rollback notes, not for automatic use
-- ============================================================
--
-- Do not run destructive rollback without explicit approval.
--
-- If this draft were applied and must be rolled back before runtime depends on
-- these columns:
--
-- drop index if exists public.workout_entries_deleted_cleanup_idx;
-- drop index if exists public.workout_entries_active_day_exercise_idx;
-- drop index if exists public.workout_entries_active_day_created_at_idx;
--
-- alter table public.workout_entries
--   drop column if exists deleted_by_user_id,
--   drop column if exists deleted_at;
--
-- Do not drop deleted_at after runtime starts writing soft-deletes unless a
-- separate data-retention and restore decision is approved.
