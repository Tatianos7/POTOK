-- SELECT-ONLY postcheck for Supabase STAGING ozidryfvhkcbtpnulakq.
-- Run after the rollback-only acceptance. It performs no business function calls.

WITH required_relations(object_name,relation_name) AS (
  VALUES
    ('preference snapshots','potok_nutrition.nutrition_preference_snapshots_v1'),
    ('safety snapshots','potok_nutrition.nutrition_safety_snapshots_v1'),
    ('authority heads','potok_nutrition.nutrition_authority_heads_v1'),
    ('manifest headers','potok_nutrition.adaptive_nutrition_candidate_manifests_v2'),
    ('manifest entries','potok_nutrition.adaptive_nutrition_candidate_manifest_entries_v2'),
    ('manifest head','potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2')
), relation_checks AS (
  SELECT '01_relation' AS section,r.object_name,
         pg_catalog.to_regclass(r.relation_name) IS NOT NULL AS ok,
         pg_catalog.jsonb_build_object('relation',r.relation_name) AS details
    FROM required_relations r
), required_functions(
  object_name,signature,expected_security_mode,authenticated_expected,required_body_marker
) AS (
  VALUES
    ('shared account gate','potok_nutrition.acquire_shared_account_gate_v1(uuid)',
      'SECURITY_INVOKER',false,'potok-shared-account-gate-v1:'),
    ('initialize authorities','potok_nutrition.initialize_nutrition_authorities_v1(uuid,uuid,bytea,bytea,uuid)',
      'SECURITY_DEFINER',false,NULL),
    ('preference successor','potok_nutrition.create_preference_successor_v1(uuid,uuid,uuid,bytea,uuid)',
      'SECURITY_DEFINER',false,NULL),
    ('safety successor','potok_nutrition.create_safety_successor_v1(uuid,uuid,uuid,bytea,uuid)',
      'SECURITY_DEFINER',false,NULL),
    ('manifest publication','potok_nutrition.publish_candidate_manifest_v2(bytea,uuid,uuid,uuid)',
      'SECURITY_DEFINER',false,NULL),
    ('generation receipt','potok_nutrition.record_generated_week_v2(uuid,uuid,uuid,bytea,bytea)',
      'SECURITY_DEFINER',false,NULL),
    ('Graph v2 activation','potok_nutrition.activate_generated_week_v2(uuid,uuid,uuid)',
      'SECURITY_DEFINER',false,NULL),
    ('Graph v2 exact read','public.adaptive_nutrition_read_graph_v2(uuid,uuid,text)',
      'SECURITY_DEFINER',true,NULL),
    ('Graph v2 history','public.adaptive_nutrition_list_graph_history_v2(uuid)',
      'SECURITY_DEFINER',true,NULL),
    ('Graph v2 operation lookup','public.adaptive_nutrition_lookup_operation_v2(uuid)',
      'SECURITY_DEFINER',true,NULL),
    ('current preference','public.adaptive_nutrition_current_preference_v1()',
      'SECURITY_DEFINER',true,NULL),
    ('current safety','public.adaptive_nutrition_current_safety_v1()',
      'SECURITY_DEFINER',true,NULL),
    ('protected manifest read','potok_nutrition.current_candidate_manifest_v2()',
      'SECURITY_DEFINER',false,NULL)
), function_checks AS (
  SELECT '02_function' AS section,f.object_name,
         p.oid IS NOT NULL
         AND p.prosecdef = (f.expected_security_mode='SECURITY_DEFINER')
         AND pg_catalog.pg_get_userbyid(p.proowner)='postgres'
         AND COALESCE('search_path=pg_catalog'=ANY(p.proconfig),false)
         AND NOT pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
         AND NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
         AND pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')=f.authenticated_expected
         AND (f.required_body_marker IS NULL OR pg_catalog.strpos(
           pg_catalog.pg_get_functiondef(p.oid),f.required_body_marker
         )>0)
         AND NOT COALESCE((
           SELECT pg_catalog.bool_or(a.grantee=0 AND a.privilege_type='EXECUTE')
             FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
         ),false) AS ok,
         pg_catalog.jsonb_build_object('signature',f.signature,
           'expected_security_mode',f.expected_security_mode,
           'actual_security_mode',CASE WHEN p.oid IS NULL THEN NULL
             WHEN p.prosecdef THEN 'SECURITY_DEFINER' ELSE 'SECURITY_INVOKER' END,
           'required_body_marker',f.required_body_marker,
           'body_marker_present',CASE WHEN p.oid IS NULL THEN NULL
             WHEN f.required_body_marker IS NULL THEN true
             ELSE pg_catalog.strpos(
               pg_catalog.pg_get_functiondef(p.oid),f.required_body_marker
             )>0 END,
           'public_execute',CASE WHEN p.oid IS NULL THEN NULL ELSE COALESCE((
             SELECT pg_catalog.bool_or(a.grantee=0 AND a.privilege_type='EXECUTE')
               FROM pg_catalog.aclexplode(
                 COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))
               ) a
           ),false) END,
           'anon_execute',CASE WHEN p.oid IS NULL THEN NULL
             ELSE pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') END,
           'authenticated_execute',CASE WHEN p.oid IS NULL THEN NULL
             ELSE pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') END,
           'service_role_execute',CASE WHEN p.oid IS NULL THEN NULL
             ELSE pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE') END) AS details
    FROM required_functions f
    LEFT JOIN pg_catalog.pg_proc p ON p.oid=pg_catalog.to_regprocedure(f.signature)
), rls_checks AS (
  SELECT '03_rls_force' AS section,n.nspname||'.'||c.relname AS object_name,
         c.relrowsecurity AND c.relforcerowsecurity AS ok,
         pg_catalog.jsonb_build_object('rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) AS details
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='potok_nutrition' AND c.relname IN (
     'nutrition_preference_snapshots_v1','nutrition_safety_snapshots_v1',
     'nutrition_authority_heads_v1','adaptive_nutrition_candidate_manifests_v2',
     'adaptive_nutrition_candidate_manifest_entries_v2','adaptive_nutrition_candidate_manifest_head_v2')
), lock_checks AS (
  SELECT '04_shared_gate' AS section,x.object_name,
         pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(x.signature))
           LIKE '%acquire_shared_account_gate_v1%' AS ok,
         pg_catalog.jsonb_build_object('signature',x.signature) AS details
    FROM (VALUES
      ('entitlement grant','potok_control.grant_entitlement_v2(uuid,text,timestamp with time zone,text,text)'),
      ('entitlement revoke','potok_control.revoke_entitlement_v2(uuid,text,text,text)'),
      ('weekly provision','public.adaptive_nutrition_provision_current_week_v1(text,uuid)'),
      ('v1 transition','potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb)'),
      ('v2 generation','potok_nutrition.record_generated_week_v2(uuid,uuid,uuid,bytea,bytea)'),
      ('v2 activation','potok_nutrition.activate_generated_week_v2(uuid,uuid,uuid)')
    ) x(object_name,signature)
), graph_v1_reader_catalog AS (
  SELECT n.nspname AS schema_name,
         p.proname AS function_name,
         p.oid,
         pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
         pg_catalog.pg_get_function_result(p.oid) AS return_type,
         p.prosecdef,
         pg_catalog.pg_get_userbyid(p.proowner) AS owner_name,
         (
           SELECT setting
             FROM pg_catalog.unnest(COALESCE(p.proconfig, ARRAY[]::text[])) setting
            WHERE setting LIKE 'search_path=%'
            ORDER BY setting
            LIMIT 1
         ) AS search_path_setting,
         pg_catalog.pg_get_functiondef(p.oid) AS function_definition
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname IN ('public', 'potok_nutrition')
     AND p.prokind = 'f'
), graph_v1_reader_candidates AS (
  SELECT f.*,
         pg_catalog.lower(f.function_definition)
           LIKE '%adaptive_nutrition_graph_revisions%' AS references_graph_revisions,
         pg_catalog.lower(f.function_definition)
           LIKE '%user_premium_plan_selections%' AS references_plan_selections,
         (
           (
             pg_catalog.lower(f.function_name) = 'adaptive_nutrition_read_v1'
             OR pg_catalog.lower(f.function_name) LIKE '%graph%v1%read%'
             OR pg_catalog.lower(f.function_name) LIKE '%read%graph%v1%'
           )
           AND pg_catalog.lower(f.function_definition)
             LIKE '%adaptive_nutrition_graph_revisions%'
           AND pg_catalog.lower(f.function_definition)
             LIKE '%user_premium_plan_selections%'
           AND pg_catalog.lower(f.function_definition) LIKE '%graph_snapshot%'
           AND pg_catalog.lower(f.function_definition) LIKE '%plan_revision%'
           AND pg_catalog.lower(f.function_definition) LIKE '%auth.uid()%'
           AND pg_catalog.lower(pg_catalog.pg_get_function_result(f.oid)) = 'jsonb'
         ) AS primary_shape
    FROM graph_v1_reader_catalog f
   WHERE pg_catalog.lower(f.function_name) = 'adaptive_nutrition_read_v1'
      OR pg_catalog.lower(f.function_name) LIKE '%adaptive%nutrition%read%'
      OR pg_catalog.lower(f.function_name) LIKE '%graph%v1%read%'
      OR pg_catalog.lower(f.function_name) LIKE '%read%graph%v1%'
      OR pg_catalog.lower(f.function_name) LIKE '%current%graph%read%'
      OR pg_catalog.lower(f.function_name) LIKE '%plan%read%'
      OR pg_catalog.lower(f.function_definition) LIKE '%adaptive nutrition read%'
      OR pg_catalog.lower(f.function_definition) LIKE '%graph v1 read%'
      OR pg_catalog.lower(f.function_definition) LIKE '%adaptive_nutrition_graph_revisions%'
), graph_v1_reader_counts AS (
  SELECT pg_catalog.count(*) FILTER (WHERE c.primary_shape) AS primary_candidate_count
    FROM graph_v1_reader_candidates c
), graph_v1_reader_classified AS (
  SELECT c.*,
         counts.primary_candidate_count,
         CASE
           WHEN c.primary_shape AND counts.primary_candidate_count = 1
             THEN 'PRIMARY_GRAPH_V1_READER'
           WHEN c.primary_shape AND counts.primary_candidate_count <> 1
             THEN 'AMBIGUOUS'
           WHEN pg_catalog.lower(c.function_name) = 'adaptive_nutrition_read_v1'
             THEN 'AMBIGUOUS'
           WHEN c.references_graph_revisions OR c.references_plan_selections
             OR pg_catalog.lower(c.function_name) LIKE '%adaptive%nutrition%read%'
             OR pg_catalog.lower(c.function_name) LIKE '%graph%read%'
             OR pg_catalog.lower(c.function_name) LIKE '%plan%read%'
             THEN 'RELATED_READER'
           ELSE 'NOT_GRAPH_V1_READER'
         END AS reader_classification
    FROM graph_v1_reader_candidates c
    CROSS JOIN graph_v1_reader_counts counts
), graph_v1_reader_summary AS (
  SELECT counts.primary_candidate_count,
         COALESCE(
           pg_catalog.jsonb_agg(
             pg_catalog.jsonb_build_object(
               'schema',c.schema_name,
               'name',c.function_name,
               'oid',c.oid,
               'identity_arguments',c.identity_arguments,
               'return_type',c.return_type,
               'security_mode',CASE WHEN c.prosecdef
                 THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END,
               'owner',c.owner_name,
               'search_path',c.search_path_setting,
               'definition_sha256',pg_catalog.encode(
                 extensions.digest(
                   pg_catalog.convert_to(c.function_definition,'UTF8'),
                   'sha256'
                 ),
                 'hex'
               ),
               'references_graph_revisions',c.references_graph_revisions,
               'references_plan_selections',c.references_plan_selections,
               'classification',c.reader_classification
             ) ORDER BY c.schema_name,c.function_name,c.identity_arguments
           ) FILTER (WHERE c.oid IS NOT NULL),
           '[]'::jsonb
         ) AS candidates
    FROM graph_v1_reader_counts counts
    LEFT JOIN graph_v1_reader_classified c ON true
   GROUP BY counts.primary_candidate_count
), schema_checks AS (
  SELECT '05_schema' AS section,'Graph v2 additive columns' AS object_name,
         pg_catalog.count(*)=17 AS ok,
         pg_catalog.jsonb_build_object('present_count',pg_catalog.count(*)) AS details
    FROM information_schema.columns c
   WHERE c.table_schema='public' AND c.table_name='adaptive_nutrition_graph_revisions'
     AND c.column_name IN ('graph_contract','graph_contract_version','graph_canonical_bytes',
       'generated_week_plan_digest','generation_input_digest','target_policy_revision',
       'preference_revision','safety_revision','candidate_manifest_revision',
       'candidate_manifest_digest','composition_policy_revision','validation_policy_revision',
       'optimization_policy_revision','generation_policy_revision','generation_operation_id',
       'activation_operation_id','supersedes_plan_revision')
  UNION ALL
  SELECT '05_schema','operation v2 result columns',pg_catalog.count(*)=4,
         pg_catalog.jsonb_build_object('present_count',pg_catalog.count(*))
    FROM information_schema.columns c
   WHERE c.table_schema='public' AND c.table_name='adaptive_nutrition_operations'
     AND c.column_name IN ('result_canonical','result_digest','result_plan_revision','result_graph_digest')
  UNION ALL
  SELECT '05_schema','Graph v1 read still present',
         s.primary_candidate_count = 1,
         pg_catalog.jsonb_build_object(
           'verdict',CASE
             WHEN s.primary_candidate_count = 1
               THEN 'UNIQUE_PRIMARY_GRAPH_V1_READER_FOUND'
             ELSE 'GRAPH_V1_READER_SIGNATURE_AMBIGUOUS'
           END,
           'primary_candidate_count',s.primary_candidate_count,
           'candidates',s.candidates
         )
    FROM graph_v1_reader_summary s
), residue_checks AS (
  SELECT '06_rollback_residue' AS section,'fixture selections' AS object_name,
         pg_catalog.count(*)=0 AS ok,pg_catalog.jsonb_build_object('count',pg_catalog.count(*)) AS details
    FROM public.user_premium_plan_selections s
   WHERE s.id IN ('92720000-0000-4000-8000-000000000001'::uuid,
                  '92720000-0000-4000-8000-000000000002'::uuid)
  UNION ALL
  SELECT '06_rollback_residue','fixture operations',pg_catalog.count(*)=0,
         pg_catalog.jsonb_build_object('count',pg_catalog.count(*))
    FROM public.adaptive_nutrition_operations o
   WHERE o.idempotency_key LIKE '92720000-0000-4000-8000-%'
      OR o.operation_id::text LIKE '92720000-0000-4000-8000-%'
  UNION ALL
  SELECT '06_rollback_residue','fixture graphs',pg_catalog.count(*)=0,
         pg_catalog.jsonb_build_object('count',pg_catalog.count(*))
    FROM public.adaptive_nutrition_graph_revisions g
   WHERE g.selection_id IN ('92720000-0000-4000-8000-000000000001'::uuid,
                            '92720000-0000-4000-8000-000000000002'::uuid)
      OR g.plan_revision::text LIKE '92720000-0000-4000-8000-%'
  UNION ALL
  SELECT '06_rollback_residue','fixture authority history/heads',
         (SELECT pg_catalog.count(*) FROM potok_nutrition.nutrition_preference_snapshots_v1 p
           WHERE p.revision_id::text LIKE '92720000-0000-4000-8000-%')
       + (SELECT pg_catalog.count(*) FROM potok_nutrition.nutrition_safety_snapshots_v1 s
           WHERE s.revision_id::text LIKE '92720000-0000-4000-8000-%')
       + (SELECT pg_catalog.count(*) FROM potok_nutrition.nutrition_authority_heads_v1 h
           WHERE h.head_revision::text LIKE '92720000-0000-4000-8000-%')=0,
         pg_catalog.jsonb_build_object('count',
           (SELECT pg_catalog.count(*) FROM potok_nutrition.nutrition_preference_snapshots_v1 p
             WHERE p.revision_id::text LIKE '92720000-0000-4000-8000-%')
         + (SELECT pg_catalog.count(*) FROM potok_nutrition.nutrition_safety_snapshots_v1 s
             WHERE s.revision_id::text LIKE '92720000-0000-4000-8000-%')
         + (SELECT pg_catalog.count(*) FROM potok_nutrition.nutrition_authority_heads_v1 h
             WHERE h.head_revision::text LIKE '92720000-0000-4000-8000-%'))
  UNION ALL
  SELECT '06_rollback_residue','fixture manifests/entries/head',
         (SELECT pg_catalog.count(*) FROM potok_nutrition.adaptive_nutrition_candidate_manifests_v2 m
           WHERE m.manifest_revision::text LIKE '92720000-0000-4000-8000-%')
       + (SELECT pg_catalog.count(*) FROM potok_nutrition.adaptive_nutrition_candidate_manifest_entries_v2 e
           WHERE e.manifest_revision::text LIKE '92720000-0000-4000-8000-%')
       + (SELECT pg_catalog.count(*) FROM potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2 h
           WHERE h.head_revision::text LIKE '92720000-0000-4000-8000-%')=0,
         pg_catalog.jsonb_build_object('count',
           (SELECT pg_catalog.count(*) FROM potok_nutrition.adaptive_nutrition_candidate_manifests_v2 m
             WHERE m.manifest_revision::text LIKE '92720000-0000-4000-8000-%')
         + (SELECT pg_catalog.count(*) FROM potok_nutrition.adaptive_nutrition_candidate_manifest_entries_v2 e
             WHERE e.manifest_revision::text LIKE '92720000-0000-4000-8000-%')
         + (SELECT pg_catalog.count(*) FROM potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2 h
             WHERE h.head_revision::text LIKE '92720000-0000-4000-8000-%'))
  UNION ALL
  SELECT '06_rollback_residue','fixture entitlement lineage',pg_catalog.count(*)=0,
         pg_catalog.jsonb_build_object('count',pg_catalog.count(*))
    FROM potok_control.access_attestations a
   WHERE a.evidence_ref LIKE 'graph-v2-rollback-only-v1/%'
  UNION ALL
  SELECT '06_rollback_residue','fixture FACT/event/diary/offer rows',
         (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e
           WHERE e.user_id IN ('d6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid,
                               '8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid))
       + (SELECT pg_catalog.count(*) FROM public.food_diary_entries d
           WHERE d.user_id IN ('d6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid,
                               '8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid))
       + (SELECT pg_catalog.count(*) FROM potok_nutrition.validated_plan_replacement_offers_v1 o
           WHERE o.account_id IN ('d6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid,
                                  '8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid))=0,
         pg_catalog.jsonb_build_object('expected','zero')
), checks AS (
  SELECT * FROM relation_checks UNION ALL SELECT * FROM function_checks
  UNION ALL SELECT * FROM rls_checks UNION ALL SELECT * FROM lock_checks
  UNION ALL SELECT * FROM schema_checks UNION ALL SELECT * FROM residue_checks
)
SELECT section,object_name,ok,details,
       pg_catalog.bool_and(ok) OVER () AS graph_v2_authorities_activation_v1_postcheck_pass
  FROM checks
 ORDER BY section,object_name;
