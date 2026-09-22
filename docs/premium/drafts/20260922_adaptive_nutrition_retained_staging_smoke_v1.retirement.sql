-- POTOK retained Adaptive Nutrition STAGING smoke v1 — RETIREMENT, NOT CLEANUP.
-- Target only: Supabase STAGING ozidryfvhkcbtpnulakq after separate owner approval.
-- Accepts one bootstrap plus N fully paired SKIPPED/UNDO histories, where N >= 1.
-- Appends a protected Premium REVOKE and archives the exact fixture selection.
-- It never deletes/truncates receipts, graph revisions, events, Goal or audit history.

BEGIN;

DO $retire$
DECLARE
  v_account constant uuid := '88c26f6b-ebc8-4bff-864d-9194fbd27f8d'::uuid;
  v_selection constant uuid := '7e710000-0000-4000-8000-000000000001'::uuid;
  v_plan_revision constant uuid := '7e710000-0000-4000-8000-000000000011'::uuid;
  v_bootstrap_operation constant uuid := '7e710000-0000-4000-8000-000000000014'::uuid;
  v_head potok_control.access_attestations%ROWTYPE;
  v_revoke_attestation uuid;
  v_pair_count bigint;
  v_updated integer;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'postgres owner SQL session required' USING ERRCODE = '42501';
  END IF;
  IF pg_catalog.to_regprocedure('potok_control.revoke_entitlement_v2(uuid,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'protected entitlement revoke contract is missing';
  END IF;

  SELECT pg_catalog.count(*) INTO STRICT v_pair_count
    FROM public.adaptive_nutrition_operations o
   WHERE o.user_id = v_account AND o.selection_id = v_selection
     AND o.action_type = 'ANNOTATION' AND o.outcome = 'accepted';

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_account)
     OR (SELECT pg_catalog.count(*) FROM public.user_profiles p WHERE p.user_id = v_account) <> 1
     OR (SELECT pg_catalog.count(*) FROM public.user_premium_plan_selections s
          WHERE s.user_id = v_account AND s.id = v_selection
            AND s.contract_version = 1
            AND s.origin_lineage ->> 'source' = 'potok-retained-staging-smoke-v1'
            AND s.origin_lineage ->> 'discoveryPolicy' = 'explicit-smoke-selection-only') <> 1
     OR (SELECT pg_catalog.count(*) FROM public.user_goals g
          WHERE g.user_id = v_account
            AND g.goal_type = 'potok_retained_staging_smoke_v1') <> 1
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_graph_revisions g
          WHERE g.user_id = v_account AND g.selection_id = v_selection
            AND g.plan_revision = v_plan_revision) <> 1
     OR v_pair_count < 1
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o
          WHERE o.user_id = v_account AND o.selection_id = v_selection)
            <> 1 + (2 * v_pair_count)
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o
          WHERE o.user_id = v_account AND o.selection_id = v_selection
            AND o.operation_id = v_bootstrap_operation
            AND o.idempotency_key = 'potok-retained-staging-smoke-v1/bootstrap'
            AND o.action_type = 'FIXTURE_BOOTSTRAP' AND o.outcome = 'accepted') <> 1
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o
          WHERE o.user_id = v_account AND o.selection_id = v_selection
            AND o.action_type = 'ANNOTATION_RETRACTION' AND o.outcome = 'accepted')
            <> v_pair_count
     OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_operations o
          WHERE o.user_id = v_account AND o.selection_id = v_selection
            AND (o.outcome <> 'accepted'
              OR o.action_type NOT IN ('FIXTURE_BOOTSTRAP', 'ANNOTATION', 'ANNOTATION_RETRACTION')
              OR o.request_digest <> extensions.digest(o.canonical_request, 'sha256')))
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e
          WHERE e.user_id = v_account AND e.selection_id = v_selection)
            <> 2 * v_pair_count
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e
          WHERE e.user_id = v_account AND e.selection_id = v_selection
            AND e.kind = 'ANNOTATION') <> v_pair_count
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e
          WHERE e.user_id = v_account AND e.selection_id = v_selection
            AND e.kind = 'ANNOTATION_RETRACTION') <> v_pair_count
     OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_events e
          WHERE e.user_id = v_account AND e.selection_id = v_selection
            AND e.kind NOT IN ('ANNOTATION', 'ANNOTATION_RETRACTION'))
     OR EXISTS (
          SELECT 1 FROM public.adaptive_nutrition_events annotation
           WHERE annotation.user_id = v_account
             AND annotation.selection_id = v_selection
             AND annotation.kind = 'ANNOTATION'
             AND (SELECT pg_catalog.count(*)
                    FROM public.adaptive_nutrition_events retraction
                   WHERE retraction.user_id = v_account
                     AND retraction.selection_id = v_selection
                     AND retraction.kind = 'ANNOTATION_RETRACTION'
                     AND retraction.supersedes_event_id = annotation.event_id) <> 1)
     OR EXISTS (
          SELECT 1 FROM public.adaptive_nutrition_events retraction
           WHERE retraction.user_id = v_account
             AND retraction.selection_id = v_selection
             AND retraction.kind = 'ANNOTATION_RETRACTION'
             AND NOT EXISTS (
               SELECT 1 FROM public.adaptive_nutrition_events annotation
                WHERE annotation.user_id = v_account
                  AND annotation.selection_id = v_selection
                  AND annotation.kind = 'ANNOTATION'
                  AND annotation.event_id = retraction.supersedes_event_id))
     OR EXISTS (SELECT 1 FROM public.food_diary_entries d WHERE d.user_id = v_account)
     OR EXISTS (SELECT 1 FROM public.user_premium_meal_selections m
                 WHERE m.user_premium_plan_selection_id = v_selection)
     OR EXISTS (SELECT 1 FROM potok_nutrition.validated_plan_replacement_offers_v1 o
                 WHERE o.account_id = v_account OR o.selection_id = v_selection)
     OR EXISTS (SELECT 1 FROM public.user_premium_plan_selections s
                 WHERE (s.id = v_selection
                    OR s.origin_lineage ->> 'source' = 'potok-retained-staging-smoke-v1')
                   AND s.user_id <> v_account)
     OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_operations o
                 WHERE (o.selection_id = v_selection
                    OR o.idempotency_key LIKE 'potok-retained-staging-smoke-v1/%')
                   AND o.user_id <> v_account)
     OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_graph_revisions g
                 WHERE (g.selection_id = v_selection OR g.plan_revision = v_plan_revision)
                   AND g.user_id <> v_account)
     OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_events e
                 WHERE e.selection_id = v_selection AND e.user_id <> v_account)
     OR EXISTS (SELECT 1 FROM potok_nutrition.validated_plan_replacement_offers_v1 o
                 WHERE o.selection_id = v_selection AND o.account_id <> v_account) THEN
    RAISE EXCEPTION 'exact accepted retained-smoke fixture state is required';
  END IF;

  SELECT a.* INTO STRICT v_head
    FROM potok_control.access_attestations a
   WHERE a.account_id = v_account AND a.capability = 'premium'
   ORDER BY a.lineage_sequence DESC LIMIT 1;

  -- Safe idempotent replay after an already successful retirement.
  IF v_head.effect = 'REVOKE'
     AND v_head.evidence_ref = 'potok-retained-staging-smoke-v1/revoke' THEN
    IF NOT EXISTS (
         SELECT 1 FROM public.user_premium_plan_selections s
          WHERE s.user_id = v_account AND s.id = v_selection AND s.status = 'archived'
       )
       OR NOT EXISTS (
         SELECT 1 FROM public.user_profiles p
          WHERE p.user_id = v_account AND NOT p.has_premium
            AND p.premium_provenance_id = v_head.attestation_id
            AND p.premium_valid_until IS NULL
       ) THEN
      RAISE EXCEPTION 'partial prior retirement state; no additional mutation allowed';
    END IF;
    RETURN;
  END IF;

  IF v_head.effect <> 'GRANT'
     OR v_head.evidence_ref <> 'potok-retained-staging-smoke-v1/grant'
     OR NOT EXISTS (
       SELECT 1 FROM public.user_profiles p
        WHERE p.user_id = v_account AND p.has_premium
          AND p.premium_provenance_id = v_head.attestation_id
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.user_premium_plan_selections s
        WHERE s.user_id = v_account AND s.id = v_selection AND s.status = 'active'
     ) THEN
    RAISE EXCEPTION 'latest entitlement/selection head is not the exact active fixture grant';
  END IF;

  v_revoke_attestation := potok_control.revoke_entitlement_v2(
    v_account,
    'premium',
    'potok-retained-staging-smoke-v1/revoke',
    'retire retained append-only STAGING browser smoke v1'
  );

  UPDATE public.user_premium_plan_selections s
     SET status = 'archived',
         completed_at = pg_catalog.statement_timestamp()
   WHERE s.user_id = v_account AND s.id = v_selection
     AND s.contract_version = 1 AND s.status = 'active'
     AND s.origin_lineage ->> 'source' = 'potok-retained-staging-smoke-v1';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'exact fixture selection archive transition failed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles p
     WHERE p.user_id = v_account AND NOT p.has_premium
       AND p.premium_provenance_id = v_revoke_attestation
       AND p.premium_valid_until IS NULL
  ) THEN
    RAISE EXCEPTION 'protected Premium revoke was not reflected by the profile';
  END IF;
