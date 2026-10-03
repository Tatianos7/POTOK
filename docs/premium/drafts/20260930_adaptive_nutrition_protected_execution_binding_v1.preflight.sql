-- POTOK protected execution binding v1 — SELECT-only STAGING metadata preflight.
-- Owner must verify Dashboard project ref ozidryfvhkcbtpnulakq before running.
-- No application function is invoked and no application row is read.

WITH
expected_project AS (
  SELECT 'ozidryfvhkcbtpnulakq'::text AS project_ref
),
relations AS (
  SELECT n.nspname AS schema_name,c.relname,c.oid,c.relrowsecurity,c.relforcerowsecurity,c.relkind
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE (n.nspname,c.relname) IN (
     ('public','adaptive_nutrition_operations'),
     ('public','user_premium_plan_selections'),
     ('public','user_goals'),
     ('potok_nutrition','nutrition_authority_heads_v1'),
     ('potok_nutrition','adaptive_nutrition_candidate_manifests_v2'),
     ('potok_nutrition','adaptive_nutrition_candidate_manifest_head_v2'),
     ('potok_nutrition','adaptive_nutrition_generation_policy_head_v2'),
     ('potok_nutrition','adaptive_nutrition_goal_targets_v1'),
     ('potok_nutrition','adaptive_nutrition_generation_requests_v2')
   )
),
columns AS (
  SELECT n.nspname AS schema_name,c.relname,a.attname,
         pg_catalog.format_type(a.atttypid,a.atttypmod) AS data_type,a.attnotnull
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE a.attnum>0 AND NOT a.attisdropped
     AND (n.nspname,c.relname) IN (
       ('public','adaptive_nutrition_operations'),
       ('public','user_premium_plan_selections'),
       ('public','user_goals')
     )
),
constraints AS (
  SELECT n.nspname AS schema_name,c.relname,con.conname,con.contype,
         pg_catalog.pg_get_constraintdef(con.oid,true) AS definition
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class c ON c.oid=con.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE (n.nspname,c.relname) IN (
     ('public','adaptive_nutrition_operations'),
     ('public','user_premium_plan_selections')
   )
),
indexes AS (
  SELECT n.nspname AS schema_name,c.relname,i.relname AS index_name,
         x.indisunique,x.indisvalid,x.indisready,x.indislive,
         pg_catalog.pg_get_indexdef(i.oid) AS definition,
         pg_catalog.pg_get_expr(x.indpred,x.indrelid) AS predicate
    FROM pg_catalog.pg_index x
    JOIN pg_catalog.pg_class c ON c.oid=x.indrelid
    JOIN pg_catalog.pg_class i ON i.oid=x.indexrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE (n.nspname,c.relname) IN (
     ('public','adaptive_nutrition_operations'),
     ('public','user_premium_plan_selections')
   )
),
triggers AS (
  SELECT n.nspname AS schema_name,c.relname,t.tgname,t.tgenabled,
         pg_catalog.pg_get_triggerdef(t.oid,true) AS definition
    FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE NOT t.tgisinternal
     AND (n.nspname,c.relname)=('public','adaptive_nutrition_operations')
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
           JOIN pg_catalog.pg_roles role_row ON role_row.oid=acl.grantee
           WHERE role_row.rolname='anon' AND acl.privilege_type='EXECUTE') AS anon_execute,
         EXISTS(SELECT 1 FROM pg_catalog.aclexplode(
           COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) acl
           JOIN pg_catalog.pg_roles role_row ON role_row.oid=acl.grantee
           WHERE role_row.rolname='authenticated' AND acl.privilege_type='EXECUTE') AS authenticated_execute,
         EXISTS(SELECT 1 FROM pg_catalog.aclexplode(
           COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) acl
           JOIN pg_catalog.pg_roles role_row ON role_row.oid=acl.grantee
           WHERE role_row.rolname='service_role' AND acl.privilege_type='EXECUTE') AS service_role_execute
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE (n.nspname,p.proname) IN (
     ('potok_control','is_effective_entitlement_v2'),
     ('potok_nutrition','acquire_shared_account_gate_v1'),
     ('potok_nutrition','record_generated_week_v2'),
     ('potok_nutrition','activate_generated_week_v2'),
     ('potok_nutrition','initialize_nutrition_authorities_v1'),
     ('potok_nutrition','create_preference_successor_v1'),
     ('potok_nutrition','create_safety_successor_v1'),
     ('potok_nutrition','publish_candidate_manifest_v2'),
     ('public','adaptive_nutrition_read_graph_v2'),
     ('public','adaptive_nutrition_request_generation_v2'),
     ('public','adaptive_nutrition_generation_status_v2'),
     ('potok_nutrition','load_generation_request_v2'),
     ('potok_nutrition','record_generated_week_gateway_v2'),
     ('potok_nutrition','activate_generated_week_gateway_v2')
   )
),
checks(check_name,ok,details) AS (
  SELECT 'project_ref_owner_confirmation_required',true,
         'Open STAGING project '||(SELECT project_ref FROM expected_project)
  UNION ALL
  SELECT 'operations_relation',EXISTS(SELECT 1 FROM relations WHERE schema_name='public' AND relname='adaptive_nutrition_operations' AND relkind='r'),
         'public.adaptive_nutrition_operations must exist'
  UNION ALL
  SELECT 'operations_columns',NOT EXISTS(
    SELECT 1 FROM pg_catalog.unnest(ARRAY[
      'user_id','idempotency_key','operation_id','selection_id','contract_version','action_type',
      'canonical_request','digest_version','request_digest','outcome','reason','result_references',
      'created_at','committed_at','result_canonical','result_digest','result_plan_revision','result_graph_digest'
    ]) required(name)
    WHERE NOT EXISTS(SELECT 1 FROM columns c WHERE c.schema_name='public'
      AND c.relname='adaptive_nutrition_operations' AND c.attname=required.name)),
    'ledger request/result columns required'
  UNION ALL
  SELECT 'operations_outcome_constraint',EXISTS(SELECT 1 FROM constraints
    WHERE conname='adaptive_nutrition_operations_outcome_check'
      AND definition ILIKE '%in_progress%' AND definition ILIKE '%accepted%'
      AND definition ILIKE '%conflict%' AND definition ILIKE '%rejected%'),
    'existing outcome vocabulary preserved'
  UNION ALL
  SELECT 'operations_action_is_extensible',NOT EXISTS(SELECT 1 FROM constraints
    WHERE schema_name='public' AND relname='adaptive_nutrition_operations'
      AND definition ILIKE '%action_type%' AND conname<>'adaptive_nutrition_operations_v2_result_check'),
    'no action allowlist may reject request/attempt action types'
  UNION ALL
  SELECT 'operations_idempotency_pk',EXISTS(SELECT 1 FROM constraints
    WHERE conname='adaptive_nutrition_operations_pkey'
      AND definition ILIKE '%user_id%' AND definition ILIKE '%idempotency_key%'),
    'account-scoped key uniqueness required'
  UNION ALL
  SELECT 'operations_global_operation_id',EXISTS(SELECT 1 FROM indexes
    WHERE index_name='adaptive_nutrition_operations_operation_global_v2_idx'
      AND indisunique AND indisvalid AND indisready AND indislive),
    'gateway identity lookup requires global operation id uniqueness'
  UNION ALL
  SELECT 'operations_immutable_guards',EXISTS(SELECT 1 FROM triggers
    WHERE tgname='potok_operations_update_guard_v1' AND tgenabled<>'D')
    AND EXISTS(SELECT 1 FROM triggers
    WHERE tgname='potok_operations_delete_guard_v1' AND tgenabled<>'D'),
    'settled update plus delete/truncate guards required'
  UNION ALL
  SELECT 'operations_rls_force',EXISTS(SELECT 1 FROM relations
    WHERE schema_name='public' AND relname='adaptive_nutrition_operations'
      AND relrowsecurity AND relforcerowsecurity),
    'operations ledger must keep RLS and FORCE RLS'
  UNION ALL
  SELECT 'selection_goal_authority_manifest_foundation',NOT EXISTS(
    SELECT 1 FROM (VALUES
      ('public','user_premium_plan_selections'),('public','user_goals'),
      ('potok_nutrition','nutrition_authority_heads_v1'),
      ('potok_nutrition','adaptive_nutrition_candidate_manifests_v2'),
      ('potok_nutrition','adaptive_nutrition_candidate_manifest_head_v2')
    ) expected(schema_name,relname)
    WHERE NOT EXISTS(SELECT 1 FROM relations r WHERE r.schema_name=expected.schema_name
      AND r.relname=expected.relname)),
    'trusted input authorities required'
  UNION ALL
  SELECT 'required_existing_functions',NOT EXISTS(
    SELECT 1 FROM (VALUES
      ('potok_control','is_effective_entitlement_v2'),
      ('potok_nutrition','acquire_shared_account_gate_v1'),
      ('potok_nutrition','record_generated_week_v2'),
      ('potok_nutrition','activate_generated_week_v2'),
      ('public','adaptive_nutrition_read_graph_v2')
    ) expected(schema_name,proname)
    WHERE NOT EXISTS(SELECT 1 FROM functions f WHERE f.schema_name=expected.schema_name
      AND f.proname=expected.proname)),
    'entitlement, shared gate, writers and exact read required'
  UNION ALL
  SELECT 'writer_prebinding_sentinel',(
    SELECT pg_catalog.count(*)=2 FROM functions f
     WHERE f.proname IN ('record_generated_week_v2','activate_generated_week_v2')
       AND f.prosecdef AND f.owner='postgres' AND f.search_path='search_path=pg_catalog'
       AND f.definition LIKE '%SESSION_USER <> ''postgres'' OR CURRENT_USER <> ''postgres''%'
  ),'reviewed old sentinel required before minimal replacement'
  UNION ALL
  SELECT 'internal_six_have_no_application_execute',(
    SELECT pg_catalog.count(*)=6 FROM functions f
     WHERE f.proname IN ('initialize_nutrition_authorities_v1','create_preference_successor_v1',
       'create_safety_successor_v1','publish_candidate_manifest_v2',
       'record_generated_week_v2','activate_generated_week_v2')
       AND NOT f.public_execute AND NOT f.anon_execute
       AND NOT f.authenticated_execute AND NOT f.service_role_execute
  ),'direct internal writer access must remain absent'
  UNION ALL
  SELECT 'binding_package_absent',NOT EXISTS(SELECT 1 FROM relations
    WHERE schema_name='potok_nutrition'
      AND relname IN ('adaptive_nutrition_generation_policy_head_v2',
                      'adaptive_nutrition_goal_targets_v1',
                      'adaptive_nutrition_generation_requests_v2'))
    AND NOT EXISTS(SELECT 1 FROM functions
      WHERE proname IN ('adaptive_nutrition_request_generation_v2',
        'adaptive_nutrition_generation_status_v2','load_generation_request_v2',
        'record_generated_week_gateway_v2','activate_generated_week_gateway_v2')),
    'preflight is for first apply only'
),
summary AS (
  SELECT pg_catalog.bool_and(ok) AS ready_for_protected_execution_binding_v1_apply
    FROM checks
)
SELECT 'CHECK'::text AS record_kind,check_name,ok,details,
       NULL::boolean AS ready_for_protected_execution_binding_v1_apply
  FROM checks
UNION ALL
SELECT 'SUMMARY','ready_for_protected_execution_binding_v1_apply',
       ready_for_protected_execution_binding_v1_apply,
       'SELECT-only metadata verdict for reviewed STAGING project; no SQL was applied',
       ready_for_protected_execution_binding_v1_apply
  FROM summary
ORDER BY record_kind,check_name;
