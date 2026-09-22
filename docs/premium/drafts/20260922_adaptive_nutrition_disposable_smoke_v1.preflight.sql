-- POTOK Adaptive Nutrition disposable-branch smoke v1 — SELECT-ONLY PREFLIGHT.
-- Run only in the disposable Supabase branch created from STAGING project
-- ozidryfvhkcbtpnulakq with Include data OFF. Never run against main STAGING or production.
-- No discovered function is executed and no application row other than aggregate
-- counts plus the sole synthetic auth user UUID is returned.

SELECT 'environment' AS section,
       pg_catalog.current_database() AS database_name,
       CURRENT_USER AS current_role,
       SESSION_USER AS session_role,
       (CURRENT_USER = 'postgres' AND SESSION_USER = 'postgres') AS owner_session_required;

SELECT 'required_objects' AS section,
       pg_catalog.to_regclass('potok_control.access_attestations') IS NOT NULL AS entitlement_storage,
       pg_catalog.to_regprocedure(
         'potok_control.grant_entitlement_v2(uuid,text,timestamp with time zone,text,text)'
       ) IS NOT NULL AS entitlement_grant,
       pg_catalog.to_regprocedure('potok_control.revoke_entitlement_v2(uuid,text,text,text)') IS NOT NULL
         AS entitlement_revoke,
       pg_catalog.to_regprocedure(
         'potok_control.is_effective_entitlement_v2(uuid,text,timestamp with time zone)'
       ) IS NOT NULL AS entitlement_predicate,
       pg_catalog.to_regclass('public.adaptive_nutrition_operations') IS NOT NULL AS operation_ledger,
       pg_catalog.to_regclass('public.adaptive_nutrition_graph_revisions') IS NOT NULL AS graph_revisions,
       pg_catalog.to_regclass('public.adaptive_nutrition_events') IS NOT NULL AS event_history,
       pg_catalog.to_regprocedure('public.adaptive_nutrition_mutate_v1(text)') IS NOT NULL AS mutate_rpc,
       pg_catalog.to_regprocedure('public.adaptive_nutrition_lookup_v1(text)') IS NOT NULL AS lookup_rpc,
       pg_catalog.to_regprocedure('public.adaptive_nutrition_read_v1(uuid,uuid)') IS NOT NULL AS read_rpc;

SELECT 'runtime_grants' AS section,
       has_function_privilege('authenticated', 'public.adaptive_nutrition_mutate_v1(text)', 'EXECUTE')
         AS authenticated_mutate,
       has_function_privilege('authenticated', 'public.adaptive_nutrition_lookup_v1(text)', 'EXECUTE')
         AS authenticated_lookup,
       has_function_privilege('authenticated', 'public.adaptive_nutrition_read_v1(uuid,uuid)', 'EXECUTE')
         AS authenticated_read,
       NOT has_function_privilege('anon', 'public.adaptive_nutrition_mutate_v1(text)', 'EXECUTE')
         AS anon_mutate_denied,
       NOT has_function_privilege('anon', 'public.adaptive_nutrition_lookup_v1(text)', 'EXECUTE')
         AS anon_lookup_denied,
       NOT has_function_privilege('anon', 'public.adaptive_nutrition_read_v1(uuid,uuid)', 'EXECUTE')
         AS anon_read_denied,
       NOT has_function_privilege('service_role', 'public.adaptive_nutrition_mutate_v1(text)', 'EXECUTE')
         AS service_role_mutate_denied,
       NOT has_function_privilege('service_role', 'public.adaptive_nutrition_lookup_v1(text)', 'EXECUTE')
         AS service_role_lookup_denied,
       NOT has_function_privilege('service_role', 'public.adaptive_nutrition_read_v1(uuid,uuid)', 'EXECUTE')
         AS service_role_read_denied;

SELECT 'runtime_security' AS section,
       pg_catalog.count(*) = 5 AS all_security_tables_present,
       pg_catalog.count(*) FILTER (WHERE c.relrowsecurity) = 5 AS all_rls_enabled,
       pg_catalog.count(*) FILTER (WHERE c.relforcerowsecurity) = 5 AS all_rls_forced
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
 WHERE (n.nspname, c.relname) IN (
   ('potok_control', 'access_attestations'),
   ('public', 'adaptive_nutrition_operations'),
   ('public', 'adaptive_nutrition_graph_revisions'),
   ('public', 'adaptive_nutrition_events'),
   ('potok_nutrition', 'validated_plan_replacement_offers_v1')
 );

