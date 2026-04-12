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
    execute '
      alter table public.workout_entries
      add column if not exists metric_type text not null default ''weight''
        check (metric_type in (''weight'', ''bodyweight'', ''time'', ''distance'', ''none''))
    ';

    execute '
      update public.workout_entries
      set metric_type = ''weight''
      where metric_type is null
    ';
  else
    raise notice 'public.workout_entries not found, skipping metric_type foundation';
  end if;
end
$$;
