-- ============================================================
-- Таблица заметок к конкретным записям упражнений в дневнике тренировок
-- ============================================================

create table if not exists public.workout_entry_notes (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  workout_entry_id uuid not null references public.workout_entries (id) on delete cascade,
  text             text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists workout_entry_notes_user_idx
  on public.workout_entry_notes (user_id);

create index if not exists workout_entry_notes_entry_idx
  on public.workout_entry_notes (workout_entry_id);

create unique index if not exists workout_entry_notes_entry_unique
  on public.workout_entry_notes (workout_entry_id);

alter table public.workout_entry_notes enable row level security;

drop policy if exists "workout_entry_notes_select_own" on public.workout_entry_notes;
create policy "workout_entry_notes_select_own"
  on public.workout_entry_notes
  for select
  using (auth.uid() = user_id);

drop policy if exists "workout_entry_notes_insert_own" on public.workout_entry_notes;
create policy "workout_entry_notes_insert_own"
  on public.workout_entry_notes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "workout_entry_notes_update_own" on public.workout_entry_notes;
create policy "workout_entry_notes_update_own"
  on public.workout_entry_notes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "workout_entry_notes_delete_own" on public.workout_entry_notes;
create policy "workout_entry_notes_delete_own"
  on public.workout_entry_notes
  for delete
  using (auth.uid() = user_id);

create or replace function update_workout_entry_notes_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_workout_entry_notes_updated_at on public.workout_entry_notes;
create trigger update_workout_entry_notes_updated_at
  before update on public.workout_entry_notes
  for each row
  execute function update_workout_entry_notes_updated_at();
