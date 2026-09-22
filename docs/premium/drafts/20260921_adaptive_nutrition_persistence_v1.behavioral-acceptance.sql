-- POTOK Adaptive Nutrition persistence v1 — BEHAVIORAL STAGING ACCEPTANCE.
-- RUNNABLE REVIEW DRAFT, NOT EXECUTED. Target: STAGING ozidryfvhkcbtpnulakq only.
-- Requires a postgres owner SQL session and separate owner authorization.
-- Every fixture/effect is inside this transaction. The final executable statement
-- is ROLLBACK. No runtime grants, FACT writes, canonical data or production access.

BEGIN;

CREATE TEMP TABLE potok_adaptive_behavioral_config (
  account_a uuid PRIMARY KEY,
  account_b uuid UNIQUE NOT NULL,
  week_anchor date NOT NULL,
  selection_a uuid UNIQUE NOT NULL,
  selection_b uuid UNIQUE NOT NULL,
  goal_revision_a uuid NULL,
  goal_revision_b uuid NULL,
  plan_a0 uuid UNIQUE NOT NULL,
  plan_a1 uuid UNIQUE NOT NULL,
  history_a0 uuid UNIQUE NOT NULL,
  history_a1 uuid UNIQUE NOT NULL,
  history_a2 uuid UNIQUE NOT NULL,
  history_a3 uuid UNIQUE NOT NULL,
  diary_a0 uuid UNIQUE NOT NULL,
  plan_b0 uuid UNIQUE NOT NULL,
  history_b0 uuid UNIQUE NOT NULL,
  diary_b0 uuid UNIQUE NOT NULL,
  bootstrap_operation_a uuid UNIQUE NOT NULL,
  expired_operation_b uuid UNIQUE NOT NULL,
  expired_event_b uuid UNIQUE NOT NULL,
  expired_stream_b uuid UNIQUE NOT NULL,
  expired_attestation_b uuid UNIQUE NOT NULL,
  transition_event_a uuid UNIQUE NOT NULL,
  transition_stream_a uuid UNIQUE NOT NULL,
  annotation_event_a uuid UNIQUE NOT NULL,
  annotation_stream_a uuid UNIQUE NOT NULL,
  retraction_event_a uuid UNIQUE NOT NULL,
  transition_operation_a uuid NULL,
  premium_grant_a uuid NULL,
  premium_revoke_a uuid NULL
) ON COMMIT DROP;

INSERT INTO potok_adaptive_behavioral_config (
  account_a, account_b, week_anchor, selection_a, selection_b,
  plan_a0, plan_a1, history_a0, history_a1, history_a2, history_a3, diary_a0,
  plan_b0, history_b0, diary_b0, bootstrap_operation_a,
  expired_operation_b, expired_event_b, expired_stream_b, expired_attestation_b,
  transition_event_a, transition_stream_a, annotation_event_a,
  annotation_stream_a, retraction_event_a
)
SELECT
  'd6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid,
  '8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid,
  '2026-09-21'::date,
  pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(),
  pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(),
  pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(),
  pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(),
  pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(),
  pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(),
  pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(),
  pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(),
  pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(),
  pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(),
  pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid();

