-- ============================================================
-- Supabase / PostgreSQL schema for POTOK fitness app backend
-- ============================================================

-- 1. USER GOALS ------------------------------------------------

create table if not exists public.user_goals (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  calories    integer    not null,
  protein     numeric(6,2) not null,
  fat         numeric(6,2) not null,
  carbs       numeric(6,2) not null,
  updated_at  timestamptz not null default now()
);

alter table public.user_goals enable row level security;

create policy "user_goals_select_own"
  on public.user_goals
  for select
  using (auth.uid() = user_id);

create policy "user_goals_upsert_own"
  on public.user_goals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- 2. FOOD DIARY ENTRIES ---------------------------------------

create table if not exists public.food_diary_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  date         date not null,
  meal_type    text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  product_name text not null,
  protein      numeric(8,2) not null default 0,
  fat          numeric(8,2) not null default 0,
  carbs        numeric(8,2) not null default 0,
  fiber        numeric(8,2) not null default 0,
  calories     numeric(8,2) not null default 0,
  weight       numeric(8,2) not null default 0,
  canonical_food_id uuid references public.foods (id) on delete set null,
  idempotency_key text,
  created_at   timestamptz not null default now()
);

create index if not exists food_diary_entries_user_date_idx
  on public.food_diary_entries (user_id, date, meal_type);

create unique index if not exists food_diary_entries_idempotency_unique
  on public.food_diary_entries (user_id, idempotency_key)
  where idempotency_key is not null;

alter table public.food_diary_entries enable row level security;

create policy "food_diary_select_own"
  on public.food_diary_entries
  for select
  using (auth.uid() = user_id);

create policy "food_diary_modify_own"
  on public.food_diary_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- 3. FAVORITE PRODUCTS ----------------------------------------

create table if not exists public.favorite_products (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  product_name text not null,
  canonical_food_id uuid references public.foods (id) on delete set null,
  protein      numeric(8,2) not null default 0,
  fat          numeric(8,2) not null default 0,
  carbs        numeric(8,2) not null default 0,
  calories     numeric(8,2) not null default 0,
  canonical_food_id uuid references public.foods (id) on delete set null,
  usage_count  integer not null default 0,
  created_at   timestamptz not null default now()
);

create unique index if not exists favorite_products_user_unique
  on public.favorite_products (user_id, product_name);

alter table public.favorite_products enable row level security;

create policy "favorite_products_select_own"
  on public.favorite_products
  for select
  using (auth.uid() = user_id);

create policy "favorite_products_modify_own"
  on public.favorite_products
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- 4. RECIPES ---------------------------------------------------

create table if not exists public.recipes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  ingredients    jsonb not null, -- хранит список ингредиентов
  total_calories numeric(10,2) not null default 0,
  protein        numeric(10,2) not null default 0,
  fat            numeric(10,2) not null default 0,
  carbs          numeric(10,2) not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists recipes_user_idx
  on public.recipes (user_id, created_at desc);

alter table public.recipes enable row level security;

create policy "recipes_select_own"
  on public.recipes
  for select
  using (auth.uid() = user_id);

create policy "recipes_modify_own"
  on public.recipes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- 5. HABITS ----------------------------------------------------

create table if not exists public.habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  description text,
  frequency   text not null check (frequency in ('daily','weekly')),
  created_at  timestamptz not null default now(),
  is_active   boolean not null default true
);

create index if not exists habits_user_idx
  on public.habits (user_id, is_active, created_at desc);

alter table public.habits enable row level security;

create policy "habits_select_own"
  on public.habits
  for select
  using (auth.uid() = user_id);

create policy "habits_modify_own"
  on public.habits
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- 6. HABIT LOGS -----------------------------------------------

create table if not exists public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  habit_id   uuid not null references public.habits (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       date not null,
  completed  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (habit_id, date)  -- одна запись на день для привычки
);

create index if not exists habit_logs_user_date_idx
  on public.habit_logs (user_id, date);

alter table public.habit_logs enable row level security;

create policy "habit_logs_select_own"
  on public.habit_logs
  for select
  using (auth.uid() = user_id);

create policy "habit_logs_modify_own"
  on public.habit_logs
  for all
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.habits h
      where h.id = habit_id and h.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.habits h
      where h.id = habit_id and h.user_id = auth.uid()
    )
  );


-- 7. ANALYTICS EVENTS -----------------------------------------

create table if not exists public.analytics_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  event_name text not null,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_user_idx
  on public.analytics_events (user_id, created_at desc);

alter table public.analytics_events enable row level security;

create policy "analytics_events_select_own"
  on public.analytics_events
  for select
  using (auth.uid() = user_id);

create policy "analytics_events_insert_own"
  on public.analytics_events
  for insert
  with check (auth.uid() = user_id);


