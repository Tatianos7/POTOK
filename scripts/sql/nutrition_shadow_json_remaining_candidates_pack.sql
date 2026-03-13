-- Nutrition shadow JSON remaining candidates pack
-- Read-only
-- Narrow scope: only unresolved / operator_choice_required rows
-- Purpose:
-- - provide expanded candidate search for the remaining legacy ingredients
-- - keep already confirmed mappings out of this pack
-- - return operator-facing candidate rows only

with trgm_available as (
  select exists (
    select 1
    from pg_extension
    where extname = 'pg_trgm'
  ) as has_pg_trgm
),
remaining_rows as (
  select
    '72656369-7065-45f3-b137-363733353137'::uuid as recipe_id,
    'Салат Весна'::text as recipe_name,
    1::bigint as ingredient_position,
    'помидора'::text as raw_ingredient_name

  union all
  select
    '72656369-7065-45f3-b137-363733353137'::uuid,
    'Салат Весна'::text,
    2::bigint,
    'огурец'::text

  union all
  select
    '72656369-7065-45f3-b137-363733353137'::uuid,
    'Салат Весна'::text,
    3::bigint,
    'масло растительное'::text

  union all
  select
    '72656369-7065-45f3-9137-363732373731'::uuid,
    'Салат Мемоза 2'::text,
    2::bigint,
    'куриного яйца'::text

  union all
  select
    '72656369-7065-45f3-9137-363733353132'::uuid,
    'Салат Оливье'::text,
    2::bigint,
    'огурца'::text

  union all
  select
    '72656369-7065-45f3-9137-363733353132'::uuid,
    'Салат Оливье'::text,
    3::bigint,
    'банка гороха'::text

  union all
  select
    '72656369-7065-45f3-9137-363733353132'::uuid,
    'Салат Оливье'::text,
    4::bigint,
    'пучок зелени'::text

  union all
  select
    '72656369-7065-45f3-9137-363733353132'::uuid,
    'Салат Оливье'::text,
    5::bigint,
    '% сметана'::text
),
normalized as (
  select
    rr.*,
    trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(lower(trim(rr.raw_ingredient_name)), '^(банка)\s+', '', 'i'),
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
              regexp_replace(lower(trim(rr.raw_ingredient_name)), '^(банка)\s+', '', 'i'),
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
              regexp_replace(lower(trim(rr.raw_ingredient_name)), '^(банка)\s+', '', 'i'),
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
              regexp_replace(lower(trim(rr.raw_ingredient_name)), '^(банка)\s+', '', 'i'),
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
              regexp_replace(lower(trim(rr.raw_ingredient_name)), '^(банка)\s+', '', 'i'),
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
              regexp_replace(lower(trim(rr.raw_ingredient_name)), '^(банка)\s+', '', 'i'),
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
              regexp_replace(lower(trim(rr.raw_ingredient_name)), '^(банка)\s+', '', 'i'),
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
  from remaining_rows rr
),
search_keys as (
  select recipe_id, recipe_name, ingredient_position, raw_ingredient_name, 'raw'::text as key_type, lower(trim(raw_ingredient_name)) as generated_search_key
  from normalized

  union all

  select recipe_id, recipe_name, ingredient_position, raw_ingredient_name, 'cleaned'::text as key_type, cleaned_name
  from normalized

  union all

  select recipe_id, recipe_name, ingredient_position, raw_ingredient_name, 'normalized'::text as key_type, normalized_name
  from normalized

  union all

  select recipe_id, recipe_name, ingredient_position, raw_ingredient_name, 'base_variant'::text as key_type,
         case
           when normalized_name = 'огурец' then 'огурец'
           when normalized_name = 'помидор' then 'помидор'
           when normalized_name = 'яйцо куриное' then 'яйцо'
           when normalized_name = 'масло растительное' then 'масло растительное'
           when normalized_name = 'гороха' then 'горошек'
           when normalized_name = 'зелени' then 'зелень'
           when normalized_name = 'сметана' then 'сметана'
           else null
         end
  from normalized
),
filtered_keys as (
  select distinct *
  from search_keys
  where coalesce(generated_search_key, '') <> ''
),
name_ilike as (
  select
    fk.recipe_name,
    fk.ingredient_position,
    fk.raw_ingredient_name,
    f.id as candidate_food_id,
    f.name as candidate_food_name,
    'foods.name_ilike'::text as matched_source,
    null::numeric as similarity_score
  from filtered_keys fk
  join public.foods f
    on lower(coalesce(f.name, '')) like '%' || fk.generated_search_key || '%'
),
normalized_ilike as (
  select
    fk.recipe_name,
    fk.ingredient_position,
    fk.raw_ingredient_name,
    f.id as candidate_food_id,
    f.name as candidate_food_name,
    'foods.normalized_name_ilike'::text as matched_source,
    null::numeric as similarity_score
  from filtered_keys fk
  join public.foods f
    on lower(coalesce(f.normalized_name, '')) like '%' || fk.generated_search_key || '%'
),
alias_ilike as (
  select
    fk.recipe_name,
    fk.ingredient_position,
    fk.raw_ingredient_name,
    a.canonical_food_id as candidate_food_id,
    f.name as candidate_food_name,
    'food_aliases.normalized_alias_ilike'::text as matched_source,
    null::numeric as similarity_score
  from filtered_keys fk
  join public.food_aliases a
    on lower(coalesce(a.normalized_alias, '')) like '%' || fk.generated_search_key || '%'
  join public.foods f
    on f.id = a.canonical_food_id
),
trgm_similarity as (
  select
    fk.recipe_name,
    fk.ingredient_position,
    fk.raw_ingredient_name,
    f.id as candidate_food_id,
    f.name as candidate_food_name,
    'foods.name_similarity'::text as matched_source,
    similarity(lower(coalesce(f.name, '')), fk.generated_search_key)::numeric as similarity_score
  from filtered_keys fk
  cross join trgm_available ta
  join public.foods f
    on ta.has_pg_trgm
   and similarity(lower(coalesce(f.name, '')), fk.generated_search_key) >= 0.25
),
trgm_word_similarity as (
  select
    fk.recipe_name,
    fk.ingredient_position,
    fk.raw_ingredient_name,
    f.id as candidate_food_id,
    f.name as candidate_food_name,
    'foods.name_word_similarity'::text as matched_source,
    word_similarity(lower(coalesce(f.name, '')), fk.generated_search_key)::numeric as similarity_score
  from filtered_keys fk
  cross join trgm_available ta
  join public.foods f
    on ta.has_pg_trgm
   and word_similarity(lower(coalesce(f.name, '')), fk.generated_search_key) >= 0.35
),
all_candidates as (
  select * from name_ilike
  union all
  select * from normalized_ilike
  union all
  select * from alias_ilike
  union all
  select * from trgm_similarity
  union all
  select * from trgm_word_similarity
)
select distinct
  recipe_name,
  ingredient_position,
  raw_ingredient_name,
  candidate_food_id,
  candidate_food_name,
  matched_source,
  round(similarity_score, 4) as similarity_score
from all_candidates
order by recipe_name, ingredient_position, matched_source, similarity_score desc nulls last, candidate_food_name;
