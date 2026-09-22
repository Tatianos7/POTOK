-- POTOK Adaptive Nutrition persistence v1 — STAGING READ-ONLY PREFLIGHT.
-- Target: Supabase STAGING ozidryfvhkcbtpnulakq. SELECT-only; no functions invoked.

SELECT 'identity' AS section,
       current_database() AS database_name,
       current_user AS current_role,
       session_user AS session_role;

SELECT 'required_relations' AS section,
       required.object_name,
       pg_catalog.to_regclass(required.object_name) IS NOT NULL AS present
  FROM (VALUES
    ('public.user_goals'),
    ('public.user_premium_plan_selections'),
    ('public.user_premium_meal_selections'),
    ('public.food_diary_entries'),
    ('public.premium_plans')
  ) AS required(object_name)
 ORDER BY required.object_name;

SELECT 'required_entitlement_functions' AS section,
       required.signature,
       pg_catalog.to_regprocedure(required.signature) IS NOT NULL AS present
  FROM (VALUES
    ('potok_control.is_effective_entitlement_v2(uuid,text,timestamp with time zone)'),
    ('public.has_verified_entitlement_v2(text)')
  ) AS required(signature)
 ORDER BY required.signature;

SELECT 'base_columns' AS section,
       c.table_name, c.ordinal_position, c.column_name, c.data_type,
       c.is_nullable, c.column_default
  FROM information_schema.columns c
 WHERE c.table_schema = 'public'
   AND c.table_name IN (
     'user_goals', 'user_premium_plan_selections',
     'user_premium_meal_selections', 'food_diary_entries'
   )
 ORDER BY c.table_name, c.ordinal_position;

SELECT 'base_constraints' AS section,
       n.nspname AS schema_name, rel.relname AS table_name,
       con.conname AS constraint_name, con.contype AS constraint_type,
       pg_catalog.pg_get_constraintdef(con.oid, true) AS definition,
       con.convalidated AS validated
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = rel.relnamespace
 WHERE n.nspname = 'public'
   AND rel.relname IN (
     'user_goals', 'user_premium_plan_selections',
     'user_premium_meal_selections', 'food_diary_entries'
   )
 ORDER BY rel.relname, con.conname;

SELECT 'existing_adaptive_objects_must_be_absent' AS section,
       candidate.object_name,
       CASE candidate.object_kind
         WHEN 'schema' THEN pg_catalog.to_regnamespace(candidate.object_name) IS NOT NULL
         WHEN 'relation' THEN pg_catalog.to_regclass(candidate.object_name) IS NOT NULL
         ELSE false
       END AS already_present
  FROM (VALUES
    ('schema', 'potok_nutrition'),
    ('relation', 'public.adaptive_nutrition_graph_revisions'),
    ('relation', 'public.adaptive_nutrition_operations'),
    ('relation', 'public.adaptive_nutrition_events')
  ) AS candidate(object_kind, object_name)
 ORDER BY candidate.object_name;

SELECT 'legacy_row_shape' AS section,
       (SELECT pg_catalog.count(*) FROM public.user_goals) AS goal_rows,
       (SELECT pg_catalog.count(*) FROM public.user_premium_plan_selections) AS selection_rows,
       (SELECT pg_catalog.count(*) FROM public.user_premium_meal_selections) AS meal_selection_rows,
       (SELECT pg_catalog.count(*) FROM public.food_diary_entries) AS diary_rows,
       (SELECT pg_catalog.count(*) FROM public.user_premium_plan_selections
         WHERE premium_plan_id IS NULL) AS selection_rows_with_null_template;

SELECT 'external_dependency_warning' AS section,
       dep.classid::regclass::text AS dependent_catalog,
       dep.objid, dep.objsubid, dep.deptype
  FROM pg_catalog.pg_depend dep
 WHERE dep.refobjid IN (
   'public.user_goals'::regclass,
   'public.user_premium_plan_selections'::regclass,
   'public.user_premium_meal_selections'::regclass,
   'public.food_diary_entries'::regclass
 )
   AND dep.deptype NOT IN ('i', 'a')
 ORDER BY dep.refobjid, dep.objid, dep.objsubid;
