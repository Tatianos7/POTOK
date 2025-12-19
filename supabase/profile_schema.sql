-- ============================================================
-- Таблица для профиля пользователя (User Profiles) в POTOK
-- Выполни этот SQL в Supabase SQL Editor
-- ============================================================

-- USER_PROFILES (профиль пользователя) ----------------------

create table if not exists public.user_profiles (
  user_id          uuid primary key,
  first_name       text,
  last_name        text,
  middle_name      text,
  birth_date       date,
  age              integer,
  height           numeric(5,2),  -- рост в см
  goal             text,           -- цель пользователя
  email            text,
  phone            text,
  avatar_url       text,           -- URL аватара (Supabase Storage или base64)
  has_premium      boolean not null default false,
  is_admin         boolean not null default false,
  subscription_type text,          -- 'monthly' | 'yearly' | null
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists user_profiles_email_idx
  on public.user_profiles (email)
  where email is not null;

create index if not exists user_profiles_phone_idx
  on public.user_profiles (phone)
  where phone is not null;

-- ВРЕМЕННО ОТКЛЮЧАЕМ RLS (для работы с локальной авторизацией)
-- alter table public.user_profiles disable row level security;

-- Для продакшена с Supabase Auth используйте:
-- alter table public.user_profiles enable row level security;
-- 
-- create policy "user_profiles_select_own"
--   on public.user_profiles
--   for select
--   using (auth.uid() = user_id);
--
-- create policy "user_profiles_modify_own"
--   on public.user_profiles
--   for all
--   using (auth.uid() = user_id)
--   with check (auth.uid() = user_id);

-- ============================================================
-- Проверка создания таблицы
-- ============================================================

-- Проверяем, что таблица создана
SELECT 
  schemaname,
  tablename,
  rowsecurity as "RLS включен"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'user_profiles';

