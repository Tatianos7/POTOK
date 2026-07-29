-- User exercise archive lifecycle migration
-- Date: 2026-07-29
--
-- Purpose:
-- - Track the production-applied user exercise archive schema in repo migrations.
-- - Make new/staging/restored environments compatible with runtime code that reads
--   public.exercises.archived_at.
--
-- Safety:
-- - Idempotent.
-- - No data deletes.
-- - No backfill.
-- - No FK changes.
-- - No changes to workout_entries, user_exercise_media, exercise_definition_*,
--   Food Core, nutrition, recipes, or Storage.

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'exercises'
      and c.relkind = 'r'
  ) then
    alter table public.exercises
      add column if not exists archived_at timestamptz null;

    comment on column public.exercises.archived_at is
      'Null means active. Non-null means user-created exercise is archived/hidden from default catalog surfaces without deleting history.';

    create index if not exists exercises_custom_owner_active_idx
      on public.exercises (created_by_user_id, category_id, name)
      where is_custom = true and archived_at is null;

    drop policy if exists "Users can create custom exercises" on public.exercises;
    create policy "Users can create custom exercises"
      on public.exercises
      for insert
      with check (
        auth.uid() = created_by_user_id
        and is_custom = true
        and archived_at is null
      );

    drop policy if exists "Users can update their custom exercises" on public.exercises;
    create policy "Users can update their custom exercises"
      on public.exercises
      for update
      using (
        created_by_user_id = auth.uid()
        and is_custom = true
      )
      with check (
        created_by_user_id = auth.uid()
        and is_custom = true
      );

    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'workout_entries'
        and c.relkind = 'r'
    ) then
      drop policy if exists "Users can delete their custom exercises" on public.exercises;
      create policy "Users can delete their custom exercises"
        on public.exercises
        for delete
        using (
          created_by_user_id = auth.uid()
          and is_custom = true
          and not exists (
            select 1
            from public.workout_entries we
            where we.exercise_id = exercises.id
          )
        );
    else
      raise notice 'public.workout_entries not found, skipping custom exercise delete policy hardening';
    end if;
  else
    raise notice 'public.exercises not found, skipping user exercise archive lifecycle migration';
  end if;
end
$$;