END
$retire$;

DO $verify_retirement$
DECLARE
  v_account constant uuid := '88c26f6b-ebc8-4bff-864d-9194fbd27f8d'::uuid;
  v_selection constant uuid := '7e710000-0000-4000-8000-000000000001'::uuid;
  v_pair_count bigint;
BEGIN
  SELECT pg_catalog.count(*) INTO STRICT v_pair_count
    FROM public.adaptive_nutrition_operations o
   WHERE o.user_id = v_account AND o.selection_id = v_selection
     AND o.action_type = 'ANNOTATION' AND o.outcome = 'accepted';

  IF potok_control.is_effective_entitlement_v2(
       v_account, 'premium', pg_catalog.statement_timestamp()
     )
     OR NOT EXISTS (
       SELECT 1 FROM potok_control.access_attestations a
        WHERE a.account_id = v_account AND a.capability = 'premium'
          AND a.effect = 'REVOKE'
          AND a.evidence_ref = 'potok-retained-staging-smoke-v1/revoke'
          AND a.lineage_sequence = (
            SELECT pg_catalog.max(latest.lineage_sequence)
              FROM potok_control.access_attestations latest
             WHERE latest.account_id = v_account AND latest.capability = 'premium'
          )
     )
     OR (SELECT pg_catalog.count(*) FROM public.user_premium_plan_selections s
          WHERE s.user_id = v_account AND s.id = v_selection
            AND s.status = 'archived'
            AND s.origin_lineage ->> 'source' = 'potok-retained-staging-smoke-v1') <> 1
     OR v_pair_count < 1
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o
          WHERE o.user_id = v_account AND o.selection_id = v_selection)
            <> 1 + (2 * v_pair_count)
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o
          WHERE o.user_id = v_account AND o.selection_id = v_selection
            AND o.action_type = 'ANNOTATION_RETRACTION' AND o.outcome = 'accepted')
            <> v_pair_count
     OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_operations o
          WHERE o.user_id = v_account AND o.selection_id = v_selection
            AND (o.outcome <> 'accepted'
              OR o.action_type NOT IN ('FIXTURE_BOOTSTRAP', 'ANNOTATION', 'ANNOTATION_RETRACTION')
              OR o.request_digest <> extensions.digest(o.canonical_request, 'sha256')))
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e
          WHERE e.user_id = v_account AND e.selection_id = v_selection)
            <> 2 * v_pair_count
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e
          WHERE e.user_id = v_account AND e.selection_id = v_selection
            AND e.kind = 'ANNOTATION') <> v_pair_count
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e
          WHERE e.user_id = v_account AND e.selection_id = v_selection
            AND e.kind = 'ANNOTATION_RETRACTION') <> v_pair_count
     OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_events e
          WHERE e.user_id = v_account AND e.selection_id = v_selection
            AND e.kind NOT IN ('ANNOTATION', 'ANNOTATION_RETRACTION'))
     OR EXISTS (
          SELECT 1 FROM public.adaptive_nutrition_events annotation
           WHERE annotation.user_id = v_account
             AND annotation.selection_id = v_selection
             AND annotation.kind = 'ANNOTATION'
             AND (SELECT pg_catalog.count(*)
                    FROM public.adaptive_nutrition_events retraction
                   WHERE retraction.user_id = v_account
                     AND retraction.selection_id = v_selection
                     AND retraction.kind = 'ANNOTATION_RETRACTION'
                     AND retraction.supersedes_event_id = annotation.event_id) <> 1)
     OR EXISTS (
          SELECT 1 FROM public.adaptive_nutrition_events retraction
           WHERE retraction.user_id = v_account
             AND retraction.selection_id = v_selection
             AND retraction.kind = 'ANNOTATION_RETRACTION'
             AND NOT EXISTS (
               SELECT 1 FROM public.adaptive_nutrition_events annotation
                WHERE annotation.user_id = v_account
                  AND annotation.selection_id = v_selection
                  AND annotation.kind = 'ANNOTATION'
                  AND annotation.event_id = retraction.supersedes_event_id))
     OR EXISTS (SELECT 1 FROM public.food_diary_entries d WHERE d.user_id = v_account)
     OR EXISTS (SELECT 1 FROM public.user_premium_meal_selections m
                 WHERE m.user_premium_plan_selection_id = v_selection)
     OR EXISTS (SELECT 1 FROM potok_nutrition.validated_plan_replacement_offers_v1 o
                 WHERE o.account_id = v_account OR o.selection_id = v_selection)
     OR EXISTS (SELECT 1 FROM public.user_premium_plan_selections s
                 WHERE (s.id = v_selection
                    OR s.origin_lineage ->> 'source' = 'potok-retained-staging-smoke-v1')
                   AND s.user_id <> v_account)
     OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_operations o
                 WHERE o.selection_id = v_selection AND o.user_id <> v_account)
     OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_events e
                 WHERE e.selection_id = v_selection AND e.user_id <> v_account) THEN
    RAISE EXCEPTION 'retained fixture retirement verification failed; transaction will roll back';
  END IF;
END
$verify_retirement$;

COMMIT;
