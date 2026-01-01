-- ============================================================
-- Таблица для заметок к продуктам в приёмах пищи
-- ============================================================

create table if not exists public.meal_entry_notes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  meal_entry_id uuid not null,  -- ID записи из food_diary_entries
  product_id    uuid,            -- ID продукта (опционально, для будущего использования)
  text          text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Индексы для быстрого поиска
create index if not exists meal_entry_notes_user_idx
  on public.meal_entry_notes (user_id);

create index if not exists meal_entry_notes_entry_idx
  on public.meal_entry_notes (meal_entry_id);

-- Уникальность: одна заметка на одну запись приёма пищи
create unique index if not exists meal_entry_notes_entry_unique
  on public.meal_entry_notes (meal_entry_id);

-- ВРЕМЕННО ОТКЛЮЧАЕМ RLS (для работы с локальной авторизацией)
-- В продакшене с Supabase Auth включите RLS и используйте:
-- alter table public.meal_entry_notes enable row level security;
--
-- create policy "meal_entry_notes_select_own"
--   on public.meal_entry_notes
--   for select
--   using (auth.uid() = user_id);
--
-- create policy "meal_entry_notes_insert_own"
--   on public.meal_entry_notes
--   for insert
--   with check (auth.uid() = user_id);
--
-- create policy "meal_entry_notes_update_own"
--   on public.meal_entry_notes
--   for update
--   using (auth.uid() = user_id)
--   with check (auth.uid() = user_id);
--
-- create policy "meal_entry_notes_delete_own"
--   on public.meal_entry_notes
--   for delete
--   using (auth.uid() = user_id);

-- Функция для автоматического обновления updated_at
create or replace function update_meal_entry_notes_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Триггер для автоматического обновления updated_at
create trigger update_meal_entry_notes_updated_at
  before update on public.meal_entry_notes
  for each row
  execute function update_meal_entry_notes_updated_at();