WITH definitions AS (
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
)
SELECT 'repair_and_runtime_markers' AS section,
       grant_definition LIKE '%v_now timestamptz := pg_catalog.statement_timestamp()%' AS grant_statement_clock,
       revoke_definition LIKE '%v_now timestamptz := pg_catalog.statement_timestamp()%' AS revoke_statement_clock,
       grant_definition LIKE '%COALESCE(v_head.lineage_sequence, 0::bigint) + 1::bigint%'
         AS bigint_coalesce_repair,
       mutate_definition LIKE '%json_has_duplicate_keys_v1%' AS raw_duplicate_guard,
       mutate_definition LIKE '%extensions.digest(v_canonical_bytes, ''sha256'')%' AS server_digest,
       mutate_definition LIKE '%WHEN ''SKIPPED'' THEN ''ANNOTATION''%'
         AND mutate_definition LIKE '%WHEN ''UNDO_ANNOTATION'' THEN ''ANNOTATION_RETRACTION''%'
         AS bounded_annotation_actions
  FROM definitions;

SELECT 'immutable_guards' AS section,
       pg_catalog.count(*) FILTER (WHERE t.tgname = 'potok_graph_revisions_immutable_v1') = 1
         AS graph_guard,
       pg_catalog.count(*) FILTER (WHERE t.tgname = 'potok_events_immutable_v1') = 1
         AS event_guard,
       pg_catalog.count(*) FILTER (WHERE t.tgname = 'potok_operations_delete_guard_v1') = 1
         AS operation_guard
  FROM pg_catalog.pg_trigger t
 WHERE NOT t.tgisinternal
   AND t.tgname IN (
     'potok_graph_revisions_immutable_v1',
     'potok_events_immutable_v1',
     'potok_operations_delete_guard_v1'
   );

WITH sole_auth_user AS (
  SELECT pg_catalog.min(u.id) AS account_id, pg_catalog.count(*) AS account_count
    FROM auth.users u
)
SELECT 'isolated_account' AS section,
       a.account_count,
       CASE WHEN a.account_count = 1 THEN a.account_id::text ELSE NULL END AS test_account_id,
       (SELECT pg_catalog.count(*) FROM public.user_profiles p
         WHERE p.user_id = a.account_id) AS profile_rows,
       (SELECT pg_catalog.count(*) FROM public.user_goals g
         WHERE g.user_id = a.account_id) AS goal_rows,
       (SELECT pg_catalog.count(*) FROM public.user_premium_plan_selections s
         WHERE s.user_id = a.account_id) AS selection_rows,
       (SELECT pg_catalog.count(*) FROM public.food_diary_entries d
         WHERE d.user_id = a.account_id) AS diary_rows,
       (SELECT pg_catalog.count(*) FROM potok_control.access_attestations e
         WHERE e.account_id = a.account_id) AS attestation_rows
  FROM sole_auth_user a;

SELECT 'empty_fixture_surfaces' AS section,
       (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations) AS operations,
       (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_graph_revisions) AS graph_revisions,
       (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events) AS events,
       (SELECT pg_catalog.count(*) FROM potok_nutrition.validated_plan_replacement_offers_v1)
         AS replacement_offers;

WITH sole_auth_user AS (
  SELECT pg_catalog.min(u.id) AS account_id, pg_catalog.count(*) AS account_count
    FROM auth.users u
), profile_state AS (
  SELECT p.* FROM public.user_profiles p
  JOIN sole_auth_user a ON a.account_id = p.user_id
), readiness AS (
  SELECT
    (SELECT account_count = 1 FROM sole_auth_user)
    AND (SELECT pg_catalog.count(*) <= 1 FROM profile_state)
    AND NOT EXISTS (
      SELECT 1 FROM profile_state p
       WHERE p.has_premium IS DISTINCT FROM false
          OR p.is_admin IS DISTINCT FROM false
          OR p.premium_provenance_id IS NOT NULL
          OR p.premium_valid_until IS NOT NULL
          OR p.admin_provenance_id IS NOT NULL
          OR p.admin_valid_until IS NOT NULL
    )
    AND NOT EXISTS (SELECT 1 FROM public.user_goals)
    AND NOT EXISTS (SELECT 1 FROM public.user_premium_plan_selections)
    AND NOT EXISTS (SELECT 1 FROM public.user_premium_meal_selections)
    AND NOT EXISTS (SELECT 1 FROM public.food_diary_entries)
    AND NOT EXISTS (SELECT 1 FROM potok_control.access_attestations)
    AND NOT EXISTS (SELECT 1 FROM public.adaptive_nutrition_operations)
    AND NOT EXISTS (SELECT 1 FROM public.adaptive_nutrition_graph_revisions)
    AND NOT EXISTS (SELECT 1 FROM public.adaptive_nutrition_events)
    AND NOT EXISTS (SELECT 1 FROM potok_nutrition.validated_plan_replacement_offers_v1)
    AS data_ready
)
SELECT 'final_readiness' AS section,
       data_ready,
       'All required-object and grant booleans above must also be true before setup.' AS requirement
  FROM readiness;