DO $preflight$
DECLARE
  v potok_adaptive_behavioral_config%ROWTYPE;
  v_count bigint;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'postgres owner SQL session required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO STRICT v FROM potok_adaptive_behavioral_config;

  SELECT pg_catalog.count(*) INTO v_count
    FROM auth.users u WHERE u.id IN (v.account_a, v.account_b);
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'both exact staging fixture auth accounts are required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.user_id IN (v.account_a, v.account_b)
    UNION ALL
    SELECT 1 FROM public.user_goals g WHERE g.user_id IN (v.account_a, v.account_b)
    UNION ALL
    SELECT 1 FROM public.user_premium_plan_selections s WHERE s.user_id IN (v.account_a, v.account_b)
    UNION ALL
    SELECT 1 FROM public.food_diary_entries d WHERE d.user_id IN (v.account_a, v.account_b)
    UNION ALL
    SELECT 1 FROM potok_control.access_attestations a WHERE a.account_id IN (v.account_a, v.account_b)
  ) THEN
    RAISE EXCEPTION 'fixture accounts are not empty; do not overwrite existing data';
  END IF;
  IF EXISTS (SELECT 1 FROM public.adaptive_nutrition_operations)
     OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_graph_revisions)
     OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_events) THEN
    RAISE EXCEPTION 'adaptive persistence tables must match the confirmed clean baseline';
  END IF;

  IF pg_catalog.to_regprocedure(
       'potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb)'
     ) IS NULL
     OR pg_catalog.to_regprocedure('public.adaptive_nutrition_lookup_v1(text)') IS NULL
     OR pg_catalog.to_regprocedure('public.adaptive_nutrition_read_v1(uuid,uuid)') IS NULL
     OR pg_catalog.to_regprocedure(
       'potok_control.grant_entitlement_v2(uuid,text,timestamp with time zone,text,text)'
     ) IS NULL
     OR pg_catalog.to_regprocedure('potok_control.revoke_entitlement_v2(uuid,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'applied persistence v1 and trusted-entitlement v2 functions are required';
  END IF;
  IF has_function_privilege(
       'authenticated',
       'potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb)',
       'EXECUTE'
     ) OR has_function_privilege('authenticated', 'public.adaptive_nutrition_lookup_v1(text)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.adaptive_nutrition_read_v1(uuid,uuid)', 'EXECUTE')
       OR has_function_privilege(
         'anon',
         'potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb)',
         'EXECUTE'
       )
       OR has_function_privilege('anon', 'public.adaptive_nutrition_lookup_v1(text)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.adaptive_nutrition_read_v1(uuid,uuid)', 'EXECUTE')
       OR has_function_privilege(
         'service_role',
         'potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb)',
         'EXECUTE'
       ) OR has_function_privilege('service_role', 'public.adaptive_nutrition_lookup_v1(text)', 'EXECUTE')
         OR has_function_privilege('service_role', 'public.adaptive_nutrition_read_v1(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'runtime EXECUTE must remain disabled';
  END IF;
END
$preflight$;

-- Minimal synthetic profile + Goal fixtures. No names, contacts or user diary rows.
INSERT INTO public.user_profiles (user_id)
SELECT account_a FROM potok_adaptive_behavioral_config
UNION ALL
SELECT account_b FROM potok_adaptive_behavioral_config;

INSERT INTO public.user_goals (user_id, calories, protein, fat, carbs, goal_type)
SELECT account_a, 2000, 100.00, 70.00, 250.00, 'behavioral_acceptance_fixture'
  FROM potok_adaptive_behavioral_config
UNION ALL
SELECT account_b, 2000, 100.00, 70.00, 250.00, 'behavioral_acceptance_fixture'
  FROM potok_adaptive_behavioral_config;

UPDATE potok_adaptive_behavioral_config c
   SET goal_revision_a = ga.goal_revision,
       goal_revision_b = gb.goal_revision
  FROM public.user_goals ga, public.user_goals gb
 WHERE ga.user_id = c.account_a AND gb.user_id = c.account_b;

DO $owner_generated_instances$
DECLARE
  v potok_adaptive_behavioral_config%ROWTYPE;
  v_graph_a jsonb;
  v_graph_b jsonb;
  v_expired_issued timestamptz := pg_catalog.statement_timestamp() - interval '3 days';
  v_expired_until timestamptz := pg_catalog.statement_timestamp() - interval '1 day';
  v_expired_committed timestamptz := pg_catalog.statement_timestamp() - interval '2 days';
BEGIN
  SELECT * INTO STRICT v FROM potok_adaptive_behavioral_config;
  v_graph_a := pg_catalog.jsonb_build_object('days', pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('date', '2026-09-21', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-22', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-23', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-24', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-25', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-26', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-27', 'slots', '[]'::jsonb)
  ));
  v_graph_b := v_graph_a;

  INSERT INTO public.user_premium_plan_selections (
    id, user_id, user_goal_id, premium_plan_id, status, start_date,
    contract_version, week_anchor, timezone, plan_revision, goal_revision,
    history_revision, diary_revision, origin_kind, origin_lineage
  ) VALUES
  (
    v.selection_a, v.account_a, v.account_a, NULL, 'provisional', v.week_anchor,
    1, v.week_anchor, 'Europe/Moscow', v.plan_a0, v.goal_revision_a,
    v.history_a0, v.diary_a0, 'generated',
    '{"source":"behavioral-acceptance-v1","generator_version":"fixture-only"}'::jsonb
  ),
  (
    v.selection_b, v.account_b, v.account_b, NULL, 'provisional', v.week_anchor,
    1, v.week_anchor, 'Europe/Moscow', v.plan_b0, v.goal_revision_b,
    v.history_b0, v.diary_b0, 'generated',
    '{"source":"behavioral-acceptance-v1","generator_version":"fixture-only"}'::jsonb
  );

  INSERT INTO public.adaptive_nutrition_operations (
    user_id, idempotency_key, operation_id, selection_id, contract_version,
    action_type, canonical_request, digest_version, request_digest,
    outcome, result_references, created_at, committed_at
  ) VALUES (
    v.account_a, 'behavioral/bootstrap-a', v.bootstrap_operation_a, v.selection_a,
    'adaptive-nutrition-v1', 'FIXTURE_BOOTSTRAP',
    pg_catalog.convert_to('{"fixture":"bootstrap-a"}', 'UTF8'),
    'sha256-v1', pg_catalog.decode(pg_catalog.repeat('01', 32), 'hex'),
    'accepted', pg_catalog.jsonb_build_object(
      'contract', 'adaptive-nutrition-receipt-v1', 'outcome', 'accepted',
      'operation_id', v.bootstrap_operation_a, 'selection_id', v.selection_a,
      'plan_revision', v.plan_a0, 'goal_revision', v.goal_revision_a,
      'history_revision', v.history_a0, 'diary_revision', v.diary_a0,
      'event_ids', '[]'::jsonb
    ), pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp()
  ), (
    v.account_b, 'behavioral/expired-original', v.expired_operation_b, v.selection_b,
    'adaptive-nutrition-v1', 'ANNOTATION',
    pg_catalog.convert_to('{"fixture":"expired-original"}', 'UTF8'),
    'sha256-v1', pg_catalog.decode(pg_catalog.repeat('02', 32), 'hex'),
    'accepted', pg_catalog.jsonb_build_object(
      'contract', 'adaptive-nutrition-receipt-v1', 'outcome', 'accepted',
      'operation_id', v.expired_operation_b, 'selection_id', v.selection_b,
      'plan_revision', v.plan_b0, 'goal_revision', v.goal_revision_b,
      'history_revision', v.history_b0, 'diary_revision', v.diary_b0,
      'event_ids', pg_catalog.jsonb_build_array(v.expired_event_b)
    ), v_expired_committed, v_expired_committed
  );

  INSERT INTO public.adaptive_nutrition_graph_revisions (
    user_id, selection_id, plan_revision, goal_revision, goal_snapshot,
    graph_snapshot, snapshot_encoding_version, content_digest,
    created_by_operation_id, created_at
  ) VALUES
  (
    v.account_a, v.selection_a, v.plan_a0, v.goal_revision_a,
    '{"fixture":"goal-a"}'::jsonb, v_graph_a, 'fixture-v1',
    pg_catalog.decode(pg_catalog.repeat('03', 32), 'hex'),
    v.bootstrap_operation_a, pg_catalog.statement_timestamp()
  ),
  (
    v.account_b, v.selection_b, v.plan_b0, v.goal_revision_b,
    '{"fixture":"goal-b"}'::jsonb, v_graph_b, 'fixture-v1',
    pg_catalog.decode(pg_catalog.repeat('04', 32), 'hex'),
    v.expired_operation_b, v_expired_committed
  );

  INSERT INTO public.adaptive_nutrition_events (
    user_id, selection_id, event_id, operation_id, stream_id,
    event_sequence, event_index, kind, local_date, slot_id,
    source_plan_revision, source_goal_revision, snapshot,
    component_manifest, supersedes_event_id, created_at
  ) VALUES (
    v.account_b, v.selection_b, v.expired_event_b, v.expired_operation_b,
    v.expired_stream_b, 1, 0, 'ANNOTATION', v.week_anchor, NULL,
    v.plan_b0, v.goal_revision_b, '{"fixture":"historical-annotation"}'::jsonb,
    '[]'::jsonb, NULL, v_expired_committed
  );

  INSERT INTO potok_control.access_attestations (
    attestation_id, account_id, capability, effect, previous_attestation_id,
    lineage_sequence, issued_at, valid_until, operator_db_role,
    evidence_ref, reason
  ) VALUES (
    v.expired_attestation_b, v.account_b, 'premium', 'GRANT', NULL,
    1, v_expired_issued, v_expired_until, SESSION_USER::name,
    'behavioral-acceptance/expired-b', 'rollback-only historical expiry fixture'
  );
  UPDATE public.user_profiles
     SET has_premium = true,
         premium_provenance_id = v.expired_attestation_b,
         premium_valid_until = v_expired_until
   WHERE user_id = v.account_b;

  IF NOT potok_control.is_effective_entitlement_v2(
       v.account_b, 'premium', v_expired_issued + interval '1 hour'
     ) OR potok_control.is_effective_entitlement_v2(
       v.account_b, 'premium', pg_catalog.statement_timestamp()
     ) THEN
    RAISE EXCEPTION 'historical Premium expiry fixture is not time-bounded correctly';
  END IF;
END
$owner_generated_instances$;

-- Ordinary authenticated writes cannot create another generated v1 instance.
SELECT pg_catalog.set_config('request.jwt.claim.sub', account_a::text, true),
       pg_catalog.set_config('potok.behavioral.account_a', account_a::text, true),
       pg_catalog.set_config('potok.behavioral.goal_a', goal_revision_a::text, true),
       pg_catalog.set_config('potok.behavioral.week', week_anchor::text, true)
  FROM potok_adaptive_behavioral_config;
SET LOCAL ROLE authenticated;
DO $owner_only_instance$
BEGIN
  BEGIN
    INSERT INTO public.user_premium_plan_selections (
      id, user_id, user_goal_id, premium_plan_id, status, start_date,
      contract_version, week_anchor, timezone, plan_revision, goal_revision,
      history_revision, diary_revision, origin_kind, origin_lineage
    ) VALUES (
      pg_catalog.gen_random_uuid(),
      pg_catalog.current_setting('potok.behavioral.account_a')::uuid,
      pg_catalog.current_setting('potok.behavioral.account_a')::uuid,
      NULL, 'paused', pg_catalog.current_setting('potok.behavioral.week')::date,
      1, pg_catalog.current_setting('potok.behavioral.week')::date, 'Europe/Moscow',
      pg_catalog.gen_random_uuid(), pg_catalog.current_setting('potok.behavioral.goal_a')::uuid,
      pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(), 'generated',
      '{"source":"unauthorized-fixture"}'::jsonb
    );
    SET CONSTRAINTS user_premium_plan_selections_graph_head_fk IMMEDIATE;
    RAISE EXCEPTION 'authenticated generated-instance creation unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$owner_only_instance$;
RESET ROLE;

-- The active account receives a real temporary verified Premium attestation.
UPDATE potok_adaptive_behavioral_config c
   SET premium_grant_a = potok_control.grant_entitlement_v2(
     c.account_a, 'premium', pg_catalog.statement_timestamp() + interval '1 day',
     'behavioral-acceptance/grant-a', 'rollback-only persistence behavioral grant'
   );

DO $atomic_transition_and_fail_closed_cases$
DECLARE
  v potok_adaptive_behavioral_config%ROWTYPE;
  v_graph jsonb;
  v_event jsonb;
  v_request bytea := pg_catalog.convert_to('{"fixture":"transition-a1"}', 'UTF8');
  v_digest bytea := pg_catalog.decode(pg_catalog.repeat('11', 32), 'hex');
  v_result jsonb;
  v_replay jsonb;
  v_case text;
  v_expected_plan uuid;
  v_expected_goal uuid;
  v_expected_history uuid;
  v_expected_diary uuid;
  v_failure_plan uuid := pg_catalog.gen_random_uuid();
  v_failure_history uuid := pg_catalog.gen_random_uuid();
BEGIN
  SELECT * INTO STRICT v FROM potok_adaptive_behavioral_config;
  v_graph := pg_catalog.jsonb_build_object('days', pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('date', '2026-09-21', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-22', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-23', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-24', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-25', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-26', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-27', 'slots', '[]'::jsonb)
  ));
  v_event := pg_catalog.jsonb_build_object(
    'event_id', v.transition_event_a, 'stream_id', v.transition_stream_a,
    'kind', 'PLAN_REPLACED', 'local_date', v.week_anchor,
    'slot_id', NULL, 'snapshot', pg_catalog.jsonb_build_object('fixture', 'replacement-a1'),
    'component_manifest', '[]'::jsonb, 'supersedes_event_id', NULL
  );

  v_result := potok_nutrition.commit_prevalidated_plan_transition_v1(
    v.account_a, v.selection_a, 'behavioral/transition-a1',
    'adaptive-nutrition-v1', 'PLAN_REPLACED', v_request, 'sha256-v1', v_digest,
    v.plan_a0, v.goal_revision_a, v.history_a0, v.diary_a0,
    v.plan_a1, v.history_a1, '{"fixture":"goal-a"}'::jsonb,
    v_graph, 'fixture-v1', pg_catalog.decode(pg_catalog.repeat('12', 32), 'hex'), v_event
  );
  UPDATE potok_adaptive_behavioral_config
     SET transition_operation_a = (v_result ->> 'operation_id')::uuid;
  SELECT * INTO STRICT v FROM potok_adaptive_behavioral_config;

  IF v_result ->> 'outcome' <> 'accepted'
     OR (v_result ->> 'plan_revision')::uuid <> v.plan_a1
     OR (v_result ->> 'history_revision')::uuid <> v.history_a1
     OR (v_result ->> 'diary_revision')::uuid <> v.diary_a0
     OR (v_result ->> 'goal_revision')::uuid <> v.goal_revision_a THEN
    RAISE EXCEPTION 'accepted receipt revision vector mismatch';
  END IF;
  IF (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o
       WHERE o.user_id = v.account_a AND o.idempotency_key = 'behavioral/transition-a1'
         AND o.outcome = 'accepted') <> 1
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_graph_revisions g
          WHERE g.user_id = v.account_a AND g.selection_id = v.selection_a
            AND g.plan_revision = v.plan_a1) <> 1
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e
          WHERE e.user_id = v.account_a AND e.operation_id = v.transition_operation_a
            AND e.event_id = v.transition_event_a) <> 1
     OR NOT EXISTS (
       SELECT 1 FROM public.user_premium_plan_selections s
        WHERE s.user_id = v.account_a AND s.id = v.selection_a
          AND s.plan_revision = v.plan_a1 AND s.goal_revision = v.goal_revision_a
          AND s.history_revision = v.history_a1 AND s.diary_revision = v.diary_a0
     ) THEN
    RAISE EXCEPTION 'atomic transition did not persist exactly one coherent effect';
  END IF;

  v_replay := potok_nutrition.commit_prevalidated_plan_transition_v1(
    v.account_a, v.selection_a, 'behavioral/transition-a1',
    'adaptive-nutrition-v1', 'PLAN_REPLACED', v_request, 'sha256-v1', v_digest,
    v.plan_a0, v.goal_revision_a, v.history_a0, v.diary_a0,
    v.plan_a1, v.history_a1, '{"fixture":"goal-a"}'::jsonb,
    v_graph, 'fixture-v1', pg_catalog.decode(pg_catalog.repeat('12', 32), 'hex'), v_event
  );
  IF v_replay IS DISTINCT FROM v_result
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o
          WHERE o.user_id = v.account_a AND o.idempotency_key = 'behavioral/transition-a1') <> 1 THEN
    RAISE EXCEPTION 'exact replay did not return the original single receipt';
  END IF;

  BEGIN
    PERFORM potok_nutrition.commit_prevalidated_plan_transition_v1(
      v.account_a, v.selection_a, 'behavioral/transition-a1',
      'adaptive-nutrition-v1', 'PLAN_REPLACED',
      pg_catalog.convert_to('{"fixture":"different-payload"}', 'UTF8'),
      'sha256-v1', pg_catalog.decode(pg_catalog.repeat('13', 32), 'hex'),
      v.plan_a0, v.goal_revision_a, v.history_a0, v.diary_a0,
      v.plan_a1, v.history_a1, '{"fixture":"goal-a"}'::jsonb,
      v_graph, 'fixture-v1', pg_catalog.decode(pg_catalog.repeat('12', 32), 'hex'), v_event
    );
    RAISE EXCEPTION 'same key with different payload unexpectedly succeeded';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;

  FOR v_case IN
    SELECT stale_kind
      FROM pg_catalog.unnest(ARRAY['plan','history','diary']) AS stale(stale_kind)
  LOOP
    v_expected_plan := CASE WHEN v_case = 'plan' THEN pg_catalog.gen_random_uuid() ELSE v.plan_a1 END;
    v_expected_goal := v.goal_revision_a;
    v_expected_history := CASE WHEN v_case = 'history' THEN pg_catalog.gen_random_uuid() ELSE v.history_a1 END;
    v_expected_diary := CASE WHEN v_case = 'diary' THEN pg_catalog.gen_random_uuid() ELSE v.diary_a0 END;
    BEGIN
      PERFORM potok_nutrition.commit_prevalidated_plan_transition_v1(
        v.account_a, v.selection_a, 'behavioral/stale-' || v_case,
        'adaptive-nutrition-v1', 'PLAN_REPLACED',
        pg_catalog.convert_to('{"fixture":"stale-' || v_case || '"}', 'UTF8'),
        'sha256-v1', pg_catalog.decode(pg_catalog.repeat('14', 32), 'hex'),
        v_expected_plan, v_expected_goal, v_expected_history, v_expected_diary,
        pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(),
        '{"fixture":"goal-a"}'::jsonb, v_graph, 'fixture-v1',
        pg_catalog.decode(pg_catalog.repeat('15', 32), 'hex'),
        pg_catalog.jsonb_build_object(
          'event_id', pg_catalog.gen_random_uuid(), 'stream_id', pg_catalog.gen_random_uuid(),
          'kind', 'PLAN_REPLACED', 'local_date', v.week_anchor,
          'snapshot', '{}'::jsonb, 'component_manifest', '[]'::jsonb
        )
      );
      RAISE EXCEPTION 'stale % revision unexpectedly succeeded', v_case;
    EXCEPTION WHEN serialization_failure THEN NULL;
    END;
  END LOOP;
  BEGIN
    UPDATE public.user_goals
       SET calories = calories + 1
     WHERE user_id = v.account_a;
    PERFORM potok_nutrition.commit_prevalidated_plan_transition_v1(
      v.account_a, v.selection_a, 'behavioral/stale-goal-authority',
      'adaptive-nutrition-v1', 'PLAN_REPLACED',
      pg_catalog.convert_to('{"fixture":"stale-goal-authority"}', 'UTF8'),
      'sha256-v1', pg_catalog.decode(pg_catalog.repeat('14', 32), 'hex'),
      v.plan_a1, v.goal_revision_a, v.history_a1, v.diary_a0,
      pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(),
      '{"fixture":"goal-a"}'::jsonb, v_graph, 'fixture-v1',
      pg_catalog.decode(pg_catalog.repeat('15', 32), 'hex'),
      pg_catalog.jsonb_build_object(
        'event_id', pg_catalog.gen_random_uuid(), 'stream_id', pg_catalog.gen_random_uuid(),
        'kind', 'PLAN_REPLACED', 'local_date', v.week_anchor,
        'snapshot', '{}'::jsonb, 'component_manifest', '[]'::jsonb
      )
    );
    RAISE EXCEPTION 'changed authoritative Goal unexpectedly accepted stale goal revision';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_goals g
     WHERE g.user_id = v.account_a AND g.goal_revision = v.goal_revision_a
  ) THEN RAISE EXCEPTION 'stale Goal case did not roll back its temporary Goal change'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.adaptive_nutrition_operations o
     WHERE o.user_id = v.account_a AND o.idempotency_key LIKE 'behavioral/stale-%'
  ) THEN RAISE EXCEPTION 'stale revision attempt left an operation fragment'; END IF;

  BEGIN
    PERFORM potok_nutrition.commit_prevalidated_plan_transition_v1(
      v.account_a, v.selection_b, 'behavioral/foreign-selection',
      'adaptive-nutrition-v1', 'PLAN_REPLACED',
      pg_catalog.convert_to('{"fixture":"foreign"}', 'UTF8'),
      'sha256-v1', pg_catalog.decode(pg_catalog.repeat('16', 32), 'hex'),
      v.plan_b0, v.goal_revision_b, v.history_b0, v.diary_b0,
      pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(),
      '{"fixture":"goal-b"}'::jsonb, v_graph, 'fixture-v1',
      pg_catalog.decode(pg_catalog.repeat('17', 32), 'hex'),
      pg_catalog.jsonb_build_object(
        'event_id', pg_catalog.gen_random_uuid(), 'stream_id', pg_catalog.gen_random_uuid(),
        'kind', 'PLAN_REPLACED', 'local_date', v.week_anchor,
        'snapshot', '{}'::jsonb, 'component_manifest', '[]'::jsonb
      )
    );
    RAISE EXCEPTION 'foreign selection transition unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM potok_nutrition.commit_prevalidated_plan_transition_v1(
      v.account_a, v.selection_a, 'behavioral/injected-failure',
      'adaptive-nutrition-v1', 'PLAN_REPLACED',
      pg_catalog.convert_to('{"fixture":"injected-failure"}', 'UTF8'),
      'sha256-v1', pg_catalog.decode(pg_catalog.repeat('18', 32), 'hex'),
      v.plan_a1, v.goal_revision_a, v.history_a1, v.diary_a0,
      v_failure_plan, v_failure_history, '{"fixture":"goal-a"}'::jsonb,
      v_graph, 'fixture-v1', pg_catalog.decode(pg_catalog.repeat('19', 32), 'hex'),
      pg_catalog.jsonb_build_object(
        'event_id', 'not-a-uuid', 'stream_id', pg_catalog.gen_random_uuid(),
        'kind', 'PLAN_REPLACED', 'local_date', v.week_anchor,
        'snapshot', '{}'::jsonb, 'component_manifest', '[]'::jsonb
      )
    );
    RAISE EXCEPTION 'injected failure unexpectedly succeeded';
  EXCEPTION WHEN invalid_text_representation THEN NULL;
  END;
  IF EXISTS (
       SELECT 1 FROM public.adaptive_nutrition_operations o
        WHERE o.user_id = v.account_a AND o.idempotency_key = 'behavioral/injected-failure'
     ) OR EXISTS (
       SELECT 1 FROM public.adaptive_nutrition_graph_revisions g
        WHERE g.user_id = v.account_a AND g.plan_revision = v_failure_plan
     ) OR EXISTS (
       SELECT 1 FROM public.adaptive_nutrition_events e
        WHERE e.user_id = v.account_a AND e.snapshot ->> 'fixture' = 'injected-failure'
     ) OR NOT EXISTS (
       SELECT 1 FROM public.user_premium_plan_selections s
        WHERE s.user_id = v.account_a AND s.id = v.selection_a
          AND s.plan_revision = v.plan_a1 AND s.history_revision = v.history_a1
     ) THEN
    RAISE EXCEPTION 'injected failure left a partial receipt/graph/event/head change';
  END IF;
