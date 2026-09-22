-- POTOK retained Adaptive Nutrition STAGING smoke v1 — ONE-TIME SETUP.
-- Target only: Supabase STAGING ozidryfvhkcbtpnulakq after exact preflight/approval.
-- This intentionally commits append-only fixture history. It never deletes history.

BEGIN;

DO $setup$
DECLARE
  v_account constant uuid := '88c26f6b-ebc8-4bff-864d-9194fbd27f8d'::uuid;
  v_selection constant uuid := '7e710000-0000-4000-8000-000000000001'::uuid;
  v_plan_revision constant uuid := '7e710000-0000-4000-8000-000000000011'::uuid;
  v_history_revision constant uuid := '7e710000-0000-4000-8000-000000000012'::uuid;
  v_diary_revision constant uuid := '7e710000-0000-4000-8000-000000000013'::uuid;
  v_bootstrap_operation constant uuid := '7e710000-0000-4000-8000-000000000014'::uuid;
  v_week_anchor date := pg_catalog.date_trunc(
    'week', pg_catalog.timezone('Europe/Moscow', pg_catalog.statement_timestamp())
  )::date;
  v_goal_revision uuid;
  v_premium_grant uuid;
  v_graph jsonb;
  v_goal_snapshot jsonb;
  v_bootstrap_bytes bytea := pg_catalog.convert_to(
    '{"fixture":"potok-retained-staging-smoke-v1","action":"bootstrap"}', 'UTF8'
  );
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'postgres owner SQL session required' USING ERRCODE = '42501';
  END IF;
  IF pg_catalog.to_regprocedure(
       'potok_control.grant_entitlement_v2(uuid,text,timestamp with time zone,text,text)'
     ) IS NULL
     OR pg_catalog.to_regprocedure('potok_control.revoke_entitlement_v2(uuid,text,text,text)') IS NULL
     OR pg_catalog.to_regprocedure('public.adaptive_nutrition_mutate_v1(text)') IS NULL
     OR pg_catalog.to_regprocedure('public.adaptive_nutrition_lookup_v1(text)') IS NULL
     OR pg_catalog.to_regprocedure('public.adaptive_nutrition_read_v1(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'applied entitlement, persistence and runtime contracts are required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_account) THEN
    RAISE EXCEPTION 'exact retained-smoke auth account is absent';
  END IF;

  PERFORM 1 FROM auth.users u WHERE u.id = v_account FOR UPDATE;
  PERFORM 1 FROM public.user_profiles p WHERE p.user_id = v_account FOR UPDATE;
  IF NOT FOUND OR (SELECT pg_catalog.count(*) FROM public.user_profiles p
                    WHERE p.user_id = v_account) <> 1 THEN
    RAISE EXCEPTION 'exactly one existing profile is required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.user_id = v_account
      AND (p.has_premium OR p.is_admin
        OR p.premium_provenance_id IS NOT NULL OR p.premium_valid_until IS NOT NULL
        OR p.admin_provenance_id IS NOT NULL OR p.admin_valid_until IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'profile entitlement state is not the expected clean baseline';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_goals g WHERE g.user_id = v_account)
     OR EXISTS (SELECT 1 FROM public.user_premium_plan_selections s WHERE s.user_id = v_account)
     OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_operations o WHERE o.user_id = v_account)
     OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_graph_revisions g WHERE g.user_id = v_account)
     OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_events e WHERE e.user_id = v_account)
     OR EXISTS (SELECT 1 FROM public.food_diary_entries d WHERE d.user_id = v_account)
     OR EXISTS (SELECT 1 FROM potok_control.access_attestations a WHERE a.account_id = v_account)
     OR EXISTS (SELECT 1 FROM potok_nutrition.validated_plan_replacement_offers_v1 o
                 WHERE o.account_id = v_account) THEN
    RAISE EXCEPTION 'account has conflicting Goal/plan/runtime/diary/entitlement state';
  END IF;
  IF EXISTS (
       SELECT 1 FROM public.user_premium_plan_selections s
        WHERE s.id = v_selection
           OR s.origin_lineage ->> 'source' = 'potok-retained-staging-smoke-v1'
     )
     OR EXISTS (
       SELECT 1 FROM public.adaptive_nutrition_operations o
        WHERE o.operation_id = v_bootstrap_operation
           OR o.idempotency_key LIKE 'potok-retained-staging-smoke-v1/%'
     )
     OR EXISTS (
       SELECT 1 FROM public.adaptive_nutrition_graph_revisions g
        WHERE g.plan_revision = v_plan_revision
           OR g.graph_snapshot::text LIKE '%7e710000-0000-4000-8000-%'
     )
     OR EXISTS (
       SELECT 1 FROM public.adaptive_nutrition_events e
        WHERE e.selection_id = v_selection
           OR e.snapshot::text LIKE '%7e710000-0000-4000-8000-%'
     )
     OR EXISTS (
       SELECT 1 FROM potok_control.access_attestations a
        WHERE a.evidence_ref LIKE 'potok-retained-staging-smoke-v1/%'
     )
     OR EXISTS (
       SELECT 1 FROM public.user_goals g
        WHERE g.goal_type = 'potok_retained_staging_smoke_v1'
     ) THEN
    RAISE EXCEPTION 'retained fixture lineage or fixed IDs already exist';
  END IF;

  INSERT INTO public.user_goals (user_id, calories, protein, fat, carbs, goal_type)
  VALUES (v_account, 2000, 100.00, 70.00, 250.00, 'potok_retained_staging_smoke_v1');
  SELECT g.goal_revision INTO STRICT v_goal_revision
    FROM public.user_goals g WHERE g.user_id = v_account;

  v_premium_grant := potok_control.grant_entitlement_v2(
    v_account,
    'premium',
    pg_catalog.statement_timestamp() + interval '24 hours',
    'potok-retained-staging-smoke-v1/grant',
    'temporary Premium grant for retained append-only STAGING browser smoke v1'
  );

  SELECT pg_catalog.jsonb_build_object(
    'fixture', 'potok-retained-staging-smoke-v1',
    'goalRevision', v_goal_revision,
    'goalType', g.goal_type,
    'calories', g.calories,
    'protein', g.protein,
    'fat', g.fat,
    'carbs', g.carbs
  ) INTO STRICT v_goal_snapshot
  FROM public.user_goals g WHERE g.user_id = v_account;

  SELECT pg_catalog.jsonb_build_object(
    'days', pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'date', v_week_anchor + fixture.day_offset,
        'slots', pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'slotId', fixture.slot_id,
            'snapshot', pg_catalog.jsonb_build_object(
              'snapshotRevision', fixture.snapshot_revision,
              'recipeRevision', NULL,
              'portionRevision', fixture.portion_revision
            )
          )
        )
      ) ORDER BY fixture.day_offset
    )
  ) INTO STRICT v_graph
  FROM (VALUES
    (0, '7e710000-0000-4000-8000-000000000021'::uuid, '7e710000-0000-4000-8000-000000000031'::uuid, '7e710000-0000-4000-8000-000000000041'::uuid),
    (1, '7e710000-0000-4000-8000-000000000022'::uuid, '7e710000-0000-4000-8000-000000000032'::uuid, '7e710000-0000-4000-8000-000000000042'::uuid),
    (2, '7e710000-0000-4000-8000-000000000023'::uuid, '7e710000-0000-4000-8000-000000000033'::uuid, '7e710000-0000-4000-8000-000000000043'::uuid),
    (3, '7e710000-0000-4000-8000-000000000024'::uuid, '7e710000-0000-4000-8000-000000000034'::uuid, '7e710000-0000-4000-8000-000000000044'::uuid),
    (4, '7e710000-0000-4000-8000-000000000025'::uuid, '7e710000-0000-4000-8000-000000000035'::uuid, '7e710000-0000-4000-8000-000000000045'::uuid),
    (5, '7e710000-0000-4000-8000-000000000026'::uuid, '7e710000-0000-4000-8000-000000000036'::uuid, '7e710000-0000-4000-8000-000000000046'::uuid),
    (6, '7e710000-0000-4000-8000-000000000027'::uuid, '7e710000-0000-4000-8000-000000000037'::uuid, '7e710000-0000-4000-8000-000000000047'::uuid)
  ) AS fixture(day_offset, slot_id, snapshot_revision, portion_revision);

  INSERT INTO public.user_premium_plan_selections (
    id, user_id, user_goal_id, premium_plan_id, status, start_date,
    contract_version, week_anchor, timezone, plan_revision, goal_revision,
    history_revision, diary_revision, origin_kind, origin_lineage
  ) VALUES (
    v_selection, v_account, v_account, NULL, 'active', v_week_anchor,
    1, v_week_anchor, 'Europe/Moscow', v_plan_revision, v_goal_revision,
    v_history_revision, v_diary_revision, 'generated',
    pg_catalog.jsonb_build_object(
      'source', 'potok-retained-staging-smoke-v1',
      'fixtureVersion', 1,
      'discoveryPolicy', 'explicit-smoke-selection-only',
      'retireToStatus', 'archived',
      'bootstrapOperationId', v_bootstrap_operation,
      'premiumGrantId', v_premium_grant
    )
  );

  INSERT INTO public.adaptive_nutrition_operations (
    user_id, idempotency_key, operation_id, selection_id, contract_version,
    action_type, canonical_request, digest_version, request_digest,
    outcome, result_references, committed_at
  ) VALUES (
    v_account, 'potok-retained-staging-smoke-v1/bootstrap', v_bootstrap_operation,
    v_selection, 'adaptive-nutrition-v1', 'FIXTURE_BOOTSTRAP', v_bootstrap_bytes,
    'potok-retained-staging-smoke-bootstrap-v1',
    extensions.digest(v_bootstrap_bytes, 'sha256'),
    'accepted', pg_catalog.jsonb_build_object(
      'contract', 'adaptive-nutrition-receipt-v1',
      'outcome', 'accepted',
      'operation_id', v_bootstrap_operation,
      'selection_id', v_selection,
      'plan_revision', v_plan_revision,
      'goal_revision', v_goal_revision,
      'history_revision', v_history_revision,
      'diary_revision', v_diary_revision,
      'event_ids', '[]'::jsonb
    ), pg_catalog.statement_timestamp()
  );

  INSERT INTO public.adaptive_nutrition_graph_revisions (
    user_id, selection_id, plan_revision, goal_revision, goal_snapshot,
    graph_snapshot, snapshot_encoding_version, content_digest,
    created_by_operation_id
  ) VALUES (
    v_account, v_selection, v_plan_revision, v_goal_revision, v_goal_snapshot,
    v_graph, 'potok-retained-staging-smoke-v1',
    extensions.digest(pg_catalog.convert_to(v_graph::text, 'UTF8'), 'sha256'),
    v_bootstrap_operation
  );
