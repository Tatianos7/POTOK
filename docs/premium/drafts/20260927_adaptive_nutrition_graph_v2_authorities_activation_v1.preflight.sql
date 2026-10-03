-- SELECT-ONLY preflight for Supabase STAGING ozidryfvhkcbtpnulakq.
-- Does not apply the Graph v2 authority/activation package and invokes no business RPC.

WITH expected_columns(table_schema, table_name, column_name, data_type) AS (
  VALUES
    ('public','adaptive_nutrition_operations','user_id','uuid'),
    ('public','adaptive_nutrition_operations','operation_id','uuid'),
    ('public','adaptive_nutrition_operations','canonical_request','bytea'),
    ('public','adaptive_nutrition_operations','request_digest','bytea'),
    ('public','adaptive_nutrition_operations','outcome','text'),
    ('public','adaptive_nutrition_graph_revisions','user_id','uuid'),
    ('public','adaptive_nutrition_graph_revisions','selection_id','uuid'),
    ('public','adaptive_nutrition_graph_revisions','plan_revision','uuid'),
    ('public','adaptive_nutrition_graph_revisions','goal_revision','uuid'),
    ('public','adaptive_nutrition_graph_revisions','graph_snapshot','jsonb'),
    ('public','adaptive_nutrition_graph_revisions','content_digest','bytea'),
    ('public','user_premium_plan_selections','plan_revision','uuid'),
    ('public','user_premium_plan_selections','goal_revision','uuid'),
    ('public','user_goals','goal_revision','uuid')
), column_results AS (
  SELECT e.table_schema || '.' || e.table_name || '.' || e.column_name AS object_name,
         EXISTS (
           SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema=e.table_schema AND c.table_name=e.table_name
              AND c.column_name=e.column_name AND c.data_type=e.data_type
         ) AS ok,
         pg_catalog.jsonb_build_object('expected_type',e.data_type) AS details
  FROM expected_columns e
), exact_functions(signature) AS (
  VALUES
    ('potok_control.grant_entitlement_v2(uuid,text,timestamp with time zone,text,text)'),
    ('potok_control.revoke_entitlement_v2(uuid,text,text,text)'),
    ('potok_control.is_effective_entitlement_v2(uuid,text,timestamp with time zone)'),
    ('public.adaptive_nutrition_provision_current_week_v1(text,uuid)'),
    ('potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb)'),
    ('public.adaptive_nutrition_read_v1(uuid,uuid,text)'),
    ('potok_nutrition.json_has_duplicate_keys_v1(json)'),
    ('potok_nutrition.jsonb_has_exact_keys_v1(jsonb,text[])'),
    ('potok_nutrition.canonical_jsonb_text_v1(jsonb)'),
    ('extensions.digest(bytea,text)')
), function_results AS (
  SELECT signature AS object_name,
         pg_catalog.to_regprocedure(signature) IS NOT NULL AS ok,
         pg_catalog.jsonb_build_object('oid',pg_catalog.to_regprocedure(signature)::text) AS details
  FROM exact_functions
), rls_results AS (
  SELECT n.nspname || '.' || c.relname AS object_name,
         c.relrowsecurity AND c.relforcerowsecurity AS ok,
         pg_catalog.jsonb_build_object('rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) AS details
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN (
    'adaptive_nutrition_operations','adaptive_nutrition_graph_revisions','adaptive_nutrition_events'
  )
), lock_results AS (
  SELECT 'entitlement_grant_legacy_lock' AS object_name,
         pg_catalog.pg_get_functiondef(
           'potok_control.grant_entitlement_v2(uuid,text,timestamp with time zone,text,text)'::pg_catalog.regprocedure
         ) LIKE '%potok-entitlement-v2:%' AS ok,
         pg_catalog.jsonb_build_object('expected_before_repair','potok-entitlement-v2') AS details
  UNION ALL
  SELECT 'entitlement_revoke_legacy_lock',
         pg_catalog.pg_get_functiondef(
           'potok_control.revoke_entitlement_v2(uuid,text,text,text)'::pg_catalog.regprocedure
         ) LIKE '%potok-entitlement-v2:%',
         pg_catalog.jsonb_build_object('expected_before_repair','potok-entitlement-v2')
  UNION ALL
  SELECT 'provision_legacy_lock',
         pg_catalog.pg_get_functiondef(
           'public.adaptive_nutrition_provision_current_week_v1(text,uuid)'::pg_catalog.regprocedure
         ) LIKE '%potok-adaptive-v1:%',
         pg_catalog.jsonb_build_object('expected_before_repair','potok-adaptive-v1')
  UNION ALL
  SELECT 'transition_legacy_lock',
         pg_catalog.pg_get_functiondef(
           'potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb)'::pg_catalog.regprocedure
         ) LIKE '%potok-adaptive-v1:%',
         pg_catalog.jsonb_build_object('expected_before_repair','potok-adaptive-v1')
), immutable_results AS (
  SELECT c.relname AS object_name,
         EXISTS (
           SELECT 1 FROM pg_catalog.pg_trigger t
            WHERE t.tgrelid=c.oid AND NOT t.tgisinternal
              AND (
                (c.relname IN ('adaptive_nutrition_graph_revisions','adaptive_nutrition_events')
                  AND pg_catalog.pg_get_triggerdef(t.oid) ILIKE '%reject_immutable_change_v1%')
                OR (c.relname='adaptive_nutrition_operations'
                  AND t.tgname IN ('potok_operations_update_guard_v1','potok_operations_delete_guard_v1'))
              )
         ) AS ok,
         pg_catalog.jsonb_build_object('trigger_count',(
           SELECT pg_catalog.count(*) FROM pg_catalog.pg_trigger t
            WHERE t.tgrelid=c.oid AND NOT t.tgisinternal
         )) AS details
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN (
    'adaptive_nutrition_operations','adaptive_nutrition_graph_revisions','adaptive_nutrition_events'
  )
), proposed_relations(name) AS (
  VALUES
    ('nutrition_preference_snapshots_v1'),('nutrition_safety_snapshots_v1'),
    ('nutrition_authority_heads_v1'),('adaptive_nutrition_candidate_manifests_v2'),
    ('adaptive_nutrition_candidate_manifest_entries_v2'),
    ('adaptive_nutrition_candidate_manifest_head_v2')
), absence_results AS (
  SELECT name AS object_name,
         pg_catalog.to_regclass('potok_nutrition.' || name) IS NULL AS ok,
         pg_catalog.jsonb_build_object('expected','absent_before_apply') AS details
  FROM proposed_relations
  UNION ALL
  SELECT 'potok_nutrition.acquire_shared_account_gate_v1(uuid)',
         pg_catalog.to_regprocedure('potok_nutrition.acquire_shared_account_gate_v1(uuid)') IS NULL,
         pg_catalog.jsonb_build_object('expected','absent_before_apply')
  UNION ALL
  SELECT 'potok_nutrition.activate_generated_week_v2(uuid,uuid,uuid)',
         pg_catalog.to_regprocedure('potok_nutrition.activate_generated_week_v2(uuid,uuid,uuid)') IS NULL,
         pg_catalog.jsonb_build_object('expected','absent_before_apply')
  UNION ALL
  SELECT f.signature,pg_catalog.to_regprocedure(f.signature) IS NULL,
         pg_catalog.jsonb_build_object('expected','absent_before_apply')
    FROM (VALUES
      ('potok_nutrition.require_canonical_json_v2(bytea)'),
      ('potok_nutrition.reject_immutable_change_v2()'),
      ('potok_nutrition.initialize_nutrition_authorities_v1(uuid,uuid,bytea,bytea,uuid)'),
      ('potok_nutrition.create_preference_successor_v1(uuid,uuid,uuid,bytea,uuid)'),
      ('potok_nutrition.create_safety_successor_v1(uuid,uuid,uuid,bytea,uuid)'),
      ('potok_nutrition.publish_candidate_manifest_v2(bytea,uuid,uuid,uuid)'),
      ('potok_nutrition.record_generated_week_v2(uuid,uuid,uuid,bytea,bytea)'),
      ('public.adaptive_nutrition_read_graph_v2(uuid,uuid,text)'),
      ('public.adaptive_nutrition_list_graph_history_v2(uuid)'),
      ('public.adaptive_nutrition_lookup_operation_v2(uuid)'),
      ('public.adaptive_nutrition_current_preference_v1()'),
      ('public.adaptive_nutrition_current_safety_v1()'),
      ('potok_nutrition.current_candidate_manifest_v2()')
    ) f(signature)
), proposed_schema_names(kind,name) AS (
  VALUES
    ('constraint','adaptive_nutrition_operations_v2_result_check'),
    ('constraint','adaptive_nutrition_graph_revisions_v2_shape_check'),
    ('constraint','adaptive_nutrition_graph_revisions_v2_manifest_fk'),
    ('constraint','adaptive_nutrition_graph_revisions_v2_generation_operation_fk'),
    ('constraint','adaptive_nutrition_graph_revisions_v2_activation_operation_fk'),
    ('constraint','adaptive_nutrition_graph_revisions_v2_supersedes_fk'),
    ('index','nutrition_preference_snapshots_v1_one_successor_idx'),
    ('index','nutrition_safety_snapshots_v1_one_successor_idx'),
    ('index','adaptive_nutrition_candidate_manifests_v2_one_successor_idx'),
    ('index','adaptive_nutrition_operations_operation_global_v2_idx'),
    ('index','adaptive_nutrition_graph_revisions_v2_digest_idx'),
    ('index','adaptive_nutrition_graph_revisions_v2_one_successor_idx'),
    ('trigger','potok_preference_snapshots_immutable_v1'),
    ('trigger','potok_safety_snapshots_immutable_v1'),
    ('trigger','potok_candidate_manifest_headers_immutable_v2'),
    ('trigger','potok_candidate_manifest_entries_immutable_v2')
), schema_name_absence AS (
  SELECT kind||':'||name AS object_name,
         CASE kind
           WHEN 'constraint' THEN NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conname=n.name)
           WHEN 'index' THEN pg_catalog.to_regclass('potok_nutrition.'||name) IS NULL
             AND pg_catalog.to_regclass('public.'||name) IS NULL
           ELSE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgname=n.name AND NOT t.tgisinternal)
         END AS ok,
         pg_catalog.jsonb_build_object('expected','absent_before_apply') AS details
    FROM proposed_schema_names n
), additive_column_names(name) AS (
  VALUES
    ('graph_contract'),('graph_contract_version'),('graph_canonical_bytes'),
    ('generated_week_plan_digest'),('generation_input_digest'),('target_policy_revision'),
    ('preference_revision'),('safety_revision'),('candidate_manifest_revision'),
    ('candidate_manifest_digest'),('composition_policy_revision'),
    ('validation_policy_revision'),('optimization_policy_revision'),
    ('generation_policy_revision'),('generation_operation_id'),
    ('activation_operation_id'),('supersedes_plan_revision')
), additive_columns_absent AS (
  SELECT 'public.adaptive_nutrition_graph_revisions.' || n.name AS object_name,
         NOT EXISTS (
           SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema='public' AND c.table_name='adaptive_nutrition_graph_revisions'
              AND c.column_name=n.name
         ) AS ok,
         pg_catalog.jsonb_build_object('expected','absent_before_apply') AS details
  FROM additive_column_names n
), grant_results AS (
  SELECT p.oid::pg_catalog.regprocedure::text AS object_name,
         p.prosecdef AND pg_catalog.pg_get_userbyid(p.proowner)='postgres'
           AND COALESCE('search_path=pg_catalog'=ANY(p.proconfig),false) AS ok,
         pg_catalog.jsonb_build_object(
           'owner',pg_catalog.pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,
           'public_execute',COALESCE((
             SELECT pg_catalog.bool_or(a.grantee=0 AND a.privilege_type='EXECUTE')
             FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
           ),false),
           'anon_execute',pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE'),
           'authenticated_execute',pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE'),
           'service_role_execute',pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
         ) AS details
  FROM pg_catalog.pg_proc p
  WHERE p.oid IN (
    'potok_control.grant_entitlement_v2(uuid,text,timestamp with time zone,text,text)'::pg_catalog.regprocedure,
    'potok_control.revoke_entitlement_v2(uuid,text,text,text)'::pg_catalog.regprocedure,
    'public.adaptive_nutrition_provision_current_week_v1(text,uuid)'::pg_catalog.regprocedure,
    'potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb)'::pg_catalog.regprocedure
  )
), data_invariants AS (
  SELECT 'global_operation_id_uniqueness' AS object_name,
         NOT EXISTS (
           SELECT operation_id FROM public.adaptive_nutrition_operations
            GROUP BY operation_id HAVING pg_catalog.count(*) > 1
         ) AS ok,
         pg_catalog.jsonb_build_object('duplicate_groups',(
           SELECT pg_catalog.count(*) FROM (
             SELECT operation_id FROM public.adaptive_nutrition_operations
              GROUP BY operation_id HAVING pg_catalog.count(*) > 1
           ) d
         )) AS details
  UNION ALL
  SELECT 'no_existing_graph_v2_contract_rows',
         NOT EXISTS (
           SELECT 1 FROM public.adaptive_nutrition_graph_revisions g
            WHERE g.snapshot_encoding_version='potok-adaptive-nutrition-graph-v2-canonical-json-v1'
         ),
         pg_catalog.jsonb_build_object('expected','zero before apply')
), checks AS (
  SELECT '01_column' section, * FROM column_results
  UNION ALL SELECT '02_function', * FROM function_results
  UNION ALL SELECT '03_rls_force', * FROM rls_results
  UNION ALL SELECT '04_legacy_lock', * FROM lock_results
  UNION ALL SELECT '05_immutable_guard', * FROM immutable_results
  UNION ALL SELECT '06_proposed_object_absent', * FROM absence_results
  UNION ALL SELECT '06_proposed_name_absent', * FROM schema_name_absence
  UNION ALL SELECT '07_additive_column_absent', * FROM additive_columns_absent
  UNION ALL SELECT '08_security_metadata', * FROM grant_results
  UNION ALL SELECT '09_data_invariant', * FROM data_invariants
)
SELECT section, object_name, ok, details,
       pg_catalog.bool_and(ok) OVER () AS ready_for_graph_v2_authorities_activation_v1_apply
FROM checks
ORDER BY section, object_name;
