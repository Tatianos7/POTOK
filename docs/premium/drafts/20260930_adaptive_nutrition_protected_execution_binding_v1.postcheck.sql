-- POTOK protected execution binding v1 — SELECT-only postcheck.
-- Target: STAGING ozidryfvhkcbtpnulakq only. No application function is invoked.

WITH
schemas AS (
  SELECT n.nspname,pg_catalog.pg_get_userbyid(n.nspowner) AS owner,
         pg_catalog.has_schema_privilege('service_role',n.oid,'USAGE') AS service_role_usage,
         pg_catalog.has_schema_privilege('service_role',n.oid,'CREATE') AS service_role_create,
         pg_catalog.has_schema_privilege('anon',n.oid,'USAGE') AS anon_usage,
         pg_catalog.has_schema_privilege('anon',n.oid,'CREATE') AS anon_create,
         pg_catalog.has_schema_privilege('authenticated',n.oid,'USAGE') AS authenticated_usage,
         pg_catalog.has_schema_privilege('authenticated',n.oid,'CREATE') AS authenticated_create,
         EXISTS(SELECT 1 FROM pg_catalog.aclexplode(
           COALESCE(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) acl
           WHERE acl.grantee=0 AND acl.privilege_type='USAGE') AS public_usage,
         EXISTS(SELECT 1 FROM pg_catalog.aclexplode(
           COALESCE(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) acl
           WHERE acl.grantee=0 AND acl.privilege_type='CREATE') AS public_create
    FROM pg_catalog.pg_namespace n
   WHERE n.nspname='potok_nutrition'
),
relations AS (
  SELECT n.nspname AS schema_name,c.relname,c.oid,c.relrowsecurity,c.relforcerowsecurity,
         EXISTS(
           SELECT 1
             FROM pg_catalog.aclexplode(
               COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) acl
             LEFT JOIN pg_catalog.pg_roles role_row ON role_row.oid=acl.grantee
            WHERE acl.grantee=0
               OR role_row.rolname IN ('anon','authenticated','service_role')
         ) AS application_acl
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE (n.nspname,c.relname) IN (
     ('potok_nutrition','adaptive_nutrition_generation_policy_head_v2'),
     ('potok_nutrition','adaptive_nutrition_goal_targets_v1'),
     ('potok_nutrition','adaptive_nutrition_generation_requests_v2')
   )
),
triggers AS (
  SELECT n.nspname AS schema_name,c.relname,t.tgname,t.tgenabled,
         t.tgtype::integer AS tgtype,
         fn.nspname AS function_schema,
         f.proname AS function_name,
         pg_catalog.pg_get_function_identity_arguments(f.oid) AS function_arguments
    FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_proc f ON f.oid=t.tgfoid
    JOIN pg_catalog.pg_namespace fn ON fn.oid=f.pronamespace
   WHERE NOT t.tgisinternal
     AND (n.nspname,c.relname) IN (
       ('potok_nutrition','adaptive_nutrition_goal_targets_v1'),
       ('potok_nutrition','adaptive_nutrition_generation_requests_v2')
     )
),
functions AS (
  SELECT n.nspname AS schema_name,p.proname,p.oid,p.prosecdef,
         pg_catalog.pg_get_userbyid(p.proowner) AS owner,
         pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
         pg_catalog.pg_get_functiondef(p.oid) AS definition,
         COALESCE((SELECT cfg FROM pg_catalog.unnest(p.proconfig) cfg
                               WHERE cfg LIKE 'search_path=%'),'') AS search_path,
         EXISTS(SELECT 1 FROM pg_catalog.aclexplode(
           COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) acl
           WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') AS public_execute,
         EXISTS(SELECT 1 FROM pg_catalog.aclexplode(
           COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) acl
           JOIN pg_catalog.pg_roles r ON r.oid=acl.grantee
           WHERE r.rolname='anon' AND acl.privilege_type='EXECUTE') AS anon_execute,
         EXISTS(SELECT 1 FROM pg_catalog.aclexplode(
           COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) acl
           JOIN pg_catalog.pg_roles r ON r.oid=acl.grantee
           WHERE r.rolname='authenticated' AND acl.privilege_type='EXECUTE') AS authenticated_execute,
         EXISTS(SELECT 1 FROM pg_catalog.aclexplode(
           COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) acl
           JOIN pg_catalog.pg_roles r ON r.oid=acl.grantee
           WHERE r.rolname='service_role' AND acl.privilege_type='EXECUTE') AS service_role_execute
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE (n.nspname,p.proname) IN (
     ('public','adaptive_nutrition_request_generation_v2'),
     ('public','adaptive_nutrition_generation_status_v2'),
     ('potok_nutrition','load_generation_request_v2'),
     ('potok_nutrition','record_generated_week_gateway_v2'),
     ('potok_nutrition','activate_generated_week_gateway_v2'),
     ('potok_nutrition','record_generated_week_v2'),
     ('potok_nutrition','activate_generated_week_v2'),
     ('potok_nutrition','initialize_nutrition_authorities_v1'),
     ('potok_nutrition','create_preference_successor_v1'),
     ('potok_nutrition','create_safety_successor_v1'),
     ('potok_nutrition','publish_candidate_manifest_v2'),
     ('public','adaptive_nutrition_read_graph_v2'),
     ('public','adaptive_nutrition_read_v1')
   )
),
service_role_executable_functions AS (
  SELECT p.oid,n.nspname,p.proname,
         pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='potok_nutrition'
     AND pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
),
checks(check_name,ok,details) AS (
  SELECT 'service_role_gateway_schema_usage',(
    SELECT pg_catalog.count(*)=1 AND pg_catalog.bool_and(
      owner='postgres' AND service_role_usage AND NOT service_role_create
      AND NOT public_usage AND NOT public_create
      AND NOT anon_usage AND NOT anon_create
      AND NOT authenticated_usage AND NOT authenticated_create)
      FROM schemas
  ),'service_role has USAGE but not CREATE; PUBLIC, anon and authenticated have neither schema privilege'
  UNION ALL
  SELECT 'service_role_effective_gateway_allowlist',(
    SELECT pg_catalog.count(*)=3 AND pg_catalog.bool_and(oid IN (
      pg_catalog.to_regprocedure('potok_nutrition.load_generation_request_v2(uuid)'),
      pg_catalog.to_regprocedure('potok_nutrition.record_generated_week_gateway_v2(uuid,bytea)'),
      pg_catalog.to_regprocedure('potok_nutrition.activate_generated_week_gateway_v2(uuid)')
    )) FROM service_role_executable_functions
  ),'service_role effective EXECUTE in potok_nutrition resolves to exactly the three narrow gateways'
  UNION ALL
  SELECT 'package_relations_rls_force',(
    SELECT pg_catalog.count(*)=3 AND pg_catalog.bool_and(
      relrowsecurity AND relforcerowsecurity AND NOT application_acl)
      FROM relations
  ),'request, policy and immutable Goal-target relations have RLS + FORCE RLS and no application ACL'
  UNION ALL
  SELECT 'package_mutation_guards',
    EXISTS(SELECT 1 FROM triggers
      WHERE schema_name='potok_nutrition'
        AND relname='adaptive_nutrition_goal_targets_v1'
        AND tgname='potok_goal_target_immutable_v1'
        AND tgenabled<>'D'
        AND (tgtype & 2)=2
        AND (tgtype & 1)=0
        AND (tgtype & 60)=56
        AND function_schema='potok_nutrition'
        AND function_name='reject_immutable_change_v2'
        AND function_arguments='')
    AND EXISTS(SELECT 1 FROM triggers
      WHERE schema_name='potok_nutrition'
        AND relname='adaptive_nutrition_generation_requests_v2'
        AND tgname='potok_generation_request_update_guard_v2'
        AND tgenabled<>'D'
        AND (tgtype & 2)=2
        AND (tgtype & 1)=1
        AND (tgtype & 60)=16
        AND function_schema='potok_nutrition'
        AND function_name='protect_generation_request_identity_v2'
        AND function_arguments='')
    AND EXISTS(SELECT 1 FROM triggers
      WHERE schema_name='potok_nutrition'
        AND relname='adaptive_nutrition_generation_requests_v2'
        AND tgname='potok_generation_request_delete_guard_v2'
        AND tgenabled<>'D'
        AND (tgtype & 2)=2
        AND (tgtype & 1)=0
        AND (tgtype & 60)=40
        AND function_schema='potok_nutrition'
        AND function_name='reject_immutable_change_v2'
        AND function_arguments=''),
    'Goal target and request guards have exact enabled BEFORE event, level and trigger-function semantics'
  UNION ALL
  SELECT 'user_request_status_acl',(
    SELECT pg_catalog.count(*)=2 AND pg_catalog.bool_and(
      owner='postgres' AND prosecdef AND search_path='search_path=pg_catalog'
      AND NOT public_execute AND NOT anon_execute AND authenticated_execute
      AND NOT service_role_execute)
      FROM functions WHERE schema_name='public'
       AND proname IN ('adaptive_nutrition_request_generation_v2',
                       'adaptive_nutrition_generation_status_v2')
  ),'only authenticated executes user request/status boundaries'
  UNION ALL
  SELECT 'narrow_gateway_acl',(
    SELECT pg_catalog.count(*)=3 AND pg_catalog.bool_and(
      owner='postgres' AND prosecdef AND search_path='search_path=pg_catalog'
      AND NOT public_execute AND NOT anon_execute AND NOT authenticated_execute
      AND service_role_execute)
      FROM functions WHERE schema_name='potok_nutrition'
       AND proname IN ('load_generation_request_v2','record_generated_week_gateway_v2',
                       'activate_generated_week_gateway_v2')
  ),'only service_role executes the three narrow gateways'
  UNION ALL
  SELECT 'internal_graph_writer_invoker_sentinel',(
    SELECT pg_catalog.count(*)=2 AND pg_catalog.bool_and(
      owner='postgres' AND NOT prosecdef AND search_path='search_path=pg_catalog'
      AND definition LIKE '%CURRENT_USER <> ''postgres''%'
      AND definition NOT LIKE '%SESSION_USER <> ''postgres''%'
      AND NOT public_execute AND NOT anon_execute AND NOT authenticated_execute
      AND NOT service_role_execute)
      FROM functions WHERE schema_name='potok_nutrition'
       AND proname IN ('record_generated_week_v2','activate_generated_week_v2')
  ),'writer runs as postgres only through owner session or postgres-owned gateway'
  UNION ALL
  SELECT 'all_internal_six_direct_acl_denied',(
    SELECT pg_catalog.count(*)=6 AND pg_catalog.bool_and(
      NOT public_execute AND NOT anon_execute AND NOT authenticated_execute
      AND NOT service_role_execute)
      FROM functions WHERE schema_name='potok_nutrition'
       AND proname IN ('initialize_nutrition_authorities_v1','create_preference_successor_v1',
         'create_safety_successor_v1','publish_candidate_manifest_v2',
         'record_generated_week_v2','activate_generated_week_v2')
  ),'service_role has no direct internal authority/writer path'
  UNION ALL
  SELECT 'Graph_v2_exact_read_preserved',EXISTS(SELECT 1 FROM functions
    WHERE schema_name='public' AND proname='adaptive_nutrition_read_graph_v2'
      AND owner='postgres' AND prosecdef),
    'Graph v2 exact/current reader remains present'
  UNION ALL
  SELECT 'Graph_v1_primary_reader_preserved',(
    SELECT pg_catalog.count(*)=1 FROM functions
     WHERE schema_name='public' AND proname='adaptive_nutrition_read_v1'
       AND definition LIKE '%adaptive_nutrition_graph_revisions%'
       AND definition LIKE '%user_premium_plan_selections%'
  ),'signature-safe Graph v1 body classification remains unique'
  UNION ALL
  SELECT 'acceptance_generation_requests_zero',NOT EXISTS(
    SELECT 1 FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 r
     WHERE r.request_operation_id::text LIKE '93020000-0000-4000-8000-%'
        OR r.account_id IN ('d6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid,
                            '8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid)
  ),'rollback left no request-state fixture rows'
  UNION ALL
  SELECT 'acceptance_operations_zero',NOT EXISTS(
    SELECT 1 FROM public.adaptive_nutrition_operations o
     WHERE o.user_id IN ('d6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid,
                         '8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid)
        OR o.idempotency_key LIKE '93020000-0000-4000-8000-%'
  ),'rollback left no operation receipts'
  UNION ALL
  SELECT 'acceptance_plan_graph_event_residue_zero',
    NOT EXISTS(SELECT 1 FROM public.user_premium_plan_selections s
      WHERE s.id::text LIKE '93020000-0000-4000-8000-%')
    AND NOT EXISTS(SELECT 1 FROM public.adaptive_nutrition_graph_revisions g
      WHERE g.selection_id::text LIKE '93020000-0000-4000-8000-%')
    AND NOT EXISTS(SELECT 1 FROM public.adaptive_nutrition_events e
      WHERE e.selection_id::text LIKE '93020000-0000-4000-8000-%'),
    'rollback left no selection/graph/event fixtures'
  UNION ALL
  SELECT 'acceptance_profile_goal_entitlement_zero',
    NOT EXISTS(SELECT 1 FROM public.user_profiles p
      WHERE p.user_id IN ('d6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid,
                          '8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid))
    AND NOT EXISTS(SELECT 1 FROM public.user_goals g
      WHERE g.user_id IN ('d6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid,
                          '8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid))
    AND NOT EXISTS(SELECT 1 FROM potok_control.access_attestations a
      WHERE a.account_id IN ('d6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid,
                             '8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid)),
    'empty Auth fixture accounts remain empty'
  UNION ALL
  SELECT 'acceptance_policy_fixture_zero',NOT EXISTS(
    SELECT 1 FROM potok_nutrition.adaptive_nutrition_generation_policy_head_v2 p
     WHERE p.publication_evidence='synthetic-protected-channel-rollback-only'
  ) AND NOT EXISTS(
    SELECT 1 FROM potok_nutrition.adaptive_nutrition_goal_targets_v1 t
     WHERE t.evidence_ref='synthetic-protected-channel-rollback-only'
        OR t.account_id IN ('d6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid,
                            '8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid)
  ),'rollback left no synthetic policy or Goal-target authority'
),
summary AS (
  SELECT pg_catalog.bool_and(ok) AS protected_execution_binding_postcheck_pass FROM checks
)
SELECT 'CHECK'::text AS record_kind,check_name,ok,details,
       NULL::boolean AS protected_execution_binding_postcheck_pass
  FROM checks
UNION ALL
SELECT 'SUMMARY','protected_execution_binding_postcheck_pass',
       protected_execution_binding_postcheck_pass,
       'SELECT-only result; no application function was invoked',
       protected_execution_binding_postcheck_pass
  FROM summary
ORDER BY record_kind,check_name;
