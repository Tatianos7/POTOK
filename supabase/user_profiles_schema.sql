-- ============================================================
-- Таблица для профилей пользователей (User Profiles) в POTOK
-- Выполни этот SQL в Supabase SQL Editor
-- ============================================================

-- USER_PROFILES (профили пользователей) ---------------------

create table if not exists public.user_profiles (
  user_id          uuid primary key,
  first_name       text,
  last_name        text,
  middle_name      text,
  birth_date       date,
  age              integer,
  height           numeric(5,2),  -- рост в см
  goal             text,          -- цель пользователя (например, "Похудение", "Набор массы")
  email            text,
  phone            text,
  avatar_url       text,          -- URL аватара (если храним в Storage) или base64
  has_premium      boolean not null default false,
  is_admin         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists user_profiles_user_idx
  on public.user_profiles (user_id);

create index if not exists user_profiles_email_idx
  on public.user_profiles (email)
  where email is not null;

create index if not exists user_profiles_phone_idx
  on public.user_profiles (phone)
  where phone is not null;

-- ВРЕМЕННО ОТКЛЮЧАЕМ RLS (для работы с локальной авторизацией)
-- alter table public.user_profiles disable row level security;

-- Функция для автоматического обновления updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Триггер для автоматического обновления updated_at
drop trigger if exists update_user_profiles_updated_at on public.user_profiles;
create trigger update_user_profiles_updated_at
  before update on public.user_profiles
  for each row
  execute function update_updated_at_column();

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

