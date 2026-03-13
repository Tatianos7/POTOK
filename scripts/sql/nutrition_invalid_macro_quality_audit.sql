-- nutrition invalid macro quality audit
-- Read-only

-- =========================================================
-- SECTION A: Summary by source
-- =========================================================
with invalid_foods as (
  select
    f.id,
    f.source,
    f.calories,
    f.protein,
    f.fat,
    f.carbs
  from public.foods f
  where
    f.calories is null
    or f.protein is null
    or f.fat is null
    or f.carbs is null
    or f.calories < 0
    or f.protein < 0
    or f.fat < 0
    or f.carbs < 0
    or (
      coalesce(f.calories, 0) = 0
      and coalesce(f.protein, 0) = 0
      and coalesce(f.fat, 0) = 0
      and coalesce(f.carbs, 0) = 0
    )
)
select
  count(*) as invalid_food_rows,
  count(*) filter (where source = 'core') as invalid_core_rows,
  count(*) filter (where source = 'brand') as invalid_brand_rows,
  count(*) filter (where source = 'user') as invalid_user_rows
from invalid_foods;

-- =========================================================
-- SECTION B: Usage impact
-- =========================================================
with has_fav_canonical as (
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'favorite_products'
      and column_name = 'canonical_food_id'
  ) as value
), invalid_foods as (
  select
    f.id,
    f.source
  from public.foods f
  where
    f.calories is null
    or f.protein is null
    or f.fat is null
    or f.carbs is null
    or f.calories < 0
    or f.protein < 0
    or f.fat < 0
    or f.carbs < 0
    or (
      coalesce(f.calories, 0) = 0
      and coalesce(f.protein, 0) = 0
      and coalesce(f.fat, 0) = 0
      and coalesce(f.carbs, 0) = 0
    )
), recipe_usage as (
  select food_id, count(*) as recipe_refs
  from public.recipe_ingredients
  group by food_id
), diary_usage as (
  select canonical_food_id as food_id, count(*) as diary_refs
  from public.food_diary_entries
  where canonical_food_id is not null
  group by canonical_food_id
), favorite_usage as (
  select
    case
      when (select value from has_fav_canonical)
        then nullif(to_jsonb(fp)->>'canonical_food_id', '')::uuid
      else null
    end as food_id,
    count(*) as favorite_refs
  from public.favorite_products fp
  group by 1
)
select
  count(*) filter (where coalesce(r.recipe_refs, 0) > 0) as used_in_recipes,
  count(*) filter (where coalesce(d.diary_refs, 0) > 0) as used_in_diary,
  count(*) filter (where coalesce(f.favorite_refs, 0) > 0) as used_in_favorites,
  count(*) filter (
    where coalesce(r.recipe_refs, 0) > 0
       or coalesce(d.diary_refs, 0) > 0
       or coalesce(f.favorite_refs, 0) > 0
  ) as used_anywhere
from invalid_foods z
left join recipe_usage r on r.food_id = z.id
left join diary_usage d on d.food_id = z.id
left join favorite_usage f on f.food_id = z.id;

-- =========================================================
-- SECTION C: Details
-- =========================================================
with has_fav_canonical as (
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'favorite_products'
      and column_name = 'canonical_food_id'
  ) as value
), invalid_foods as (
  select
    f.id,
    f.name,
    f.source,
    f.created_by_user_id,
    f.calories,
    f.protein,
    f.fat,
    f.carbs,
    case
      when f.calories is null then 'calories_null'
      when f.protein is null then 'protein_null'
      when f.fat is null then 'fat_null'
      when f.carbs is null then 'carbs_null'
      when f.calories < 0 then 'calories_negative'
      when f.protein < 0 then 'protein_negative'
      when f.fat < 0 then 'fat_negative'
      when f.carbs < 0 then 'carbs_negative'
      when coalesce(f.calories, 0) = 0
       and coalesce(f.protein, 0) = 0
       and coalesce(f.fat, 0) = 0
       and coalesce(f.carbs, 0) = 0 then 'all_zero_macros'
      else 'unknown'
    end as invalid_reason
  from public.foods f
  where
    f.calories is null
    or f.protein is null
    or f.fat is null
    or f.carbs is null
    or f.calories < 0
    or f.protein < 0
    or f.fat < 0
    or f.carbs < 0
    or (
      coalesce(f.calories, 0) = 0
      and coalesce(f.protein, 0) = 0
      and coalesce(f.fat, 0) = 0
      and coalesce(f.carbs, 0) = 0
    )
), recipe_usage as (
  select food_id, count(*) as recipe_refs
  from public.recipe_ingredients
  group by food_id
), diary_usage as (
  select canonical_food_id as food_id, count(*) as diary_refs
  from public.food_diary_entries
  where canonical_food_id is not null
  group by canonical_food_id
), favorite_usage as (
  select
    case
      when (select value from has_fav_canonical)
        then nullif(to_jsonb(fp)->>'canonical_food_id', '')::uuid
      else null
    end as food_id,
    count(*) as favorite_refs
  from public.favorite_products fp
  group by 1
)
select
  z.id,
  z.name,
  z.source,
  z.created_by_user_id,
  z.calories,
  z.protein,
  z.fat,
  z.carbs,
  z.invalid_reason,
  coalesce(r.recipe_refs, 0) as recipe_refs,
  coalesce(d.diary_refs, 0) as diary_refs,
  coalesce(f.favorite_refs, 0) as favorite_refs
from invalid_foods z
left join recipe_usage r on r.food_id = z.id
left join diary_usage d on d.food_id = z.id
left join favorite_usage f on f.food_id = z.id
order by
  coalesce(r.recipe_refs, 0) desc,
  coalesce(d.diary_refs, 0) desc,
  coalesce(f.favorite_refs, 0) desc,
  z.source,
  z.name;
