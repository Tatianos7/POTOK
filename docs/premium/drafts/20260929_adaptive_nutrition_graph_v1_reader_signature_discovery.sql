-- SELECT-ONLY Graph v1 reader signature discovery for Supabase STAGING
-- project ozidryfvhkcbtpnulakq. Prepare/run separately; this file invokes no
-- application function and does not mutate catalog or application data.

WITH function_catalog AS (
  SELECT n.nspname AS schema_name,
         p.proname AS function_name,
         p.oid,
         pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
         pg_catalog.pg_get_function_arguments(p.oid) AS full_arguments,
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
), candidate_functions AS (
  SELECT f.*,
         pg_catalog.lower(f.function_definition)
           LIKE '%adaptive_nutrition_graph_revisions%' AS references_graph_revisions,
         pg_catalog.lower(f.function_definition)
           LIKE '%user_premium_plan_selections%' AS references_plan_selections,
         pg_catalog.lower(f.function_definition) AS normalized_definition
    FROM function_catalog f
   WHERE pg_catalog.lower(f.function_name) = 'adaptive_nutrition_read_v1'
      OR pg_catalog.lower(f.function_name) LIKE '%adaptive%nutrition%read%'
      OR pg_catalog.lower(f.function_name) LIKE '%graph%v1%read%'
      OR pg_catalog.lower(f.function_name) LIKE '%read%graph%v1%'
      OR pg_catalog.lower(f.function_name) LIKE '%current%graph%read%'
      OR pg_catalog.lower(f.function_name) LIKE '%plan%read%'
      OR pg_catalog.lower(f.function_definition) LIKE '%adaptive nutrition read%'
      OR pg_catalog.lower(f.function_definition) LIKE '%graph v1 read%'
      OR pg_catalog.lower(f.function_definition) LIKE '%adaptive_nutrition_graph_revisions%'
), scored_candidates AS (
  SELECT c.*,
         (
           (
             pg_catalog.lower(c.function_name) = 'adaptive_nutrition_read_v1'
             OR pg_catalog.lower(c.function_name) LIKE '%graph%v1%read%'
             OR pg_catalog.lower(c.function_name) LIKE '%read%graph%v1%'
           )
           AND c.references_graph_revisions
           AND c.references_plan_selections
           AND c.normalized_definition LIKE '%graph_snapshot%'
           AND c.normalized_definition LIKE '%plan_revision%'
           AND c.normalized_definition LIKE '%auth.uid()%'
           AND pg_catalog.lower(c.return_type) = 'jsonb'
         ) AS primary_shape,
         (
           c.references_graph_revisions
           OR c.references_plan_selections
           OR pg_catalog.lower(c.function_name) LIKE '%adaptive%nutrition%read%'
           OR pg_catalog.lower(c.function_name) LIKE '%graph%read%'
           OR pg_catalog.lower(c.function_name) LIKE '%plan%read%'
         ) AS related_shape
    FROM candidate_functions c
), candidate_counts AS (
  SELECT pg_catalog.count(*) FILTER (WHERE s.primary_shape) AS primary_candidate_count
    FROM scored_candidates s
), classified_candidates AS (
  SELECT s.*,
         c.primary_candidate_count,
         CASE
           WHEN s.primary_shape AND c.primary_candidate_count = 1
             THEN 'PRIMARY_GRAPH_V1_READER'
           WHEN s.primary_shape AND c.primary_candidate_count <> 1
             THEN 'AMBIGUOUS'
           WHEN pg_catalog.lower(s.function_name) = 'adaptive_nutrition_read_v1'
             THEN 'AMBIGUOUS'
           WHEN s.related_shape THEN 'RELATED_READER'
           ELSE 'NOT_GRAPH_V1_READER'
         END AS reader_classification,
         CASE
           WHEN c.primary_candidate_count = 1
             THEN 'UNIQUE_PRIMARY_GRAPH_V1_READER_FOUND'
           ELSE 'GRAPH_V1_READER_SIGNATURE_AMBIGUOUS'
         END AS discovery_verdict
    FROM scored_candidates s
    CROSS JOIN candidate_counts c
), candidate_rows AS (
  SELECT 'CANDIDATE'::text AS row_kind,
         c.schema_name,
         c.function_name,
         c.oid,
         c.identity_arguments,
         c.full_arguments,
         c.return_type,
         CASE WHEN c.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END
           AS security_mode,
         c.owner_name,
         c.search_path_setting,
         pg_catalog.encode(
           extensions.digest(
             pg_catalog.convert_to(c.function_definition, 'UTF8'),
             'sha256'
           ),
           'hex'
         ) AS function_definition_sha256,
         c.references_graph_revisions,
         c.references_plan_selections,
         c.primary_shape AS looks_like_graph_v1_reader,
         c.reader_classification,
         c.primary_candidate_count,
         c.discovery_verdict
    FROM classified_candidates c
), summary_row AS (
  SELECT 'SUMMARY'::text AS row_kind,
         NULL::name AS schema_name,
         NULL::name AS function_name,
         NULL::oid AS oid,
         NULL::text AS identity_arguments,
         NULL::text AS full_arguments,
         NULL::text AS return_type,
         NULL::text AS security_mode,
         NULL::name AS owner_name,
         NULL::text AS search_path_setting,
         NULL::text AS function_definition_sha256,
         NULL::boolean AS references_graph_revisions,
         NULL::boolean AS references_plan_selections,
         NULL::boolean AS looks_like_graph_v1_reader,
         NULL::text AS reader_classification,
         c.primary_candidate_count,
         CASE
           WHEN c.primary_candidate_count = 1
             THEN 'UNIQUE_PRIMARY_GRAPH_V1_READER_FOUND'
           ELSE 'GRAPH_V1_READER_SIGNATURE_AMBIGUOUS'
         END AS discovery_verdict
    FROM candidate_counts c
)
SELECT * FROM candidate_rows
UNION ALL
SELECT * FROM summary_row
ORDER BY row_kind, schema_name, function_name, identity_arguments;
