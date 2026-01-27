-- ============================================================
-- Food Ingestion Pipeline (staging + conflicts + admin tooling)
-- ============================================================

create table if not exists public.food_import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null,
  source_version text,
  filename text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_import_staging (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.food_import_batches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  brand text,
  calories numeric(8,2) not null default 0,
  protein numeric(8,2) not null default 0,
  fat numeric(8,2) not null default 0,
  carbs numeric(8,2) not null default 0,
  fiber numeric(8,2) not null default 0,
  unit text not null default 'g',
  aliases text[],
  allergens text[],
  intolerances text[],
  source text not null default 'core',
  source_version text,
  normalized_name text,
  normalized_brand text,
  confidence_score numeric(4,3) not null default 0.7,
  verified boolean not null default false,
  suspicious boolean not null default false,
  status text not null default 'pending',
  conflict_reason text,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_import_conflicts (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.food_import_batches (id) on delete cascade,
  staging_id uuid not null references public.food_import_staging (id) on delete cascade,
  conflict_type text not null,
  details jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists food_import_staging_batch_idx on public.food_import_staging (batch_id);
create index if not exists food_import_staging_status_idx on public.food_import_staging (status);
create index if not exists food_import_conflicts_batch_idx on public.food_import_conflicts (batch_id);

alter table public.food_import_batches enable row level security;
alter table public.food_import_staging enable row level security;
alter table public.food_import_conflicts enable row level security;

create policy "food_import_batches_owner"
  on public.food_import_batches
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "food_import_staging_owner"
  on public.food_import_staging
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "food_import_conflicts_owner"
  on public.food_import_conflicts
  for all
  using (auth.uid() = (select user_id from public.food_import_batches where id = batch_id))
  with check (auth.uid() = (select user_id from public.food_import_batches where id = batch_id));

create or replace function update_food_import_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_food_import_batches_updated_at
  before update on public.food_import_batches
  for each row
  execute function update_food_import_updated_at();

create trigger update_food_import_staging_updated_at
  before update on public.food_import_staging
  for each row
  execute function update_food_import_updated_at();

create trigger update_food_import_conflicts_updated_at
  before update on public.food_import_conflicts
  for each row
  execute function update_food_import_updated_at();

-- RPC: recompute diary entries for canonical foods (admin only)
create or replace function public.recompute_food_entries_for_food_ids(food_ids uuid[])
returns void as $$
begin
  if not exists (
    select 1 from public.user_profiles
    where user_id = auth.uid() and is_admin = true
  ) then
    raise exception 'Admin only';
  end if;

  update public.food_diary_entries fde
  set
    calories = round((f.calories * fde.weight / 100.0)::numeric, 2),
    protein = round((f.protein * fde.weight / 100.0)::numeric, 2),
    fat = round((f.fat * fde.weight / 100.0)::numeric, 2),
    carbs = round((f.carbs * fde.weight / 100.0)::numeric, 2),
    fiber = round((f.fiber * fde.weight / 100.0)::numeric, 2)
  from public.foods f
  where fde.canonical_food_id = f.id
    and f.id = any(food_ids);
end;
$$ language plpgsql security definer;

