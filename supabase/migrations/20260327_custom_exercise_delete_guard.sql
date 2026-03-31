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
    execute 'drop policy if exists "Users can delete their custom exercises" on public.exercises';
    execute '
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
      )
    ';
  else
    raise notice ''public.exercises not found, skipping custom exercise delete guard'';
  end if;
end
$$;
