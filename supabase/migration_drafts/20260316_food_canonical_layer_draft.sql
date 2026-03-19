-- Food Canonical Layer draft migration
-- DRAFT ONLY
-- Do not apply blindly.
-- Purpose:
-- - add safe, non-destructive schema supports for canonical food resolution
-- - avoid data rewrites and destructive constraints in the first rollout

begin;

-- 1) Index canonical root traversals explicitly
create index if not exists foods_canonical_food_id_idx
  on public.foods (canonical_food_id);

-- 2) Make canonical status queryable without requiring a data rewrite
alter table public.foods
  add column if not exists canonical_resolution_status text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'foods_canonical_resolution_status_check'
  ) then
    alter table public.foods
      add constraint foods_canonical_resolution_status_check
      check (
        canonical_resolution_status is null
        or canonical_resolution_status in (
          'canonical',
          'variant',
          'user_canonical',
          'user_variant',
          'needs_review',
          'legacy_unresolved'
        )
      ) not valid;
  end if;
end $$;

-- 3) Allow future non-destructive deprecation of duplicate standalone rows
alter table public.foods
  add column if not exists superseded_by_food_id uuid references public.foods(id) on delete set null;

create index if not exists foods_superseded_by_food_id_idx
  on public.foods (superseded_by_food_id)
  where superseded_by_food_id is not null;

-- 4) Add explicit alias provenance for resolver decisions
alter table public.food_aliases
  add column if not exists resolver_priority integer not null default 100;

create index if not exists food_aliases_normalized_alias_priority_idx
  on public.food_aliases (normalized_alias, resolver_priority, canonical_food_id);

-- 5) Add optional resolver diagnostics on downstream rows without changing flows
alter table public.food_diary_entries
  add column if not exists canonical_resolution_source text;

alter table public.favorite_products
  add column if not exists canonical_resolution_source text;

alter table public.recipe_ingredients
  add column if not exists canonical_resolution_source text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'food_diary_entries_canonical_resolution_source_check'
  ) then
    alter table public.food_diary_entries
      add constraint food_diary_entries_canonical_resolution_source_check
      check (
        canonical_resolution_source is null
        or canonical_resolution_source in (
          'resolver_exact',
          'resolver_alias',
          'resolver_barcode',
          'resolver_manual',
          'legacy',
          'user_food'
        )
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'favorite_products_canonical_resolution_source_check'
  ) then
    alter table public.favorite_products
      add constraint favorite_products_canonical_resolution_source_check
      check (
        canonical_resolution_source is null
        or canonical_resolution_source in (
          'resolver_exact',
          'resolver_alias',
          'resolver_barcode',
          'resolver_manual',
          'legacy',
          'user_food'
        )
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'recipe_ingredients_canonical_resolution_source_check'
  ) then
    alter table public.recipe_ingredients
      add constraint recipe_ingredients_canonical_resolution_source_check
      check (
        canonical_resolution_source is null
        or canonical_resolution_source in (
          'resolver_exact',
          'resolver_alias',
          'resolver_barcode',
          'resolver_manual',
          'legacy',
          'user_food'
        )
      ) not valid;
  end if;
end $$;

-- 6) Tighten future canonical roots gradually without breaking legacy rows
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'foods_canonical_food_id_present_check'
  ) then
    alter table public.foods
      add constraint foods_canonical_food_id_present_check
      check (canonical_food_id is not null) not valid;
  end if;
end $$;

commit;