END
$setup$;

SET CONSTRAINTS ALL IMMEDIATE;

DO $verify_setup$
DECLARE
  v_account constant uuid := '88c26f6b-ebc8-4bff-864d-9194fbd27f8d'::uuid;
  v_selection constant uuid := '7e710000-0000-4000-8000-000000000001'::uuid;
  v_plan_revision constant uuid := '7e710000-0000-4000-8000-000000000011'::uuid;
BEGIN
  IF NOT potok_control.is_effective_entitlement_v2(
       v_account, 'premium', pg_catalog.statement_timestamp()
     )
     OR (SELECT pg_catalog.count(*) FROM public.user_premium_plan_selections s
          WHERE s.user_id = v_account AND s.id = v_selection
            AND s.contract_version = 1 AND s.status = 'active'
            AND s.origin_lineage ->> 'source' = 'potok-retained-staging-smoke-v1') <> 1
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_graph_revisions g
          WHERE g.user_id = v_account AND g.selection_id = v_selection
            AND g.plan_revision = v_plan_revision) <> 1
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o
          WHERE o.user_id = v_account AND o.selection_id = v_selection
            AND o.idempotency_key = 'potok-retained-staging-smoke-v1/bootstrap'
            AND o.outcome = 'accepted') <> 1
     OR EXISTS (SELECT 1 FROM public.food_diary_entries d WHERE d.user_id = v_account)
     OR EXISTS (SELECT 1 FROM potok_nutrition.validated_plan_replacement_offers_v1 o
                 WHERE o.account_id = v_account) THEN
    RAISE EXCEPTION 'retained fixture verification failed; transaction will roll back';
  END IF;
END
$verify_setup$;

COMMIT;
