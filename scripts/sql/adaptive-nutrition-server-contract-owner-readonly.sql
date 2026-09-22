-- Adaptive Nutrition: owner-run metadata export v1.
-- STAGING ONLY: verify Dashboard project ref ozidryfvhkcbtpnulakq BEFORE running.
-- The expected_project_ref below is a label, NOT database identity verification.
-- One SELECT result, numbered sections; export ALL rows without Dashboard truncation.
-- Reads system catalogs only. Discovered functions/triggers are NEVER invoked.
-- Definitions/default expressions are metadata; inspect for embedded secrets before sharing.
-- No user diary rows, canonical food data, or private recipe atomic audit.
-- Read the companion owner-export-instructions.md before manual execution.

WITH
app_schemas AS (
  SELECT n.oid, n.nspname
  FROM pg_catalog.pg_namespace AS n
  WHERE n.nspname !~ '^pg_'
    AND n.nspname NOT IN (
      'information_schema', 'auth', 'storage', 'vault', 'extensions',
      'realtime', 'supabase_functions', 'supabase_migrations',
      'graphql', 'graphql_public', 'net', 'cron', 'pgsodium', 'pgsodium_masks'
    )
),
relation_inventory AS (
  SELECT c.oid, n.nspname, c.relname, c.relkind, c.relowner,
         c.relrowsecurity, c.relforcerowsecurity, c.relacl, c.reloptions,
         CASE
           WHEN c.relname IN ('foods', 'recipes', 'recipe_ingredients')
             THEN 'parked_food_or_private_recipe_boundary'
           WHEN c.relname ~* '(^|_)(workout|exercise|billing|payment|purchase)(_|$)'
             THEN 'outside_adaptive_scope'
           WHEN c.relname IN (
             'user_goals', 'food_diary_entries', 'user_profiles', 'profiles',
             'entitlements', 'subscriptions', 'user_premium_plan_selections',
             'user_premium_meal_selections'
           ) THEN 'known_repo_contract_name'
           WHEN c.relname ~* '(^|_)(adaptive|nutrition|premium|plan|plans|meal|meals|goal|goals|diary|idempotency|snapshot|snapshots|history|event|events|operation|operations|receipt|receipts|revision|revisions|version|versions|entitlement|entitlements)(_|$)'
             THEN 'name_candidate_requires_owner_mapping'
           WHEN EXISTS (
             SELECT 1 FROM pg_catalog.pg_attribute AS a
             WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
               AND a.attname IN ('plan_id', 'plan_revision', 'goal_revision',
                 'idempotency_key', 'diary_revision', 'recipe_snapshot_revision',
                 'portion_snapshot_revision', 'supersedes_event_id', 'retracts_event_id')
           ) THEN 'column_candidate_requires_owner_mapping'
           ELSE 'inventory_only'
         END AS scope_reason
  FROM pg_catalog.pg_class AS c
  JOIN app_schemas AS n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
),
relations AS (
  SELECT * FROM relation_inventory
  WHERE scope_reason IN ('known_repo_contract_name',
    'name_candidate_requires_owner_mapping', 'column_candidate_requires_owner_mapping')
),
columns_meta AS (
  SELECT r.oid AS relation_oid, r.nspname AS schema_name, r.relname AS table_name,
         a.attnum AS ordinal_position, a.attname AS column_name, a.atttypid,
         pg_catalog.format_type(a.atttypid, a.atttypmod) AS formatted_type,
         tn.nspname AS type_schema, t.typname AS type_name, t.typtype AS type_kind,
         NOT (a.attnotnull OR t.typnotnull) AS is_nullable,
         pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS column_default,
         t.typdefault AS type_default,
         i.numeric_precision, i.numeric_precision_radix, i.numeric_scale,
         i.datetime_precision, i.character_maximum_length,
         i.column_name IS NOT NULL AS information_schema_visible,
         a.attidentity AS identity_kind, a.attgenerated AS generated_kind,
         a.attacl AS column_acl
  FROM relations AS r
  JOIN pg_catalog.pg_attribute AS a ON a.attrelid = r.oid
  JOIN pg_catalog.pg_type AS t ON t.oid = a.atttypid
  JOIN pg_catalog.pg_namespace AS tn ON tn.oid = t.typnamespace
  LEFT JOIN pg_catalog.pg_attrdef AS d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  LEFT JOIN information_schema.columns AS i
    ON i.table_schema = r.nspname AND i.table_name = r.relname AND i.column_name = a.attname
  WHERE a.attnum > 0 AND NOT a.attisdropped
),
constraints_meta AS (
  SELECT co.oid, co.conname, co.contype, co.conrelid, co.confrelid, co.contypid,
         co.conkey, co.confkey, co.condeferrable, co.condeferred, co.convalidated,
         CASE WHEN co.contypid <> 0 THEN pg_catalog.format_type(co.contypid, NULL) END AS domain_type,
         sn.nspname AS source_schema, sc.relname AS source_table,
         dn.nspname AS target_schema, dc.relname AS target_table,
         co.conrelid IN (SELECT oid FROM relations) AS source_in_scope,
         co.confrelid IN (SELECT oid FROM relations) AS target_in_scope,
         pg_catalog.pg_get_constraintdef(co.oid, true) AS definition
  FROM pg_catalog.pg_constraint AS co
  LEFT JOIN pg_catalog.pg_class AS sc ON sc.oid = co.conrelid
  LEFT JOIN pg_catalog.pg_namespace AS sn ON sn.oid = sc.relnamespace
  LEFT JOIN pg_catalog.pg_class AS dc ON dc.oid = co.confrelid
  LEFT JOIN pg_catalog.pg_namespace AS dn ON dn.oid = dc.relnamespace
  WHERE co.conrelid IN (SELECT oid FROM relations)
     OR co.confrelid IN (SELECT oid FROM relations)
     OR co.contypid IN (SELECT atttypid FROM columns_meta)
),
triggers_meta AS (
  SELECT t.oid, t.tgfoid, t.tgrelid, r.nspname AS schema_name, r.relname AS table_name,
         t.tgname AS trigger_name, t.tgenabled AS enabled_state,
         t.tgisinternal AS is_internal, t.tgdeferrable, t.tginitdeferred,
         n.nspname AS function_schema, p.proname AS function_name,
         pg_catalog.pg_get_function_identity_arguments(p.oid) AS function_arguments,
         pg_catalog.pg_get_triggerdef(t.oid, true) AS definition
  FROM pg_catalog.pg_trigger AS t
  JOIN relations AS r ON r.oid = t.tgrelid
  JOIN pg_catalog.pg_proc AS p ON p.oid = t.tgfoid
  JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
),
object_roots AS (
  SELECT 'pg_catalog.pg_class'::pg_catalog.regclass::oid AS classid, r.oid AS objid
  FROM relations AS r
  UNION
  SELECT 'pg_catalog.pg_policy'::pg_catalog.regclass::oid, p.oid
  FROM pg_catalog.pg_policy AS p WHERE p.polrelid IN (SELECT oid FROM relations)
  UNION
  SELECT 'pg_catalog.pg_attrdef'::pg_catalog.regclass::oid, d.oid
  FROM pg_catalog.pg_attrdef AS d WHERE d.adrelid IN (SELECT oid FROM relations)
  UNION
  SELECT 'pg_catalog.pg_constraint'::pg_catalog.regclass::oid, c.oid FROM constraints_meta AS c
  UNION
  SELECT 'pg_catalog.pg_rewrite'::pg_catalog.regclass::oid, w.oid
  FROM pg_catalog.pg_rewrite AS w WHERE w.ev_class IN (SELECT oid FROM relations)
  UNION
  SELECT 'pg_catalog.pg_trigger'::pg_catalog.regclass::oid, t.oid FROM triggers_meta AS t
),
functions_meta AS (
  SELECT p.*, n.nspname AS schema_name,
         CASE WHEN p.oid IN (SELECT tgfoid FROM triggers_meta)
           THEN 'attached_trigger'
           WHEN p.proname IN ('get_entitlements', 'get_paywall_state')
           THEN 'known_repo_access_rpc'
           WHEN EXISTS (
             SELECT 1 FROM pg_catalog.pg_depend AS d
             JOIN object_roots AS o ON o.classid = d.classid AND o.objid = d.objid
             WHERE d.refclassid = 'pg_catalog.pg_proc'::pg_catalog.regclass
               AND d.refobjid = p.oid
           ) THEN 'catalog_recorded_dependency'
           ELSE 'name_candidate_requires_owner_mapping'
         END AS scope_reason
  FROM pg_catalog.pg_proc AS p
  JOIN app_schemas AS n ON n.oid = p.pronamespace
  WHERE p.prokind IN ('f', 'p')
    AND p.proname !~* '(^|_)(purchase|payment|billing)(_|$)'
    AND p.proname NOT IN ('replace_recipe_ingredients_atomic',
      'recompute_recipe_totals', 'recipe_ingredients_recompute_trigger')
    AND (
      p.proname IN ('get_entitlements', 'get_paywall_state')
      OR p.proname ~* '(^|_)(adaptive|nutrition|premium|plan|plans|meal|meals|goal|goals|diary|idempotency|snapshot|snapshots|history|operation|operations|receipt|receipts|entitlement|entitlements)(_|$)'
      OR p.oid IN (SELECT tgfoid FROM triggers_meta)
      OR EXISTS (
        SELECT 1 FROM pg_catalog.pg_depend AS d
        JOIN object_roots AS o ON o.classid = d.classid AND o.objid = d.objid
        WHERE d.refclassid = 'pg_catalog.pg_proc'::pg_catalog.regclass
          AND d.refobjid = p.oid
      )
    )
),
dependency_roots AS (
  SELECT classid, objid FROM object_roots
  UNION
  SELECT 'pg_catalog.pg_proc'::pg_catalog.regclass::oid, p.oid FROM functions_meta AS p
),
sections AS (
  SELECT 0 AS section_id, 'context_and_limits' AS section,
         pg_catalog.jsonb_build_object(
           'expected_project_ref_label_only', 'ozidryfvhkcbtpnulakq',
           'database_name_not_project_attestation', pg_catalog.current_database(),
           'database_role', current_user, 'session_role', session_user,
           'observed_at', current_timestamp, 'postgres_version', pg_catalog.version(),
           'scope', 'application catalog metadata only; no application rows',
           'limits', 'Name/column scope is heuristic. Empty results are not proof of absence under restricted visibility. Metadata does not prove runtime behavior or deployed external endpoints. Dependency edges are not a complete call graph. Parked private recipe/food and payment bodies excluded.'
         ) AS evidence
  UNION ALL
  SELECT 1, 'relation_inventory_and_scope', pg_catalog.jsonb_build_object(
    'schema', r.nspname, 'relation', r.relname, 'kind', r.relkind, 'scope_reason', r.scope_reason)
  FROM relation_inventory AS r
  UNION ALL
  SELECT 2, 'tables_rls_and_views', pg_catalog.jsonb_build_object(
    'schema', r.nspname, 'table', r.relname, 'kind', r.relkind,
    'owner', pg_catalog.pg_get_userbyid(r.relowner),
    'rls_enabled', r.relrowsecurity, 'rls_forced', r.relforcerowsecurity,
    'relation_options', r.reloptions, 'explicit_acl', r.relacl,
    'view_definition', CASE WHEN r.relkind IN ('v', 'm') THEN pg_catalog.pg_get_viewdef(r.oid, true) END)
  FROM relations AS r
  UNION ALL
  SELECT 3, 'columns_types_defaults_precision', pg_catalog.to_jsonb(c)
  FROM columns_meta AS c
  UNION ALL
  SELECT 4, 'constraints_and_relation_boundaries', pg_catalog.to_jsonb(c) || pg_catalog.jsonb_build_object(
    'source_columns', (SELECT pg_catalog.jsonb_agg(a.attname ORDER BY k.ord)
      FROM pg_catalog.unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
      JOIN pg_catalog.pg_attribute AS a ON a.attrelid = c.conrelid AND a.attnum = k.attnum),
    'target_columns', (SELECT pg_catalog.jsonb_agg(a.attname ORDER BY k.ord)
      FROM pg_catalog.unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord)
      JOIN pg_catalog.pg_attribute AS a ON a.attrelid = c.confrelid AND a.attnum = k.attnum))
  FROM constraints_meta AS c
  UNION ALL
  SELECT 5, 'indexes_including_idempotency', pg_catalog.jsonb_build_object(
    'schema', r.nspname, 'table', r.relname, 'index', ic.relname,
    'is_unique', i.indisunique, 'is_primary', i.indisprimary,
    'is_valid', i.indisvalid, 'is_ready', i.indisready,
    'definition', pg_catalog.pg_get_indexdef(i.indexrelid),
    'predicate', pg_catalog.pg_get_expr(i.indpred, i.indrelid),
    'expressions', pg_catalog.pg_get_expr(i.indexprs, i.indrelid))
  FROM pg_catalog.pg_index AS i
  JOIN relations AS r ON r.oid = i.indrelid
  JOIN pg_catalog.pg_class AS ic ON ic.oid = i.indexrelid
  UNION ALL
  SELECT 6, 'rls_policies', pg_catalog.jsonb_build_object(
    'schema', r.nspname, 'table', r.relname, 'policy', p.polname,
    'command_code', p.polcmd, 'permissive', p.polpermissive,
    'roles', (SELECT pg_catalog.jsonb_agg(CASE WHEN x.role_oid = 0 THEN 'PUBLIC'
      ELSE pg_catalog.pg_get_userbyid(x.role_oid) END ORDER BY x.role_oid)
      FROM pg_catalog.unnest(p.polroles) AS x(role_oid)),
    'using_expression', pg_catalog.pg_get_expr(p.polqual, p.polrelid),
    'with_check_expression', pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid))
  FROM pg_catalog.pg_policy AS p JOIN relations AS r ON r.oid = p.polrelid
  UNION ALL
  SELECT 7, 'table_privileges_including_default_acl', pg_catalog.jsonb_build_object(
    'schema', r.nspname, 'table', r.relname, 'acl_was_null', r.relacl IS NULL,
    'grantor', pg_catalog.pg_get_userbyid(a.grantor),
    'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
    'privilege', a.privilege_type, 'is_grantable', a.is_grantable)
  FROM relations AS r
  CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(r.relacl, pg_catalog.acldefault('r', r.relowner))) AS a
  UNION ALL
  SELECT 8, 'explicit_column_privileges', pg_catalog.jsonb_build_object(
    'schema', c.schema_name, 'table', c.table_name, 'column', c.column_name,
    'grantor', pg_catalog.pg_get_userbyid(a.grantor),
    'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
    'privilege', a.privilege_type, 'is_grantable', a.is_grantable)
  FROM columns_meta AS c CROSS JOIN LATERAL pg_catalog.aclexplode(c.column_acl) AS a
  UNION ALL
  SELECT 9, 'functions_rpc_definitions_metadata_only', pg_catalog.jsonb_build_object(
    'schema', p.schema_name, 'name', p.proname, 'kind', p.prokind,
    'scope_reason', p.scope_reason,
    'identity_arguments', pg_catalog.pg_get_function_identity_arguments(p.oid),
    'arguments_with_defaults', pg_catalog.pg_get_function_arguments(p.oid),
    'return_type', pg_catalog.pg_get_function_result(p.oid),
    'language', l.lanname, 'owner', pg_catalog.pg_get_userbyid(p.proowner),
    'security', CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END,
    'volatility', p.provolatile, 'leakproof', p.proleakproof,
    'search_path_configuration', (SELECT pg_catalog.jsonb_agg(x.setting)
      FROM pg_catalog.unnest(p.proconfig) AS x(setting) WHERE x.setting LIKE 'search_path=%'),
    'definition', pg_catalog.pg_get_functiondef(p.oid))
  FROM functions_meta AS p JOIN pg_catalog.pg_language AS l ON l.oid = p.prolang
  UNION ALL
  SELECT 10, 'function_privileges_including_default_acl', pg_catalog.jsonb_build_object(
    'schema', p.schema_name, 'function', p.proname,
    'identity_arguments', pg_catalog.pg_get_function_identity_arguments(p.oid),
    'acl_was_null', p.proacl IS NULL,
    'grantor', pg_catalog.pg_get_userbyid(a.grantor),
    'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
    'privilege', a.privilege_type, 'is_grantable', a.is_grantable)
  FROM functions_meta AS p
  CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))) AS a
  UNION ALL
  SELECT 11, 'triggers_metadata_only', pg_catalog.to_jsonb(t)
  FROM triggers_meta AS t
  UNION ALL
  SELECT 12, 'recorded_dependencies_both_directions', pg_catalog.jsonb_build_object(
    'dependent', pg_catalog.pg_describe_object(d.classid, d.objid, d.objsubid),
    'referenced', pg_catalog.pg_describe_object(d.refclassid, d.refobjid, d.refobjsubid),
    'dependency_type', d.deptype,
    'dependent_is_root', EXISTS (SELECT 1 FROM dependency_roots AS o WHERE o.classid = d.classid AND o.objid = d.objid),
    'referenced_is_root', EXISTS (SELECT 1 FROM dependency_roots AS o WHERE o.classid = d.refclassid AND o.objid = d.refobjid))
  FROM pg_catalog.pg_depend AS d
  WHERE EXISTS (SELECT 1 FROM dependency_roots AS o WHERE o.classid = d.classid AND o.objid = d.objid)
     OR EXISTS (SELECT 1 FROM dependency_roots AS o WHERE o.classid = d.refclassid AND o.objid = d.refobjid)
  UNION ALL
  SELECT 13, 'identity_revision_history_field_candidates', pg_catalog.jsonb_build_object(
    'schema', c.schema_name, 'table', c.table_name, 'column', c.column_name,
    'type', c.formatted_type, 'nullable', c.is_nullable, 'default', c.column_default,
    'interpretation', 'Candidate only: a field name or timestamp does not prove authoritative revision, ownership, immutable history, or CAS semantics.')
  FROM columns_meta AS c
  WHERE c.column_name ~* '(^|_)(id|user|account|owner|plan|goal|diary|revision|version|snapshot|portion|idempotency|operation|receipt|event|supersedes|superseded|retracts|retracted|retraction|undo|history|date|day|week|timezone|updated)(_|$)'
  UNION ALL
  SELECT 14, 'schema_privileges_including_default_acl', pg_catalog.jsonb_build_object(
    'schema', n.nspname, 'owner', pg_catalog.pg_get_userbyid(n.nspowner),
    'grantor', pg_catalog.pg_get_userbyid(a.grantor),
    'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
    'privilege', a.privilege_type, 'is_grantable', a.is_grantable)
  FROM pg_catalog.pg_namespace AS n
  CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(n.nspacl, pg_catalog.acldefault('n', n.nspowner))) AS a
  WHERE n.oid IN (SELECT oid FROM app_schemas)
  UNION ALL
  SELECT 15, 'function_inventory_names_only', pg_catalog.jsonb_build_object(
    'schema', n.nspname, 'name', p.proname, 'kind', p.prokind,
    'identity_arguments', pg_catalog.pg_get_function_identity_arguments(p.oid),
    'definition_in_export', p.oid IN (SELECT oid FROM functions_meta),
    'interpretation', 'Names only for owner mapping; excluded or unknown helpers need a separately reviewed scope, never invocation.')
  FROM pg_catalog.pg_proc AS p JOIN app_schemas AS n ON n.oid = p.pronamespace
  WHERE p.prokind IN ('f', 'p')
),
section_names AS (
  SELECT * FROM (VALUES
    (0, 'context_and_limits'), (1, 'relation_inventory_and_scope'),
    (2, 'tables_rls_and_views'), (3, 'columns_types_defaults_precision'),
    (4, 'constraints_and_relation_boundaries'), (5, 'indexes_including_idempotency'),
    (6, 'rls_policies'), (7, 'table_privileges_including_default_acl'),
    (8, 'explicit_column_privileges'), (9, 'functions_rpc_definitions_metadata_only'),
    (10, 'function_privileges_including_default_acl'), (11, 'triggers_metadata_only'),
    (12, 'recorded_dependencies_both_directions'), (13, 'identity_revision_history_field_candidates'),
    (14, 'schema_privileges_including_default_acl'), (15, 'function_inventory_names_only')
  ) AS labels(section_id, section)
)
SELECT n.section_id, n.section,
       pg_catalog.count(s.evidence) OVER (PARTITION BY n.section_id) AS section_row_count,
       pg_catalog.count(*) OVER () AS export_row_count,
       COALESCE(s.evidence, pg_catalog.jsonb_build_object(
         'no_visible_matching_metadata', true,
         'interpretation', 'No rows within this scope/role; not a deployment or permission guarantee.'
       )) AS evidence
FROM section_names AS n
LEFT JOIN sections AS s ON s.section_id = n.section_id
ORDER BY n.section_id, s.evidence::text;
