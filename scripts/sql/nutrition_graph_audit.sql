-- Nutrition unified graph audit (read-only)
-- Run as postgres in Supabase SQL Editor

-- 1) Schema presence / key linkage columns
with required_columns as (
  select * from (values
    ('foods','id'),
    ('foods','source'),
    ('foods','calories'),
    ('foods','protein'),
    ('foods','fat'),
    ('foods','carbs'),
    ('foods','created_by_user_id'),
    ('food_diary_entries','canonical_food_id'),
    ('food_diary_entries','product_name'),
    ('favorite_products','canonical_food_id'),
    ('favorite_products','product_name'),
    ('recipe_ingredients','food_id'),
    ('recipe_ingredients','recipe_id'),
    ('recipes','ingredients')
  ) as t(table_name, column_name)
)
select
  rc.table_name,
  rc.column_name,
  exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = rc.table_name
      and c.column_name = rc.column_name
  ) as exists_in_db
from required_columns rc
order by rc.table_name, rc.column_name;

-- 2) food_diary_entries linkage quality
select
  count(*) as total_rows,
  count(*) filter (where canonical_food_id is not null) as rows_with_canonical_food_id,
  count(*) filter (where canonical_food_id is null) as rows_without_canonical_food_id,
  count(*) filter (where canonical_food_id is not null and product_name is not null and btrim(product_name) <> '') as rows_with_both,
  count(*) filter (where canonical_food_id is null and (product_name is null or btrim(product_name) = '')) as rows_with_neither
from public.food_diary_entries;

-- 3) favorite_products linkage quality (safe for DBs without canonical_food_id)
with fav as (
  select to_jsonb(fp) as row_json
  from public.favorite_products fp
), has_col as (
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'favorite_products'
      and column_name = 'canonical_food_id'
  ) as has_canonical
)
select
  (select has_canonical from has_col) as canonical_column_exists,
  count(*) as total_rows,
  count(*) filter (where coalesce(row_json->>'canonical_food_id', '') <> '') as rows_with_canonical_food_id,
  count(*) filter (where coalesce(row_json->>'canonical_food_id', '') = '') as rows_without_canonical_food_id
from fav;

-- 4) recipe graph integrity
select
  count(*) as recipe_rows,
  count(*) filter (where coalesce(jsonb_array_length(ingredients), 0) > 0) as recipes_with_json_ingredients,
  count(*) filter (where coalesce(jsonb_array_length(ingredients), 0) = 0) as recipes_without_json_ingredients
from public.recipes;

with ingredient_counts as (
  select
    r.id as recipe_id,
    count(ri.id) as graph_ingredients_count,
    coalesce(jsonb_array_length(r.ingredients), 0) as json_ingredients_count
  from public.recipes r
  left join public.recipe_ingredients ri on ri.recipe_id = r.id
  group by r.id, r.ingredients
)
select
  count(*) as recipes_total,
  count(*) filter (where graph_ingredients_count > 0) as recipes_with_graph_ingredients,
  count(*) filter (where graph_ingredients_count = 0) as recipes_without_graph_ingredients,
  count(*) filter (where graph_ingredients_count > 0 and json_ingredients_count = 0) as graph_only,
  count(*) filter (where graph_ingredients_count = 0 and json_ingredients_count > 0) as json_only,
  count(*) filter (where graph_ingredients_count > 0 and json_ingredients_count > 0) as both_graph_and_json
from ingredient_counts;

-- 5) Invalid recipe ingredient food nutrients (null or all zeros)
select
  ri.recipe_id,
  ri.food_id,
  f.name,
  f.calories,
  f.protein,
  f.fat,
  f.carbs,
  ri.amount_g,
  case
    when f.calories is null or f.protein is null or f.fat is null or f.carbs is null then 'null_nutrients'
    when coalesce(f.calories,0)=0 and coalesce(f.protein,0)=0 and coalesce(f.fat,0)=0 and coalesce(f.carbs,0)=0 then 'all_zero_nutrients'
    else 'ok'
  end as nutrient_status
from public.recipe_ingredients ri
join public.foods f on f.id = ri.food_id
where (f.calories is null or f.protein is null or f.fat is null or f.carbs is null)
   or (coalesce(f.calories,0)=0 and coalesce(f.protein,0)=0 and coalesce(f.fat,0)=0 and coalesce(f.carbs,0)=0)
order by ri.recipe_id, f.name
limit 500;

-- 6) Candidate backfill for diary canonical_food_id by normalized name / alias
with diary_missing as (
  select
    e.id,
    e.user_id,
    e.date,
    e.product_name,
    lower(regexp_replace(coalesce(e.product_name,''), '[^a-z0-9а-яё]+', ' ', 'gi')) as normalized_product_name
  from public.food_diary_entries e
  where e.canonical_food_id is null
    and coalesce(btrim(e.product_name), '') <> ''
), direct_match as (
  select
    d.id as entry_id,
    f.id as matched_food_id,
    'foods.normalized_name' as match_source
  from diary_missing d
  join public.foods f
    on f.normalized_name = trim(regexp_replace(d.normalized_product_name, ' +', ' ', 'g'))
), alias_match as (
  select
    d.id as entry_id,
    a.canonical_food_id as matched_food_id,
    'food_aliases.normalized_alias' as match_source
  from diary_missing d
  join public.food_aliases a
    on a.normalized_alias = trim(regexp_replace(d.normalized_product_name, ' +', ' ', 'g'))
)
select
  count(*) as diary_rows_missing_canonical,
  count(*) filter (where dm.entry_id is not null) as direct_food_matches,
  count(*) filter (where am.entry_id is not null) as alias_matches
from diary_missing d
left join direct_match dm on dm.entry_id = d.id
left join alias_match am on am.entry_id = d.id;
