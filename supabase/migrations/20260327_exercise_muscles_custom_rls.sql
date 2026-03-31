do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'exercise_muscles'
      and c.relkind = 'r'
  ) then
    execute 'alter table public.exercise_muscles enable row level security';

    execute 'drop policy if exists "Anyone can read exercise muscle links" on public.exercise_muscles';
    execute '
      create policy "Anyone can read exercise muscle links"
      on public.exercise_muscles
      for select
      using (true)
    ';

    execute 'drop policy if exists "Users can create muscle links for their custom exercises" on public.exercise_muscles';
    execute '
      create policy "Users can create muscle links for their custom exercises"
      on public.exercise_muscles
      for insert
      with check (
        exists (
          select 1
          from public.exercises e
          where e.id = exercise_id
            and e.is_custom = true
            and e.created_by_user_id = auth.uid()
        )
      )
    ';

    execute 'drop policy if exists "Users can delete muscle links for their custom exercises" on public.exercise_muscles';
    execute '
      create policy "Users can delete muscle links for their custom exercises"
      on public.exercise_muscles
      for delete
      using (
        exists (
          select 1
          from public.exercises e
          where e.id = exercise_id
            and e.is_custom = true
            and e.created_by_user_id = auth.uid()
        )
      )
    ';

    execute 'grant select, insert, delete on public.exercise_muscles to authenticated';
  else
    raise notice ''public.exercise_muscles not found, skipping custom exercise muscle RLS fix'';
  end if;
end
$$;
