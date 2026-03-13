-- favorite_products canonical_food_id dry-run audit
-- Run after migration 20260310_favorite_products_canonical_food_id.sql
-- Read-only
-- Fix note:
-- PostgreSQL CTEs are scoped to a single statement. Supabase SQL Editor runs
-- SECTION A and SECTION B as separate statements, so each section keeps its
-- own WITH chain to avoid "relation \"fav_scope\" does not exist" errors.

-- =========================================================
-- SECTION A: Summary
-- =========================================================
with fav_scope as (
  select
    fp.id,
    fp.user_id,
    fp.product_name,
    nullif(to_jsonb(fp)->>'canonical_food_id', '')::uuid as canonical_food_id,
    trim(regexp_replace(lower(coalesce(fp.product_name, '')), '[^a-z0-9а-яё]+', ' ', 'gi')) as normalized_product_name
  from public.favorite_products fp
),
unresolved as (
  select *
  from fav_scope
  where canonical_food_id is null
    and coalesce(product_name, '') <> ''
),
candidate_matches as (
  select
    u.id as favorite_id,
    f.id as food_id,
    f.name as food_name,
    f.source as food_source,
    'foods.normalized_name'::text as match_source
  from unresolved u
  join public.foods f
    on f.normalized_name = u.normalized_product_name

  union all

  select
    u.id as favorite_id,
    f.id as food_id,
    f.name as food_name,
    f.source as food_source,
    'foods.name_exact'::text as match_source
  from unresolved u
  join public.foods f
    on lower(coalesce(f.name, '')) = lower(coalesce(u.product_name, ''))

  union all

  select
    u.id as favorite_id,
    a.canonical_food_id as food_id,
    f.name as food_name,
    f.source as food_source,
    'food_aliases.normalized_alias'::text as match_source
  from unresolved u
  join public.food_aliases a
    on a.normalized_alias = u.normalized_product_name
  join public.foods f
    on f.id = a.canonical_food_id
),
match_summary as (
  select
    favorite_id,
    count(distinct food_id) as distinct_food_matches,
    array_agg(distinct food_id) as matched_food_ids,
    array_agg(distinct food_name) as matched_food_names,
    array_agg(distinct match_source) as matched_sources
  from candidate_matches
  group by favorite_id
)
select
  count(*) as total_favorites,
  count(*) filter (where canonical_food_id is not null) as already_linked,
  count(*) filter (where canonical_food_id is null) as missing_canonical_food_id,
  count(*) filter (where coalesce(ms.distinct_food_matches, 0) = 1) as dry_run_matched,
  count(*) filter (where coalesce(ms.distinct_food_matches, 0) = 0) as dry_run_unmatched,
  count(*) filter (where coalesce(ms.distinct_food_matches, 0) > 1) as dry_run_ambiguous
from fav_scope f
left join match_summary ms
  on ms.favorite_id = f.id;

-- =========================================================
-- SECTION B: Details
-- =========================================================
with fav_scope as (
  select
    fp.id,
    fp.user_id,
    fp.product_name,
    nullif(to_jsonb(fp)->>'canonical_food_id', '')::uuid as canonical_food_id,
    trim(regexp_replace(lower(coalesce(fp.product_name, '')), '[^a-z0-9а-яё]+', ' ', 'gi')) as normalized_product_name
  from public.favorite_products fp
),
unresolved as (
  select *
  from fav_scope
  where canonical_food_id is null
    and coalesce(product_name, '') <> ''
),
candidate_matches as (
  select
    u.id as favorite_id,
    f.id as food_id,
    f.name as food_name,
    f.source as food_source,
    'foods.normalized_name'::text as match_source
  from unresolved u
  join public.foods f
    on f.normalized_name = u.normalized_product_name

  union all

  select
    u.id as favorite_id,
    f.id as food_id,
    f.name as food_name,
    f.source as food_source,
    'foods.name_exact'::text as match_source
  from unresolved u
  join public.foods f
    on lower(coalesce(f.name, '')) = lower(coalesce(u.product_name, ''))

  union all

  select
    u.id as favorite_id,
    a.canonical_food_id as food_id,
    f.name as food_name,
    f.source as food_source,
    'food_aliases.normalized_alias'::text as match_source
  from unresolved u
  join public.food_aliases a
    on a.normalized_alias = u.normalized_product_name
  join public.foods f
    on f.id = a.canonical_food_id
),
match_summary as (
  select
    favorite_id,
    count(distinct food_id) as distinct_food_matches,
    array_agg(distinct food_id) as matched_food_ids,
    array_agg(distinct food_name) as matched_food_names,
    array_agg(distinct match_source) as matched_sources
  from candidate_matches
  group by favorite_id
)
select
  f.id as favorite_id,
  f.user_id,
  f.product_name,
  coalesce(ms.distinct_food_matches, 0) as distinct_food_matches,
  ms.matched_food_ids,
  ms.matched_food_names,
  ms.matched_sources,
  case
    when f.canonical_food_id is not null then 'already_linked'
    when coalesce(ms.distinct_food_matches, 0) = 1 then 'matched'
    when coalesce(ms.distinct_food_matches, 0) = 0 then 'unmatched'
    else 'ambiguous'
  end as audit_status
from fav_scope f
left join match_summary ms
  on ms.favorite_id = f.id
order by audit_status, f.product_name, f.id;
