-- POTOK retained Adaptive Nutrition STAGING smoke v1 — SELECT-ONLY POST-RETIREMENT CHECK.
-- Target only: Supabase STAGING ozidryfvhkcbtpnulakq after exact retirement SQL.

WITH constants AS (
  SELECT
    '88c26f6b-ebc8-4bff-864d-9194fbd27f8d'::uuid AS account_id,
    '7e710000-0000-4000-8000-000000000001'::uuid AS selection_id,
    '7e710000-0000-4000-8000-000000000011'::uuid AS plan_revision,
    '7e710000-0000-4000-8000-000000000014'::uuid AS bootstrap_operation_id
), latest_premium AS (
  SELECT a.* FROM potok_control.access_attestations a CROSS JOIN constants c
   WHERE a.account_id = c.account_id AND a.capability = 'premium'
   ORDER BY a.lineage_sequence DESC LIMIT 1
), function_state AS (
  SELECT
    pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(
      'public.adaptive_nutrition_mutate_v1(text)'
    )) AS mutate_definition,
    pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(
      'public.adaptive_nutrition_read_v1(uuid,uuid)'
    )) AS read_definition,
    pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(
      'potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb)'
    )) AS boundary_definition
), measurements AS (
  SELECT
    (SELECT pg_catalog.count(*) FROM potok_control.access_attestations a CROSS JOIN constants c
      WHERE a.account_id = c.account_id AND a.capability = 'premium') AS premium_attestations,
    (SELECT effect FROM latest_premium) AS latest_premium_effect,
    (SELECT evidence_ref FROM latest_premium) AS latest_premium_evidence_ref,
    COALESCE((SELECT p.premium_provenance_id = a.attestation_id
                       AND NOT p.has_premium AND p.premium_valid_until IS NULL
                FROM public.user_profiles p JOIN latest_premium a ON a.account_id = p.user_id), false)
      AS profile_matches_revoke,
    NOT potok_control.is_effective_entitlement_v2(
      (SELECT account_id FROM constants), 'premium', pg_catalog.statement_timestamp()
    ) AS premium_effective_false,
    (SELECT pg_catalog.count(*) FROM public.user_premium_plan_selections s CROSS JOIN constants c
      WHERE s.user_id = c.account_id AND s.id = c.selection_id
        AND s.status = 'archived' AND s.contract_version = 1
        AND s.origin_lineage ->> 'source' = 'potok-retained-staging-smoke-v1'
        AND s.origin_lineage ->> 'discoveryPolicy' = 'explicit-smoke-selection-only') AS archived_selections,
    (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o CROSS JOIN constants c
      WHERE o.user_id = c.account_id AND o.selection_id = c.selection_id) AS retained_receipts,
    (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o CROSS JOIN constants c
      WHERE o.user_id = c.account_id AND o.selection_id = c.selection_id
        AND o.operation_id = c.bootstrap_operation_id
        AND o.idempotency_key = 'potok-retained-staging-smoke-v1/bootstrap'
        AND o.action_type = 'FIXTURE_BOOTSTRAP' AND o.outcome = 'accepted') AS bootstrap_receipts,
    (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o CROSS JOIN constants c
      WHERE o.user_id = c.account_id AND o.selection_id = c.selection_id
        AND o.action_type = 'ANNOTATION' AND o.outcome = 'accepted') AS accepted_skipped_receipts,
    (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o CROSS JOIN constants c
      WHERE o.user_id = c.account_id AND o.selection_id = c.selection_id
        AND o.action_type = 'ANNOTATION_RETRACTION' AND o.outcome = 'accepted') AS accepted_undo_receipts,
    (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o CROSS JOIN constants c
      WHERE o.user_id = c.account_id AND o.selection_id = c.selection_id
        AND o.outcome <> 'accepted') AS nonaccepted_receipts,
    (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o CROSS JOIN constants c
      WHERE o.user_id = c.account_id AND o.selection_id = c.selection_id
        AND NOT (
          (o.operation_id = c.bootstrap_operation_id
            AND o.idempotency_key = 'potok-retained-staging-smoke-v1/bootstrap'
            AND o.action_type = 'FIXTURE_BOOTSTRAP' AND o.outcome = 'accepted')
          OR (o.action_type IN ('ANNOTATION', 'ANNOTATION_RETRACTION')
            AND o.outcome = 'accepted')
        )) AS unexpected_receipts,
    (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o CROSS JOIN constants c
      WHERE o.user_id = c.account_id AND o.selection_id = c.selection_id
        AND o.request_digest <> extensions.digest(o.canonical_request, 'sha256')) AS digest_mismatches,
    (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_graph_revisions g CROSS JOIN constants c
      WHERE g.user_id = c.account_id AND g.selection_id = c.selection_id
        AND g.plan_revision = c.plan_revision) AS retained_graph_revisions,
    (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e CROSS JOIN constants c
      WHERE e.user_id = c.account_id AND e.selection_id = c.selection_id) AS retained_events,
    (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e CROSS JOIN constants c
      WHERE e.user_id = c.account_id AND e.selection_id = c.selection_id
        AND e.kind = 'ANNOTATION') AS annotations,
    (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e CROSS JOIN constants c
      WHERE e.user_id = c.account_id AND e.selection_id = c.selection_id
        AND e.kind = 'ANNOTATION_RETRACTION') AS annotation_retractions,
    (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e CROSS JOIN constants c
      WHERE e.user_id = c.account_id AND e.selection_id = c.selection_id
        AND e.kind NOT IN ('ANNOTATION', 'ANNOTATION_RETRACTION')) AS unexpected_events,
    (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e CROSS JOIN constants c
      WHERE e.user_id = c.account_id AND e.selection_id = c.selection_id
        AND e.kind IN ('FACT', 'FACT_RETRACTION', 'PLAN_REPLACED')) AS fact_or_plan_replaced_events,
    (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e CROSS JOIN constants c
      WHERE e.user_id = c.account_id AND e.selection_id = c.selection_id
        AND e.kind = 'ANNOTATION' AND NOT EXISTS (
          SELECT 1 FROM public.adaptive_nutrition_events successor
           WHERE successor.user_id = c.account_id
             AND successor.selection_id = c.selection_id
             AND successor.kind = 'ANNOTATION_RETRACTION'
             AND successor.supersedes_event_id = e.event_id
        )) AS live_annotations,
    (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e CROSS JOIN constants c
      WHERE e.user_id = c.account_id AND e.selection_id = c.selection_id
        AND e.kind = 'ANNOTATION' AND (
          SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events successor
           WHERE successor.user_id = c.account_id
             AND successor.selection_id = c.selection_id
             AND successor.kind = 'ANNOTATION_RETRACTION'
             AND successor.supersedes_event_id = e.event_id
        ) <> 1) AS wrong_successor_counts,
    (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events retraction
      CROSS JOIN constants c
      WHERE retraction.user_id = c.account_id AND retraction.selection_id = c.selection_id
        AND retraction.kind = 'ANNOTATION_RETRACTION'
        AND NOT EXISTS (
          SELECT 1 FROM public.adaptive_nutrition_events annotation
           WHERE annotation.user_id = c.account_id
             AND annotation.selection_id = c.selection_id
             AND annotation.kind = 'ANNOTATION'
             AND annotation.event_id = retraction.supersedes_event_id
        )) AS invalid_retraction_targets,
    (SELECT pg_catalog.count(*) FROM public.food_diary_entries d CROSS JOIN constants c
      WHERE d.user_id = c.account_id) AS diary_rows,
    (SELECT pg_catalog.count(*) FROM public.user_premium_meal_selections m CROSS JOIN constants c
      WHERE m.user_premium_plan_selection_id = c.selection_id) AS meal_selection_rows,
    (SELECT pg_catalog.count(*) FROM potok_nutrition.validated_plan_replacement_offers_v1 o
      CROSS JOIN constants c
      WHERE o.account_id = c.account_id OR o.selection_id = c.selection_id) AS replacement_offers,
    has_function_privilege('authenticated', 'public.adaptive_nutrition_lookup_v1(text)', 'EXECUTE')
      AND has_function_privilege('authenticated', 'public.adaptive_nutrition_read_v1(uuid,uuid)', 'EXECUTE')
      AS historical_read_grants_present,
    f.read_definition LIKE '%IF p_operation_id IS NULL THEN%'
      AND f.read_definition LIKE '%is_effective_entitlement_v2%'
      AND f.read_definition LIKE '%o.operation_id = p_operation_id%'
      AND pg_catalog.strpos(f.mutate_definition, 'SELECT o.* INTO v_existing') > 0
      AND pg_catalog.strpos(f.mutate_definition, 'commit_prevalidated_plan_transition_v1')
          > pg_catalog.strpos(f.mutate_definition, 'SELECT o.* INTO v_existing')
      AND f.boundary_definition LIKE '%IF NOT potok_control.is_effective_entitlement_v2%'
      AS current_denied_exact_history_contract_present,
    (SELECT pg_catalog.count(*) FROM public.user_premium_plan_selections s CROSS JOIN constants c
      WHERE (s.id = c.selection_id OR s.origin_lineage ->> 'source' = 'potok-retained-staging-smoke-v1')
        AND s.user_id <> c.account_id)
      + (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o CROSS JOIN constants c
          WHERE (o.selection_id = c.selection_id
             OR o.idempotency_key LIKE 'potok-retained-staging-smoke-v1/%')
            AND o.user_id <> c.account_id)
      + (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_graph_revisions g CROSS JOIN constants c
          WHERE (g.selection_id = c.selection_id OR g.plan_revision = c.plan_revision)
            AND g.user_id <> c.account_id)
      + (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e CROSS JOIN constants c
          WHERE e.selection_id = c.selection_id AND e.user_id <> c.account_id)
      + (SELECT pg_catalog.count(*) FROM potok_nutrition.validated_plan_replacement_offers_v1 o
          CROSS JOIN constants c WHERE o.selection_id = c.selection_id AND o.account_id <> c.account_id)
      AS foreign_fixture_rows
  FROM function_state f
)
SELECT
  'ozidryfvhkcbtpnulakq' AS expected_staging_project_ref,
  c.account_id,
  c.selection_id,
  m.*,
  m.premium_attestations = 2
    AND m.latest_premium_effect = 'REVOKE'
    AND m.latest_premium_evidence_ref = 'potok-retained-staging-smoke-v1/revoke'
    AND m.profile_matches_revoke AND m.premium_effective_false
    AND m.archived_selections = 1
    AND m.bootstrap_receipts = 1 AND m.accepted_skipped_receipts >= 1
    AND m.accepted_undo_receipts = m.accepted_skipped_receipts
    AND m.retained_receipts = 1 + (2 * m.accepted_skipped_receipts)
    AND m.nonaccepted_receipts = 0 AND m.unexpected_receipts = 0
    AND m.digest_mismatches = 0 AND m.retained_graph_revisions = 1
    AND m.annotations = m.accepted_skipped_receipts
    AND m.annotation_retractions = m.accepted_skipped_receipts
    AND m.retained_events = 2 * m.accepted_skipped_receipts
    AND m.unexpected_events = 0 AND m.fact_or_plan_replaced_events = 0
    AND m.live_annotations = 0 AND m.wrong_successor_counts = 0
    AND m.invalid_retraction_targets = 0
    AND m.diary_rows = 0 AND m.meal_selection_rows = 0
    AND m.replacement_offers = 0
    AND m.historical_read_grants_present
    AND m.current_denied_exact_history_contract_present
    AND m.foreign_fixture_rows = 0 AS retained_fixture_retirement_pass
FROM constants c CROSS JOIN measurements m;
