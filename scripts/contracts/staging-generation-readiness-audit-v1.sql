-- POTOK Staging generation readiness: aggregate, read-only, no users or recipes exposed.
-- Run only against project ozidryfvhkcbtpnulakq. This SELECT never publishes candidates.
-- Legacy premium_recipes are NOT accepted generation candidates.
WITH legacy AS (
  SELECT lower(coalesce(category,'')) AS slot, count(*)::integer AS n
  FROM public.premium_recipes WHERE is_active IS TRUE
  GROUP BY lower(coalesce(category,''))
), labels AS (
  SELECT unnest(ARRAY['breakfast','lunch','dinner','snack']) AS slot
), slots AS (
  SELECT labels.slot, coalesce(legacy.n,0) AS legacy_rows_not_eligible,
    greatest(0,4-coalesce(legacy.n,0)) AS minimum_legacy_row_shortage
  FROM labels LEFT JOIN legacy USING(slot)
), gate AS (
  SELECT
    (SELECT count(*)::integer FROM potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2) AS manifest_heads,
    (SELECT count(*)::integer FROM potok_nutrition.adaptive_nutrition_candidate_manifests_v2 WHERE publication_state='PUBLISHED') AS published_manifests,
    (SELECT count(*)::integer FROM potok_nutrition.adaptive_nutrition_candidate_manifest_entries_v2) AS candidate_entries,
    (SELECT count(*)::integer FROM potok_nutrition.adaptive_nutrition_generation_policy_head_v2 WHERE publication_state='PUBLISHED') AS published_policy_heads,
    (SELECT count(*)::integer FROM potok_nutrition.adaptive_nutrition_goal_targets_v1) AS prepared_goal_targets,
    (SELECT count(*)::integer FROM potok_nutrition.generation_preparation_sources_v1) AS preparation_sources,
    (SELECT count(*)::integer FROM potok_nutrition.adaptive_nutrition_generation_requests_v2) AS current_requests
)
SELECT jsonb_build_object(
 'contract','potok-staging-generation-readiness-audit-v1',
 'read_only',true,
 'legacy_recipes_are_not_admitted',true,
 'minimum_required_per_meal_slot_if_max_twice_per_week',4,
 'legacy_slot_counts',(SELECT jsonb_agg(jsonb_build_object(
  'slot',slot,'legacy_rows_not_eligible',legacy_rows_not_eligible,
  'minimum_legacy_row_shortage',minimum_legacy_row_shortage) ORDER BY slot) FROM slots),
 'manifest_heads',manifest_heads,'published_manifests',published_manifests,
 'candidate_entries',candidate_entries,'published_policy_heads',published_policy_heads,
 'prepared_goal_targets',prepared_goal_targets,'preparation_sources',preparation_sources,
 'current_requests',current_requests,
 'worker_activation_permitted',false
) AS audit
FROM gate;
