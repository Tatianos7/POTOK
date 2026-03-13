-- Safe migration: add canonical_food_id to favorite_products if missing
-- No destructive changes. No RLS weakening.

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'favorite_products'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'favorite_products'
      and column_name = 'canonical_food_id'
  ) then
    alter table public.favorite_products
      add column canonical_food_id uuid null;
  end if;
end $$;

create index if not exists favorite_products_canonical_food_id_idx
  on public.favorite_products (canonical_food_id);