END
$atomic_transition_and_fail_closed_cases$;

-- Append one annotation and exactly one successor; a second successor must roll back.
DO $one_successor_case$
DECLARE
  v potok_adaptive_behavioral_config%ROWTYPE;
  v_annotation_result jsonb;
  v_retraction_result jsonb;
BEGIN
  SELECT * INTO STRICT v FROM potok_adaptive_behavioral_config;
  v_annotation_result := potok_nutrition.commit_prevalidated_plan_transition_v1(
    v.account_a, v.selection_a, 'behavioral/annotation-a',
    'adaptive-nutrition-v1', 'ANNOTATION',
    pg_catalog.convert_to('{"fixture":"annotation-a"}', 'UTF8'),
    'sha256-v1', pg_catalog.decode(pg_catalog.repeat('21', 32), 'hex'),
    v.plan_a1, v.goal_revision_a, v.history_a1, v.diary_a0,
    NULL, v.history_a2, NULL, NULL, NULL, NULL,
    pg_catalog.jsonb_build_object(
      'event_id', v.annotation_event_a, 'stream_id', v.annotation_stream_a,
      'kind', 'ANNOTATION', 'local_date', v.week_anchor,
      'slot_id', NULL, 'snapshot', '{"fixture":"annotation-a"}'::jsonb,
      'component_manifest', '[]'::jsonb, 'supersedes_event_id', NULL
    )
  );
  IF v_annotation_result ->> 'history_revision' <> v.history_a2::text THEN
    RAISE EXCEPTION 'annotation did not advance history revision';
  END IF;

  v_retraction_result := potok_nutrition.commit_prevalidated_plan_transition_v1(
    v.account_a, v.selection_a, 'behavioral/retraction-a',
    'adaptive-nutrition-v1', 'ANNOTATION_RETRACTION',
    pg_catalog.convert_to('{"fixture":"retraction-a"}', 'UTF8'),
    'sha256-v1', pg_catalog.decode(pg_catalog.repeat('22', 32), 'hex'),
    v.plan_a1, v.goal_revision_a, v.history_a2, v.diary_a0,
    NULL, v.history_a3, NULL, NULL, NULL, NULL,
    pg_catalog.jsonb_build_object(
      'event_id', v.retraction_event_a, 'stream_id', v.annotation_stream_a,
      'kind', 'ANNOTATION_RETRACTION', 'local_date', v.week_anchor,
      'slot_id', NULL, 'snapshot', '{"fixture":"retraction-a"}'::jsonb,
      'component_manifest', '[]'::jsonb,
      'supersedes_event_id', v.annotation_event_a
    )
  );
  IF v_retraction_result ->> 'history_revision' <> v.history_a3::text THEN
    RAISE EXCEPTION 'retraction did not advance history revision';
  END IF;

  BEGIN
    PERFORM potok_nutrition.commit_prevalidated_plan_transition_v1(
      v.account_a, v.selection_a, 'behavioral/retraction-fork',
      'adaptive-nutrition-v1', 'ANNOTATION_RETRACTION',
      pg_catalog.convert_to('{"fixture":"retraction-fork"}', 'UTF8'),
      'sha256-v1', pg_catalog.decode(pg_catalog.repeat('23', 32), 'hex'),
      v.plan_a1, v.goal_revision_a, v.history_a3, v.diary_a0,
      NULL, pg_catalog.gen_random_uuid(), NULL, NULL, NULL, NULL,
      pg_catalog.jsonb_build_object(
        'event_id', pg_catalog.gen_random_uuid(), 'stream_id', v.annotation_stream_a,
        'kind', 'ANNOTATION_RETRACTION', 'local_date', v.week_anchor,
        'slot_id', NULL, 'snapshot', '{}'::jsonb,
        'component_manifest', '[]'::jsonb,
        'supersedes_event_id', v.annotation_event_a
      )
    );
    RAISE EXCEPTION 'second successor unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  IF (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e
       WHERE e.user_id = v.account_a AND e.supersedes_event_id = v.annotation_event_a) <> 1
     OR EXISTS (
       SELECT 1 FROM public.adaptive_nutrition_operations o
        WHERE o.user_id = v.account_a AND o.idempotency_key = 'behavioral/retraction-fork'
     ) OR NOT EXISTS (
       SELECT 1 FROM public.user_premium_plan_selections s
        WHERE s.user_id = v.account_a AND s.id = v.selection_a
          AND s.history_revision = v.history_a3
     ) THEN
    RAISE EXCEPTION 'one-successor failure left a fork or partial operation';
  END IF;
