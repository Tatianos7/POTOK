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
  category              text,
  brand                 text,
  source                text not null check (source in ('core', 'brand', 'user')),
  created_by_user_id    uuid references auth.users (id) on delete set null,
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

-- Полнотекстовый поиск
-- Добавляем вычисляемое поле для полнотекстового поиска
alter table public.foods add column if not exists search_vector tsvector;

-- Функция для обновления search_vector
create or replace function foods_update_search_vector()
returns trigger as $$
begin
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

-- Политика: все могут читать core и brand продукты, пользователи видят только свои user продукты
create policy "foods_select_open_sources"
  on public.foods
  for select
  using (
    source in ('core', 'brand')
    or (source = 'user' and created_by_user_id = auth.uid())
  );

-- Политика: пользователи могут создавать свои продукты
create policy "foods_insert_user"
  on public.foods
  for insert
  with check (
    source = 'user' and created_by_user_id = auth.uid()
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

