create extension if not exists pgcrypto;

create table if not exists public.measurement_photo_deletions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  deleted_at timestamptz not null default now(),
  unique (user_id, day)
);

create index if not exists measurement_photo_deletions_user_day_idx
  on public.measurement_photo_deletions (user_id, day desc);

alter table if exists public.measurement_photo_deletions enable row level security;

drop policy if exists "measurement_photo_deletions_select_own_v1" on public.measurement_photo_deletions;
create policy "measurement_photo_deletions_select_own_v1"
  on public.measurement_photo_deletions
  for select
  using (auth.uid() = user_id);

drop policy if exists "measurement_photo_deletions_insert_own_v1" on public.measurement_photo_deletions;
create policy "measurement_photo_deletions_insert_own_v1"
  on public.measurement_photo_deletions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "measurement_photo_deletions_delete_own_v1" on public.measurement_photo_deletions;
create policy "measurement_photo_deletions_delete_own_v1"
  on public.measurement_photo_deletions
  for delete
  using (auth.uid() = user_id);

select pg_notify('pgrst', 'reload schema');