END
$one_successor_case$;

DO $append_only_guards$
DECLARE
  v potok_adaptive_behavioral_config%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v FROM potok_adaptive_behavioral_config;
  BEGIN
    UPDATE public.adaptive_nutrition_graph_revisions SET goal_snapshot = goal_snapshot
     WHERE user_id = v.account_a AND plan_revision = v.plan_a1;
    RAISE EXCEPTION 'graph UPDATE unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
  BEGIN
    DELETE FROM public.adaptive_nutrition_graph_revisions
     WHERE user_id = v.account_a AND plan_revision = v.plan_a1;
    RAISE EXCEPTION 'graph DELETE unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
  BEGIN
    UPDATE public.adaptive_nutrition_events SET snapshot = snapshot
     WHERE user_id = v.account_a AND event_id = v.transition_event_a;
    RAISE EXCEPTION 'event UPDATE unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
  BEGIN
    DELETE FROM public.adaptive_nutrition_events
     WHERE user_id = v.account_a AND event_id = v.transition_event_a;
    RAISE EXCEPTION 'event DELETE unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
  BEGIN
    UPDATE public.adaptive_nutrition_operations SET reason = reason
     WHERE user_id = v.account_a AND operation_id = v.transition_operation_a;
    RAISE EXCEPTION 'settled operation UPDATE unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
  BEGIN
    DELETE FROM public.adaptive_nutrition_operations
     WHERE user_id = v.account_a AND operation_id = v.transition_operation_a;
    RAISE EXCEPTION 'operation DELETE unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
  BEGIN
    EXECUTE 'TRUNCATE public.adaptive_nutrition_events CASCADE';
    RAISE EXCEPTION 'event TRUNCATE unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
  BEGIN
    EXECUTE 'TRUNCATE public.adaptive_nutrition_graph_revisions CASCADE';
    RAISE EXCEPTION 'graph TRUNCATE unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
  BEGIN
    EXECUTE 'TRUNCATE public.adaptive_nutrition_operations CASCADE';
    RAISE EXCEPTION 'operation TRUNCATE unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
