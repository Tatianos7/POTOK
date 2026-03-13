-- Nutrition shadow JSON resolution audit
-- Read-only
-- Purpose:
-- - inspect legacy recipes.ingredients JSON for recipes that still have zero
--   rows in public.recipe_ingredients
-- - attempt conservative name normalization and candidate food matching
-- - explicitly separate food matching from amount/unit interpretation

with ingredient_counts as (
  select
    r.id as recipe_id,
    count(ri.id) as ingredient_rows
  from public.recipes r
  left join public.recipe_ingredients ri
    on ri.recipe_id = r.id
  group by r.id
),
target_recipes as (
  select
    r.id as recipe_id,
    r.name as recipe_name,
    r.user_id,
    r.ingredients
  from public.recipes r
  join ingredient_counts ic
    on ic.recipe_id = r.id
  where ic.ingredient_rows = 0
    and jsonb_typeof(r.ingredients) = 'array'
    and jsonb_array_length(r.ingredients) > 0
),
parsed as (
  select
    tr.recipe_id,
    tr.recipe_name,
    tr.user_id,
    i.ord as ingredient_position,
    i.elem as ingredient_json,
    nullif(trim(coalesce(i.elem->>'name', i.elem->>'ingredient_name', '')), '') as raw_ingredient_name,
    coalesce(
      nullif(i.elem->>'grams', ''),
      nullif(i.elem->>'amount_g', ''),
      nullif(i.elem->>'amount', ''),
      nullif(i.elem->>'quantity', ''),
      nullif(i.elem->>'qty', '')
    ) as raw_amount
  from target_recipes tr
  cross join lateral jsonb_array_elements(tr.ingredients) with ordinality as i(elem, ord)
),
normalized as (
  select
    p.*,
    lower(trim(coalesce(p.raw_ingredient_name, ''))) as raw_name_lower,
    trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(lower(trim(coalesce(p.raw_ingredient_name, ''))), '^(банка)\s+', '', 'i'),
            '^(пучок)\s+', '', 'i'
          ),
          '^(%+)\s*', '', 'i'
        ),
        '[^a-z0-9а-яё]+',
        ' ',
        'gi'
      )
    ) as cleaned_ingredient_name,
    case
      when trim(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(lower(trim(coalesce(p.raw_ingredient_name, ''))), '^(банка)\s+', '', 'i'),
              '^(пучок)\s+', '', 'i'
            ),
            '^(%+)\s*', '', 'i'
          ),
          '[^a-z0-9а-яё]+',
          ' ',
          'gi'
        )
      ) = 'огурца' then 'огурец'
      when trim(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(lower(trim(coalesce(p.raw_ingredient_name, ''))), '^(банка)\s+', '', 'i'),
              '^(пучок)\s+', '', 'i'
            ),
            '^(%+)\s*', '', 'i'
          ),
          '[^a-z0-9а-яё]+',
          ' ',
          'gi'
        )
      ) = 'помидора' then 'помидор'
      when trim(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(lower(trim(coalesce(p.raw_ingredient_name, ''))), '^(банка)\s+', '', 'i'),
              '^(пучок)\s+', '', 'i'
            ),
            '^(%+)\s*', '', 'i'
          ),
          '[^a-z0-9а-яё]+',
          ' ',
          'gi'
        )
      ) = 'тунца' then 'тунец'
      when trim(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(lower(trim(coalesce(p.raw_ingredient_name, ''))), '^(банка)\s+', '', 'i'),
              '^(пучок)\s+', '', 'i'
            ),
            '^(%+)\s*', '', 'i'
          ),
          '[^a-z0-9а-яё]+',
          ' ',
          'gi'
        )
      ) = 'куриной грудки' then 'куриная грудка'
      when trim(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(lower(trim(coalesce(p.raw_ingredient_name, ''))), '^(банка)\s+', '', 'i'),
              '^(пучок)\s+', '', 'i'
            ),
            '^(%+)\s*', '', 'i'
          ),
          '[^a-z0-9а-яё]+',
          ' ',
          'gi'
        )
      ) = 'куриного яйца' then 'яйцо куриное'
      else trim(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(lower(trim(coalesce(p.raw_ingredient_name, ''))), '^(банка)\s+', '', 'i'),
              '^(пучок)\s+', '', 'i'
            ),
            '^(%+)\s*', '', 'i'
          ),
          '[^a-z0-9а-яё]+',
          ' ',
          'gi'
        )
      )
    end as normalized_ingredient_name,
    case
      when lower(trim(coalesce(p.raw_ingredient_name, ''))) like 'банка %' then 'container'
      when lower(trim(coalesce(p.raw_ingredient_name, ''))) like 'пучок %' then 'bundle'
      when coalesce(p.raw_amount, '') !~ '^[0-9]+([\\.,][0-9]+)?$' then 'unknown'
      when trim(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(lower(trim(coalesce(p.raw_ingredient_name, ''))), '^(банка)\s+', '', 'i'),
              '^(пучок)\s+', '', 'i'
            ),
            '^(%+)\s*', '', 'i'
          ),
          '[^a-z0-9а-яё]+',
          ' ',
          'gi'
        )
      ) ~ '(масло|сметана|майонез|соус|соль|сахар|мука|крупа|рис|творог|сыр|тунец|грудка)' then 'grams'
      when replace(p.raw_amount, ',', '.')::numeric > 20 then 'grams'
      when replace(p.raw_amount, ',', '.')::numeric > 0 then 'pieces'
      else 'unknown'
    end as interpreted_amount_kind
  from parsed p
),
candidate_matches as (
  select
    n.recipe_id,
    n.ingredient_position,
    f.id as food_id,
    f.name as food_name,
    'foods.normalized_name'::text as match_source
  from normalized n
  join public.foods f
    on f.normalized_name = n.normalized_ingredient_name

  union all

  select
    n.recipe_id,
    n.ingredient_position,
    f.id as food_id,
    f.name as food_name,
    'foods.name_lower'::text as match_source
  from normalized n
  join public.foods f
    on lower(coalesce(f.name, '')) = n.normalized_ingredient_name

  union all

  select
    n.recipe_id,
    n.ingredient_position,
    a.canonical_food_id as food_id,
    f.name as food_name,
    'food_aliases.normalized_alias'::text as match_source
  from normalized n
  join public.food_aliases a
    on a.normalized_alias = n.normalized_ingredient_name
  join public.foods f
    on f.id = a.canonical_food_id
),
match_summary as (
  select
    cm.recipe_id,
    cm.ingredient_position,
    count(distinct cm.food_id) as candidate_match_count,
    array_agg(distinct cm.food_id order by cm.food_id) as candidate_food_ids,
    array_agg(distinct cm.food_name order by cm.food_name) as candidate_food_names,
    array_agg(distinct cm.match_source order by cm.match_source) as candidate_match_sources
  from candidate_matches cm
  group by cm.recipe_id, cm.ingredient_position
)
select
  n.recipe_id,
  n.recipe_name,
  n.user_id,
  n.ingredient_position,
  n.raw_ingredient_name,
  n.normalized_ingredient_name,
  n.raw_amount,
  n.interpreted_amount_kind,
  ms.candidate_food_ids,
  ms.candidate_food_names,
  coalesce(ms.candidate_match_count, 0) as candidate_match_count,
  case
    when coalesce(ms.candidate_match_count, 0) = 1 and n.interpreted_amount_kind = 'grams' then 'auto_resolvable'
    when coalesce(ms.candidate_match_count, 0) = 1 and n.interpreted_amount_kind in ('pieces', 'bundle', 'container', 'unknown') then 'needs_manual_amount_conversion'
    when coalesce(ms.candidate_match_count, 0) > 1 then 'needs_manual_food_match'
    else 'unresolved'
  end as resolution_status,
  ms.candidate_match_sources
from normalized n
left join match_summary ms
  on ms.recipe_id = n.recipe_id
 and ms.ingredient_position = n.ingredient_position
order by n.recipe_name, n.recipe_id, n.ingredient_position;
