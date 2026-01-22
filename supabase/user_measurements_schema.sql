-- ============================================================
-- Таблицы для замеров пользователя (Measurements)
-- ============================================================
-- ВАЖНО: RLS отключен для работы с локальной авторизацией
-- Выполни этот SQL в Supabase SQL Editor после основной схемы
-- ============================================================

-- 1. ТЕКУЩИЕ ЗАМЕРЫ (последние сохраненные значения)
create table if not exists public.user_measurements (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  measurements jsonb not null, -- массив {id, name, value}[]
  photos      jsonb not null default '[]'::jsonb, -- основные фото (base64)
  additional_photos jsonb not null default '[]'::jsonb, -- дополнительные фото (base64)
  updated_at  timestamptz not null default now()
);

-- 2. ИСТОРИЯ ЗАМЕРОВ (для бесплатных пользователей)
create table if not exists public.measurement_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  date        date not null,
  measurements jsonb not null, -- массив {id, name, value}[]
  photos      jsonb not null default '[]'::jsonb, -- основные фото (base64)
  additional_photos jsonb not null default '[]'::jsonb, -- дополнительные фото (base64)
  created_at  timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists measurement_history_user_date_idx
  on public.measurement_history (user_id, date desc);

-- 3. ИСТОРИЯ ФОТО (отдельно от замеров)
create table if not exists public.measurement_photo_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  date        date not null,
  photos      jsonb not null default '[]'::jsonb, -- основные фото (base64)
  additional_photos jsonb not null default '[]'::jsonb, -- дополнительные фото (base64)
  created_at  timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists measurement_photo_history_user_date_idx
  on public.measurement_photo_history (user_id, date desc);

-- Включаем RLS (Supabase Auth)
alter table if exists public.user_measurements enable row level security;
alter table if exists public.measurement_history enable row level security;
alter table if exists public.measurement_photo_history enable row level security;

drop policy if exists "user_measurements_select_own" on public.user_measurements;
create policy "user_measurements_select_own"
  on public.user_measurements
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_measurements_modify_own" on public.user_measurements;
create policy "user_measurements_modify_own"
  on public.user_measurements
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "measurement_history_select_own" on public.measurement_history;
create policy "measurement_history_select_own"
  on public.measurement_history
  for select
  using (auth.uid() = user_id);

drop policy if exists "measurement_history_modify_own" on public.measurement_history;
create policy "measurement_history_modify_own"
  on public.measurement_history
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "measurement_photo_history_select_own" on public.measurement_photo_history;
create policy "measurement_photo_history_select_own"
  on public.measurement_photo_history
  for select
  using (auth.uid() = user_id);

drop policy if exists "measurement_photo_history_modify_own" on public.measurement_photo_history;
create policy "measurement_photo_history_modify_own"
  on public.measurement_photo_history
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

