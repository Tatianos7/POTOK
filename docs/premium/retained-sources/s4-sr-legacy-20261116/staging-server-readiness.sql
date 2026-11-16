-- Read-only administrative probe for POTOK Staging before a real generation request.
WITH inventory AS (
  SELECT
    (SELECT count(*) FROM potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2) AS catalog_heads,
    (SELECT count(*) FROM potok_nutrition.adaptive_nutrition_candidate_manifest_entries_v2) AS catalog_entries,
    (SELECT count(*) FROM potok_nutrition.adaptive_nutrition_generation_policy_head_v2
      WHERE publication_state = 'PUBLISHED') AS published_policy_heads,
    (SELECT count(*) FROM potok_nutrition.generation_preparation_sources_v1) AS preparation_sources,
    (SELECT count(*) FROM potok_nutrition.generation_validation_inputs_v1) AS validation_inputs,
    (SELECT count(*) FROM potok_nutrition.generation_validation_warnings_v1) AS warning_sources
)
SELECT *,
       CASE
         WHEN catalog_heads = 0 OR catalog_entries = 0 THEN 'MISSING_RUNTIME_CATALOG'
         WHEN published_policy_heads = 0 THEN 'MISSING_PUBLISHED_POLICY'
         ELSE 'CHECK_ACCOUNT_AND_REQUEST_BINDINGS'
       END AS next_check
FROM inventory;
