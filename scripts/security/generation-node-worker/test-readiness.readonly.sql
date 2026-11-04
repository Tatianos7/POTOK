-- Trusted administrative metadata inventory only. Do not grant worker roles
-- table access to run this query. Counts alone never authorize a generation.
BEGIN READ ONLY;
SELECT
 (SELECT count(*) FROM potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2) AS manifest_heads,
 (SELECT count(*) FROM potok_nutrition.adaptive_nutrition_generation_policy_head_v2) AS generation_policy_heads,
 (SELECT count(*) FROM potok_nutrition.generation_preparation_sources_v1) AS preparation_sources,
 (SELECT count(*) FROM potok_nutrition.generation_validation_inputs_v1) AS validation_inputs,
 (SELECT count(*) FROM potok_nutrition.generation_validation_warnings_v1) AS final_warning_sources,
 false AS may_activate;
ROLLBACK;