END
$append_only_guards$;

-- Foreign public read/lookup returns no identifiers from account A.
SELECT pg_catalog.set_config('request.jwt.claim.sub', account_b::text, true)
  FROM potok_adaptive_behavioral_config;
DO $foreign_read_case$
DECLARE
  v potok_adaptive_behavioral_config%ROWTYPE;
  v_lookup jsonb;
  v_read jsonb;
BEGIN
  SELECT * INTO STRICT v FROM potok_adaptive_behavioral_config;
  v_lookup := public.adaptive_nutrition_lookup_v1('behavioral/transition-a1');
  v_read := public.adaptive_nutrition_read_v1(v.selection_a, v.transition_operation_a);
  IF v_lookup ->> 'kind' <> 'unknown' OR v_read ->> 'kind' <> 'denied'
     OR v_lookup ? 'operation_id' OR v_read ? 'selection_id' THEN
    RAISE EXCEPTION 'foreign lookup/read leaked account A state';
  END IF;
END
$foreign_read_case$;

-- Revoke account A. New paid effects fail; original replay/lookup/exact read survive.
UPDATE potok_adaptive_behavioral_config c
   SET premium_revoke_a = potok_control.revoke_entitlement_v2(
     c.account_a, 'premium', 'behavioral-acceptance/revoke-a',
     'rollback-only replay-after-entitlement-loss case'
   );

