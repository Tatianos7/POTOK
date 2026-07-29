-- Workout entry exercise FK hardening migration
-- Date: 2026-07-29
--
-- Purpose:
-- - Track the production-applied Workout Lifecycle Phase 1A FK hardening in repo migrations.
-- - Stop privileged/admin exercise deletes from cascading into workout_entries.
-- - Preserve workout diary/progress history.
--
-- Safety:
-- - Idempotent.
-- - No data deletes.
-- - No backfill.
-- - No FK changes outside workout_entries.exercise_id -> exercises.id.
-- - Keeps workout_entries.exercise_id NOT NULL.
-- - No changes to user_exercise_media, workout notes, Exercise Card, Food Core, or Storage.

do $$
declare
  existing_fk_name text;
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'workout_entries'
      and c.relkind = 'r'
  ) then
    raise notice 'public.workout_entries not found, skipping workout entry exercise FK hardening';
    return;
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'exercises'
      and c.relkind = 'r'
  ) then
    raise notice 'public.exercises not found, skipping workout entry exercise FK hardening';
    return;
  end if;

  select c.conname
    into existing_fk_name
  from pg_constraint c
  join pg_attribute a
    on a.attrelid = c.conrelid
   and a.attnum = any(c.conkey)
  where c.conrelid = 'public.workout_entries'::regclass
    and c.confrelid = 'public.exercises'::regclass
    and c.contype = 'f'
    and a.attname = 'exercise_id'
    and array_length(c.conkey, 1) = 1
  limit 1;

  if existing_fk_name is not null then
    execute format('alter table public.workout_entries drop constraint %I', existing_fk_name);
  end if;

  alter table public.workout_entries
    drop constraint if exists workout_entries_exercise_id_fkey;

  alter table public.workout_entries
    add constraint workout_entries_exercise_id_fkey
    foreign key (exercise_id)
    references public.exercises(id)
    on delete restrict;
end
$$;
