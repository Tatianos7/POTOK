-- POTOK Adaptive Nutrition disposable-branch smoke v1 — ONE-TIME FIXTURE SETUP.
-- Run only after the exact SELECT-only preflight passes in a disposable branch
-- created from STAGING ozidryfvhkcbtpnulakq with Include data OFF.
-- This transaction intentionally creates durable append-only smoke history. Teardown
-- is deletion of the entire disposable branch, never row cleanup.

BEGIN;

DO $fixture$
DECLARE
  v_account uuid;
  v_account_count bigint;
  v_week_anchor date := pg_catalog.date_trunc(
    'week', pg_catalog.timezone('Europe/Moscow', pg_catalog.statement_timestamp())
  )::date;
  v_selection constant uuid := '9a220000-0000-4000-8000-000000000001'::uuid;
  v_plan_revision constant uuid := '9a220000-0000-4000-8000-000000000011'::uuid;
  v_history_revision constant uuid := '9a220000-0000-4000-8000-000000000012'::uuid;
  v_diary_revision constant uuid := '9a220000-0000-4000-8000-000000000013'::uuid;
  v_bootstrap_operation constant uuid := '9a220000-0000-4000-8000-000000000014'::uuid;
  v_goal_revision uuid;
  v_premium_grant uuid;
  v_graph jsonb;
  v_goal_snapshot jsonb;
  v_bootstrap_bytes bytea := pg_catalog.convert_to(
    '{"fixture":"potok-disposable-branch-smoke-v1","action":"bootstrap"}', 'UTF8'
  );
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'postgres owner SQL session required' USING ERRCODE = '42501';
  END IF;
  IF pg_catalog.to_regprocedure(
       'potok_control.grant_entitlement_v2(uuid,text,timestamp with time zone,text,text)'
     ) IS NULL
     OR pg_catalog.to_regprocedure('public.adaptive_nutrition_mutate_v1(text)') IS NULL
     OR pg_catalog.to_regprocedure('public.adaptive_nutrition_lookup_v1(text)') IS NULL
     OR pg_catalog.to_regprocedure('public.adaptive_nutrition_read_v1(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'trusted entitlement, persistence and runtime activation must be present';
  END IF;

  SELECT pg_catalog.count(*), pg_catalog.min(u.id)
    INTO v_account_count, v_account
    FROM auth.users u;
  IF v_account_count <> 1 OR v_account IS NULL THEN
    RAISE EXCEPTION 'disposable branch must contain exactly one branch-local auth user';
  END IF;

  PERFORM 1 FROM auth.users u WHERE u.id = v_account FOR UPDATE;
  IF (SELECT pg_catalog.count(*) FROM public.user_profiles p WHERE p.user_id = v_account) > 1
     OR EXISTS (
       SELECT 1 FROM public.user_profiles p WHERE p.user_id = v_account
         AND (p.has_premium IS DISTINCT FROM false
           OR p.is_admin IS DISTINCT FROM false
           OR p.premium_provenance_id IS NOT NULL
           OR p.premium_valid_until IS NOT NULL
           OR p.admin_provenance_id IS NOT NULL
           OR p.admin_valid_until IS NOT NULL)
     )
     OR EXISTS (SELECT 1 FROM public.user_goals)
     OR EXISTS (SELECT 1 FROM public.user_premium_plan_selections)
     OR EXISTS (SELECT 1 FROM public.user_premium_meal_selections)
     OR EXISTS (SELECT 1 FROM public.food_diary_entries)
     OR EXISTS (SELECT 1 FROM potok_control.access_attestations)
     OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_operations)
     OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_graph_revisions)
     OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_events)
     OR EXISTS (SELECT 1 FROM potok_nutrition.validated_plan_replacement_offers_v1) THEN
    RAISE EXCEPTION 'branch is not an empty isolated smoke environment; no fixture was written';
  END IF;

  INSERT INTO public.user_profiles (user_id)
  SELECT v_account
   WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.user_id = v_account);

  INSERT INTO public.user_goals (user_id, calories, protein, fat, carbs, goal_type)
  VALUES (v_account, 2000, 100.00, 70.00, 250.00, 'disposable_branch_smoke_v1');
  SELECT g.goal_revision INTO STRICT v_goal_revision
    FROM public.user_goals g WHERE g.user_id = v_account;

  v_premium_grant := potok_control.grant_entitlement_v2(
    v_account,
    'premium',
    pg_catalog.statement_timestamp() + interval '24 hours',
    'adaptive-nutrition/disposable-branch-smoke-v1/grant',
    'temporary Premium grant for disposable branch browser smoke'
  );

  SELECT pg_catalog.jsonb_build_object(
    'fixture', 'potok-disposable-branch-smoke-v1',
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
    (0, '9a220000-0000-4000-8000-000000000021'::uuid, '9a220000-0000-4000-8000-000000000031'::uuid, '9a220000-0000-4000-8000-000000000041'::uuid),
    (1, '9a220000-0000-4000-8000-000000000022'::uuid, '9a220000-0000-4000-8000-000000000032'::uuid, '9a220000-0000-4000-8000-000000000042'::uuid),
    (2, '9a220000-0000-4000-8000-000000000023'::uuid, '9a220000-0000-4000-8000-000000000033'::uuid, '9a220000-0000-4000-8000-000000000043'::uuid),
    (3, '9a220000-0000-4000-8000-000000000024'::uuid, '9a220000-0000-4000-8000-000000000034'::uuid, '9a220000-0000-4000-8000-000000000044'::uuid),
    (4, '9a220000-0000-4000-8000-000000000025'::uuid, '9a220000-0000-4000-8000-000000000035'::uuid, '9a220000-0000-4000-8000-000000000045'::uuid),
    (5, '9a220000-0000-4000-8000-000000000026'::uuid, '9a220000-0000-4000-8000-000000000036'::uuid, '9a220000-0000-4000-8000-000000000046'::uuid),
    (6, '9a220000-0000-4000-8000-000000000027'::uuid, '9a220000-0000-4000-8000-000000000037'::uuid, '9a220000-0000-4000-8000-000000000047'::uuid)
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
      'source', 'potok-disposable-branch-smoke-v1',
      'fixtureVersion', 1,
      'bootstrapOperationId', v_bootstrap_operation,
      'premiumGrantId', v_premium_grant
    )
  );

  INSERT INTO public.adaptive_nutrition_operations (
    user_id, idempotency_key, operation_id, selection_id, contract_version,
    action_type, canonical_request, digest_version, request_digest,
    outcome, result_references, committed_at
  ) VALUES (
    v_account, 'disposable-branch-smoke-v1/bootstrap', v_bootstrap_operation,
    v_selection, 'adaptive-nutrition-v1', 'FIXTURE_BOOTSTRAP', v_bootstrap_bytes,
    'potok-disposable-smoke-bootstrap-v1', extensions.digest(v_bootstrap_bytes, 'sha256'),
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
    v_graph, 'potok-disposable-branch-smoke-v1',
    extensions.digest(pg_catalog.convert_to(v_graph::text, 'UTF8'), 'sha256'),
    v_bootstrap_operation
  );

END
$fixture$;

SET CONSTRAINTS ALL IMMEDIATE;

DO $verify_fixture$
DECLARE
  v_account uuid;
  v_selection constant uuid := '9a220000-0000-4000-8000-000000000001'::uuid;
  v_plan_revision constant uuid := '9a220000-0000-4000-8000-000000000011'::uuid;
BEGIN
  SELECT pg_catalog.min(u.id) INTO STRICT v_account FROM auth.users u;
  IF NOT potok_control.is_effective_entitlement_v2(
       v_account, 'premium', pg_catalog.statement_timestamp()
     )
     OR (SELECT pg_catalog.count(*) FROM public.user_premium_plan_selections s
          WHERE s.user_id = v_account AND s.id = v_selection
            AND s.contract_version = 1 AND s.status = 'active') <> 1
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_graph_revisions g
          WHERE g.user_id = v_account AND g.selection_id = v_selection
            AND g.plan_revision = v_plan_revision) <> 1
     OR EXISTS (SELECT 1 FROM public.food_diary_entries) THEN
    RAISE EXCEPTION 'fixture verification failed; transaction will roll back';
  END IF;
END
$verify_fixture$;

COMMIT;