DO $replay_after_entitlement_loss$
DECLARE
  v potok_adaptive_behavioral_config%ROWTYPE;
  v_graph jsonb;
  v_event jsonb;
  v_original jsonb;
  v_replay jsonb;
BEGIN
  SELECT * INTO STRICT v FROM potok_adaptive_behavioral_config;
  v_graph := pg_catalog.jsonb_build_object('days', pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('date', '2026-09-21', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-22', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-23', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-24', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-25', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-26', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-27', 'slots', '[]'::jsonb)
  ));
  v_event := pg_catalog.jsonb_build_object(
    'event_id', v.transition_event_a, 'stream_id', v.transition_stream_a,
    'kind', 'PLAN_REPLACED', 'local_date', v.week_anchor,
    'slot_id', NULL, 'snapshot', pg_catalog.jsonb_build_object('fixture', 'replacement-a1'),
    'component_manifest', '[]'::jsonb, 'supersedes_event_id', NULL
  );
  SELECT o.result_references INTO STRICT v_original
    FROM public.adaptive_nutrition_operations o
   WHERE o.user_id = v.account_a AND o.idempotency_key = 'behavioral/transition-a1';
  v_replay := potok_nutrition.commit_prevalidated_plan_transition_v1(
    v.account_a, v.selection_a, 'behavioral/transition-a1',
    'adaptive-nutrition-v1', 'PLAN_REPLACED',
    pg_catalog.convert_to('{"fixture":"transition-a1"}', 'UTF8'),
    'sha256-v1', pg_catalog.decode(pg_catalog.repeat('11', 32), 'hex'),
    v.plan_a0, v.goal_revision_a, v.history_a0, v.diary_a0,
    v.plan_a1, v.history_a1, '{"fixture":"goal-a"}'::jsonb,
    v_graph, 'fixture-v1', pg_catalog.decode(pg_catalog.repeat('12', 32), 'hex'), v_event
  );
  IF v_replay IS DISTINCT FROM v_original THEN
    RAISE EXCEPTION 'original accepted outcome was not replayed after entitlement loss';
  END IF;
  BEGIN
    PERFORM potok_nutrition.commit_prevalidated_plan_transition_v1(
      v.account_a, v.selection_a, 'behavioral/new-after-revoke',
      'adaptive-nutrition-v1', 'ANNOTATION',
      pg_catalog.convert_to('{"fixture":"new-after-revoke"}', 'UTF8'),
      'sha256-v1', pg_catalog.decode(pg_catalog.repeat('24', 32), 'hex'),
      v.plan_a1, v.goal_revision_a, v.history_a3, v.diary_a0,
      NULL, pg_catalog.gen_random_uuid(), NULL, NULL, NULL, NULL,
      pg_catalog.jsonb_build_object(
        'event_id', pg_catalog.gen_random_uuid(), 'stream_id', pg_catalog.gen_random_uuid(),
        'kind', 'ANNOTATION', 'local_date', v.week_anchor,
        'snapshot', '{}'::jsonb, 'component_manifest', '[]'::jsonb
      )
    );
    RAISE EXCEPTION 'new paid effect succeeded after revoke';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$replay_after_entitlement_loss$;

