-- POTOK Adaptive Nutrition read-only entry v1 — SELECT-ONLY STAGING PREFLIGHT.
-- Target: Supabase STAGING ozidryfvhkcbtpnulakq only.
-- Run before applying 20260922_adaptive_nutrition_read_only_entry_v1.sql.
-- Expected apply artifact SHA-256:
-- 9ae90f023875bde8dd86fc99cff1c63c8b9860a48fb1d07b8ef75f3b411ed580
-- This query cannot identify a Supabase project ref from database metadata. The
-- owner must verify the Dashboard project ref before running it.

WITH required_columns(column_name) AS (
  VALUES
    ('id'), ('user_id'), ('contract_version'), ('week_anchor'), ('timezone'),
    ('status'), ('origin_lineage'), ('plan_revision'), ('goal_revision'),
    ('history_revision'), ('diary_revision')
), column_state AS (
  SELECT
    pg_catalog.count(*) = (SELECT pg_catalog.count(*) FROM required_columns)
      AS selection_columns_ok
  FROM information_schema.columns c
  JOIN required_columns r ON r.column_name = c.column_name
  WHERE c.table_schema = 'public'
    AND c.table_name = 'user_premium_plan_selections'
), index_state AS (
  SELECT COALESCE(
    i.indisunique
    AND pg_catalog.pg_get_indexdef(i.indexrelid)
      LIKE '%ON public.user_premium_plan_selections USING btree (user_id, week_anchor)%'
    AND pg_catalog.pg_get_expr(i.indpred, i.indrelid)
      LIKE '%contract_version = 1%'
    AND pg_catalog.pg_get_expr(i.indpred, i.indrelid)
      LIKE '%status%active%provisional%',
    false
  ) AS one_week_candidate_index_ok
  FROM pg_catalog.pg_index i
  WHERE i.indexrelid = pg_catalog.to_regclass(
    'public.user_premium_plan_selections_week_candidate_v1_idx'
  )
), constraint_state AS (
  SELECT
    pg_catalog.count(*) FILTER (
      WHERE c.conname = 'user_premium_plan_selections_contract_check'
        AND c.contype = 'c'
    ) = 1
    AND pg_catalog.count(*) FILTER (
      WHERE c.conname = 'user_premium_plan_selections_user_id_id_unique'
        AND c.contype = 'u'
    ) = 1
    AND pg_catalog.count(*) FILTER (
      WHERE c.conname = 'user_premium_plan_selections_graph_head_fk'
        AND c.contype = 'f'
    ) = 1 AS selection_constraints_ok
  FROM pg_catalog.pg_constraint c
  WHERE c.conrelid = pg_catalog.to_regclass('public.user_premium_plan_selections')
), object_state AS (
  SELECT
    pg_catalog.to_regprocedure(
      'potok_control.is_effective_entitlement_v2(uuid,text,timestamp with time zone)'
    ) IS NOT NULL
      AND pg_catalog.to_regclass('potok_control.access_attestations') IS NOT NULL
      AS trusted_entitlement_v2_ok,
    pg_catalog.to_regprocedure('public.adaptive_nutrition_read_v1(uuid,uuid)') IS NOT NULL
      AS current_read_rpc_ok,
    pg_catalog.to_regprocedure('public.adaptive_nutrition_discover_current_v1(text)') IS NULL
      AS discovery_absent_before_apply,
    pg_catalog.to_regclass('public.user_premium_plan_selections') IS NOT NULL
      AND pg_catalog.to_regclass('public.user_goals') IS NOT NULL
      AND pg_catalog.to_regclass('public.adaptive_nutrition_operations') IS NOT NULL
      AND pg_catalog.to_regclass('public.adaptive_nutrition_graph_revisions') IS NOT NULL
      AND pg_catalog.to_regclass('public.adaptive_nutrition_events') IS NOT NULL
      AND pg_catalog.to_regclass(
        'potok_nutrition.validated_plan_replacement_offers_v1'
      ) IS NOT NULL AS persistence_runtime_foundation_ok
), security_state AS (
  SELECT
    has_function_privilege(
      'authenticated', 'public.adaptive_nutrition_read_v1(uuid,uuid)', 'EXECUTE'
    )
      AND NOT has_function_privilege(
        'anon', 'public.adaptive_nutrition_read_v1(uuid,uuid)', 'EXECUTE'
      )
      AND NOT has_function_privilege(
        'service_role', 'public.adaptive_nutrition_read_v1(uuid,uuid)', 'EXECUTE'
      ) AS current_read_grants_ok,
    (SELECT pg_catalog.count(*) = 5
       AND pg_catalog.count(*) FILTER (WHERE c.relrowsecurity) = 5
       AND pg_catalog.count(*) FILTER (WHERE c.relforcerowsecurity) = 5
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE (n.nspname, c.relname) IN (
           ('potok_control', 'access_attestations'),
           ('public', 'adaptive_nutrition_operations'),
           ('public', 'adaptive_nutrition_graph_revisions'),
           ('public', 'adaptive_nutrition_events'),
           ('potok_nutrition', 'validated_plan_replacement_offers_v1')
         )) AS runtime_rls_force_ok,
    (SELECT pg_catalog.count(*) FILTER (
       WHERE t.tgname IN (
         'potok_graph_revisions_immutable_v1',
         'potok_events_immutable_v1',
         'potok_operations_delete_guard_v1',
         'potok_validated_plan_offers_immutable_v1'
       )) = 4
       FROM pg_catalog.pg_trigger t
      WHERE NOT t.tgisinternal) AS immutable_guards_ok
), verdict AS (
  SELECT
    o.*,
    c.selection_columns_ok,
    COALESCE(i.one_week_candidate_index_ok, false) AS one_week_candidate_index_ok,
    k.selection_constraints_ok,
    s.*
  FROM object_state o
  CROSS JOIN column_state c
  LEFT JOIN index_state i ON true
  CROSS JOIN constraint_state k
  CROSS JOIN security_state s
)
SELECT
  'ozidryfvhkcbtpnulakq'::text AS expected_staging_project_ref,
  true AS owner_must_verify_dashboard_project_ref,
  '9ae90f023875bde8dd86fc99cff1c63c8b9860a48fb1d07b8ef75f3b411ed580'::text
    AS expected_apply_sha256,
  v.*,
  v.trusted_entitlement_v2_ok
    AND v.current_read_rpc_ok
    AND v.discovery_absent_before_apply
    AND v.persistence_runtime_foundation_ok
    AND v.selection_columns_ok
    AND v.one_week_candidate_index_ok
    AND v.selection_constraints_ok
    AND v.current_read_grants_ok
    AND v.runtime_rls_force_ok
    AND v.immutable_guards_ok AS ready_for_read_only_discovery_apply
FROM verdict v;
