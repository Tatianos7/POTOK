-- ============================================================
-- Таблицы для замеров (Measurements) в POTOK
-- Выполни этот SQL в Supabase SQL Editor
-- ============================================================

-- 1. USER_MEASUREMENTS (текущие замеры и фото) ---------------

create table if not exists public.user_measurements (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  measurements     jsonb not null default '[]'::jsonb,  -- массив объектов {id, name, value}
  photos           jsonb not null default '[]'::jsonb,   -- массив base64 строк (основные фото)
  additional_photos jsonb not null default '[]'::jsonb,  -- массив base64 строк (дополнительные фото)
  updated_at       timestamptz not null default now()
);

create index if not exists user_measurements_user_idx
  on public.user_measurements (user_id);

alter table public.user_measurements enable row level security;

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


-- 2. MEASUREMENT_HISTORY (история замеров) -----------------

create table if not exists public.measurement_history (
  id               text primary key,  -- используем text для совместимости с localStorage ID
  user_id          uuid not null references auth.users (id) on delete cascade,
  date             text not null,     -- формат: "DD.MM.YYYY"
  measurements     jsonb not null,     -- массив объектов {id, name, value}
  photos           jsonb not null default '[]'::jsonb,
  additional_photos jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists measurement_history_user_date_idx
  on public.measurement_history (user_id, date desc);

-- Уникальность: один набор замеров на дату для пользователя
create unique index if not exists measurement_history_user_date_unique
  on public.measurement_history (user_id, date);

alter table public.measurement_history enable row level security;

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


-- 3. MEASUREMENT_PHOTO_HISTORY (история фото) --------------

create table if not exists public.measurement_photo_history (
  id               text primary key,  -- используем text для совместимости с localStorage ID
  user_id          uuid not null references auth.users (id) on delete cascade,
  date             text not null,     -- формат: "DD.MM.YYYY"
  photos           jsonb not null default '[]'::jsonb,
  additional_photos jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists measurement_photo_history_user_date_idx
  on public.measurement_photo_history (user_id, date desc);

-- Уникальность: один набор фото на дату для пользователя
create unique index if not exists measurement_photo_history_user_date_unique
  on public.measurement_photo_history (user_id, date);

alter table public.measurement_photo_history enable row level security;

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


-- ============================================================
-- Проверка создания таблиц
-- ============================================================

-- Проверяем, что таблицы созданы
SELECT 
  schemaname,
  tablename,
  rowsecurity as "RLS включен"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'user_measurements',
    'measurement_history',
    'measurement_photo_history'
  )
ORDER BY tablename;



