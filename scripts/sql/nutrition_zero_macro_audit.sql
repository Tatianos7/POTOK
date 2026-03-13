-- foods zero-macro audit
-- Read-only

with has_fav_canonical as (
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'favorite_products'
      and column_name = 'canonical_food_id'
  ) as value
), zero_macro_foods as (
  select
    f.id,
    f.name,
    f.source,
    f.created_by_user_id,
    f.calories,
    f.protein,
    f.fat,
    f.carbs,
    (f.calories is null or f.protein is null or f.fat is null or f.carbs is null) as has_null_macros,
    (coalesce(f.calories, 0) = 0 and coalesce(f.protein, 0) = 0 and coalesce(f.fat, 0) = 0 and coalesce(f.carbs, 0) = 0) as all_zero_macros
  from public.foods f
  where
    f.calories is null or f.protein is null or f.fat is null or f.carbs is null
    or (
      coalesce(f.calories, 0) = 0 and coalesce(f.protein, 0) = 0 and coalesce(f.fat, 0) = 0 and coalesce(f.carbs, 0) = 0
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
        then (to_jsonb(fp)->>'canonical_food_id')::uuid
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
  z.has_null_macros,
  z.all_zero_macros,
  coalesce(r.recipe_refs, 0) as recipe_refs,
  coalesce(d.diary_refs, 0) as diary_refs,
  coalesce(f.favorite_refs, 0) as favorite_refs,
  case
    when coalesce(r.recipe_refs, 0) > 0 then 'critical'
    when coalesce(d.diary_refs, 0) > 0 or coalesce(f.favorite_refs, 0) > 0 then 'medium'
    else 'low'
  end as severity
from zero_macro_foods z
left join recipe_usage r on r.food_id = z.id
left join diary_usage d on d.food_id = z.id
left join favorite_usage f on f.food_id = z.id
order by
  case
    when coalesce(r.recipe_refs, 0) > 0 then 1
    when coalesce(d.diary_refs, 0) > 0 or coalesce(f.favorite_refs, 0) > 0 then 2
    else 3
  end,
  z.name;

select
  count(*) as zero_macro_food_rows,
  count(*) filter (where severity = 'critical') as critical_rows,
  count(*) filter (where severity = 'medium') as medium_rows,
  count(*) filter (where severity = 'low') as low_rows
from (
  with has_fav_canonical as (
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'favorite_products'
        and column_name = 'canonical_food_id'
    ) as value
  ), zero_macro_foods as (
    select
      f.id
    from public.foods f
    where
      f.calories is null or f.protein is null or f.fat is null or f.carbs is null
      or (
        coalesce(f.calories, 0) = 0 and coalesce(f.protein, 0) = 0 and coalesce(f.fat, 0) = 0 and coalesce(f.carbs, 0) = 0
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
          then (to_jsonb(fp)->>'canonical_food_id')::uuid
        else null
      end as food_id,
      count(*) as favorite_refs
    from public.favorite_products fp
    group by 1
  )
  select
    case
      when coalesce(r.recipe_refs, 0) > 0 then 'critical'
      when coalesce(d.diary_refs, 0) > 0 or coalesce(f.favorite_refs, 0) > 0 then 'medium'
      else 'low'
    end as severity
  from zero_macro_foods z
  left join recipe_usage r on r.food_id = z.id
  left join diary_usage d on d.food_id = z.id
  left join favorite_usage f on f.food_id = z.id
) s;
