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
      add column if not exists exercise_name_snapshot text,
      add column if not exists exercise_category_id_snapshot uuid null,
      add column if not exists exercise_category_name_snapshot text,
      add column if not exists canonical_exercise_id_snapshot uuid null,
      add column if not exists primary_muscles_snapshot text[] not null default '{}',
      add column if not exists secondary_muscles_snapshot text[] not null default '{}',
      add column if not exists muscles_snapshot jsonb not null default '[]'::jsonb;
  else
    raise notice 'public.workout_entries not found, skipping workout entry snapshots';
  end if;
end
$$;
