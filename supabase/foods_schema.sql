-- ============================================================
-- Foods table - юридически безопасная база продуктов
-- ============================================================
-- Принципы:
-- 1. Все продукты имеют обязательное поле source
-- 2. Пользовательские продукты (source='user') видны только создателю
-- 3. Открытые базы (open_food_facts, usda) доступны всем
-- 4. Не храним чужие коммерческие базы как отдельные коллекции
-- ============================================================

create table if not exists public.foods (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  name_original         text,
  barcode               text,
  calories              numeric(8,2) not null default 0,
  protein               numeric(8,2) not null default 0,
  fat                   numeric(8,2) not null default 0,
  carbs                 numeric(8,2) not null default 0,
  fiber                 numeric(8,2) not null default 0,
  unit                  text not null default 'g',
  category              text,
  brand                 text,
  source                text not null check (source in ('core', 'brand', 'user')),
  created_by_user_id    uuid references auth.users (id) on delete set null,
  canonical_food_id     uuid references public.foods (id) on delete set null,
  normalized_name       text,
  normalized_brand      text,
  nutrition_version     integer not null default 1,
  verified              boolean not null default false,
  suspicious            boolean not null default false,
  confidence_score      numeric(4,3) not null default 1,
  source_version        text,
  allergens             text[],
  intolerances          text[],
  photo                 text,
  aliases               text[], -- массив синонимов для поиска
  auto_filled           boolean not null default false,
  popularity            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Индексы для производительности
create index if not exists foods_source_idx on public.foods (source);
create index if not exists foods_created_by_user_id_idx on public.foods (created_by_user_id) where created_by_user_id is not null;
create index if not exists foods_barcode_idx on public.foods (barcode) where barcode is not null;
create index if not exists foods_name_trgm_idx on public.foods using gin (name gin_trgm_ops);
create index if not exists foods_category_idx on public.foods (category) where category is not null;
create unique index if not exists foods_normalized_unique
  on public.foods (normalized_name, coalesce(normalized_brand, ''));

-- Полнотекстовый поиск
-- Добавляем вычисляемое поле для полнотекстового поиска
alter table public.foods add column if not exists search_vector tsvector;

create or replace function normalize_food_text(value text)
returns text as $$
  select trim(regexp_replace(lower(coalesce(value, '')), '[^a-z0-9а-яё]+', ' ', 'g'));
$$ language sql immutable;

-- Функция для обновления search_vector
create or replace function foods_update_search_vector()
returns trigger as $$
begin
  new.normalized_name := normalize_food_text(new.name);
  new.normalized_brand := normalize_food_text(new.brand);
  if new.canonical_food_id is null then
    new.canonical_food_id := new.id;
  end if;
  new.search_vector := 
    setweight(to_tsvector('russian', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('russian', coalesce(new.name_original, '')), 'B') ||
    setweight(to_tsvector('russian', coalesce(array_to_string(new.aliases, ' '), '')), 'C');
  return new;
end;
$$ language plpgsql;

-- Триггер для автоматического обновления search_vector
drop trigger if exists foods_search_vector_update on public.foods;
create trigger foods_search_vector_update
  before insert or update on public.foods
  for each row
  execute function foods_update_search_vector();

-- Индекс для полнотекстового поиска
create index if not exists foods_search_idx on public.foods using gin (search_vector);

-- Триггер для обновления updated_at
create or replace function update_foods_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_foods_updated_at
  before update on public.foods
  for each row
  execute function update_foods_updated_at();

-- Row Level Security (RLS)
alter table public.foods enable row level security;

-- Политика: все могут читать core и brand продукты
drop policy if exists "foods_select_open_sources" on public.foods;
create policy "foods_select_public_sources"
  on public.foods
  for select
  using (source in ('core', 'brand'));

-- Политика: пользователи могут читать только свои user продукты
drop policy if exists "foods_select_user_sources" on public.foods;
create policy "foods_select_user_sources"
  on public.foods
  for select
  using (source = 'user' and created_by_user_id = auth.uid());

-- Политика: пользователи могут создавать свои продукты
create policy "foods_insert_user"
  on public.foods
  for insert
  with check (
    source = 'user' and created_by_user_id = auth.uid()
  );

-- Политика: админ может добавлять core/brand продукты
drop policy if exists "foods_insert_admin" on public.foods;
create policy "foods_insert_admin"
  on public.foods
  for insert
  with check (
    source in ('core', 'brand')
    and exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and is_admin = true
    )
  );

-- Политика: пользователи могут обновлять только свои продукты
create policy "foods_update_user"
  on public.foods
  for update
  using (
    source = 'user' and created_by_user_id = auth.uid()
  )
  with check (
    source = 'user' and created_by_user_id = auth.uid()
  );

-- Политика: админ может обновлять core/brand продукты
drop policy if exists "foods_update_admin" on public.foods;
create policy "foods_update_admin"
  on public.foods
  for update
  using (
    source in ('core', 'brand')
    and exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and is_admin = true
    )
  )
  with check (
    source in ('core', 'brand')
    and exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and is_admin = true
    )
  );

-- Политика: пользователи могут удалять только свои продукты
create policy "foods_delete_user"
  on public.foods
  for delete
  using (
    source = 'user' and created_by_user_id = auth.uid()
  );

-- Комментарии для документации
comment on table public.foods is 'Юридически безопасная база продуктов с обязательным указанием источника';
comment on column public.foods.source is 'Источник данных: core (базовая база), brand (продукты с брендами), user (пользовательские продукты)';
comment on column public.foods.created_by_user_id is 'ID пользователя, создавшего продукт (обязательно для source=user)';
comment on column public.foods.name is 'Русское название продукта (основное отображение)';
comment on column public.foods.name_original is 'Оригинальное/английское название';
comment on column public.foods.aliases is 'Массив синонимов для улучшения поиска';

create table if not exists public.food_aliases (
  id uuid primary key default gen_random_uuid(),
  canonical_food_id uuid not null references public.foods (id) on delete cascade,
  alias text not null,
  normalized_alias text,
  source text not null default 'core',
  verified boolean not null default false,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_alias)
);

create index if not exists food_aliases_canonical_idx
  on public.food_aliases (canonical_food_id);

alter table public.food_aliases enable row level security;

drop policy if exists "food_aliases_select_public" on public.food_aliases;
create policy "food_aliases_select_public"
  on public.food_aliases
  for select
  using (true);

drop policy if exists "food_aliases_modify_own" on public.food_aliases;
create policy "food_aliases_modify_own"
  on public.food_aliases
  for all
  using (auth.uid() = created_by_user_id)
  with check (auth.uid() = created_by_user_id);

-- Политика: админ может управлять алиасами core/brand
drop policy if exists "food_aliases_modify_admin" on public.food_aliases;
create policy "food_aliases_modify_admin"
  on public.food_aliases
  for all
  using (
    exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and is_admin = true
    )
  );

create or replace function food_aliases_normalize()
returns trigger as $$
begin
  new.normalized_alias := normalize_food_text(new.alias);
  return new;
end;
$$ language plpgsql;

drop trigger if exists food_aliases_normalize_trigger on public.food_aliases;
create trigger food_aliases_normalize_trigger
  before insert or update on public.food_aliases
  for each row
  execute function food_aliases_normalize();
