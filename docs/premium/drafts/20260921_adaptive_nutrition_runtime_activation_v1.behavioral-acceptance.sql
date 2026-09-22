-- POTOK Adaptive Nutrition runtime activation v1 — BEHAVIORAL STAGING ACCEPTANCE.
-- RUNNABLE REVIEW DRAFT, NOT EXECUTED. Target: STAGING ozidryfvhkcbtpnulakq only.
-- Requires a postgres owner SQL session and separate owner authorization.
-- Synthetic fixtures only; every write is inside this transaction and the final
-- executable statement is ROLLBACK. No FACT writer, canonical catalog access,
-- service_role shortcut, production access or runtime/UI deployment.

BEGIN;

CREATE TEMP TABLE potok_runtime_acceptance_config (
  account_a uuid PRIMARY KEY,
  account_b uuid UNIQUE NOT NULL,
  week_anchor date NOT NULL,
  selection_a uuid UNIQUE NOT NULL,
  selection_b uuid UNIQUE NOT NULL,
  goal_revision_a uuid NULL,
  goal_revision_b uuid NULL,
  plan_a0 uuid UNIQUE NOT NULL,
  plan_a1 uuid UNIQUE NOT NULL,
  plan_b0 uuid UNIQUE NOT NULL,
  history_a0 uuid UNIQUE NOT NULL,
  history_a_after_undo uuid NULL,
  history_a_after_replace uuid UNIQUE NOT NULL,
  history_b0 uuid UNIQUE NOT NULL,
  diary_a0 uuid UNIQUE NOT NULL,
  diary_b0 uuid UNIQUE NOT NULL,
  slot_a1 uuid UNIQUE NOT NULL,
  slot_a2 uuid UNIQUE NOT NULL,
  slot_b1 uuid UNIQUE NOT NULL,
  snapshot_a1 uuid UNIQUE NOT NULL,
  snapshot_a2 uuid UNIQUE NOT NULL,
  snapshot_b1 uuid UNIQUE NOT NULL,
  portion_a1 uuid UNIQUE NOT NULL,
  portion_a2 uuid UNIQUE NOT NULL,
  portion_b1 uuid UNIQUE NOT NULL,
  bootstrap_operation_a uuid UNIQUE NOT NULL,
  bootstrap_operation_b uuid UNIQUE NOT NULL,
  valid_offer_a uuid UNIQUE NOT NULL,
  expired_offer_a uuid UNIQUE NOT NULL,
  mismatched_offer_a uuid UNIQUE NOT NULL,
  foreign_offer_b uuid UNIQUE NOT NULL,
  expired_attestation_b uuid UNIQUE NOT NULL,
  skip_operation_a uuid NULL,
  skip_event_a uuid NULL,
  undo_operation_a uuid NULL,
  undo_event_a uuid NULL,
  replace_operation_a uuid NULL,
  replace_event_a uuid NULL,
  premium_grant_a uuid NULL,
  premium_revoke_a uuid NULL
) ON COMMIT DROP;

INSERT INTO potok_runtime_acceptance_config (
  account_a, account_b, week_anchor, selection_a, selection_b,
  plan_a0, plan_a1, plan_b0, history_a0, history_a_after_replace, history_b0,
  diary_a0, diary_b0, slot_a1, slot_a2, slot_b1,
  snapshot_a1, snapshot_a2, snapshot_b1, portion_a1, portion_a2, portion_b1,
  bootstrap_operation_a, bootstrap_operation_b,
  valid_offer_a, expired_offer_a, mismatched_offer_a, foreign_offer_b,
  expired_attestation_b
) VALUES (
  'd6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid,
  '8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid,
  '2026-09-21'::date,
  '71000000-0000-4000-8000-000000000001'::uuid,
  '71000000-0000-4000-8000-000000000002'::uuid,
  '71000000-0000-4000-8000-000000000011'::uuid,
  '71000000-0000-4000-8000-000000000012'::uuid,
  '71000000-0000-4000-8000-000000000013'::uuid,
  '71000000-0000-4000-8000-000000000021'::uuid,
  '71000000-0000-4000-8000-000000000061'::uuid,
  '71000000-0000-4000-8000-000000000023'::uuid,
  '71000000-0000-4000-8000-000000000022'::uuid,
  '71000000-0000-4000-8000-000000000024'::uuid,
  '71000000-0000-4000-8000-000000000031'::uuid,
  '71000000-0000-4000-8000-000000000032'::uuid,
  '71000000-0000-4000-8000-000000000035'::uuid,
  '71000000-0000-4000-8000-000000000033'::uuid,
  '71000000-0000-4000-8000-000000000036'::uuid,
  '71000000-0000-4000-8000-000000000038'::uuid,
  '71000000-0000-4000-8000-000000000034'::uuid,
  '71000000-0000-4000-8000-000000000037'::uuid,
  '71000000-0000-4000-8000-000000000039'::uuid,
  '71000000-0000-4000-8000-000000000041'::uuid,
  '71000000-0000-4000-8000-000000000042'::uuid,
  '71000000-0000-4000-8000-000000000051'::uuid,
  '71000000-0000-4000-8000-000000000052'::uuid,
  '71000000-0000-4000-8000-000000000053'::uuid,
  '71000000-0000-4000-8000-000000000054'::uuid,
  '71000000-0000-4000-8000-000000000071'::uuid
);