-- Account B has an expired historical grant and settled operation fixture.
-- New paid effect is denied; exact replay and own lookup remain available.
DO $expired_entitlement_case$
DECLARE
  v potok_adaptive_behavioral_config%ROWTYPE;
  v_event jsonb;
  v_original jsonb;
  v_replay jsonb;
BEGIN
  SELECT * INTO STRICT v FROM potok_adaptive_behavioral_config;
  v_event := pg_catalog.jsonb_build_object(
    'event_id', v.expired_event_b, 'stream_id', v.expired_stream_b,
    'kind', 'ANNOTATION', 'local_date', v.week_anchor,
    'snapshot', '{"fixture":"historical-annotation"}'::jsonb,
    'component_manifest', '[]'::jsonb
  );
  SELECT o.result_references INTO STRICT v_original
    FROM public.adaptive_nutrition_operations o
   WHERE o.user_id = v.account_b AND o.idempotency_key = 'behavioral/expired-original';
  v_replay := potok_nutrition.commit_prevalidated_plan_transition_v1(
    v.account_b, v.selection_b, 'behavioral/expired-original',
    'adaptive-nutrition-v1', 'ANNOTATION',
    pg_catalog.convert_to('{"fixture":"expired-original"}', 'UTF8'),
    'sha256-v1', pg_catalog.decode(pg_catalog.repeat('02', 32), 'hex'),
    v.plan_b0, v.goal_revision_b, v.history_b0, v.diary_b0,
    NULL, v.history_b0, NULL, NULL, NULL, NULL, v_event
  );
  IF v_replay IS DISTINCT FROM v_original THEN
    RAISE EXCEPTION 'expired-account exact replay did not return original receipt';
  END IF;
  BEGIN
    PERFORM potok_nutrition.commit_prevalidated_plan_transition_v1(
      v.account_b, v.selection_b, 'behavioral/new-after-expiry',
      'adaptive-nutrition-v1', 'ANNOTATION',
      pg_catalog.convert_to('{"fixture":"new-after-expiry"}', 'UTF8'),
      'sha256-v1', pg_catalog.decode(pg_catalog.repeat('25', 32), 'hex'),
      v.plan_b0, v.goal_revision_b, v.history_b0, v.diary_b0,
      NULL, pg_catalog.gen_random_uuid(), NULL, NULL, NULL, NULL,
      pg_catalog.jsonb_build_object(
        'event_id', pg_catalog.gen_random_uuid(), 'stream_id', pg_catalog.gen_random_uuid(),
        'kind', 'ANNOTATION', 'local_date', v.week_anchor,
        'snapshot', '{}'::jsonb, 'component_manifest', '[]'::jsonb
      )
    );
    RAISE EXCEPTION 'new paid effect succeeded after entitlement expiry';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$expired_entitlement_case$;

