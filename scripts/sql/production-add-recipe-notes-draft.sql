-- PRODUCTION DRAFT: add recipe_notes table for persistent recipe notes
-- TARGET PRODUCTION PROJECT REF: dtsdnhbcwpbfrhcazqkb
--
-- Status: DRAFT ONLY. Do not run without explicit owner approval.
-- Scope: additive schema only; no historical recipe/diary/favorite mutations.

begin;

create table if not exists public.recipe_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists recipe_notes_user_recipe_unique
  on public.recipe_notes (user_id, recipe_id);

create index if not exists recipe_notes_user_id_idx
  on public.recipe_notes (user_id);

create index if not exists recipe_notes_recipe_id_idx
  on public.recipe_notes (recipe_id);

create or replace function public.update_recipe_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_recipe_notes_updated_at on public.recipe_notes;
create trigger update_recipe_notes_updated_at
  before update on public.recipe_notes
  for each row
  execute function public.update_recipe_notes_updated_at();

alter table public.recipe_notes enable row level security;
alter table public.recipe_notes force row level security;

revoke all on table public.recipe_notes from anon;
grant select, insert, update, delete on table public.recipe_notes to authenticated;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recipe_notes'
      and policyname = 'recipe_notes_select_own'
  ) then
    create policy recipe_notes_select_own
      on public.recipe_notes
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recipe_notes'
      and policyname = 'recipe_notes_insert_own'
  ) then
    create policy recipe_notes_insert_own
      on public.recipe_notes
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recipe_notes'
      and policyname = 'recipe_notes_update_own'
  ) then
    create policy recipe_notes_update_own
      on public.recipe_notes
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recipe_notes'
      and policyname = 'recipe_notes_delete_own'
  ) then
    create policy recipe_notes_delete_own
      on public.recipe_notes
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

comment on table public.recipe_notes is 'User-owned notes for saved recipes';
comment on column public.recipe_notes.recipe_id is 'Recipe id from public.recipes';
comment on column public.recipe_notes.text is 'User note text for the recipe';

select pg_notify('pgrst', 'reload schema');

commit;
