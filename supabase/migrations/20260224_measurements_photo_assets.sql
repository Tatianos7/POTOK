create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) Canonical photo assets table (parallel to legacy history)
-- ------------------------------------------------------------

create table if not exists public.measurement_photo_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  day date not null,
  slot text not null check (slot in ('main_1', 'main_2', 'main_3', 'extra_1', 'extra_2', 'extra_3')),
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists measurement_photo_assets_user_day_idx
  on public.measurement_photo_assets (user_id, day desc);

create unique index if not exists measurement_photo_assets_user_day_slot_unique
  on public.measurement_photo_assets (user_id, day, slot);

alter table public.measurement_photo_assets enable row level security;

drop policy if exists "measurement_photo_assets_select_own_v1" on public.measurement_photo_assets;
create policy "measurement_photo_assets_select_own_v1"
  on public.measurement_photo_assets
  for select
  using (user_id = auth.uid());

drop policy if exists "measurement_photo_assets_insert_own_v1" on public.measurement_photo_assets;
create policy "measurement_photo_assets_insert_own_v1"
  on public.measurement_photo_assets
  for insert
  with check (user_id = auth.uid());

drop policy if exists "measurement_photo_assets_update_own_v1" on public.measurement_photo_assets;
create policy "measurement_photo_assets_update_own_v1"
  on public.measurement_photo_assets
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "measurement_photo_assets_delete_own_v1" on public.measurement_photo_assets;
create policy "measurement_photo_assets_delete_own_v1"
  on public.measurement_photo_assets
  for delete
  using (user_id = auth.uid());

-- ------------------------------------------------------------
-- 2) Storage bucket + object policies (private)
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('measurements-photos', 'measurements-photos', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "measurements_photos_select_own_v1" on storage.objects;
create policy "measurements_photos_select_own_v1"
  on storage.objects
  for select
  using (
    bucket_id = 'measurements-photos'
    and split_part(name, '/', 1) = 'user'
    and split_part(name, '/', 2) = auth.uid()::text
  );

drop policy if exists "measurements_photos_insert_own_v1" on storage.objects;
create policy "measurements_photos_insert_own_v1"
  on storage.objects
  for insert
  with check (
    bucket_id = 'measurements-photos'
    and split_part(name, '/', 1) = 'user'
    and split_part(name, '/', 2) = auth.uid()::text
  );

drop policy if exists "measurements_photos_update_own_v1" on storage.objects;
create policy "measurements_photos_update_own_v1"
  on storage.objects
  for update
  using (
    bucket_id = 'measurements-photos'
    and split_part(name, '/', 1) = 'user'
    and split_part(name, '/', 2) = auth.uid()::text
  )
  with check (
    bucket_id = 'measurements-photos'
    and split_part(name, '/', 1) = 'user'
    and split_part(name, '/', 2) = auth.uid()::text
  );

drop policy if exists "measurements_photos_delete_own_v1" on storage.objects;
create policy "measurements_photos_delete_own_v1"
  on storage.objects
  for delete
  using (
    bucket_id = 'measurements-photos'
    and split_part(name, '/', 1) = 'user'
    and split_part(name, '/', 2) = auth.uid()::text
  );

-- ------------------------------------------------------------
-- 3) Reload PostgREST schema cache
-- ------------------------------------------------------------
select pg_notify('pgrst', 'reload schema');