-- Public lookup and exact read prove account binding and receipt revisions.
SELECT pg_catalog.set_config('request.jwt.claim.sub', account_a::text, true)
  FROM potok_adaptive_behavioral_config;
DO $lookup_and_exact_read$
DECLARE
  v potok_adaptive_behavioral_config%ROWTYPE;
  v_lookup jsonb;
  v_read jsonb;
BEGIN
  SELECT * INTO STRICT v FROM potok_adaptive_behavioral_config;
  v_lookup := public.adaptive_nutrition_lookup_v1('behavioral/transition-a1');
  v_read := public.adaptive_nutrition_read_v1(v.selection_a, v.transition_operation_a);
  IF v_lookup ->> 'kind' <> 'settled'
     OR (v_lookup ->> 'operation_id')::uuid <> v.transition_operation_a
     OR v_lookup ->> 'outcome' <> 'accepted' THEN
    RAISE EXCEPTION 'own settled lookup mismatch';
  END IF;
  IF v_read ->> 'kind' <> 'ready'
     OR (v_read ->> 'exact_operation_id')::uuid <> v.transition_operation_a
     OR (v_read ->> 'plan_revision')::uuid <> v.plan_a1
     OR (v_read ->> 'goal_revision')::uuid <> v.goal_revision_a
     OR (v_read ->> 'history_revision')::uuid <> v.history_a1
     OR (v_read ->> 'diary_revision')::uuid <> v.diary_a0
     OR (v_read -> 'graph' ->> 'plan_revision')::uuid <> v.plan_a1
     OR pg_catalog.jsonb_array_length(v_read -> 'events') <> 1
     OR (v_read -> 'events' -> 0 ->> 'event_id')::uuid <> v.transition_event_a THEN
    RAISE EXCEPTION 'exact read is not bound to original receipt revisions';
  END IF;
  IF public.adaptive_nutrition_read_v1(v.selection_a, NULL) ->> 'kind' <> 'denied' THEN
    RAISE EXCEPTION 'current paid read remained available after revoke';
  END IF;
END
$lookup_and_exact_read$;

SELECT pg_catalog.set_config('request.jwt.claim.sub', account_b::text, true)
  FROM potok_adaptive_behavioral_config;
DO $expired_lookup$
DECLARE
  v_lookup jsonb;
BEGIN
  v_lookup := public.adaptive_nutrition_lookup_v1('behavioral/expired-original');
  IF v_lookup ->> 'kind' <> 'settled' OR v_lookup ->> 'outcome' <> 'accepted' THEN
    RAISE EXCEPTION 'expired account cannot look up its original settled operation';
  END IF;
END
$expired_lookup$;

-- ROLLBACK would otherwise skip commit-time checks for initially deferred FKs.
SET CONSTRAINTS ALL IMMEDIATE;

-- In-transaction completeness: all attempted failures left no rows or head changes.
DO $final_in_transaction_assertions$
DECLARE
  v potok_adaptive_behavioral_config%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v FROM potok_adaptive_behavioral_config;
  IF EXISTS (
    SELECT 1 FROM public.adaptive_nutrition_operations o
     WHERE o.idempotency_key IN (
       'behavioral/injected-failure', 'behavioral/foreign-selection',
       'behavioral/retraction-fork', 'behavioral/new-after-revoke',
       'behavioral/new-after-expiry'
     ) OR o.idempotency_key LIKE 'behavioral/stale-%'
  ) THEN RAISE EXCEPTION 'a rejected attempt left an operation row'; END IF;
  IF EXISTS (SELECT 1 FROM public.food_diary_entries d
              WHERE d.user_id IN (v.account_a, v.account_b)) THEN
    RAISE EXCEPTION 'behavioral acceptance wrote diary/FACT rows';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_premium_plan_selections s
     WHERE s.user_id = v.account_a AND s.id = v.selection_a
       AND s.plan_revision = v.plan_a1 AND s.goal_revision = v.goal_revision_a
       AND s.history_revision = v.history_a3 AND s.diary_revision = v.diary_a0
  ) THEN RAISE EXCEPTION 'final account A head mismatch'; END IF;
END
$final_in_transaction_assertions$;

-- Do not append statements after this line. Owner performs the existing read-only
-- post-check separately and must again observe operations=0, graph_revisions=0,
-- events=0 and no fixture profiles/goals/selections/attestations for accounts A/B.
ROLLBACK;
