-- ============================================================
-- Measurements canonical layer (non-breaking)
-- Canonical target:
--   - id: uuid
--   - day: date
--   - unique (user_id, day)
-- Legacy compatibility:
--   - keep legacy "date" column untouched
--   - do not drop/rename existing columns
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) user_measurements: one row per user_id
-- ------------------------------------------------------------

alter table if exists public.user_measurements
  add column if not exists user_id uuid;

create unique index if not exists user_measurements_user_id_unique
  on public.user_measurements (user_id);

-- ------------------------------------------------------------
-- 2) measurement_history: canonical id/day
-- ------------------------------------------------------------

alter table if exists public.measurement_history
  add column if not exists day date;

do $$
declare
  id_exists boolean;
  id_type text;
  id_is_pk boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'measurement_history'
      and column_name = 'id'
  ) into id_exists;

  if id_exists then
    select data_type
    into id_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'measurement_history'
      and column_name = 'id';
  end if;

  if not id_exists then
    execute 'alter table public.measurement_history add column id uuid default gen_random_uuid()';
    id_type := 'uuid';
  elsif id_type = 'uuid' then
    execute 'alter table public.measurement_history alter column id set default gen_random_uuid()';
  else
    -- Legacy non-uuid id: add canonical uuid sidecar without breaking existing PK
    execute 'alter table public.measurement_history add column if not exists id_uuid uuid default gen_random_uuid()';
    execute 'create unique index if not exists measurement_history_id_uuid_unique on public.measurement_history (id_uuid)';
  end if;

  if id_type = 'uuid' then
    select exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where c.contype = 'p'
        and n.nspname = 'public'
        and t.relname = 'measurement_history'
    ) into id_is_pk;

    if not id_is_pk then
      execute 'alter table public.measurement_history add constraint measurement_history_pkey primary key (id)';
    end if;
  end if;
end $$;

create unique index if not exists measurement_history_user_day_unique
  on public.measurement_history (user_id, day)
  where day is not null;

-- ------------------------------------------------------------
-- 3) measurement_photo_history: canonical id/day
-- ------------------------------------------------------------

alter table if exists public.measurement_photo_history
  add column if not exists day date;

do $$
declare
  id_exists boolean;
  id_type text;
  id_is_pk boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'measurement_photo_history'
      and column_name = 'id'
  ) into id_exists;

  if id_exists then
    select data_type
    into id_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'measurement_photo_history'
      and column_name = 'id';
  end if;

  if not id_exists then
    execute 'alter table public.measurement_photo_history add column id uuid default gen_random_uuid()';
    id_type := 'uuid';
  elsif id_type = 'uuid' then
    execute 'alter table public.measurement_photo_history alter column id set default gen_random_uuid()';
  else
    -- Legacy non-uuid id: add canonical uuid sidecar without breaking existing PK
    execute 'alter table public.measurement_photo_history add column if not exists id_uuid uuid default gen_random_uuid()';
    execute 'create unique index if not exists measurement_photo_history_id_uuid_unique on public.measurement_photo_history (id_uuid)';
  end if;

  if id_type = 'uuid' then
    select exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where c.contype = 'p'
        and n.nspname = 'public'
        and t.relname = 'measurement_photo_history'
    ) into id_is_pk;

    if not id_is_pk then
      execute 'alter table public.measurement_photo_history add constraint measurement_photo_history_pkey primary key (id)';
    end if;
  end if;
end $$;

create unique index if not exists measurement_photo_history_user_day_unique
  on public.measurement_photo_history (user_id, day)
  where day is not null;

-- ------------------------------------------------------------
-- 4) RLS hardening for all 3 tables
-- ------------------------------------------------------------

alter table if exists public.user_measurements enable row level security;
alter table if exists public.measurement_history enable row level security;
alter table if exists public.measurement_photo_history enable row level security;

-- user_measurements policies
drop policy if exists "user_measurements_select_own_v3" on public.user_measurements;
create policy "user_measurements_select_own_v3"
  on public.user_measurements
  for select
  using (user_id = auth.uid());

drop policy if exists "user_measurements_insert_own_v3" on public.user_measurements;
create policy "user_measurements_insert_own_v3"
  on public.user_measurements
  for insert
  with check (user_id = auth.uid());

drop policy if exists "user_measurements_update_own_v3" on public.user_measurements;
create policy "user_measurements_update_own_v3"
  on public.user_measurements
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "user_measurements_delete_own_v3" on public.user_measurements;
create policy "user_measurements_delete_own_v3"
  on public.user_measurements
  for delete
  using (user_id = auth.uid());

-- measurement_history policies
drop policy if exists "measurement_history_select_own_v3" on public.measurement_history;
create policy "measurement_history_select_own_v3"
  on public.measurement_history
  for select
  using (user_id = auth.uid());

drop policy if exists "measurement_history_insert_own_v3" on public.measurement_history;
create policy "measurement_history_insert_own_v3"
  on public.measurement_history
  for insert
  with check (user_id = auth.uid());

drop policy if exists "measurement_history_update_own_v3" on public.measurement_history;
create policy "measurement_history_update_own_v3"
  on public.measurement_history
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "measurement_history_delete_own_v3" on public.measurement_history;
create policy "measurement_history_delete_own_v3"
  on public.measurement_history
  for delete
  using (user_id = auth.uid());

-- measurement_photo_history policies
drop policy if exists "measurement_photo_history_select_own_v3" on public.measurement_photo_history;
create policy "measurement_photo_history_select_own_v3"
  on public.measurement_photo_history
  for select
  using (user_id = auth.uid());

drop policy if exists "measurement_photo_history_insert_own_v3" on public.measurement_photo_history;
create policy "measurement_photo_history_insert_own_v3"
  on public.measurement_photo_history
  for insert
  with check (user_id = auth.uid());

drop policy if exists "measurement_photo_history_update_own_v3" on public.measurement_photo_history;
create policy "measurement_photo_history_update_own_v3"
  on public.measurement_photo_history
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "measurement_photo_history_delete_own_v3" on public.measurement_photo_history;
create policy "measurement_photo_history_delete_own_v3"
  on public.measurement_photo_history
  for delete
  using (user_id = auth.uid());

-- ------------------------------------------------------------
-- 5) Reload PostgREST schema cache
-- ------------------------------------------------------------
select pg_notify('pgrst', 'reload schema');

