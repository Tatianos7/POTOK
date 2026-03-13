-- Nutrition shadow JSON candidate search pack
-- Read-only
-- Narrow scope: only the three currently known legacy shadow-json recipes
-- Purpose:
-- - generate broader search keys for unresolved ingredient names
-- - search candidate foods via ilike and pg_trgm similarity when available
-- - provide operator-facing candidate rows without any writes

with target_recipe_ids as (
  select unnest(array[
    '72656369-7065-45f3-b137-363733353137'::uuid,
    '72656369-7065-45f3-9137-363732373731'::uuid,
    '72656369-7065-45f3-9137-363733353132'::uuid
  ]) as recipe_id
),
trgm_available as (
  select exists (
    select 1
    from pg_extension
    where extname = 'pg_trgm'
  ) as has_pg_trgm
),
ingredient_counts as (
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
  join target_recipe_ids tri
    on tri.recipe_id = r.id
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
    ) as cleaned_name,
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
    end as normalized_name
  from parsed p
),
search_keys as (
  select recipe_id, recipe_name, user_id, ingredient_position, raw_ingredient_name, raw_amount, 'raw'::text as key_type, lower(trim(coalesce(raw_ingredient_name, ''))) as generated_search_key
  from normalized

  union all

  select recipe_id, recipe_name, user_id, ingredient_position, raw_ingredient_name, raw_amount, 'cleaned'::text as key_type, cleaned_name as generated_search_key
  from normalized

  union all

  select recipe_id, recipe_name, user_id, ingredient_position, raw_ingredient_name, raw_amount, 'normalized'::text as key_type, normalized_name as generated_search_key
  from normalized

  union all

  select recipe_id, recipe_name, user_id, ingredient_position, raw_ingredient_name, raw_amount, 'without_adjective'::text as key_type,
         case
           when normalized_name = 'яйцо куриное' then 'яйцо'
           when normalized_name = 'куриная грудка' then 'грудка'
           else null
         end as generated_search_key
  from normalized

  union all

  select recipe_id, recipe_name, user_id, ingredient_position, raw_ingredient_name, raw_amount, 'base_variant'::text as key_type,
         case
           when normalized_name = 'огурец' then 'огурец'
           when normalized_name = 'помидор' then 'помидор'
           when normalized_name = 'тунец' then 'тунец'
           when normalized_name = 'яйцо куриное' then 'яйцо куриное'
           when normalized_name = 'куриная грудка' then 'куриная грудка'
           when normalized_name = 'сметана' then 'сметана'
           when normalized_name = 'масло растительное' then 'масло растительное'
           when normalized_name = 'гороха' then 'горошек'
           when normalized_name = 'зелени' then 'зелень'
           else null
         end as generated_search_key
  from normalized
),
filtered_keys as (
  select *
  from search_keys
  where coalesce(generated_search_key, '') <> ''
),
ilike_name_matches as (
  select
    fk.recipe_id,
    fk.recipe_name,
    fk.ingredient_position,
    fk.raw_ingredient_name,
    fk.raw_amount,
    fk.generated_search_key,
    f.id as matched_food_id,
    f.name as matched_food_name,
    'foods.name_ilike'::text as matched_source,
    null::numeric as similarity_score
  from filtered_keys fk
  join public.foods f
    on lower(coalesce(f.name, '')) like '%' || fk.generated_search_key || '%'
),
ilike_normalized_matches as (
  select
    fk.recipe_id,
    fk.recipe_name,
    fk.ingredient_position,
    fk.raw_ingredient_name,
    fk.raw_amount,
    fk.generated_search_key,
    f.id as matched_food_id,
    f.name as matched_food_name,
    'foods.normalized_name_ilike'::text as matched_source,
    null::numeric as similarity_score
  from filtered_keys fk
  join public.foods f
    on lower(coalesce(f.normalized_name, '')) like '%' || fk.generated_search_key || '%'
),
alias_ilike_matches as (
  select
    fk.recipe_id,
    fk.recipe_name,
    fk.ingredient_position,
    fk.raw_ingredient_name,
    fk.raw_amount,
    fk.generated_search_key,
    a.canonical_food_id as matched_food_id,
    f.name as matched_food_name,
    'food_aliases.normalized_alias_ilike'::text as matched_source,
    null::numeric as similarity_score
  from filtered_keys fk
  join public.food_aliases a
    on lower(coalesce(a.normalized_alias, '')) like '%' || fk.generated_search_key || '%'
  join public.foods f
    on f.id = a.canonical_food_id
),
trgm_name_matches as (
  select
    fk.recipe_id,
    fk.recipe_name,
    fk.ingredient_position,
    fk.raw_ingredient_name,
    fk.raw_amount,
    fk.generated_search_key,
    f.id as matched_food_id,
    f.name as matched_food_name,
    'foods.name_similarity'::text as matched_source,
    similarity(lower(coalesce(f.name, '')), fk.generated_search_key)::numeric as similarity_score
  from filtered_keys fk
  cross join trgm_available ta
  join public.foods f
    on ta.has_pg_trgm
   and similarity(lower(coalesce(f.name, '')), fk.generated_search_key) >= 0.25
),
trgm_word_matches as (
  select
    fk.recipe_id,
    fk.recipe_name,
    fk.ingredient_position,
    fk.raw_ingredient_name,
    fk.raw_amount,
    fk.generated_search_key,
    f.id as matched_food_id,
    f.name as matched_food_name,
    'foods.name_word_similarity'::text as matched_source,
    word_similarity(lower(coalesce(f.name, '')), fk.generated_search_key)::numeric as similarity_score
  from filtered_keys fk
  cross join trgm_available ta
  join public.foods f
    on ta.has_pg_trgm
   and word_similarity(lower(coalesce(f.name, '')), fk.generated_search_key) >= 0.35
),
all_matches as (
  select * from ilike_name_matches
  union all
  select * from ilike_normalized_matches
  union all
  select * from alias_ilike_matches
  union all
  select * from trgm_name_matches
  union all
  select * from trgm_word_matches
)
select distinct
  recipe_id,
  recipe_name,
  ingredient_position,
  raw_ingredient_name,
  raw_amount,
  generated_search_key,
  matched_food_id,
  matched_food_name,
  matched_source,
  round(similarity_score, 4) as similarity_score
from all_matches
order by recipe_name, ingredient_position, generated_search_key, matched_source, similarity_score desc nulls last, matched_food_name;
