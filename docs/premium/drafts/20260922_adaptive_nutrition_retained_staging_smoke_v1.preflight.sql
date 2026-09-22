-- POTOK retained Adaptive Nutrition STAGING smoke v1 — SELECT-ONLY PREFLIGHT.
-- Target only: Supabase STAGING ozidryfvhkcbtpnulakq.
-- Run in that project's Dashboard SQL Editor. This query performs no writes.

WITH constants AS (
  SELECT
    '88c26f6b-ebc8-4bff-864d-9194fbd27f8d'::uuid AS account_id,
    '7e710000-0000-4000-8000-000000000001'::uuid AS selection_id,
    '7e710000-0000-4000-8000-000000000011'::uuid AS plan_revision,
    '7e710000-0000-4000-8000-000000000014'::uuid AS bootstrap_operation_id,
    'potok-retained-staging-smoke-v1'::text AS fixture_source
), object_state AS (
  SELECT
    pg_catalog.to_regclass('potok_control.access_attestations') IS NOT NULL
      AND pg_catalog.to_regprocedure(
        'potok_control.grant_entitlement_v2(uuid,text,timestamp with time zone,text,text)'
      ) IS NOT NULL
      AND pg_catalog.to_regprocedure(
        'potok_control.revoke_entitlement_v2(uuid,text,text,text)'
      ) IS NOT NULL
      AND pg_catalog.to_regprocedure(
        'potok_control.is_effective_entitlement_v2(uuid,text,timestamp with time zone)'
      ) IS NOT NULL AS entitlement_objects_ok,
    pg_catalog.to_regclass('public.adaptive_nutrition_operations') IS NOT NULL
      AND pg_catalog.to_regclass('public.adaptive_nutrition_graph_revisions') IS NOT NULL
      AND pg_catalog.to_regclass('public.adaptive_nutrition_events') IS NOT NULL
      AND pg_catalog.to_regclass('potok_nutrition.validated_plan_replacement_offers_v1') IS NOT NULL
      AS persistence_objects_ok,
    pg_catalog.to_regprocedure('public.adaptive_nutrition_mutate_v1(text)') IS NOT NULL
      AND pg_catalog.to_regprocedure('public.adaptive_nutrition_lookup_v1(text)') IS NOT NULL
      AND pg_catalog.to_regprocedure('public.adaptive_nutrition_read_v1(uuid,uuid)') IS NOT NULL
      AS runtime_objects_ok
), function_state AS (
  SELECT
    pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(
      'potok_control.grant_entitlement_v2(uuid,text,timestamp with time zone,text,text)'
    )) AS grant_definition,
    pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(
      'potok_control.revoke_entitlement_v2(uuid,text,text,text)'
    )) AS revoke_definition,
    pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(
      'public.adaptive_nutrition_mutate_v1(text)'
    )) AS mutate_definition
), security_state AS (
  SELECT
    has_function_privilege('authenticated', 'public.adaptive_nutrition_mutate_v1(text)', 'EXECUTE')
      AND has_function_privilege('authenticated', 'public.adaptive_nutrition_lookup_v1(text)', 'EXECUTE')
      AND has_function_privilege('authenticated', 'public.adaptive_nutrition_read_v1(uuid,uuid)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.adaptive_nutrition_mutate_v1(text)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.adaptive_nutrition_lookup_v1(text)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.adaptive_nutrition_read_v1(uuid,uuid)', 'EXECUTE')
      AND NOT has_function_privilege('service_role', 'public.adaptive_nutrition_mutate_v1(text)', 'EXECUTE')
      AND NOT has_function_privilege('service_role', 'public.adaptive_nutrition_lookup_v1(text)', 'EXECUTE')
      AND NOT has_function_privilege('service_role', 'public.adaptive_nutrition_read_v1(uuid,uuid)', 'EXECUTE')
      AS runtime_grants_ok,
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
      )) AS rls_force_ok,
    (SELECT pg_catalog.count(*) FILTER (
       WHERE t.tgname IN (
         'potok_graph_revisions_immutable_v1',
         'potok_events_immutable_v1',
         'potok_operations_delete_guard_v1',
         'potok_validated_plan_offers_immutable_v1'
       )) = 4
       FROM pg_catalog.pg_trigger t WHERE NOT t.tgisinternal) AS immutable_guards_ok
), account_state AS (
  SELECT
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.account_id) AS account_exists,
    (SELECT pg_catalog.count(*) FROM public.user_profiles p WHERE p.user_id = c.account_id) = 1
      AS one_profile,
    COALESCE((SELECT NOT p.has_premium AND NOT p.is_admin
                       AND p.premium_provenance_id IS NULL
                       AND p.premium_valid_until IS NULL
                       AND p.admin_provenance_id IS NULL
                       AND p.admin_valid_until IS NULL
                FROM public.user_profiles p WHERE p.user_id = c.account_id), false)
      AS profile_safe,
    NOT EXISTS (SELECT 1 FROM public.user_goals g WHERE g.user_id = c.account_id)
      AS no_goal,
    NOT EXISTS (SELECT 1 FROM public.user_premium_plan_selections s WHERE s.user_id = c.account_id)
      AS no_plan_selection,
    NOT EXISTS (SELECT 1 FROM public.adaptive_nutrition_operations o WHERE o.user_id = c.account_id)
      AND NOT EXISTS (SELECT 1 FROM public.adaptive_nutrition_graph_revisions g WHERE g.user_id = c.account_id)
      AND NOT EXISTS (SELECT 1 FROM public.adaptive_nutrition_events e WHERE e.user_id = c.account_id)
      AS no_runtime_state,
    NOT EXISTS (SELECT 1 FROM public.food_diary_entries d WHERE d.user_id = c.account_id)
      AS no_diary_state,
    NOT EXISTS (SELECT 1 FROM potok_control.access_attestations a WHERE a.account_id = c.account_id)
      AS no_entitlement_lineage,
    NOT EXISTS (
      SELECT 1 FROM potok_nutrition.validated_plan_replacement_offers_v1 o
       WHERE o.account_id = c.account_id
    ) AS no_replacement_offers
  FROM constants c
), fixture_state AS (
  SELECT NOT (
    EXISTS (SELECT 1 FROM public.user_premium_plan_selections s
             WHERE s.id = c.selection_id OR s.origin_lineage ->> 'source' = c.fixture_source)
    OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_operations o
                WHERE o.operation_id = c.bootstrap_operation_id
                   OR o.idempotency_key LIKE 'potok-retained-staging-smoke-v1/%')
    OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_graph_revisions g
                WHERE g.plan_revision = c.plan_revision
                   OR g.graph_snapshot::text LIKE '%7e710000-0000-4000-8000-%')
    OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_events e
                WHERE e.selection_id = c.selection_id OR e.snapshot::text LIKE '%7e710000-0000-4000-8000-%')
    OR EXISTS (SELECT 1 FROM potok_control.access_attestations a
                WHERE a.evidence_ref LIKE 'potok-retained-staging-smoke-v1/%')
    OR EXISTS (SELECT 1 FROM public.user_goals g
                WHERE g.goal_type = 'potok_retained_staging_smoke_v1')
  ) AS fixture_identity_unused
  FROM constants c
), verdict AS (
  SELECT
    o.entitlement_objects_ok,
    o.persistence_objects_ok,
    o.runtime_objects_ok,
    s.runtime_grants_ok,
    s.rls_force_ok,
    s.immutable_guards_ok,
    COALESCE(f.grant_definition LIKE '%v_now timestamptz := pg_catalog.statement_timestamp()%'
      AND f.revoke_definition LIKE '%v_now timestamptz := pg_catalog.statement_timestamp()%'
      AND f.grant_definition LIKE '%COALESCE(v_head.lineage_sequence, 0::bigint) + 1::bigint%', false)
      AS entitlement_repairs_ok,
    COALESCE(f.mutate_definition LIKE '%json_has_duplicate_keys_v1%'
      AND f.mutate_definition LIKE '%extensions.digest(v_canonical_bytes, ''sha256'')%'
      AND f.mutate_definition LIKE '%WHEN ''SKIPPED'' THEN ''ANNOTATION''%'
      AND f.mutate_definition LIKE '%WHEN ''UNDO_ANNOTATION'' THEN ''ANNOTATION_RETRACTION''%', false)
      AS bounded_runtime_ok,
    a.*,
    x.fixture_identity_unused
  FROM object_state o
  CROSS JOIN function_state f
  CROSS JOIN security_state s
  CROSS JOIN account_state a
  CROSS JOIN fixture_state x
)
SELECT
  'ozidryfvhkcbtpnulakq' AS expected_staging_project_ref,
  c.account_id,
  c.selection_id,
  v.*,
  v.entitlement_objects_ok AND v.persistence_objects_ok AND v.runtime_objects_ok
    AND v.runtime_grants_ok AND v.rls_force_ok AND v.immutable_guards_ok
    AND v.entitlement_repairs_ok AND v.bounded_runtime_ok
    AND v.account_exists AND v.one_profile AND v.profile_safe AND v.no_goal
    AND v.no_plan_selection AND v.no_runtime_state AND v.no_diary_state
    AND v.no_entitlement_lineage AND v.no_replacement_offers
    AND v.fixture_identity_unused AS ready_for_retained_fixture_setup
FROM constants c CROSS JOIN verdict v;
