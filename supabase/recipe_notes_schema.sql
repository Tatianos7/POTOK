-- ============================================================
-- Recipe Notes table - заметки к рецептам
-- ============================================================
-- Принципы:
-- 1. Каждый пользователь может иметь только одну заметку к рецепту
-- 2. Заметка привязана к пользователю и рецепту
-- 3. Заметка видна только создателю
-- ============================================================

create table if not exists public.recipe_notes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  recipe_id     text not null, -- ID рецепта (может быть не UUID, так как рецепты хранятся в localStorage)
  text          text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Уникальный индекс: один пользователь - одна заметка на рецепт
create unique index if not exists recipe_notes_user_recipe_unique 
  on public.recipe_notes (user_id, recipe_id);

-- Индекс для быстрого поиска заметок пользователя
create index if not exists recipe_notes_user_id_idx 
  on public.recipe_notes (user_id);

-- Индекс для быстрого поиска заметок рецепта
create index if not exists recipe_notes_recipe_id_idx 
  on public.recipe_notes (recipe_id);

-- Триггер для обновления updated_at
create or replace function update_recipe_notes_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_recipe_notes_updated_at
  before update on public.recipe_notes
  for each row
  execute function update_recipe_notes_updated_at();

-- Row Level Security (RLS)
alter table public.recipe_notes enable row level security;

-- Политика: пользователи могут читать только свои заметки
create policy "recipe_notes_select_own"
  on public.recipe_notes
  for select
  using (auth.uid() = user_id);

-- Политика: пользователи могут создавать только свои заметки
create policy "recipe_notes_insert_own"
  on public.recipe_notes
  for insert
  with check (auth.uid() = user_id);

-- Политика: пользователи могут обновлять только свои заметки
create policy "recipe_notes_update_own"
  on public.recipe_notes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Политика: пользователи могут удалять только свои заметки
create policy "recipe_notes_delete_own"
  on public.recipe_notes
  for delete
  using (auth.uid() = user_id);

-- Комментарии для документации
comment on table public.recipe_notes is 'Заметки пользователей к рецептам';
comment on column public.recipe_notes.recipe_id is 'ID рецепта (может быть не UUID, так как рецепты хранятся в localStorage)';
comment on column public.recipe_notes.text is 'Текст заметки (способ приготовления блюда)';

