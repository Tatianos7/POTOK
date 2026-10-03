-- POTOK Adaptive Nutrition Graph v2 persistence metadata preflight v1.
-- OWNER-RUN / SELECT-ONLY / STAGING PROJECT ozidryfvhkcbtpnulakq ONLY.
-- The project ref is a required operator check; PostgreSQL cannot attest a Supabase project ref.
-- Do not run on production. Export every result row without truncation.
-- Reads only pg_catalog and information_schema metadata. Application functions are not invoked.
-- Function and trigger definitions are returned as text for review.

WITH
expected_relations(schema_name, relation_name, scope_group) AS (
  VALUES
    ('public', 'user_premium_plan_selections', 'weekly_selection'),
    ('public', 'adaptive_nutrition_graph_revisions', 'graph_revision'),
    ('public', 'adaptive_nutrition_operations', 'operation_ledger'),
    ('public', 'adaptive_nutrition_events', 'event_compatibility'),
    ('public', 'user_goals', 'goal_authority')
),
application_schemas AS (
  SELECT n.oid, n.nspname
    FROM pg_catalog.pg_namespace AS n
   WHERE n.nspname IN ('public', 'potok_control', 'potok_nutrition')
),
all_application_relations AS (
  SELECT c.oid, n.nspname AS schema_name, c.relname AS relation_name,
         c.relkind, c.relowner, c.relrowsecurity, c.relforcerowsecurity,
         c.relacl, c.reloptions
    FROM pg_catalog.pg_class AS c
    JOIN application_schemas AS n ON n.oid = c.relnamespace
   WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
),
scoped_relations AS (
  SELECT r.*,
         COALESCE(e.scope_group,
           CASE
             WHEN r.relation_name ~* '(preference|dietary|dislike|exclusion|allerg|intoleran|safety|restriction)'
               OR EXISTS (
                 SELECT 1 FROM pg_catalog.pg_attribute AS a
                  WHERE a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped
                    AND a.attname ~* '(preference|dietary|dislike|exclusion|allerg|intoleran|safety|restriction)'
               )
               THEN 'preference_or_safety_candidate'
             WHEN r.relation_name ~* '(manifest|publication|recipe_revision|catalog_revision)'
               OR EXISTS (
                 SELECT 1 FROM pg_catalog.pg_attribute AS a
                  WHERE a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped
                    AND a.attname ~* '(manifest|publication|recipe_revision|catalog_revision)'
               )
               THEN 'manifest_candidate'
             WHEN r.relation_name ~* '(entitlement|attestation|access_grant|premium_access)'
               OR EXISTS (
                 SELECT 1 FROM pg_catalog.pg_attribute AS a
                  WHERE a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped
                    AND a.attname ~* '(entitlement|attestation|has_premium|is_admin)'
               )
               THEN 'entitlement_candidate'
           END) AS scope_group
    FROM all_application_relations AS r
    LEFT JOIN expected_relations AS e
      ON e.schema_name = r.schema_name AND e.relation_name = r.relation_name
   WHERE e.relation_name IS NOT NULL
      OR r.relation_name ~* '(preference|dietary|dislike|exclusion|allerg|intoleran|safety|restriction|manifest|publication|recipe_revision|catalog_revision|entitlement|attestation|access_grant|premium_access)'
      OR EXISTS (
        SELECT 1 FROM pg_catalog.pg_attribute AS a
         WHERE a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped
           AND a.attname ~* '(preference|dietary|dislike|exclusion|allerg|intoleran|safety|restriction|manifest|publication|recipe_revision|catalog_revision|entitlement|attestation|has_premium|is_admin)'
      )
),
scoped_columns AS (
  SELECT r.oid AS relation_oid, r.schema_name, r.relation_name, r.scope_group,
         a.attnum AS ordinal_position, a.attname AS column_name,
         pg_catalog.format_type(a.atttypid, a.atttypmod) AS formatted_type,
         NOT (a.attnotnull OR t.typnotnull) AS is_nullable,
         pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS column_default,
         a.attidentity AS identity_kind, a.attgenerated AS generated_kind,
         i.numeric_precision, i.numeric_scale, i.datetime_precision,
         i.character_maximum_length, a.attacl AS column_acl
    FROM scoped_relations AS r
    JOIN pg_catalog.pg_attribute AS a ON a.attrelid = r.oid
    JOIN pg_catalog.pg_type AS t ON t.oid = a.atttypid
    LEFT JOIN pg_catalog.pg_attrdef AS d
      ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    LEFT JOIN information_schema.columns AS i
      ON i.table_schema = r.schema_name
     AND i.table_name = r.relation_name
     AND i.column_name = a.attname
   WHERE a.attnum > 0 AND NOT a.attisdropped
),
scoped_constraints AS (
  SELECT co.oid, co.conname, co.contype, co.conrelid, co.confrelid,
         co.conkey, co.confkey, co.condeferrable, co.condeferred, co.convalidated,
         sn.nspname AS source_schema, sc.relname AS source_relation,
         tn.nspname AS target_schema, tc.relname AS target_relation,
         pg_catalog.pg_get_constraintdef(co.oid, true) AS definition
    FROM pg_catalog.pg_constraint AS co
    LEFT JOIN pg_catalog.pg_class AS sc ON sc.oid = co.conrelid
    LEFT JOIN pg_catalog.pg_namespace AS sn ON sn.oid = sc.relnamespace
    LEFT JOIN pg_catalog.pg_class AS tc ON tc.oid = co.confrelid
    LEFT JOIN pg_catalog.pg_namespace AS tn ON tn.oid = tc.relnamespace
   WHERE co.conrelid IN (SELECT r.oid FROM scoped_relations AS r)
      OR co.confrelid IN (SELECT r.oid FROM scoped_relations AS r)
),
scoped_indexes AS (
  SELECT r.schema_name, r.relation_name, ic.relname AS index_name,
         i.indisunique, i.indisprimary, i.indisvalid, i.indisready, i.indislive,
         pg_catalog.pg_get_indexdef(i.indexrelid) AS definition,
         pg_catalog.pg_get_expr(i.indpred, i.indrelid) AS predicate,
         pg_catalog.pg_get_expr(i.indexprs, i.indrelid) AS expressions,
         (SELECT pg_catalog.jsonb_agg(a.attname ORDER BY keys.ordinality)
            FROM pg_catalog.unnest(i.indkey) WITH ORDINALITY AS keys(attnum, ordinality)
            LEFT JOIN pg_catalog.pg_attribute AS a
              ON a.attrelid = i.indrelid AND a.attnum = keys.attnum
           WHERE keys.attnum > 0) AS indexed_columns
    FROM pg_catalog.pg_index AS i
    JOIN scoped_relations AS r ON r.oid = i.indrelid
    JOIN pg_catalog.pg_class AS ic ON ic.oid = i.indexrelid
),
scoped_triggers AS (
  SELECT t.oid, t.tgfoid, r.schema_name, r.relation_name,
         t.tgname AS trigger_name, t.tgenabled AS enabled_state,
         t.tgisinternal AS is_internal, t.tgdeferrable, t.tginitdeferred,
         fn.nspname AS function_schema, p.proname AS function_name,
         pg_catalog.pg_get_function_identity_arguments(p.oid) AS function_arguments,
         pg_catalog.pg_get_triggerdef(t.oid, true) AS definition
    FROM pg_catalog.pg_trigger AS t
    JOIN scoped_relations AS r ON r.oid = t.tgrelid
    JOIN pg_catalog.pg_proc AS p ON p.oid = t.tgfoid
    JOIN pg_catalog.pg_namespace AS fn ON fn.oid = p.pronamespace
),
application_functions_all AS (
  SELECT p.oid, n.nspname AS schema_name, p.proname AS function_name,
         p.prokind, p.proowner, p.prosecdef, p.provolatile, p.proleakproof,
         p.proconfig, p.proacl, p.prolang,
         pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
         pg_catalog.pg_get_function_arguments(p.oid) AS arguments_with_defaults,
         pg_catalog.pg_get_function_result(p.oid) AS return_type,
         pg_catalog.pg_get_functiondef(p.oid) AS definition
    FROM pg_catalog.pg_proc AS p
    JOIN application_schemas AS n ON n.oid = p.pronamespace
   WHERE p.prokind IN ('f', 'p')
),
scoped_functions AS (
  SELECT f.*,
         CASE
           WHEN f.oid IN (SELECT t.tgfoid FROM scoped_triggers AS t)
             THEN 'scoped_trigger_function'
           WHEN f.function_name ~* '(entitlement|attestation|grant.*access|revoke.*access)'
             THEN 'entitlement_function'
           WHEN f.function_name ~* '(adaptive_nutrition|generated_week|plan_selection|goal_revision)'
             THEN 'adaptive_or_goal_function'
           WHEN f.function_name ~* '(preference|dietary|dislike|exclusion|allerg|intoleran|safety|restriction)'
             THEN 'preference_or_safety_function_candidate'
           WHEN f.function_name ~* '(manifest|publication|recipe_revision|catalog_revision)'
             THEN 'manifest_function_candidate'
           ELSE 'definition_mentions_scoped_relation'
         END AS scope_reason
    FROM application_functions_all AS f
   WHERE f.oid IN (SELECT t.tgfoid FROM scoped_triggers AS t)
      OR f.function_name ~* '(entitlement|attestation|grant.*access|revoke.*access|adaptive_nutrition|generated_week|plan_selection|goal_revision|preference|dietary|dislike|exclusion|allerg|intoleran|safety|restriction|manifest|publication|recipe_revision|catalog_revision)'
      OR f.definition ~* '(user_premium_plan_selections|adaptive_nutrition_graph_revisions|adaptive_nutrition_operations|adaptive_nutrition_events|user_goals|access_attestations)'
),
scoped_policies AS (
  SELECT r.schema_name, r.relation_name, p.polname AS policy_name,
         p.polcmd, p.polpermissive, p.polroles,
         pg_catalog.pg_get_expr(p.polqual, p.polrelid) AS using_expression,
         pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) AS with_check_expression
    FROM pg_catalog.pg_policy AS p
    JOIN scoped_relations AS r ON r.oid = p.polrelid
),
dependency_roots AS (
  SELECT 'pg_catalog.pg_class'::pg_catalog.regclass::oid AS classid, r.oid AS objid
    FROM scoped_relations AS r
  UNION
  SELECT 'pg_catalog.pg_proc'::pg_catalog.regclass::oid, f.oid
    FROM scoped_functions AS f
  UNION
  SELECT 'pg_catalog.pg_trigger'::pg_catalog.regclass::oid, t.oid
    FROM scoped_triggers AS t
  UNION
  SELECT 'pg_catalog.pg_constraint'::pg_catalog.regclass::oid, c.oid
    FROM scoped_constraints AS c
),
evidence AS (
  SELECT 0 AS section_id, 'context_and_operator_gate'::text AS section_name,
         'staging:ozidryfvhkcbtpnulakq'::text AS object_name,
         'CONTEXT'::text AS record_kind,
         pg_catalog.jsonb_build_object(
           'expected_project_ref_label_only', 'ozidryfvhkcbtpnulakq',
           'operator_must_verify_dashboard_project', true,
           'database_name_not_project_attestation', pg_catalog.current_database(),
           'current_role', current_user,
           'session_role', session_user,
           'observed_at', current_timestamp,
           'postgres_version', pg_catalog.version(),
           'scope', 'metadata only; no application RPC invocation and no application row values',
           'absence_language', 'Empty results mean NOT_FOUND_IN_SCOPED_METADATA, not proof that an external writer or service does not exist.'
         ) AS payload_json

  UNION ALL
  SELECT 1, 'required_relation_presence', e.schema_name || '.' || e.relation_name,
         CASE WHEN r.oid IS NULL THEN 'NOT_FOUND' ELSE 'RELATION' END,
         pg_catalog.jsonb_build_object(
           'scope_group', e.scope_group,
           'found', r.oid IS NOT NULL,
           'relation_kind', r.relkind,
           'owner', pg_catalog.pg_get_userbyid(r.relowner),
           'rls_enabled', r.relrowsecurity,
           'rls_forced', r.relforcerowsecurity,
           'relation_options', r.reloptions
         )
    FROM expected_relations AS e
    LEFT JOIN scoped_relations AS r
      ON r.schema_name = e.schema_name AND r.relation_name = e.relation_name

  UNION ALL
  SELECT 2, 'weekly_selection_columns', c.schema_name || '.' || c.relation_name,
         'COLUMN', pg_catalog.jsonb_build_object(
           'ordinal_position', c.ordinal_position, 'column', c.column_name,
           'type', c.formatted_type, 'nullable', c.is_nullable,
           'default', c.column_default, 'identity_kind', c.identity_kind,
           'generated_kind', c.generated_kind,
           'numeric_precision', c.numeric_precision, 'numeric_scale', c.numeric_scale
         )
    FROM scoped_columns AS c
   WHERE c.schema_name = 'public' AND c.relation_name = 'user_premium_plan_selections'

  UNION ALL
  SELECT 3, 'weekly_selection_constraints_indexes',
         COALESCE(c.source_schema || '.' || c.source_relation, 'public.user_premium_plan_selections'),
         'CONSTRAINT', pg_catalog.jsonb_build_object(
           'name', c.conname, 'type', c.contype, 'definition', c.definition,
           'target', c.target_schema || '.' || c.target_relation,
           'deferrable', c.condeferrable, 'initially_deferred', c.condeferred,
           'validated', c.convalidated,
           'source_columns', (SELECT pg_catalog.jsonb_agg(a.attname ORDER BY keys.ordinality)
             FROM pg_catalog.unnest(c.conkey) WITH ORDINALITY AS keys(attnum, ordinality)
             JOIN pg_catalog.pg_attribute AS a
               ON a.attrelid = c.conrelid AND a.attnum = keys.attnum),
           'target_columns', (SELECT pg_catalog.jsonb_agg(a.attname ORDER BY keys.ordinality)
             FROM pg_catalog.unnest(c.confkey) WITH ORDINALITY AS keys(attnum, ordinality)
             JOIN pg_catalog.pg_attribute AS a
               ON a.attrelid = c.confrelid AND a.attnum = keys.attnum)
         )
    FROM scoped_constraints AS c
   WHERE c.source_schema = 'public' AND c.source_relation = 'user_premium_plan_selections'
  UNION ALL
  SELECT 3, 'weekly_selection_constraints_indexes', i.schema_name || '.' || i.relation_name,
         'INDEX', pg_catalog.jsonb_build_object(
           'name', i.index_name, 'unique', i.indisunique, 'primary', i.indisprimary,
           'valid', i.indisvalid, 'ready', i.indisready, 'live', i.indislive,
           'columns', i.indexed_columns, 'predicate', i.predicate,
           'expressions', i.expressions, 'definition', i.definition
         )
    FROM scoped_indexes AS i
   WHERE i.schema_name = 'public' AND i.relation_name = 'user_premium_plan_selections'

  UNION ALL
  SELECT 4, 'weekly_selection_triggers', t.schema_name || '.' || t.relation_name,
         'TRIGGER', pg_catalog.jsonb_build_object(
           'name', t.trigger_name, 'enabled_state', t.enabled_state,
           'internal', t.is_internal, 'deferrable', t.tgdeferrable,
           'initially_deferred', t.tginitdeferred,
           'function', t.function_schema || '.' || t.function_name,
           'function_arguments', t.function_arguments, 'definition', t.definition
         )
    FROM scoped_triggers AS t
   WHERE t.schema_name = 'public' AND t.relation_name = 'user_premium_plan_selections'

  UNION ALL
  SELECT 5, 'graph_revision_storage', c.schema_name || '.' || c.relation_name,
         'COLUMN', pg_catalog.jsonb_build_object(
           'ordinal_position', c.ordinal_position, 'column', c.column_name,
           'type', c.formatted_type, 'nullable', c.is_nullable,
           'default', c.column_default, 'numeric_precision', c.numeric_precision,
           'numeric_scale', c.numeric_scale
         )
    FROM scoped_columns AS c
   WHERE c.schema_name = 'public' AND c.relation_name = 'adaptive_nutrition_graph_revisions'
  UNION ALL
  SELECT 5, 'graph_revision_storage', COALESCE(c.source_schema, c.target_schema) || '.' ||
         COALESCE(c.source_relation, c.target_relation), 'CONSTRAINT',
         pg_catalog.jsonb_build_object(
           'name', c.conname, 'type', c.contype, 'source_relation', c.source_relation,
           'target_relation', c.target_relation, 'definition', c.definition,
           'deferrable', c.condeferrable, 'initially_deferred', c.condeferred,
           'validated', c.convalidated
         )
    FROM scoped_constraints AS c
   WHERE (c.source_schema = 'public' AND c.source_relation = 'adaptive_nutrition_graph_revisions')
      OR (c.target_schema = 'public' AND c.target_relation = 'adaptive_nutrition_graph_revisions')
  UNION ALL
  SELECT 5, 'graph_revision_storage', i.schema_name || '.' || i.relation_name,
         'INDEX', pg_catalog.jsonb_build_object(
           'name', i.index_name, 'unique', i.indisunique, 'primary', i.indisprimary,
           'valid', i.indisvalid, 'ready', i.indisready, 'live', i.indislive,
           'columns', i.indexed_columns, 'predicate', i.predicate,
           'expressions', i.expressions, 'definition', i.definition
         )
    FROM scoped_indexes AS i
   WHERE i.schema_name = 'public' AND i.relation_name = 'adaptive_nutrition_graph_revisions'
  UNION ALL
  SELECT 5, 'graph_revision_storage', t.schema_name || '.' || t.relation_name,
         'TRIGGER', pg_catalog.jsonb_build_object(
           'name', t.trigger_name, 'enabled_state', t.enabled_state,
           'function', t.function_schema || '.' || t.function_name,
           'definition', t.definition
         )
    FROM scoped_triggers AS t
   WHERE t.schema_name = 'public' AND t.relation_name = 'adaptive_nutrition_graph_revisions'

  UNION ALL
  SELECT 6, 'operation_receipt_ledger', c.schema_name || '.' || c.relation_name,
         'COLUMN', pg_catalog.jsonb_build_object(
           'ordinal_position', c.ordinal_position, 'column', c.column_name,
           'type', c.formatted_type, 'nullable', c.is_nullable,
           'default', c.column_default
         )
    FROM scoped_columns AS c
   WHERE c.schema_name = 'public' AND c.relation_name = 'adaptive_nutrition_operations'
  UNION ALL
  SELECT 6, 'operation_receipt_ledger', COALESCE(c.source_schema, c.target_schema) || '.' ||
         COALESCE(c.source_relation, c.target_relation), 'CONSTRAINT',
         pg_catalog.jsonb_build_object(
           'name', c.conname, 'type', c.contype, 'source_relation', c.source_relation,
           'target_relation', c.target_relation, 'definition', c.definition,
           'deferrable', c.condeferrable, 'initially_deferred', c.condeferred,
           'validated', c.convalidated
         )
    FROM scoped_constraints AS c
   WHERE (c.source_schema = 'public' AND c.source_relation = 'adaptive_nutrition_operations')
      OR (c.target_schema = 'public' AND c.target_relation = 'adaptive_nutrition_operations')
  UNION ALL
  SELECT 6, 'operation_receipt_ledger', i.schema_name || '.' || i.relation_name,
         'INDEX', pg_catalog.jsonb_build_object(
           'name', i.index_name, 'unique', i.indisunique, 'primary', i.indisprimary,
           'valid', i.indisvalid, 'ready', i.indisready, 'live', i.indislive,
           'columns', i.indexed_columns, 'predicate', i.predicate,
           'definition', i.definition
         )
    FROM scoped_indexes AS i
   WHERE i.schema_name = 'public' AND i.relation_name = 'adaptive_nutrition_operations'
  UNION ALL
  SELECT 6, 'operation_receipt_ledger', t.schema_name || '.' || t.relation_name,
         'TRIGGER', pg_catalog.jsonb_build_object(
           'name', t.trigger_name, 'enabled_state', t.enabled_state,
           'function', t.function_schema || '.' || t.function_name,
           'definition', t.definition
         )
    FROM scoped_triggers AS t
   WHERE t.schema_name = 'public' AND t.relation_name = 'adaptive_nutrition_operations'

  UNION ALL
  SELECT 7, 'event_plan_fact_compatibility', c.schema_name || '.' || c.relation_name,
         'COLUMN', pg_catalog.jsonb_build_object(
           'ordinal_position', c.ordinal_position, 'column', c.column_name,
           'type', c.formatted_type, 'nullable', c.is_nullable,
           'default', c.column_default
         )
    FROM scoped_columns AS c
   WHERE c.schema_name = 'public' AND c.relation_name = 'adaptive_nutrition_events'
  UNION ALL
  SELECT 7, 'event_plan_fact_compatibility', COALESCE(c.source_schema, c.target_schema) || '.' ||
         COALESCE(c.source_relation, c.target_relation), 'CONSTRAINT',
         pg_catalog.jsonb_build_object(
           'name', c.conname, 'type', c.contype, 'source_relation', c.source_relation,
           'target_relation', c.target_relation, 'definition', c.definition,
           'validated', c.convalidated
         )
    FROM scoped_constraints AS c
   WHERE (c.source_schema = 'public' AND c.source_relation = 'adaptive_nutrition_events')
      OR (c.target_schema = 'public' AND c.target_relation = 'adaptive_nutrition_events')
  UNION ALL
  SELECT 7, 'event_plan_fact_compatibility', i.schema_name || '.' || i.relation_name,
         'INDEX', pg_catalog.jsonb_build_object(
           'name', i.index_name, 'unique', i.indisunique, 'primary', i.indisprimary,
           'valid', i.indisvalid, 'ready', i.indisready, 'live', i.indislive,
           'columns', i.indexed_columns, 'predicate', i.predicate,
           'definition', i.definition
         )
    FROM scoped_indexes AS i
   WHERE i.schema_name = 'public' AND i.relation_name = 'adaptive_nutrition_events'

  UNION ALL
  SELECT 8, 'goal_authority', c.schema_name || '.' || c.relation_name,
         'COLUMN', pg_catalog.jsonb_build_object(
           'ordinal_position', c.ordinal_position, 'column', c.column_name,
           'type', c.formatted_type, 'nullable', c.is_nullable,
           'default', c.column_default
         )
    FROM scoped_columns AS c
   WHERE c.schema_name = 'public' AND c.relation_name = 'user_goals'
  UNION ALL
  SELECT 8, 'goal_authority', COALESCE(c.source_schema, c.target_schema) || '.' ||
         COALESCE(c.source_relation, c.target_relation), 'CONSTRAINT',
         pg_catalog.jsonb_build_object(
           'name', c.conname, 'type', c.contype, 'source_relation', c.source_relation,
           'target_relation', c.target_relation, 'definition', c.definition,
           'validated', c.convalidated
         )
    FROM scoped_constraints AS c
   WHERE (c.source_schema = 'public' AND c.source_relation = 'user_goals')
      OR (c.target_schema = 'public' AND c.target_relation = 'user_goals')
  UNION ALL
  SELECT 8, 'goal_authority', i.schema_name || '.' || i.relation_name,
         'INDEX', pg_catalog.jsonb_build_object(
           'name', i.index_name, 'unique', i.indisunique, 'primary', i.indisprimary,
           'valid', i.indisvalid, 'ready', i.indisready, 'live', i.indislive,
           'columns', i.indexed_columns, 'predicate', i.predicate,
           'definition', i.definition
         )
    FROM scoped_indexes AS i
   WHERE i.schema_name = 'public' AND i.relation_name = 'user_goals'
  UNION ALL
  SELECT 8, 'goal_authority', t.schema_name || '.' || t.relation_name,
         'TRIGGER', pg_catalog.jsonb_build_object(
           'name', t.trigger_name, 'enabled_state', t.enabled_state,
           'function', t.function_schema || '.' || t.function_name,
           'definition', t.definition
         )
    FROM scoped_triggers AS t
   WHERE t.schema_name = 'public' AND t.relation_name = 'user_goals'

  UNION ALL
  SELECT 9, 'preference_authority_candidates', r.schema_name || '.' || r.relation_name,
         'RELATION_CANDIDATE', pg_catalog.jsonb_build_object(
           'relation_kind', r.relkind, 'owner', pg_catalog.pg_get_userbyid(r.relowner),
           'rls_enabled', r.relrowsecurity, 'rls_forced', r.relforcerowsecurity,
           'classification', 'FOUND_CANDIDATE_REQUIRES_SEMANTIC_REVIEW',
           'warning', 'A matching name does not prove authoritative preference ownership or revision semantics.'
         )
    FROM scoped_relations AS r
   WHERE r.scope_group = 'preference_or_safety_candidate'
     AND r.relation_name ~* '(preference|dietary|dislike|exclusion|meal_preference|generator_preference)'
  UNION ALL
  SELECT 9, 'preference_authority_candidates', c.schema_name || '.' || c.relation_name,
         'COLUMN_CANDIDATE', pg_catalog.jsonb_build_object(
           'column', c.column_name, 'type', c.formatted_type,
           'nullable', c.is_nullable, 'default', c.column_default,
           'revision_like', c.column_name ~* '(revision|version)'
         )
    FROM scoped_columns AS c
   WHERE c.scope_group = 'preference_or_safety_candidate'
     AND (c.relation_name ~* '(preference|dietary|dislike|exclusion|meal_preference|generator_preference)'
       OR c.column_name ~* '(preference|dietary|dislike|exclusion|meal_preference|generator_preference)')

  UNION ALL
  SELECT 10, 'safety_authority_candidates', r.schema_name || '.' || r.relation_name,
         'RELATION_CANDIDATE', pg_catalog.jsonb_build_object(
           'relation_kind', r.relkind, 'owner', pg_catalog.pg_get_userbyid(r.relowner),
           'rls_enabled', r.relrowsecurity, 'rls_forced', r.relforcerowsecurity,
           'classification', 'FOUND_CANDIDATE_REQUIRES_SEMANTIC_REVIEW',
           'warning', 'A matching name does not prove nutrition-safety authority or immutable revision semantics.'
         )
    FROM scoped_relations AS r
   WHERE r.scope_group = 'preference_or_safety_candidate'
     AND r.relation_name ~* '(allerg|intoleran|safety|restriction|dietary|exclusion)'
  UNION ALL
  SELECT 10, 'safety_authority_candidates', c.schema_name || '.' || c.relation_name,
         'COLUMN_CANDIDATE', pg_catalog.jsonb_build_object(
           'column', c.column_name, 'type', c.formatted_type,
           'nullable', c.is_nullable, 'default', c.column_default,
           'revision_like', c.column_name ~* '(revision|version)'
         )
    FROM scoped_columns AS c
   WHERE c.scope_group = 'preference_or_safety_candidate'
     AND (c.relation_name ~* '(allerg|intoleran|safety|restriction|dietary|exclusion)'
       OR c.column_name ~* '(allerg|intoleran|safety|restriction|dietary|exclusion)')

  UNION ALL
  SELECT 11, 'entitlement_lock_evidence', f.schema_name || '.' || f.function_name,
         'FUNCTION_DEFINITION', pg_catalog.jsonb_build_object(
           'identity_arguments', f.identity_arguments,
           'owner', pg_catalog.pg_get_userbyid(f.proowner),
           'security', CASE WHEN f.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END,
           'volatility', f.provolatile,
           'search_path_configuration', (SELECT pg_catalog.jsonb_agg(setting ORDER BY setting)
             FROM pg_catalog.unnest(f.proconfig) AS cfg(setting)
            WHERE setting LIKE 'search_path=%'),
           'mentions_advisory_xact_lock', f.definition ~* 'pg_advisory_xact_lock',
           'mentions_advisory_lock', f.definition ~* 'pg_advisory',
           'definition', f.definition,
           'classification_rule', 'Compare exact grant/revoke lock function, key derivation and acquisition order after export.'
         )
    FROM scoped_functions AS f
   WHERE f.scope_reason = 'entitlement_function'

  UNION ALL
  SELECT 12, 'candidate_manifest_storage', r.schema_name || '.' || r.relation_name,
         'RELATION_CANDIDATE', pg_catalog.jsonb_build_object(
           'relation_kind', r.relkind, 'owner', pg_catalog.pg_get_userbyid(r.relowner),
           'rls_enabled', r.relrowsecurity, 'rls_forced', r.relforcerowsecurity,
           'classification', 'CANDIDATE_ONLY_NOT_AUTHORITY_UNTIL_CONTRACT_REVIEW'
         )
    FROM scoped_relations AS r
   WHERE r.scope_group = 'manifest_candidate'
  UNION ALL
  SELECT 12, 'candidate_manifest_storage', c.schema_name || '.' || c.relation_name,
         'COLUMN_CANDIDATE', pg_catalog.jsonb_build_object(
           'column', c.column_name, 'type', c.formatted_type,
           'nullable', c.is_nullable, 'default', c.column_default
         )
    FROM scoped_columns AS c
   WHERE c.scope_group = 'manifest_candidate'
  UNION ALL
  SELECT 12, 'candidate_manifest_storage', f.schema_name || '.' || f.function_name,
         'FUNCTION_CANDIDATE', pg_catalog.jsonb_build_object(
           'identity_arguments', f.identity_arguments, 'scope_reason', f.scope_reason,
           'definition', f.definition,
           'warning', 'Function definition is metadata; it was not invoked.'
         )
    FROM scoped_functions AS f
   WHERE f.scope_reason = 'manifest_function_candidate'

  UNION ALL
  SELECT 13, 'graph_v1_read_activation_compatibility', f.schema_name || '.' || f.function_name,
         'FUNCTION_DEFINITION', pg_catalog.jsonb_build_object(
           'identity_arguments', f.identity_arguments,
           'arguments_with_defaults', f.arguments_with_defaults,
           'return_type', f.return_type,
           'owner', pg_catalog.pg_get_userbyid(f.proowner),
           'security', CASE WHEN f.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END,
           'volatility', f.provolatile, 'leakproof', f.proleakproof,
           'search_path_configuration', (SELECT pg_catalog.jsonb_agg(setting ORDER BY setting)
             FROM pg_catalog.unnest(f.proconfig) AS cfg(setting)
            WHERE setting LIKE 'search_path=%'),
           'definition', f.definition
         )
    FROM scoped_functions AS f
   WHERE f.function_name IN (
     'adaptive_nutrition_read_v1', 'adaptive_nutrition_discover_current_v1',
     'adaptive_nutrition_lookup_v1', 'adaptive_nutrition_mutate_v1',
     'activate_generated_week_v1', 'adaptive_nutrition_provision_current_week_v1'
   )

  UNION ALL
  SELECT 14, 'rls_policies', p.schema_name || '.' || p.relation_name,
         'POLICY', pg_catalog.jsonb_build_object(
           'name', p.policy_name, 'command_code', p.polcmd,
           'permissive', p.polpermissive,
           'roles', (SELECT pg_catalog.jsonb_agg(
             CASE WHEN role_oid = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(role_oid) END
             ORDER BY role_oid)
             FROM pg_catalog.unnest(p.polroles) AS roles(role_oid)),
           'using_expression', p.using_expression,
           'with_check_expression', p.with_check_expression
         )
    FROM scoped_policies AS p

  UNION ALL
  SELECT 15, 'table_and_column_acl', r.schema_name || '.' || r.relation_name,
         'TABLE_PRIVILEGE', pg_catalog.jsonb_build_object(
           'acl_was_null', r.relacl IS NULL,
           'grantor', pg_catalog.pg_get_userbyid(a.grantor),
           'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC'
             ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
           'privilege', a.privilege_type, 'grantable', a.is_grantable
         )
    FROM scoped_relations AS r
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(r.relacl, pg_catalog.acldefault('r', r.relowner))) AS a
  UNION ALL
  SELECT 15, 'table_and_column_acl', c.schema_name || '.' || c.relation_name,
         'COLUMN_PRIVILEGE', pg_catalog.jsonb_build_object(
           'column', c.column_name,
           'grantor', pg_catalog.pg_get_userbyid(a.grantor),
           'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC'
             ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
           'privilege', a.privilege_type, 'grantable', a.is_grantable
         )
    FROM scoped_columns AS c
    CROSS JOIN LATERAL pg_catalog.aclexplode(c.column_acl) AS a

  UNION ALL
  SELECT 16, 'function_security_acl', f.schema_name || '.' || f.function_name,
         'FUNCTION_PRIVILEGE', pg_catalog.jsonb_build_object(
           'identity_arguments', f.identity_arguments,
           'scope_reason', f.scope_reason,
           'owner', pg_catalog.pg_get_userbyid(f.proowner),
           'security', CASE WHEN f.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END,
           'volatility', f.provolatile,
           'search_path_configuration', (SELECT pg_catalog.jsonb_agg(setting ORDER BY setting)
             FROM pg_catalog.unnest(f.proconfig) AS cfg(setting)
            WHERE setting LIKE 'search_path=%'),
           'acl_was_null', f.proacl IS NULL,
           'grantor', pg_catalog.pg_get_userbyid(a.grantor),
           'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC'
             ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
           'privilege', a.privilege_type, 'grantable', a.is_grantable
         )
    FROM scoped_functions AS f
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(f.proacl, pg_catalog.acldefault('f', f.proowner))) AS a

  UNION ALL
  SELECT 17, 'external_writer_and_dependency_evidence', f.schema_name || '.' || f.function_name,
         'FUNCTION_BODY_METADATA', pg_catalog.jsonb_build_object(
           'identity_arguments', f.identity_arguments,
           'scope_reason', f.scope_reason,
           'mentions_selection', f.definition ~* 'user_premium_plan_selections',
           'mentions_graph_revision', f.definition ~* 'adaptive_nutrition_graph_revisions',
           'mentions_operation_ledger', f.definition ~* 'adaptive_nutrition_operations',
           'mentions_goal', f.definition ~* 'user_goals',
           'mentions_entitlement', f.definition ~* '(access_attestations|entitlement)',
           'mentions_write_syntax', f.definition ~* '(insert[[:space:]]+into|update[[:space:]]+|delete[[:space:]]+from|merge[[:space:]]+into)',
           'definition', f.definition,
           'interpretation', 'Exact visible function text; absence is NOT_FOUND_IN_SCOPED_METADATA, not proof that no external writer exists.'
         )
    FROM scoped_functions AS f
   WHERE f.definition ~* '(user_premium_plan_selections|adaptive_nutrition_graph_revisions|adaptive_nutrition_operations|adaptive_nutrition_events|user_goals|access_attestations)'
  UNION ALL
  SELECT 17, 'external_writer_and_dependency_evidence',
         pg_catalog.pg_describe_object(d.classid, d.objid, d.objsubid),
         'CATALOG_DEPENDENCY', pg_catalog.jsonb_build_object(
           'dependent', pg_catalog.pg_describe_object(d.classid, d.objid, d.objsubid),
           'referenced', pg_catalog.pg_describe_object(d.refclassid, d.refobjid, d.refobjsubid),
           'dependency_type', d.deptype,
           'dependent_is_scoped_root', EXISTS (
             SELECT 1 FROM dependency_roots AS roots
              WHERE roots.classid = d.classid AND roots.objid = d.objid),
           'referenced_is_scoped_root', EXISTS (
             SELECT 1 FROM dependency_roots AS roots
              WHERE roots.classid = d.refclassid AND roots.objid = d.refobjid)
         )
    FROM pg_catalog.pg_depend AS d
   WHERE EXISTS (SELECT 1 FROM dependency_roots AS roots
                  WHERE roots.classid = d.classid AND roots.objid = d.objid)
      OR EXISTS (SELECT 1 FROM dependency_roots AS roots
                  WHERE roots.classid = d.refclassid AND roots.objid = d.refobjid)
),
section_catalog(section_id, section_name) AS (
  VALUES
    (0, 'context_and_operator_gate'),
    (1, 'required_relation_presence'),
    (2, 'weekly_selection_columns'),
    (3, 'weekly_selection_constraints_indexes'),
    (4, 'weekly_selection_triggers'),
    (5, 'graph_revision_storage'),
    (6, 'operation_receipt_ledger'),
    (7, 'event_plan_fact_compatibility'),
    (8, 'goal_authority'),
    (9, 'preference_authority_candidates'),
    (10, 'safety_authority_candidates'),
    (11, 'entitlement_lock_evidence'),
    (12, 'candidate_manifest_storage'),
    (13, 'graph_v1_read_activation_compatibility'),
    (14, 'rls_policies'),
    (15, 'table_and_column_acl'),
    (16, 'function_security_acl'),
    (17, 'external_writer_and_dependency_evidence')
),
final_rows AS (
  SELECT c.section_id, c.section_name,
         COALESCE(e.object_name, '__EMPTY__') AS object_name,
         COALESCE(e.record_kind, 'NOT_FOUND_IN_SCOPED_METADATA') AS record_kind,
         COALESCE(e.payload_json, pg_catalog.jsonb_build_object(
           'empty', true,
           'classification', 'NOT_FOUND_IN_SCOPED_METADATA',
           'warning', 'No visible rows in this scoped metadata export; this is not proof of external absence.'
         )) AS payload_json
    FROM section_catalog AS c
    LEFT JOIN evidence AS e ON e.section_id = c.section_id
)
SELECT section_id, section_name, object_name, record_kind, payload_json
  FROM final_rows
 ORDER BY section_id, object_name, record_kind, payload_json::text;
