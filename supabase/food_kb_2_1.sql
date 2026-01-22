-- ============================================================
-- Phase 2.1 Food Knowledge Base migration
-- ============================================================

alter table public.foods
  add column if not exists fiber numeric(8,2) not null default 0,
  add column if not exists unit text not null default 'g',
  add column if not exists canonical_food_id uuid references public.foods (id) on delete set null,
  add column if not exists normalized_name text,
  add column if not exists normalized_brand text,
  add column if not exists nutrition_version integer not null default 1,
  add column if not exists verified boolean not null default false,
  add column if not exists suspicious boolean not null default false;

create or replace function normalize_food_text(value text)
returns text as $$
  select trim(regexp_replace(lower(coalesce(value, '')), '[^a-z0-9а-яё]+', ' ', 'g'));
$$ language sql immutable;

alter table public.foods add column if not exists search_vector tsvector;

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

 drop trigger if exists foods_search_vector_update on public.foods;
create trigger foods_search_vector_update
  before insert or update on public.foods
  for each row
  execute function foods_update_search_vector();

create unique index if not exists foods_normalized_unique
  on public.foods (normalized_name, coalesce(normalized_brand, ''));

create index if not exists foods_search_idx on public.foods using gin (search_vector);

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

alter table public.food_diary_entries
  add column if not exists canonical_food_id uuid references public.foods (id) on delete set null,
  add column if not exists fiber numeric(8,2) not null default 0;

create index if not exists food_diary_entries_canonical_idx
  on public.food_diary_entries (user_id, canonical_food_id);

alter table public.favorite_products
  add column if not exists canonical_food_id uuid references public.foods (id) on delete set null;

create index if not exists favorite_products_canonical_idx
  on public.favorite_products (user_id, canonical_food_id);
