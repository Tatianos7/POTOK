-- POTOK Adaptive Nutrition read-only entry v1 — SELECT-ONLY POSTCHECK.
-- Target: Supabase STAGING ozidryfvhkcbtpnulakq only, after the behavioral
-- acceptance reaches its mandatory final ROLLBACK.
-- All fixture counts and markers must be zero. No RPC or write is performed.

WITH accounts(account_id) AS (
  VALUES
    ('d6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid),
    ('8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid)
), residue AS (
  SELECT
    (SELECT pg_catalog.count(*) FROM public.user_profiles p
      WHERE p.user_id IN (SELECT account_id FROM accounts)) AS profiles,
    (SELECT pg_catalog.count(*) FROM public.user_goals g
      WHERE g.user_id IN (SELECT account_id FROM accounts)) AS goals,
    (SELECT pg_catalog.count(*) FROM public.user_premium_plan_selections s
      WHERE s.user_id IN (SELECT account_id FROM accounts)) AS selections,
    (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o
      WHERE o.user_id IN (SELECT account_id FROM accounts)) AS operations,
    (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_graph_revisions g
      WHERE g.user_id IN (SELECT account_id FROM accounts)) AS graph_revisions,
    (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e
      WHERE e.user_id IN (SELECT account_id FROM accounts)) AS events,
    (SELECT pg_catalog.count(*) FROM public.food_diary_entries d
      WHERE d.user_id IN (SELECT account_id FROM accounts)) AS diary_rows,
    (SELECT pg_catalog.count(*) FROM public.user_premium_meal_selections m
      JOIN public.user_premium_plan_selections s
        ON s.id = m.user_premium_plan_selection_id
      WHERE s.user_id IN (SELECT account_id FROM accounts)) AS meal_selections,
    (SELECT pg_catalog.count(*)
       FROM potok_nutrition.validated_plan_replacement_offers_v1 o
      WHERE o.account_id IN (SELECT account_id FROM accounts)) AS replacement_offers,
    (SELECT pg_catalog.count(*) FROM potok_control.access_attestations a
      WHERE a.account_id IN (SELECT account_id FROM accounts)) AS attestations,
    (SELECT pg_catalog.count(*) FROM public.user_goals g
      WHERE g.goal_type = 'adaptive_read_entry_acceptance_v1') AS goal_markers,
    (SELECT pg_catalog.count(*) FROM public.user_premium_plan_selections s
      WHERE s.origin_lineage ->> 'source' = 'adaptive-read-entry-acceptance-v1')
      AS selection_markers,
    (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o
      WHERE o.idempotency_key LIKE 'adaptive-read-entry-acceptance-v1/%')
      AS operation_markers,
    (SELECT pg_catalog.count(*) FROM potok_control.access_attestations a
      WHERE a.evidence_ref LIKE 'adaptive-read-entry-acceptance-v1/%')
      AS attestation_markers
)
SELECT
  'ozidryfvhkcbtpnulakq'::text AS expected_staging_project_ref,
  true AS owner_must_verify_dashboard_project_ref,
  pg_catalog.to_regprocedure(
    'public.adaptive_nutrition_discover_current_v1(text)'
  ) IS NOT NULL AS discovery_still_applied,
  r.*,
  pg_catalog.to_regprocedure(
    'public.adaptive_nutrition_discover_current_v1(text)'
  ) IS NOT NULL
    AND r.profiles = 0
    AND r.goals = 0
    AND r.selections = 0
    AND r.operations = 0
    AND r.graph_revisions = 0
    AND r.events = 0
    AND r.diary_rows = 0
    AND r.meal_selections = 0
    AND r.replacement_offers = 0
    AND r.attestations = 0
    AND r.goal_markers = 0
    AND r.selection_markers = 0
    AND r.operation_markers = 0
    AND r.attestation_markers = 0 AS read_entry_acceptance_rollback_clean
FROM residue r;
