-- Read-only compatibility gate for migrating the weekly generator to POTOK Production.
-- Inspect statuses before choosing a migration path. This file never mutates data.
WITH required(kind, object_name, present) AS (
  VALUES
    ('base', 'public.user_goals', to_regclass('public.user_goals') IS NOT NULL),
    ('base', 'public.food_diary_entries', to_regclass('public.food_diary_entries') IS NOT NULL),
    ('premium', 'public.premium_plans', to_regclass('public.premium_plans') IS NOT NULL),
    ('premium', 'public.user_premium_plan_selections', to_regclass('public.user_premium_plan_selections') IS NOT NULL),
    ('premium', 'public.user_premium_meal_selections', to_regclass('public.user_premium_meal_selections') IS NOT NULL),
    ('adaptive', 'public.adaptive_nutrition_operations', to_regclass('public.adaptive_nutrition_operations') IS NOT NULL),
    ('adaptive', 'public.adaptive_nutrition_graph_revisions', to_regclass('public.adaptive_nutrition_graph_revisions') IS NOT NULL),
    ('adaptive', 'potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2',
      to_regclass('potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2') IS NOT NULL),
    ('authority', 'potok_control.is_effective_entitlement_v2',
      to_regprocedure('potok_control.is_effective_entitlement_v2(uuid,text,timestamp with time zone)') IS NOT NULL),
    ('api', 'public.adaptive_nutrition_provision_current_week_v1',
      to_regprocedure('public.adaptive_nutrition_provision_current_week_v1(text,uuid)') IS NOT NULL),
    ('api', 'public.adaptive_nutrition_request_generation_v2',
      to_regprocedure('public.adaptive_nutrition_request_generation_v2(text,uuid)') IS NOT NULL),
    ('api', 'public.adaptive_nutrition_read_generation_plan_v2',
      to_regprocedure('public.adaptive_nutrition_read_generation_plan_v2(uuid)') IS NOT NULL)
)
SELECT kind, object_name, present FROM required ORDER BY kind, object_name;
