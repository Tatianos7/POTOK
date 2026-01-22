-- ============================================================
-- Recipe relations: favorites and collections
-- ============================================================

create table if not exists public.favorite_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

create index if not exists favorite_recipes_user_idx
  on public.favorite_recipes (user_id, created_at desc);

alter table public.favorite_recipes enable row level security;

drop policy if exists "favorite_recipes_select_own" on public.favorite_recipes;
create policy "favorite_recipes_select_own"
  on public.favorite_recipes
  for select
  using (auth.uid() = user_id);

drop policy if exists "favorite_recipes_modify_own" on public.favorite_recipes;
create policy "favorite_recipes_modify_own"
  on public.favorite_recipes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.recipe_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

create index if not exists recipe_collections_user_idx
  on public.recipe_collections (user_id, created_at desc);

alter table public.recipe_collections enable row level security;

drop policy if exists "recipe_collections_select_own" on public.recipe_collections;
create policy "recipe_collections_select_own"
  on public.recipe_collections
  for select
  using (auth.uid() = user_id);

drop policy if exists "recipe_collections_modify_own" on public.recipe_collections;
create policy "recipe_collections_modify_own"
  on public.recipe_collections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