DO $preflight$
DECLARE
  v potok_runtime_acceptance_config%ROWTYPE;
  v_auth_count bigint;
  v_digest text;
  v_golden jsonb := '{
    "contract":"adaptive-nutrition-v1-proposed",
    "expected":{
      "accountId":"d6eb4e97-90d0-470f-bc4a-2f3e401e1fde",
      "planId":"71000000-0000-4000-8000-000000000001",
      "planRevision":"71000000-0000-4000-8000-000000000011",
      "goalRevision":"71000000-0000-4000-8000-000000000099",
      "historyRevision":"71000000-0000-4000-8000-000000000021",
      "diaryRevision":"71000000-0000-4000-8000-000000000022",
      "weekAnchor":"2026-09-21",
      "timeZone":"Europe/Moscow"
    },
    "idempotencyKey":"72000000-0000-4000-8000-000000000001",
    "explicitConfirmation":true,
    "action":{
      "type":"SKIPPED",
      "slot":{
        "slotId":"71000000-0000-4000-8000-000000000031",
        "date":"2026-09-21",
        "snapshot":{
          "snapshotRevision":"71000000-0000-4000-8000-000000000033",
          "recipeRevision":null,
          "portionRevision":"71000000-0000-4000-8000-000000000034"
        }
      }
    }
  }'::jsonb;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'postgres owner SQL session required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO STRICT v FROM potok_runtime_acceptance_config;

  SELECT pg_catalog.count(*) INTO v_auth_count
    FROM auth.users u WHERE u.id IN (v.account_a, v.account_b);
  IF v_auth_count <> 2 THEN
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
     OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_events)
     OR EXISTS (SELECT 1 FROM potok_nutrition.validated_plan_replacement_offers_v1) THEN
    RAISE EXCEPTION 'runtime tables must match the confirmed clean baseline';
  END IF;

  IF pg_catalog.to_regprocedure('public.adaptive_nutrition_mutate_v1(text)') IS NULL
     OR pg_catalog.to_regprocedure('public.adaptive_nutrition_lookup_v1(text)') IS NULL
     OR pg_catalog.to_regprocedure('public.adaptive_nutrition_read_v1(uuid,uuid)') IS NULL
     OR pg_catalog.to_regprocedure(
       'potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb)'
     ) IS NULL
     OR pg_catalog.to_regprocedure(
       'potok_control.grant_entitlement_v2(uuid,text,timestamp with time zone,text,text)'
     ) IS NULL
     OR pg_catalog.to_regprocedure('potok_control.revoke_entitlement_v2(uuid,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'applied entitlement, persistence and runtime activation v1 are required';
  END IF;
  IF (SELECT p.pronargs FROM pg_catalog.pg_proc p
       WHERE p.oid = 'public.adaptive_nutrition_mutate_v1(text)'::regprocedure) <> 1 THEN
    RAISE EXCEPTION 'mutation RPC must expose raw request text only';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.adaptive_nutrition_mutate_v1(text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.adaptive_nutrition_lookup_v1(text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.adaptive_nutrition_read_v1(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.adaptive_nutrition_mutate_v1(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.adaptive_nutrition_lookup_v1(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.adaptive_nutrition_read_v1(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.adaptive_nutrition_mutate_v1(text)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.adaptive_nutrition_lookup_v1(text)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.adaptive_nutrition_read_v1(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'runtime EXECUTE grant boundary drift';
  END IF;
  IF has_table_privilege('authenticated', 'potok_nutrition.validated_plan_replacement_offers_v1', 'SELECT')
     OR has_table_privilege('authenticated', 'potok_nutrition.validated_plan_replacement_offers_v1', 'INSERT')
     OR has_table_privilege('authenticated', 'potok_nutrition.validated_plan_replacement_offers_v1', 'UPDATE')
     OR has_table_privilege('authenticated', 'potok_nutrition.validated_plan_replacement_offers_v1', 'DELETE')
     OR has_table_privilege('authenticated', 'potok_nutrition.validated_plan_replacement_offers_v1', 'TRUNCATE')
     OR has_table_privilege('anon', 'potok_nutrition.validated_plan_replacement_offers_v1', 'SELECT')
     OR has_table_privilege('anon', 'potok_nutrition.validated_plan_replacement_offers_v1', 'INSERT')
     OR has_table_privilege('anon', 'potok_nutrition.validated_plan_replacement_offers_v1', 'UPDATE')
     OR has_table_privilege('anon', 'potok_nutrition.validated_plan_replacement_offers_v1', 'DELETE')
     OR has_table_privilege('anon', 'potok_nutrition.validated_plan_replacement_offers_v1', 'TRUNCATE')
     OR has_table_privilege('service_role', 'potok_nutrition.validated_plan_replacement_offers_v1', 'SELECT')
     OR has_table_privilege('service_role', 'potok_nutrition.validated_plan_replacement_offers_v1', 'INSERT')
     OR has_table_privilege('service_role', 'potok_nutrition.validated_plan_replacement_offers_v1', 'UPDATE')
     OR has_table_privilege('service_role', 'potok_nutrition.validated_plan_replacement_offers_v1', 'DELETE')
     OR has_table_privilege('service_role', 'potok_nutrition.validated_plan_replacement_offers_v1', 'TRUNCATE') THEN
    RAISE EXCEPTION 'replacement offers must remain private';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'potok_nutrition'
       AND c.relname = 'validated_plan_replacement_offers_v1'
       AND c.relrowsecurity AND c.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'replacement offer RLS/FORCE RLS required';
  END IF;

  v_digest := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    '{"encoding":"potok-adaptive-nutrition-canonical-json-v1","payload":'
    || potok_nutrition.canonical_jsonb_text_v1(v_golden)
    || ',"protocol":"adaptive-nutrition-v1-proposed"}', 'UTF8'), 'sha256'), 'hex');
  IF v_digest <> 'a73879f843886b83d42fadc387533b402adbed6976be84c8e16e607a66eeba38' THEN
    RAISE EXCEPTION 'deployed server canonical digest differs from local TS golden vector';
  END IF;
END
$preflight$;

-- Minimal synthetic profiles and Goals. No names, contacts, food or diary data.
INSERT INTO public.user_profiles (user_id)
SELECT account_a FROM potok_runtime_acceptance_config
UNION ALL
SELECT account_b FROM potok_runtime_acceptance_config;

INSERT INTO public.user_goals (user_id, calories, protein, fat, carbs, goal_type)
SELECT account_a, 2000, 100.00, 70.00, 250.00, 'runtime_acceptance_fixture'
  FROM potok_runtime_acceptance_config
UNION ALL
SELECT account_b, 2000, 100.00, 70.00, 250.00, 'runtime_acceptance_fixture'
  FROM potok_runtime_acceptance_config;

UPDATE potok_runtime_acceptance_config c
   SET goal_revision_a = ga.goal_revision,
       goal_revision_b = gb.goal_revision
  FROM public.user_goals ga, public.user_goals gb
 WHERE ga.user_id = c.account_a AND gb.user_id = c.account_b;

DO $owner_bootstrap$
DECLARE
  v potok_runtime_acceptance_config%ROWTYPE;
  v_graph_a jsonb;
  v_graph_b jsonb;
  v_expired_issued timestamptz := pg_catalog.statement_timestamp() - interval '3 days';
  v_expired_until timestamptz := pg_catalog.statement_timestamp() - interval '1 day';
BEGIN
  SELECT * INTO STRICT v FROM potok_runtime_acceptance_config;
  v_graph_a := pg_catalog.jsonb_build_object('days', pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('date', '2026-09-21', 'slots', pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('slotId', v.slot_a1, 'snapshot', pg_catalog.jsonb_build_object(
        'snapshotRevision', v.snapshot_a1, 'recipeRevision', NULL,
        'portionRevision', v.portion_a1)),
      pg_catalog.jsonb_build_object('slotId', v.slot_a2, 'snapshot', pg_catalog.jsonb_build_object(
        'snapshotRevision', v.snapshot_a2, 'recipeRevision', NULL,
        'portionRevision', v.portion_a2))
    )),
    pg_catalog.jsonb_build_object('date', '2026-09-22', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-23', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-24', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-25', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-26', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-27', 'slots', '[]'::jsonb)
  ));
  v_graph_b := pg_catalog.jsonb_build_object('days', pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('date', '2026-09-21', 'slots', pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('slotId', v.slot_b1, 'snapshot', pg_catalog.jsonb_build_object(
        'snapshotRevision', v.snapshot_b1, 'recipeRevision', NULL,
        'portionRevision', v.portion_b1))
    )),
    pg_catalog.jsonb_build_object('date', '2026-09-22', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-23', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-24', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-25', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-26', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-27', 'slots', '[]'::jsonb)
  ));

  INSERT INTO public.user_premium_plan_selections (
    id, user_id, user_goal_id, premium_plan_id, status, start_date,
    contract_version, week_anchor, timezone, plan_revision, goal_revision,
    history_revision, diary_revision, origin_kind, origin_lineage
  ) VALUES
  (v.selection_a, v.account_a, v.account_a, NULL, 'active', v.week_anchor,
   1, v.week_anchor, 'Europe/Moscow', v.plan_a0, v.goal_revision_a,
   v.history_a0, v.diary_a0, 'generated',
   '{"source":"runtime-acceptance-v1","generator_version":"fixture-only"}'::jsonb),
  (v.selection_b, v.account_b, v.account_b, NULL, 'active', v.week_anchor,
   1, v.week_anchor, 'Europe/Moscow', v.plan_b0, v.goal_revision_b,
   v.history_b0, v.diary_b0, 'generated',
   '{"source":"runtime-acceptance-v1","generator_version":"fixture-only"}'::jsonb);

  INSERT INTO public.adaptive_nutrition_operations (
    user_id, idempotency_key, operation_id, selection_id, contract_version,
    action_type, canonical_request, digest_version, request_digest,
    outcome, result_references, committed_at
  ) VALUES
  (v.account_a, 'runtime-acceptance/bootstrap-a', v.bootstrap_operation_a, v.selection_a,
   'adaptive-nutrition-v1', 'FIXTURE_BOOTSTRAP',
   pg_catalog.convert_to('{"fixture":"runtime-bootstrap-a"}', 'UTF8'),
   'fixture-only', pg_catalog.decode(pg_catalog.repeat('01', 32), 'hex'), 'accepted',
   pg_catalog.jsonb_build_object(
     'contract', 'adaptive-nutrition-receipt-v1', 'outcome', 'accepted',
     'operation_id', v.bootstrap_operation_a, 'selection_id', v.selection_a,
     'plan_revision', v.plan_a0, 'goal_revision', v.goal_revision_a,
     'history_revision', v.history_a0, 'diary_revision', v.diary_a0,
     'event_ids', '[]'::jsonb), pg_catalog.statement_timestamp()),
  (v.account_b, 'runtime-acceptance/bootstrap-b', v.bootstrap_operation_b, v.selection_b,
   'adaptive-nutrition-v1', 'FIXTURE_BOOTSTRAP',
   pg_catalog.convert_to('{"fixture":"runtime-bootstrap-b"}', 'UTF8'),
   'fixture-only', pg_catalog.decode(pg_catalog.repeat('02', 32), 'hex'), 'accepted',
   pg_catalog.jsonb_build_object(
     'contract', 'adaptive-nutrition-receipt-v1', 'outcome', 'accepted',
     'operation_id', v.bootstrap_operation_b, 'selection_id', v.selection_b,
     'plan_revision', v.plan_b0, 'goal_revision', v.goal_revision_b,
     'history_revision', v.history_b0, 'diary_revision', v.diary_b0,
     'event_ids', '[]'::jsonb), pg_catalog.statement_timestamp());

  INSERT INTO public.adaptive_nutrition_graph_revisions (
    user_id, selection_id, plan_revision, goal_revision, goal_snapshot,
    graph_snapshot, snapshot_encoding_version, content_digest,
    created_by_operation_id
  ) VALUES
  (v.account_a, v.selection_a, v.plan_a0, v.goal_revision_a,
   '{"fixture":"goal-a"}'::jsonb, v_graph_a, 'runtime-fixture-v1',
   extensions.digest(pg_catalog.convert_to(v_graph_a::text, 'UTF8'), 'sha256'),
   v.bootstrap_operation_a),
  (v.account_b, v.selection_b, v.plan_b0, v.goal_revision_b,
   '{"fixture":"goal-b"}'::jsonb, v_graph_b, 'runtime-fixture-v1',
   extensions.digest(pg_catalog.convert_to(v_graph_b::text, 'UTF8'), 'sha256'),
   v.bootstrap_operation_b);

  INSERT INTO potok_control.access_attestations (
    attestation_id, account_id, capability, effect, previous_attestation_id,
    lineage_sequence, issued_at, valid_until, operator_db_role, evidence_ref, reason
  ) VALUES (
    v.expired_attestation_b, v.account_b, 'premium', 'GRANT', NULL,
    1, v_expired_issued, v_expired_until, SESSION_USER::name,
    'runtime-acceptance/expired-b', 'rollback-only historical expiry fixture'
  );
  UPDATE public.user_profiles
     SET has_premium = true,
         premium_provenance_id = v.expired_attestation_b,
         premium_valid_until = v_expired_until
   WHERE user_id = v.account_b;
END
$owner_bootstrap$;

UPDATE potok_runtime_acceptance_config c
   SET premium_grant_a = potok_control.grant_entitlement_v2(
     c.account_a, 'premium', pg_catalog.statement_timestamp() + interval '1 day',
     'runtime-acceptance/grant-a', 'rollback-only runtime acceptance grant'
   );

SELECT pg_catalog.set_config('potok.runtime.goal_a', goal_revision_a::text, true),
       pg_catalog.set_config('potok.runtime.goal_b', goal_revision_b::text, true)
  FROM potok_runtime_acceptance_config;

-- JWT actor A: strict raw boundary, own/foreign read, SKIPPED/replay/CAS/undo.
SELECT pg_catalog.set_config('request.jwt.claim.sub', account_a::text, true)
  FROM potok_runtime_acceptance_config;
SET LOCAL ROLE authenticated;

DO $authenticated_annotation_cases$
DECLARE
  v_account_a constant uuid := 'd6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid;
  v_account_b constant uuid := '8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid;
  v_selection_a constant uuid := '71000000-0000-4000-8000-000000000001'::uuid;
  v_selection_b constant uuid := '71000000-0000-4000-8000-000000000002'::uuid;
  v_plan_a0 constant uuid := '71000000-0000-4000-8000-000000000011'::uuid;
  v_history_a0 constant uuid := '71000000-0000-4000-8000-000000000021'::uuid;
  v_diary_a0 constant uuid := '71000000-0000-4000-8000-000000000022'::uuid;
  v_slot_a1 constant uuid := '71000000-0000-4000-8000-000000000031'::uuid;
  v_slot_a2 constant uuid := '71000000-0000-4000-8000-000000000032'::uuid;
  v_snapshot_a1 constant uuid := '71000000-0000-4000-8000-000000000033'::uuid;
  v_portion_a1 constant uuid := '71000000-0000-4000-8000-000000000034'::uuid;
  v_snapshot_a2 constant uuid := '71000000-0000-4000-8000-000000000036'::uuid;
  v_portion_a2 constant uuid := '71000000-0000-4000-8000-000000000037'::uuid;
  v_goal uuid;
  v_expected jsonb;
  v_current_expected jsonb;
  v_slot_1 jsonb;
  v_slot_2 jsonb;
  v_request jsonb;
  v_raw text;
  v_duplicate text;
  v_receipt jsonb;
  v_replay jsonb;
  v_lookup jsonb;
  v_read jsonb;
  v_undo jsonb;
  v_undo_receipt jsonb;
  v_skip_event uuid;
  v_case text;
  v_stale_request jsonb;
BEGIN
  v_goal := pg_catalog.current_setting('potok.runtime.goal_a')::uuid;
  v_expected := pg_catalog.jsonb_build_object(
    'accountId', v_account_a, 'planId', v_selection_a,
    'planRevision', v_plan_a0, 'goalRevision', v_goal,
    'historyRevision', v_history_a0, 'diaryRevision', v_diary_a0,
    'weekAnchor', '2026-09-21', 'timeZone', 'Europe/Moscow');
  v_slot_1 := pg_catalog.jsonb_build_object(
    'slotId', v_slot_a1, 'date', '2026-09-21',
    'snapshot', pg_catalog.jsonb_build_object(
      'snapshotRevision', v_snapshot_a1, 'recipeRevision', NULL,
      'portionRevision', v_portion_a1));
  v_slot_2 := pg_catalog.jsonb_build_object(
    'slotId', v_slot_a2, 'date', '2026-09-21',
    'snapshot', pg_catalog.jsonb_build_object(
      'snapshotRevision', v_snapshot_a2, 'recipeRevision', NULL,
      'portionRevision', v_portion_a2));
  v_request := pg_catalog.jsonb_build_object(
    'contract', 'adaptive-nutrition-v1-proposed', 'expected', v_expected,
    'idempotencyKey', '72000000-0000-4000-8000-000000000001',
    'explicitConfirmation', true,
    'action', pg_catalog.jsonb_build_object('type', 'SKIPPED', 'slot', v_slot_1));
  v_raw := v_request::text;

  v_duplicate := '{"contract":"adaptive-nutrition-v1-proposed","expected":'
    || v_expected::text
    || ',"idempotencyKey":"72000000-0000-4000-8000-000000000001"'
    || ',"\u0069dempotencyKey":"72000000-0000-4000-8000-000000000001"'
    || ',"explicitConfirmation":true,"action":'
    || (v_request -> 'action')::text || '}';
  BEGIN
    PERFORM public.adaptive_nutrition_mutate_v1(v_duplicate);
    RAISE EXCEPTION 'escaped duplicate raw key unexpectedly accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.adaptive_nutrition_mutate_v1(
      (v_request || '{"clientDigest":"forged"}'::jsonb)::text);
    RAISE EXCEPTION 'unknown client digest field unexpectedly accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.adaptive_nutrition_mutate_v1(pg_catalog.jsonb_set(
      v_request, '{expected,accountId}', pg_catalog.to_jsonb(v_account_b::text))::text);
    RAISE EXCEPTION 'client account override unexpectedly accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  FOR v_case IN SELECT * FROM pg_catalog.unnest(
    ARRAY['FACT','CONSUMED_AS_PLANNED','CONSUMED_MODIFIED','EXTRA_FOOD']
  ) LOOP
    BEGIN
      PERFORM public.adaptive_nutrition_mutate_v1(pg_catalog.jsonb_set(
        pg_catalog.jsonb_set(v_request, '{idempotencyKey}', pg_catalog.to_jsonb(
          CASE v_case
            WHEN 'FACT' THEN '72000000-0000-4000-8000-000000000081'
            WHEN 'CONSUMED_AS_PLANNED' THEN '72000000-0000-4000-8000-000000000082'
            WHEN 'CONSUMED_MODIFIED' THEN '72000000-0000-4000-8000-000000000083'
            ELSE '72000000-0000-4000-8000-000000000084' END)),
        '{action}', CASE v_case
          WHEN 'FACT' THEN pg_catalog.jsonb_build_object('type', 'FACT')
          WHEN 'CONSUMED_AS_PLANNED' THEN pg_catalog.jsonb_build_object(
            'type', v_case, 'slot', v_slot_1)
          WHEN 'CONSUMED_MODIFIED' THEN pg_catalog.jsonb_build_object(
            'type', v_case, 'slot', v_slot_1, 'actual', pg_catalog.jsonb_build_object(
              'items', pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
                'foodRef', '71000000-0000-4000-8000-000000000091',
                'amount', '1.00', 'unit', 'g', 'state', 'raw'))))
          ELSE pg_catalog.jsonb_build_object(
            'type', v_case, 'date', '2026-09-21', 'mealType', 'snack',
            'actual', pg_catalog.jsonb_build_object('items', pg_catalog.jsonb_build_array(
              pg_catalog.jsonb_build_object(
                'foodRef', '71000000-0000-4000-8000-000000000091',
                'amount', '1.00', 'unit', 'g', 'state', 'raw'))))
        END)::text);
      RAISE EXCEPTION '% unexpectedly reached a FACT/diary writer', v_case;
    EXCEPTION WHEN feature_not_supported THEN NULL;
    END;
  END LOOP;

  v_lookup := public.adaptive_nutrition_lookup_v1(
    '72000000-0000-4000-8000-000000000001');
  v_read := public.adaptive_nutrition_read_v1(v_selection_a, NULL);
  IF v_lookup ->> 'kind' <> 'unknown'
     OR v_read ->> 'kind' <> 'ready'
     OR v_read ->> 'selection_id' <> v_selection_a::text THEN
    RAISE EXCEPTION 'own lookup/current read admission failed';
  END IF;
  v_lookup := public.adaptive_nutrition_lookup_v1('runtime-acceptance/bootstrap-b');
  v_read := public.adaptive_nutrition_read_v1(v_selection_b, NULL);
  IF v_lookup ->> 'kind' <> 'unknown' OR v_read ->> 'kind' <> 'denied'
     OR v_lookup ? 'operation_id' OR v_read ? 'selection_id' THEN
    RAISE EXCEPTION 'foreign lookup/read leaked account B state';
  END IF;

  v_receipt := public.adaptive_nutrition_mutate_v1(v_raw);
  IF v_receipt ->> 'kind' <> 'settled' OR v_receipt ->> 'outcome' <> 'accepted'
     OR v_receipt ->> 'idempotency_key' <> '72000000-0000-4000-8000-000000000001'
     OR v_receipt ->> 'digest_version' <> 'potok-adaptive-nutrition-canonical-json-v1'
     OR NOT ((v_receipt ->> 'request_digest_hex') ~ '^[0-9a-f]{64}$') THEN
    RAISE EXCEPTION 'SKIPPED did not return a valid server receipt';
  END IF;
  v_skip_event := (v_receipt #>> '{result,event_ids,0}')::uuid;
  v_replay := public.adaptive_nutrition_mutate_v1(v_raw);
  IF v_replay IS DISTINCT FROM v_receipt THEN
    RAISE EXCEPTION 'exact replay did not return the original receipt';
  END IF;
  v_lookup := public.adaptive_nutrition_lookup_v1(
    '72000000-0000-4000-8000-000000000001');
  IF v_lookup IS DISTINCT FROM v_receipt THEN
    RAISE EXCEPTION 'own lookup did not return the original receipt';
  END IF;
  BEGIN
    PERFORM public.adaptive_nutrition_mutate_v1(pg_catalog.jsonb_set(
      v_request, '{expected,timeZone}', '"UTC"'::jsonb)::text);
    RAISE EXCEPTION 'same key with changed payload unexpectedly succeeded';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;

  v_current_expected := pg_catalog.jsonb_set(
    v_expected, '{historyRevision}',
    pg_catalog.to_jsonb(v_receipt #>> '{result,history_revision}'));
  FOR v_case IN SELECT * FROM pg_catalog.unnest(ARRAY['plan','goal','history','diary']) LOOP
    v_stale_request := pg_catalog.jsonb_set(
      pg_catalog.jsonb_set(v_request, '{expected}', v_current_expected),
      '{idempotencyKey}', pg_catalog.to_jsonb(CASE v_case
        WHEN 'plan' THEN '72000000-0000-4000-8000-000000000011'
        WHEN 'goal' THEN '72000000-0000-4000-8000-000000000012'
        WHEN 'history' THEN '72000000-0000-4000-8000-000000000013'
        ELSE '72000000-0000-4000-8000-000000000014' END));
    v_stale_request := pg_catalog.jsonb_set(v_stale_request, '{action}',
      pg_catalog.jsonb_build_object('type', 'SKIPPED', 'slot', v_slot_2));
    v_stale_request := pg_catalog.jsonb_set(v_stale_request,
      CASE v_case
        WHEN 'plan' THEN '{expected,planRevision}'::text[]
        WHEN 'goal' THEN '{expected,goalRevision}'::text[]
        WHEN 'history' THEN '{expected,historyRevision}'::text[]
        ELSE '{expected,diaryRevision}'::text[] END,
      pg_catalog.to_jsonb('71000000-0000-4000-8000-000000000098'::text));
    BEGIN
      PERFORM public.adaptive_nutrition_mutate_v1(v_stale_request::text);
      RAISE EXCEPTION 'stale % revision unexpectedly succeeded', v_case;
    EXCEPTION WHEN serialization_failure THEN NULL;
    END;
  END LOOP;

  v_undo := pg_catalog.jsonb_build_object(
    'contract', 'adaptive-nutrition-v1-proposed',
    'expected', pg_catalog.jsonb_set(v_expected, '{historyRevision}',
      pg_catalog.to_jsonb(v_receipt #>> '{result,history_revision}')),
    'idempotencyKey', '72000000-0000-4000-8000-000000000002',
    'explicitConfirmation', true,
    'action', pg_catalog.jsonb_build_object(
      'type', 'UNDO_ANNOTATION', 'targetEventId', v_skip_event));
  v_undo_receipt := public.adaptive_nutrition_mutate_v1(v_undo::text);
  IF v_undo_receipt ->> 'kind' <> 'settled'
     OR v_undo_receipt ->> 'outcome' <> 'accepted' THEN
    RAISE EXCEPTION 'annotation retraction was not accepted';
  END IF;
  BEGIN
    PERFORM public.adaptive_nutrition_mutate_v1(pg_catalog.jsonb_set(
      pg_catalog.jsonb_set(v_undo, '{idempotencyKey}',
        '"72000000-0000-4000-8000-000000000003"'::jsonb),
      '{expected,historyRevision}',
      pg_catalog.to_jsonb(v_undo_receipt #>> '{result,history_revision}'))::text);
    RAISE EXCEPTION 'second annotation successor unexpectedly succeeded';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;

  PERFORM pg_catalog.set_config('potok.runtime.skip_receipt', v_receipt::text, true);
  PERFORM pg_catalog.set_config('potok.runtime.undo_receipt', v_undo_receipt::text, true);
END
$authenticated_annotation_cases$;

RESET ROLE;

UPDATE potok_runtime_acceptance_config
   SET skip_operation_a = (pg_catalog.current_setting('potok.runtime.skip_receipt')::jsonb ->> 'operation_id')::uuid,
       skip_event_a = (pg_catalog.current_setting('potok.runtime.skip_receipt')::jsonb #>> '{result,event_ids,0}')::uuid,
       undo_operation_a = (pg_catalog.current_setting('potok.runtime.undo_receipt')::jsonb ->> 'operation_id')::uuid,
       undo_event_a = (pg_catalog.current_setting('potok.runtime.undo_receipt')::jsonb #>> '{result,event_ids,0}')::uuid,
       history_a_after_undo = (pg_catalog.current_setting('potok.runtime.undo_receipt')::jsonb #>> '{result,history_revision}')::uuid;

DO $owner_annotation_assertions_and_offers$
DECLARE
  v potok_runtime_acceptance_config%ROWTYPE;
  v_graph_new jsonb;
BEGIN
  SELECT * INTO STRICT v FROM potok_runtime_acceptance_config;
  IF (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e
       WHERE e.user_id = v.account_a AND e.kind = 'ANNOTATION'
         AND e.event_id = v.skip_event_a AND e.component_manifest = '[]'::jsonb) <> 1
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e
          WHERE e.user_id = v.account_a AND e.kind = 'ANNOTATION_RETRACTION'
            AND e.event_id = v.undo_event_a AND e.supersedes_event_id = v.skip_event_a
            AND e.component_manifest = '[]'::jsonb) <> 1
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e
          WHERE e.user_id = v.account_a AND e.supersedes_event_id = v.skip_event_a) <> 1
     OR EXISTS (SELECT 1 FROM public.food_diary_entries d
                 WHERE d.user_id IN (v.account_a, v.account_b)) THEN
    RAISE EXCEPTION 'annotation/retraction created wrong history or diary projection';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.adaptive_nutrition_operations o
     WHERE o.user_id = v.account_a
       AND o.idempotency_key IN (
         '72000000-0000-4000-8000-000000000003',
         '72000000-0000-4000-8000-000000000011',
         '72000000-0000-4000-8000-000000000012',
         '72000000-0000-4000-8000-000000000013',
         '72000000-0000-4000-8000-000000000014',
         '72000000-0000-4000-8000-000000000081',
         '72000000-0000-4000-8000-000000000082',
         '72000000-0000-4000-8000-000000000083',
         '72000000-0000-4000-8000-000000000084'
       )
  ) THEN
    RAISE EXCEPTION 'rejected action left an operation fragment';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.adaptive_nutrition_operations o
     WHERE o.user_id = v.account_a AND o.operation_id = v.skip_operation_a
       AND o.request_digest = extensions.digest(o.canonical_request, 'sha256')
       AND pg_catalog.encode(o.request_digest, 'hex') =
           (pg_catalog.current_setting('potok.runtime.skip_receipt')::jsonb ->> 'request_digest_hex')
  ) THEN
    RAISE EXCEPTION 'persisted request digest does not match canonical bytes/receipt';
  END IF;

  v_graph_new := pg_catalog.jsonb_build_object('days', pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('date', '2026-09-21', 'slots', pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('slotId', v.slot_a1, 'snapshot', pg_catalog.jsonb_build_object(
        'snapshotRevision', '71000000-0000-4000-8000-000000000063',
        'recipeRevision', NULL,
        'portionRevision', '71000000-0000-4000-8000-000000000064')),
      pg_catalog.jsonb_build_object('slotId', v.slot_a2, 'snapshot', pg_catalog.jsonb_build_object(
        'snapshotRevision', v.snapshot_a2, 'recipeRevision', NULL,
        'portionRevision', v.portion_a2))
    )),
    pg_catalog.jsonb_build_object('date', '2026-09-22', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-23', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-24', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-25', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-26', 'slots', '[]'::jsonb),
    pg_catalog.jsonb_build_object('date', '2026-09-27', 'slots', '[]'::jsonb)
  ));

  INSERT INTO potok_nutrition.validated_plan_replacement_offers_v1 (
    account_id, selection_id, offer_id,
    expected_plan_revision, expected_goal_revision,
    expected_history_revision, expected_diary_revision,
    local_date, slot_id, expected_snapshot_revision,
    expected_recipe_revision, expected_portion_revision,
    new_plan_revision, new_history_revision, goal_snapshot, graph_snapshot,
    snapshot_encoding_version, graph_digest, event_snapshot, expires_at
  ) VALUES
  (v.account_a, v.selection_a, v.valid_offer_a,
   v.plan_a0, v.goal_revision_a, v.history_a_after_undo, v.diary_a0,
   v.week_anchor, v.slot_a1, v.snapshot_a1, NULL, v.portion_a1,
   v.plan_a1, v.history_a_after_replace, '{"fixture":"goal-a"}'::jsonb, v_graph_new,
   'runtime-fixture-v1', extensions.digest(pg_catalog.convert_to(v_graph_new::text, 'UTF8'), 'sha256'),
   '{"fixture":"valid-private-offer"}'::jsonb,
   pg_catalog.statement_timestamp() + interval '1 day'),
  (v.account_a, v.selection_a, v.expired_offer_a,
   v.plan_a0, v.goal_revision_a, v.history_a_after_undo, v.diary_a0,
   v.week_anchor, v.slot_a1, v.snapshot_a1, NULL, v.portion_a1,
   '71000000-0000-4000-8000-000000000065'::uuid,
   '71000000-0000-4000-8000-000000000066'::uuid,
   '{"fixture":"goal-a"}'::jsonb, v_graph_new, 'runtime-fixture-v1',
   extensions.digest(pg_catalog.convert_to(v_graph_new::text, 'UTF8'), 'sha256'),
   '{"fixture":"expired-offer"}'::jsonb,
   pg_catalog.statement_timestamp() - interval '1 day'),
  (v.account_a, v.selection_a, v.mismatched_offer_a,
   v.plan_a0, v.goal_revision_a,
   '71000000-0000-4000-8000-000000000067'::uuid, v.diary_a0,
   v.week_anchor, v.slot_a1, v.snapshot_a1, NULL, v.portion_a1,
   '71000000-0000-4000-8000-000000000068'::uuid,
   '71000000-0000-4000-8000-000000000069'::uuid,
   '{"fixture":"goal-a"}'::jsonb, v_graph_new, 'runtime-fixture-v1',
   extensions.digest(pg_catalog.convert_to(v_graph_new::text, 'UTF8'), 'sha256'),
   '{"fixture":"mismatched-offer"}'::jsonb,
   pg_catalog.statement_timestamp() + interval '1 day'),
  (v.account_b, v.selection_b, v.foreign_offer_b,
   v.plan_b0, v.goal_revision_b, v.history_b0, v.diary_b0,
   v.week_anchor, v.slot_b1, v.snapshot_b1, NULL, v.portion_b1,
   '71000000-0000-4000-8000-000000000075'::uuid,
   '71000000-0000-4000-8000-000000000076'::uuid,
   '{"fixture":"goal-b"}'::jsonb, v_graph_new, 'runtime-fixture-v1',
   extensions.digest(pg_catalog.convert_to(v_graph_new::text, 'UTF8'), 'sha256'),
   '{"fixture":"foreign-offer"}'::jsonb,
   pg_catalog.statement_timestamp() + interval '1 day');
END
$owner_annotation_assertions_and_offers$;

-- JWT actor A: private-offer admission and accepted PLAN_REPLACED transition.
SELECT pg_catalog.set_config('request.jwt.claim.sub', account_a::text, true)
  FROM potok_runtime_acceptance_config;
SET LOCAL ROLE authenticated;

DO $authenticated_replace_cases$
DECLARE
  v_account constant uuid := 'd6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid;
  v_selection constant uuid := '71000000-0000-4000-8000-000000000001'::uuid;
  v_goal uuid;
  v_history uuid;
  v_expected jsonb;
  v_slot jsonb;
  v_request jsonb;
  v_receipt jsonb;
  v_replay jsonb;
  v_offer text;
  v_key text;
BEGIN
  v_goal := pg_catalog.current_setting('potok.runtime.goal_a')::uuid;
  v_history := (pg_catalog.current_setting('potok.runtime.undo_receipt')::jsonb
    #>> '{result,history_revision}')::uuid;
  v_expected := pg_catalog.jsonb_build_object(
    'accountId', v_account, 'planId', v_selection,
    'planRevision', '71000000-0000-4000-8000-000000000011',
    'goalRevision', v_goal, 'historyRevision', v_history,
    'diaryRevision', '71000000-0000-4000-8000-000000000022',
    'weekAnchor', '2026-09-21', 'timeZone', 'Europe/Moscow');
  v_slot := pg_catalog.jsonb_build_object(
    'slotId', '71000000-0000-4000-8000-000000000031',
    'date', '2026-09-21',
    'snapshot', pg_catalog.jsonb_build_object(
      'snapshotRevision', '71000000-0000-4000-8000-000000000033',
      'recipeRevision', NULL,
      'portionRevision', '71000000-0000-4000-8000-000000000034'));

  FOR v_offer, v_key IN VALUES
    ('71000000-0000-4000-8000-000000000052', '72000000-0000-4000-8000-000000000021'),
    ('71000000-0000-4000-8000-000000000053', '72000000-0000-4000-8000-000000000022'),
    ('71000000-0000-4000-8000-000000000054', '72000000-0000-4000-8000-000000000023'),
    ('71000000-0000-4000-8000-000000000055', '72000000-0000-4000-8000-000000000024')
  LOOP
    v_request := pg_catalog.jsonb_build_object(
      'contract', 'adaptive-nutrition-v1-proposed', 'expected', v_expected,
      'idempotencyKey', v_key, 'explicitConfirmation', true,
      'action', pg_catalog.jsonb_build_object(
        'type', 'REPLACE', 'slot', v_slot, 'replacementOfferId', v_offer));
    BEGIN
      PERFORM public.adaptive_nutrition_mutate_v1(v_request::text);
      RAISE EXCEPTION 'invalid replacement offer % unexpectedly accepted', v_offer;
    EXCEPTION WHEN serialization_failure THEN NULL;
    END;
  END LOOP;

  v_request := pg_catalog.jsonb_build_object(
    'contract', 'adaptive-nutrition-v1-proposed', 'expected', v_expected,
    'idempotencyKey', '72000000-0000-4000-8000-000000000004',
    'explicitConfirmation', true,
    'action', pg_catalog.jsonb_build_object(
      'type', 'REPLACE', 'slot', v_slot,
      'replacementOfferId', '71000000-0000-4000-8000-000000000051'));
  v_receipt := public.adaptive_nutrition_mutate_v1(v_request::text);
  IF v_receipt ->> 'kind' <> 'settled' OR v_receipt ->> 'outcome' <> 'accepted'
     OR v_receipt #>> '{result,plan_revision}' <> '71000000-0000-4000-8000-000000000012'
     OR v_receipt #>> '{result,history_revision}' <> '71000000-0000-4000-8000-000000000061'
     OR v_receipt #>> '{result,diary_revision}' <> '71000000-0000-4000-8000-000000000022' THEN
    RAISE EXCEPTION 'valid private replacement offer did not commit expected revisions';
  END IF;
  v_replay := public.adaptive_nutrition_mutate_v1(v_request::text);
  IF v_replay IS DISTINCT FROM v_receipt THEN
    RAISE EXCEPTION 'PLAN_REPLACED exact replay changed its receipt';
  END IF;
  IF public.adaptive_nutrition_lookup_v1(
       '72000000-0000-4000-8000-000000000004') IS DISTINCT FROM v_receipt THEN
    RAISE EXCEPTION 'PLAN_REPLACED lookup did not return original receipt';
  END IF;
  IF public.adaptive_nutrition_read_v1(v_selection, NULL) ->> 'plan_revision'
       <> '71000000-0000-4000-8000-000000000012'
     OR public.adaptive_nutrition_read_v1(
       v_selection, (v_receipt ->> 'operation_id')::uuid) ->> 'exact_operation_id'
       <> (v_receipt ->> 'operation_id') THEN
    RAISE EXCEPTION 'current/exact read did not bind replacement receipt revisions';
  END IF;
  PERFORM pg_catalog.set_config('potok.runtime.replace_request', v_request::text, true);
  PERFORM pg_catalog.set_config('potok.runtime.replace_receipt', v_receipt::text, true);
END
$authenticated_replace_cases$;

RESET ROLE;

UPDATE potok_runtime_acceptance_config
   SET replace_operation_a = (pg_catalog.current_setting('potok.runtime.replace_receipt')::jsonb ->> 'operation_id')::uuid,
       replace_event_a = (pg_catalog.current_setting('potok.runtime.replace_receipt')::jsonb #>> '{result,event_ids,0}')::uuid;

DO $owner_replace_assertions$
DECLARE
  v potok_runtime_acceptance_config%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v FROM potok_runtime_acceptance_config;
  IF (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_graph_revisions g
       WHERE g.user_id = v.account_a AND g.selection_id = v.selection_a
         AND g.plan_revision = v.plan_a1) <> 1
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e
          WHERE e.user_id = v.account_a AND e.event_id = v.replace_event_a
            AND e.kind = 'PLAN_REPLACED' AND e.component_manifest = '[]'::jsonb) <> 1
     OR EXISTS (SELECT 1 FROM public.food_diary_entries d
                 WHERE d.user_id IN (v.account_a, v.account_b))
     OR EXISTS (
       SELECT 1 FROM public.adaptive_nutrition_operations o
        WHERE o.user_id = v.account_a
          AND o.idempotency_key IN (
            '72000000-0000-4000-8000-000000000021',
            '72000000-0000-4000-8000-000000000022',
            '72000000-0000-4000-8000-000000000023',
            '72000000-0000-4000-8000-000000000024'
          )
     ) THEN
    RAISE EXCEPTION 'replacement admission left invalid effects or diary rows';
  END IF;
END
$owner_replace_assertions$;

UPDATE potok_runtime_acceptance_config c
   SET premium_revoke_a = potok_control.revoke_entitlement_v2(
     c.account_a, 'premium', 'runtime-acceptance/revoke-a',
     'rollback-only runtime replay-after-revoke case'
   );

-- JWT actor A after revoke: original evidence remains, new paid effect is denied.
SELECT pg_catalog.set_config('request.jwt.claim.sub', account_a::text, true)
  FROM potok_runtime_acceptance_config;
SET LOCAL ROLE authenticated;

DO $authenticated_after_revoke$
DECLARE
  v_selection constant uuid := '71000000-0000-4000-8000-000000000001'::uuid;
  v_request jsonb := pg_catalog.current_setting('potok.runtime.replace_request')::jsonb;
  v_original jsonb := pg_catalog.current_setting('potok.runtime.replace_receipt')::jsonb;
  v_replay jsonb;
  v_lookup jsonb;
  v_exact jsonb;
  v_current jsonb;
  v_new jsonb;
BEGIN
  v_replay := public.adaptive_nutrition_mutate_v1(v_request::text);
  v_lookup := public.adaptive_nutrition_lookup_v1(
    '72000000-0000-4000-8000-000000000004');
  v_exact := public.adaptive_nutrition_read_v1(
    v_selection, (v_original ->> 'operation_id')::uuid);
  v_current := public.adaptive_nutrition_read_v1(v_selection, NULL);
  IF v_replay IS DISTINCT FROM v_original OR v_lookup IS DISTINCT FROM v_original
     OR v_exact ->> 'kind' <> 'ready'
     OR v_exact ->> 'exact_operation_id' <> (v_original ->> 'operation_id')
     OR v_current ->> 'kind' <> 'denied' THEN
    RAISE EXCEPTION 'replay/lookup/exact/current semantics after revoke are incorrect';
  END IF;

  v_new := pg_catalog.jsonb_build_object(
    'contract', 'adaptive-nutrition-v1-proposed',
    'expected', pg_catalog.jsonb_build_object(
      'accountId', 'd6eb4e97-90d0-470f-bc4a-2f3e401e1fde',
      'planId', v_selection,
      'planRevision', '71000000-0000-4000-8000-000000000012',
      'goalRevision', v_original #>> '{result,goal_revision}',
      'historyRevision', v_original #>> '{result,history_revision}',
      'diaryRevision', v_original #>> '{result,diary_revision}',
      'weekAnchor', '2026-09-21', 'timeZone', 'Europe/Moscow'),
    'idempotencyKey', '72000000-0000-4000-8000-000000000031',
    'explicitConfirmation', true,
    'action', pg_catalog.jsonb_build_object(
      'type', 'SKIPPED',
      'slot', pg_catalog.jsonb_build_object(
        'slotId', '71000000-0000-4000-8000-000000000032',
        'date', '2026-09-21',
        'snapshot', pg_catalog.jsonb_build_object(
          'snapshotRevision', '71000000-0000-4000-8000-000000000036',
          'recipeRevision', NULL,
          'portionRevision', '71000000-0000-4000-8000-000000000037'))));
  BEGIN
    PERFORM public.adaptive_nutrition_mutate_v1(v_new::text);
    RAISE EXCEPTION 'new paid effect unexpectedly succeeded after revoke';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$authenticated_after_revoke$;

RESET ROLE;

-- JWT actor B has an expired verified lineage. New effect/current read fail closed;
-- account A lookup/read remain non-disclosing.
SELECT pg_catalog.set_config('request.jwt.claim.sub', account_b::text, true)
  FROM potok_runtime_acceptance_config;
SET LOCAL ROLE authenticated;

DO $authenticated_expired_and_foreign$
DECLARE
  v_request jsonb;
  v_lookup jsonb;
  v_read jsonb;
BEGIN
  v_request := pg_catalog.jsonb_build_object(
    'contract', 'adaptive-nutrition-v1-proposed',
    'expected', pg_catalog.jsonb_build_object(
      'accountId', '8f82ff67-39d1-4bb1-9d55-028af99d5cca',
      'planId', '71000000-0000-4000-8000-000000000002',
      'planRevision', '71000000-0000-4000-8000-000000000013',
      'goalRevision', pg_catalog.current_setting('potok.runtime.goal_b'),
      'historyRevision', '71000000-0000-4000-8000-000000000023',
      'diaryRevision', '71000000-0000-4000-8000-000000000024',
      'weekAnchor', '2026-09-21', 'timeZone', 'Europe/Moscow'),
    'idempotencyKey', '72000000-0000-4000-8000-000000000041',
    'explicitConfirmation', true,
    'action', pg_catalog.jsonb_build_object(
      'type', 'SKIPPED',
      'slot', pg_catalog.jsonb_build_object(
        'slotId', '71000000-0000-4000-8000-000000000035',
        'date', '2026-09-21',
        'snapshot', pg_catalog.jsonb_build_object(
          'snapshotRevision', '71000000-0000-4000-8000-000000000038',
          'recipeRevision', NULL,
          'portionRevision', '71000000-0000-4000-8000-000000000039'))));
  BEGIN
    PERFORM public.adaptive_nutrition_mutate_v1(v_request::text);
    RAISE EXCEPTION 'new paid effect unexpectedly succeeded after expiry';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF public.adaptive_nutrition_read_v1(
       '71000000-0000-4000-8000-000000000002', NULL) ->> 'kind' <> 'denied' THEN
    RAISE EXCEPTION 'current read unexpectedly succeeded after expiry';
  END IF;
  v_lookup := public.adaptive_nutrition_lookup_v1(
    '72000000-0000-4000-8000-000000000004');
  v_read := public.adaptive_nutrition_read_v1(
    '71000000-0000-4000-8000-000000000001',
    (pg_catalog.current_setting('potok.runtime.replace_receipt')::jsonb ->> 'operation_id')::uuid);
  IF v_lookup ->> 'kind' <> 'unknown' OR v_read ->> 'kind' <> 'denied'
     OR v_lookup ? 'operation_id' OR v_read ? 'selection_id' THEN
    RAISE EXCEPTION 'foreign account received account A runtime evidence';
  END IF;
END
$authenticated_expired_and_foreign$;

RESET ROLE;

DO $final_owner_assertions$
DECLARE
  v potok_runtime_acceptance_config%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v FROM potok_runtime_acceptance_config;
  IF EXISTS (SELECT 1 FROM public.food_diary_entries d
              WHERE d.user_id IN (v.account_a, v.account_b)) THEN
    RAISE EXCEPTION 'runtime acceptance created forbidden diary projection rows';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.adaptive_nutrition_events e
     WHERE e.user_id IN (v.account_a, v.account_b)
       AND (e.kind = 'FACT' OR pg_catalog.jsonb_array_length(e.component_manifest) <> 0)
  ) THEN
    RAISE EXCEPTION 'runtime acceptance created a FACT/component effect';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.adaptive_nutrition_operations o
     WHERE o.user_id = v.account_a
       AND o.idempotency_key = '72000000-0000-4000-8000-000000000031'
  ) OR EXISTS (
    SELECT 1 FROM public.adaptive_nutrition_operations o
     WHERE o.user_id = v.account_b
       AND o.idempotency_key = '72000000-0000-4000-8000-000000000041'
  ) THEN
    RAISE EXCEPTION 'entitlement denial left an operation fragment';
  END IF;
  IF (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o
       WHERE o.user_id = v.account_a
         AND o.idempotency_key IN (
           '72000000-0000-4000-8000-000000000001',
           '72000000-0000-4000-8000-000000000002',
           '72000000-0000-4000-8000-000000000004'
         ) AND o.outcome = 'accepted') <> 3 THEN
    RAISE EXCEPTION 'expected accepted runtime receipts are incomplete';
  END IF;
  IF (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e
       WHERE e.user_id = v.account_a
         AND e.kind IN ('ANNOTATION','ANNOTATION_RETRACTION','PLAN_REPLACED')) <> 3 THEN
    RAISE EXCEPTION 'expected append-only runtime history is incomplete';
  END IF;
END
$final_owner_assertions$;

SET CONSTRAINTS ALL IMMEDIATE;

ROLLBACK;
