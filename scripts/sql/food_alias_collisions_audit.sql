-- Food alias collisions audit
-- Read-only
-- Purpose:
-- - find alias rows that collide with foods normalized names
-- - find alias rows that would resolve to multiple canonical foods

-- =========================================================
-- SECTION A: alias -> foods normalized collisions
-- =========================================================
select
  a.id as alias_id,
  a.alias,
  a.normalized_alias,
  a.canonical_food_id as alias_points_to_food_id,
  f.id as colliding_food_id,
  f.name as colliding_food_name,
  f.source as colliding_food_source,
  case
    when a.canonical_food_id = f.id then 'self_match'
    else 'cross_food_collision'
  end as collision_type
from public.food_aliases a
join public.foods f
  on f.normalized_name = a.normalized_alias
where coalesce(a.normalized_alias, '') <> ''
order by collision_type, a.normalized_alias, a.alias, f.name;

-- =========================================================
-- SECTION B: aliases that map to names shared by multiple foods
-- =========================================================
with alias_candidates as (
  select
    a.id as alias_id,
    a.alias,
    a.normalized_alias,
    a.canonical_food_id,
    f.id as candidate_food_id,
    f.name as candidate_food_name
  from public.food_aliases a
  join public.foods f
    on f.normalized_name = a.normalized_alias
  where coalesce(a.normalized_alias, '') <> ''
),
candidate_counts as (
  select
    alias_id,
    count(distinct candidate_food_id) as candidate_food_count,
    array_agg(distinct candidate_food_id order by candidate_food_id) as candidate_food_ids,
    array_agg(distinct candidate_food_name order by candidate_food_name) as candidate_food_names
  from alias_candidates
  group by alias_id
)
select
  a.id as alias_id,
  a.alias,
  a.normalized_alias,
  a.canonical_food_id,
  cc.candidate_food_count,
  cc.candidate_food_ids,
  cc.candidate_food_names
from public.food_aliases a
join candidate_counts cc
  on cc.alias_id = a.id
where cc.candidate_food_count > 1
order by cc.candidate_food_count desc, a.normalized_alias, a.alias, a.id;
