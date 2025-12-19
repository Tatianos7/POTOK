-- ============================================================
-- Supabase / PostgreSQL schema for POTOK fitness app backend
-- ИСПРАВЛЕННАЯ ВЕРСИЯ: RLS политики работают без Supabase Auth
-- ============================================================

-- ВАЖНО: Эта схема использует альтернативный подход для RLS
-- Вместо auth.uid() мы используем параметр запроса или отключаем RLS
-- Для продакшена рекомендуется использовать Supabase Auth

-- 1. USER GOALS ------------------------------------------------

create table if not exists public.user_goals (
  user_id     uuid primary key,
  calories    integer    not null,
  protein     numeric(6,2) not null,
  fat         numeric(6,2) not null,
  carbs       numeric(6,2) not null,
  updated_at  timestamptz not null default now()
);

-- ВРЕМЕННО ОТКЛЮЧАЕМ RLS для работы с локальной авторизацией
-- В продакшене включите RLS и используйте Supabase Auth
-- alter table public.user_goals enable row level security;

-- Для продакшена с Supabase Auth используйте:
-- create policy "user_goals_select_own"
--   on public.user_goals
--   for select
--   using (auth.uid() = user_id);
--
-- create policy "user_goals_upsert_own"
--   on public.user_goals
--   for all
--   using (auth.uid() = user_id)
--   with check (auth.uid() = user_id);


-- 2. FOOD DIARY ENTRIES ---------------------------------------

create table if not exists public.food_diary_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  date         date not null,
  meal_type    text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  product_name text not null,
  protein      numeric(8,2) not null default 0,
  fat          numeric(8,2) not null default 0,
  carbs        numeric(8,2) not null default 0,
  calories     numeric(8,2) not null default 0,
  weight       numeric(8,2) not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists food_diary_entries_user_date_idx
  on public.food_diary_entries (user_id, date, meal_type);

-- ВРЕМЕННО ОТКЛЮЧАЕМ RLS
-- alter table public.food_diary_entries enable row level security;


-- 3. FAVORITE PRODUCTS ----------------------------------------

create table if not exists public.favorite_products (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  product_name text not null,
  protein      numeric(8,2) not null default 0,
  fat          numeric(8,2) not null default 0,
  carbs        numeric(8,2) not null default 0,
  calories     numeric(8,2) not null default 0,
  usage_count  integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists favorite_products_user_idx
  on public.favorite_products (user_id, product_name);

-- ВРЕМЕННО ОТКЛЮЧАЕМ RLS
-- alter table public.favorite_products enable row level security;


-- 4. RECIPES ---------------------------------------------------

create table if not exists public.recipes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  name           text not null,
  ingredients    jsonb not null,
  total_calories numeric(10,2) not null default 0,
  protein        numeric(10,2) not null default 0,
  fat            numeric(10,2) not null default 0,
  carbs          numeric(10,2) not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists recipes_user_idx
  on public.recipes (user_id, created_at desc);

-- ВРЕМЕННО ОТКЛЮЧАЕМ RLS
-- alter table public.recipes enable row level security;


-- 5. HABITS ----------------------------------------------------

create table if not exists public.habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  title       text not null,
  description text,
  frequency   text not null check (frequency in ('daily','weekly')),
  created_at  timestamptz not null default now(),
  is_active   boolean not null default true
);

create index if not exists habits_user_idx
  on public.habits (user_id, is_active, created_at desc);

-- ВРЕМЕННО ОТКЛЮЧАЕМ RLS
-- alter table public.habits enable row level security;


-- 6. HABIT LOGS -----------------------------------------------

create table if not exists public.habit_logs (
  id          uuid primary key default gen_random_uuid(),
  habit_id    uuid not null references public.habits (id) on delete cascade,
  user_id     uuid not null,
  date        date not null,
  completed   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (habit_id, date)
);

create index if not exists habit_logs_user_date_idx
  on public.habit_logs (user_id, date);

-- ВРЕМЕННО ОТКЛЮЧАЕМ RLS
-- alter table public.habit_logs enable row level security;


-- 7. ANALYTICS EVENTS -----------------------------------------

create table if not exists public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  event_name  text not null,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists analytics_events_user_date_idx
  on public.analytics_events (user_id, created_at desc);

-- ВРЕМЕННО ОТКЛЮЧАЕМ RLS
-- alter table public.analytics_events enable row level security;

