-- recipe_ingredients trigger smoke check
-- Run as postgres in Supabase SQL Editor
-- This script temporarily changes one ingredient amount, shows that recipe
-- totals were recomputed automatically by the trigger, then rolls back.

begin;

create temp table _recipe_trigger_smoke on commit drop as
select
  ri.id as ingredient_id,
  ri.recipe_id,
  ri.amount_g as amount_before,
  r.total_calories as calories_before,
  r.protein as protein_before,
  r.fat as fat_before,
  r.carbs as carbs_before
from public.recipe_ingredients ri
join public.recipes r
  on r.id = ri.recipe_id
join public.foods f
  on f.id = ri.food_id
where coalesce(f.calories, 0) > 0
   or coalesce(f.protein, 0) > 0
   or coalesce(f.fat, 0) > 0
   or coalesce(f.carbs, 0) > 0
order by r.updated_at desc nulls last, ri.updated_at desc nulls last
limit 1;

do $$
begin
  if not exists (select 1 from _recipe_trigger_smoke) then
    raise exception 'No eligible recipe_ingredients row found for trigger smoke check';
  end if;
end
$$;

update public.recipe_ingredients ri
set amount_g = ri.amount_g + 10
where ri.id = (select ingredient_id from _recipe_trigger_smoke);

select
  s.recipe_id,
  s.ingredient_id,
  s.amount_before,
  ri.amount_g as amount_after,
  s.calories_before,
  r.total_calories as calories_after,
  s.protein_before,
  r.protein as protein_after,
  s.fat_before,
  r.fat as fat_after,
  s.carbs_before,
  r.carbs as carbs_after,
  (
    coalesce(r.total_calories, 0) <> coalesce(s.calories_before, 0)
    or coalesce(r.protein, 0) <> coalesce(s.protein_before, 0)
    or coalesce(r.fat, 0) <> coalesce(s.fat_before, 0)
    or coalesce(r.carbs, 0) <> coalesce(s.carbs_before, 0)
  ) as totals_changed_automatically
from _recipe_trigger_smoke s
join public.recipe_ingredients ri
  on ri.id = s.ingredient_id
join public.recipes r
  on r.id = s.recipe_id;

rollback;
