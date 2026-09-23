-- POTOK Adaptive Nutrition read-only entry v1 — ROLLBACK-ONLY BEHAVIORAL ACCEPTANCE.
-- Target: Supabase STAGING ozidryfvhkcbtpnulakq only, after the exact discovery
-- draft has been applied under separate owner approval.
-- Uses only two previously verified STAGING Auth accounts. Every fixture write is
-- transaction-local and the final executable statement is ROLLBACK.
-- No mutation/read/lookup RPC, entitlement grant/revoke routine, FACT, diary,
-- canonical food/recipe or replacement-offer writer is invoked.

BEGIN;

CREATE TEMP TABLE potok_read_entry_acceptance_config (
  account_premium uuid PRIMARY KEY,
  account_free uuid UNIQUE NOT NULL,
  week_anchor date NOT NULL,
  selection_premium uuid UNIQUE NOT NULL,
  selection_foreign uuid UNIQUE NOT NULL,
  goal_revision_premium uuid NULL,
  goal_revision_free uuid NULL,
  plan_revision_premium uuid UNIQUE NOT NULL,
  plan_revision_foreign uuid UNIQUE NOT NULL,
  history_revision_premium uuid UNIQUE NOT NULL,
  history_revision_foreign uuid UNIQUE NOT NULL,
  diary_revision_premium uuid UNIQUE NOT NULL,
  diary_revision_foreign uuid UNIQUE NOT NULL,
  operation_premium uuid UNIQUE NOT NULL,
  operation_foreign uuid UNIQUE NOT NULL,
  attestation_premium uuid UNIQUE NOT NULL
) ON COMMIT DROP;

INSERT INTO potok_read_entry_acceptance_config (
  account_premium, account_free, week_anchor,
  selection_premium, selection_foreign,
  plan_revision_premium, plan_revision_foreign,
  history_revision_premium, history_revision_foreign,
  diary_revision_premium, diary_revision_foreign,
  operation_premium, operation_foreign, attestation_premium
)
SELECT
  'd6eb4e97-90d0-470f-bc4a-2f3e401e1fde'::uuid,
  '8f82ff67-39d1-4bb1-9d55-028af99d5cca'::uuid,
  pg_catalog.date_trunc(
    'week', pg_catalog.statement_timestamp() AT TIME ZONE 'Europe/Moscow'
  )::date,
  pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(),
  pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(),
  pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(),
  pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(),
  pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(),
  pg_catalog.gen_random_uuid();

DO $preflight$
DECLARE
  v potok_read_entry_acceptance_config%ROWTYPE;
  v_definition text;
  v_public_execute boolean;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'postgres owner SQL session required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO STRICT v FROM potok_read_entry_acceptance_config;

  IF EXTRACT(isodow FROM v.week_anchor) <> 1 THEN
    RAISE EXCEPTION 'fixture week anchor must be Monday';
  END IF;
  IF (SELECT pg_catalog.count(*) FROM auth.users u
       WHERE u.id IN (v.account_premium, v.account_free)) <> 2 THEN
    RAISE EXCEPTION 'both exact verified STAGING fixture Auth accounts are required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_profiles p
      WHERE p.user_id IN (v.account_premium, v.account_free)
    UNION ALL
    SELECT 1 FROM public.user_goals g
      WHERE g.user_id IN (v.account_premium, v.account_free)
    UNION ALL
    SELECT 1 FROM public.user_premium_plan_selections s
      WHERE s.user_id IN (v.account_premium, v.account_free)
    UNION ALL
    SELECT 1 FROM public.food_diary_entries d
      WHERE d.user_id IN (v.account_premium, v.account_free)
    UNION ALL
    SELECT 1 FROM potok_control.access_attestations a
      WHERE a.account_id IN (v.account_premium, v.account_free)
    UNION ALL
    SELECT 1 FROM public.adaptive_nutrition_operations o
      WHERE o.user_id IN (v.account_premium, v.account_free)
    UNION ALL
    SELECT 1 FROM public.adaptive_nutrition_graph_revisions g
      WHERE g.user_id IN (v.account_premium, v.account_free)
    UNION ALL
    SELECT 1 FROM public.adaptive_nutrition_events e
      WHERE e.user_id IN (v.account_premium, v.account_free)
    UNION ALL
    SELECT 1 FROM potok_nutrition.validated_plan_replacement_offers_v1 o
      WHERE o.account_id IN (v.account_premium, v.account_free)
  ) THEN
    RAISE EXCEPTION 'fixture accounts are not empty; do not overwrite existing state';
  END IF;

  IF pg_catalog.to_regprocedure(
       'public.adaptive_nutrition_discover_current_v1(text)'
     ) IS NULL
     OR pg_catalog.to_regprocedure(
       'potok_control.is_effective_entitlement_v2(uuid,text,timestamp with time zone)'
     ) IS NULL
     OR pg_catalog.to_regprocedure(
       'public.adaptive_nutrition_read_v1(uuid,uuid)'
     ) IS NULL THEN
    RAISE EXCEPTION 'applied read-only discovery and its foundations are required';
  END IF;
  IF NOT has_function_privilege(
       'authenticated', 'public.adaptive_nutrition_discover_current_v1(text)', 'EXECUTE'
     )
     OR has_function_privilege(
       'anon', 'public.adaptive_nutrition_discover_current_v1(text)', 'EXECUTE'
     )
     OR has_function_privilege(
       'service_role', 'public.adaptive_nutrition_discover_current_v1(text)', 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'discovery EXECUTE grants do not match the reviewed contract';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
      ) acl
     WHERE p.oid = pg_catalog.to_regprocedure(
       'public.adaptive_nutrition_discover_current_v1(text)'
     )
       AND acl.grantee = 0
       AND acl.privilege_type = 'EXECUTE'
  ) INTO v_public_execute;
  IF v_public_execute THEN
    RAISE EXCEPTION 'PUBLIC must not execute discovery';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(
    'public.adaptive_nutrition_discover_current_v1(text)'
  )) INTO STRICT v_definition;
  IF NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_proc p
        WHERE p.oid = pg_catalog.to_regprocedure(
          'public.adaptive_nutrition_discover_current_v1(text)'
        )
          AND p.prosecdef
          AND p.provolatile = 's'
          AND p.proconfig @> ARRAY['search_path=pg_catalog']::text[]
     )
     OR v_definition NOT LIKE '%v_actor uuid := auth.uid()%'
     OR v_definition NOT LIKE '%is_effective_entitlement_v2(v_actor, ''premium''%'
     OR v_definition NOT LIKE '%s.user_id = v_actor%'
     OR v_definition NOT LIKE '%s.contract_version = 1%'
     OR v_definition NOT LIKE '%s.status = ''active''%'
     OR v_definition NOT LIKE '%potok-retained-staging-smoke-v1%'
     OR v_definition NOT LIKE '%v_match_count > 1%'
     OR v_definition NOT LIKE '%''kind'', ''ambiguous''%'
     OR v_definition ~* '\m(INSERT|UPDATE|DELETE|TRUNCATE|CALL|PERFORM)\M' THEN
    RAISE EXCEPTION 'deployed discovery definition differs from reviewed read-only contract';
  END IF;

  IF pg_catalog.to_regclass(
       'public.user_premium_plan_selections_week_candidate_v1_idx'
     ) IS NULL THEN
    RAISE EXCEPTION 'one-week candidate unique index is required';
  END IF;
END
$preflight$;

-- Minimal synthetic profiles and Goals. No names, contact data or diary rows.
INSERT INTO public.user_profiles (user_id)
SELECT account_premium FROM potok_read_entry_acceptance_config
UNION ALL
SELECT account_free FROM potok_read_entry_acceptance_config;

INSERT INTO public.user_goals (
  user_id, calories, protein, fat, carbs, goal_type
)
SELECT account_premium, 2000, 100.00, 70.00, 250.00,
       'adaptive_read_entry_acceptance_v1'
  FROM potok_read_entry_acceptance_config
UNION ALL
SELECT account_free, 2000, 100.00, 70.00, 250.00,
       'adaptive_read_entry_acceptance_v1'
  FROM potok_read_entry_acceptance_config;

UPDATE potok_read_entry_acceptance_config c
   SET goal_revision_premium = premium.goal_revision,
       goal_revision_free = free.goal_revision
  FROM public.user_goals premium, public.user_goals free
 WHERE premium.user_id = c.account_premium
   AND free.user_id = c.account_free;

-- Transaction-local verified Premium lineage for account A. No provisioning RPC is
-- invoked; the fixture mirrors the already accepted attestation/profile invariant.
INSERT INTO potok_control.access_attestations (
  attestation_id, account_id, capability, effect, previous_attestation_id,
  lineage_sequence, issued_at, valid_until, operator_db_role, evidence_ref, reason
)
SELECT
  attestation_premium, account_premium, 'premium', 'GRANT', NULL,
  1, pg_catalog.statement_timestamp() - interval '1 second',
  pg_catalog.statement_timestamp() + interval '1 day', SESSION_USER::name,
  'adaptive-read-entry-acceptance-v1/premium',
  'rollback-only read entry behavioral acceptance'
FROM potok_read_entry_acceptance_config;

UPDATE public.user_profiles p
   SET has_premium = true,
       premium_provenance_id = c.attestation_premium,
       premium_valid_until = pg_catalog.statement_timestamp() + interval '1 day'
  FROM potok_read_entry_acceptance_config c
 WHERE p.user_id = c.account_premium;

DO $entitlement_fixture_check$
DECLARE
  v potok_read_entry_acceptance_config%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v FROM potok_read_entry_acceptance_config;
  IF NOT potok_control.is_effective_entitlement_v2(
       v.account_premium, 'premium', pg_catalog.statement_timestamp()
     ) OR potok_control.is_effective_entitlement_v2(
       v.account_free, 'premium', pg_catalog.statement_timestamp()
     ) THEN
    RAISE EXCEPTION 'fixture Premium/Free predicates are not isolated';
  END IF;
END
$entitlement_fixture_check$;

-- Verified Premium with literally zero selection rows returns no_active_plan and
-- cannot create a receipt, graph, event or diary row.
SELECT pg_catalog.set_config('request.jwt.claim.sub', account_premium::text, true)
  FROM potok_read_entry_acceptance_config;
SET LOCAL ROLE authenticated;
DO $premium_zero_selection$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.adaptive_nutrition_discover_current_v1('Europe/Moscow');
  IF v_result <> '{"kind":"no_active_plan"}'::jsonb THEN
    RAISE EXCEPTION 'verified Premium with zero selections must return no_active_plan';
  END IF;
END
$premium_zero_selection$;
RESET ROLE;

DO $premium_zero_selection_owner_check$
DECLARE
  v potok_read_entry_acceptance_config%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v FROM potok_read_entry_acceptance_config;
  IF EXISTS (SELECT 1 FROM public.adaptive_nutrition_operations o
              WHERE o.user_id = v.account_premium)
     OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_graph_revisions g
                 WHERE g.user_id = v.account_premium)
     OR EXISTS (SELECT 1 FROM public.adaptive_nutrition_events e
                 WHERE e.user_id = v.account_premium)
     OR EXISTS (SELECT 1 FROM public.food_diary_entries d
                 WHERE d.user_id = v.account_premium) THEN
    RAISE EXCEPTION 'zero-selection discovery created a persistence or diary effect';
  END IF;
END
$premium_zero_selection_owner_check$;

DO $fixture_graphs$
DECLARE
  v potok_read_entry_acceptance_config%ROWTYPE;
  v_graph jsonb;
BEGIN
  SELECT * INTO STRICT v FROM potok_read_entry_acceptance_config;
  SELECT pg_catalog.jsonb_build_object(
    'days', pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'date', (v.week_anchor + d.offset_days)::text,
        'slots', '[]'::jsonb
      ) ORDER BY d.offset_days
    )
  ) INTO STRICT v_graph
  FROM pg_catalog.generate_series(0, 6) AS d(offset_days);

  INSERT INTO public.user_premium_plan_selections (
    id, user_id, user_goal_id, premium_plan_id, status, start_date,
    contract_version, week_anchor, timezone, plan_revision, goal_revision,
    history_revision, diary_revision, origin_kind, origin_lineage
  ) VALUES
  (
    v.selection_premium, v.account_premium, v.account_premium, NULL,
    'archived', v.week_anchor, 1, v.week_anchor, 'Europe/Moscow',
    v.plan_revision_premium, v.goal_revision_premium,
    v.history_revision_premium, v.diary_revision_premium, 'generated',
    '{"source":"adaptive-read-entry-acceptance-v1","case":"premium"}'::jsonb
  ),
  (
    v.selection_foreign, v.account_free, v.account_free, NULL,
    'active', v.week_anchor, 1, v.week_anchor, 'Europe/Moscow',
    v.plan_revision_foreign, v.goal_revision_free,
    v.history_revision_foreign, v.diary_revision_foreign, 'generated',
    '{"source":"adaptive-read-entry-acceptance-v1","case":"foreign"}'::jsonb
  );

  INSERT INTO public.adaptive_nutrition_operations (
    user_id, idempotency_key, operation_id, selection_id, contract_version,
    action_type, canonical_request, digest_version, request_digest,
    outcome, result_references, committed_at
  ) VALUES
  (
    v.account_premium, 'adaptive-read-entry-acceptance-v1/bootstrap-premium',
    v.operation_premium, v.selection_premium, 'adaptive-nutrition-v1',
    'FIXTURE_BOOTSTRAP', pg_catalog.convert_to('{"fixture":"premium"}', 'UTF8'),
    'fixture-only', pg_catalog.decode(pg_catalog.repeat('11', 32), 'hex'),
    'accepted', pg_catalog.jsonb_build_object(
      'contract', 'adaptive-nutrition-receipt-v1', 'outcome', 'accepted',
      'operation_id', v.operation_premium, 'selection_id', v.selection_premium,
      'plan_revision', v.plan_revision_premium,
      'goal_revision', v.goal_revision_premium,
      'history_revision', v.history_revision_premium,
      'diary_revision', v.diary_revision_premium, 'event_ids', '[]'::jsonb
    ), pg_catalog.statement_timestamp()
  ),
  (
    v.account_free, 'adaptive-read-entry-acceptance-v1/bootstrap-foreign',
    v.operation_foreign, v.selection_foreign, 'adaptive-nutrition-v1',
    'FIXTURE_BOOTSTRAP', pg_catalog.convert_to('{"fixture":"foreign"}', 'UTF8'),
    'fixture-only', pg_catalog.decode(pg_catalog.repeat('22', 32), 'hex'),
    'accepted', pg_catalog.jsonb_build_object(
      'contract', 'adaptive-nutrition-receipt-v1', 'outcome', 'accepted',
      'operation_id', v.operation_foreign, 'selection_id', v.selection_foreign,
      'plan_revision', v.plan_revision_foreign,
      'goal_revision', v.goal_revision_free,
      'history_revision', v.history_revision_foreign,
      'diary_revision', v.diary_revision_foreign, 'event_ids', '[]'::jsonb
    ), pg_catalog.statement_timestamp()
  );

  INSERT INTO public.adaptive_nutrition_graph_revisions (
    user_id, selection_id, plan_revision, goal_revision, goal_snapshot,
    graph_snapshot, snapshot_encoding_version, content_digest,
    created_by_operation_id
  ) VALUES
  (
    v.account_premium, v.selection_premium, v.plan_revision_premium,
    v.goal_revision_premium, '{"fixture":"premium-goal"}'::jsonb, v_graph,
    'fixture-only', pg_catalog.decode(pg_catalog.repeat('33', 32), 'hex'),
    v.operation_premium
  ),
  (
    v.account_free, v.selection_foreign, v.plan_revision_foreign,
    v.goal_revision_free, '{"fixture":"foreign-goal"}'::jsonb, v_graph,
    'fixture-only', pg_catalog.decode(pg_catalog.repeat('44', 32), 'hex'),
    v.operation_foreign
  );
END
$fixture_graphs$;

CREATE TEMP TABLE potok_read_entry_effect_baseline ON COMMIT DROP AS
SELECT
  (SELECT pg_catalog.count(*) FROM public.user_profiles p
    WHERE p.user_id IN (c.account_premium, c.account_free)) AS profiles,
  (SELECT pg_catalog.count(*) FROM public.user_goals g
    WHERE g.user_id IN (c.account_premium, c.account_free)) AS goals,
  (SELECT pg_catalog.count(*) FROM public.user_premium_plan_selections s
    WHERE s.user_id IN (c.account_premium, c.account_free)) AS selections,
  (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o
    WHERE o.user_id IN (c.account_premium, c.account_free)) AS operations,
  (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_graph_revisions g
    WHERE g.user_id IN (c.account_premium, c.account_free)) AS graphs,
  (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e
    WHERE e.user_id IN (c.account_premium, c.account_free)) AS events,
  (SELECT pg_catalog.count(*) FROM public.food_diary_entries d
    WHERE d.user_id IN (c.account_premium, c.account_free)) AS diary_rows,
  (SELECT pg_catalog.count(*) FROM public.user_premium_meal_selections m
    WHERE m.user_premium_plan_selection_id IN (
      c.selection_premium, c.selection_foreign
    )) AS meal_selections,
  (SELECT pg_catalog.count(*)
     FROM potok_nutrition.validated_plan_replacement_offers_v1 o
    WHERE o.account_id IN (c.account_premium, c.account_free)) AS offers,
  (SELECT pg_catalog.count(*) FROM potok_control.access_attestations a
    WHERE a.account_id IN (c.account_premium, c.account_free)) AS attestations
FROM potok_read_entry_acceptance_config c;

-- Authenticated role without a JWT subject: denied. anon/PUBLIC lack EXECUTE and
-- are checked in preflight instead of being granted a callable unauthenticated path.
SELECT pg_catalog.set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE authenticated;
DO $unauthenticated_denied$
DECLARE v_result jsonb;
BEGIN
  v_result := public.adaptive_nutrition_discover_current_v1('Europe/Moscow');
  IF v_result <> '{"kind":"denied"}'::jsonb THEN
    RAISE EXCEPTION 'authenticated role without auth.uid must be denied';
  END IF;
END
$unauthenticated_denied$;
RESET ROLE;

-- Free account B has an otherwise eligible own row but no verified Premium.
SELECT pg_catalog.set_config('request.jwt.claim.sub', account_free::text, true)
  FROM potok_read_entry_acceptance_config;
SET LOCAL ROLE authenticated;
DO $free_denied$
DECLARE v_result jsonb;
BEGIN
  v_result := public.adaptive_nutrition_discover_current_v1('Europe/Moscow');
  IF v_result <> '{"kind":"denied"}'::jsonb THEN
    RAISE EXCEPTION 'Free actor must be denied before selection disclosure';
  END IF;
END
$free_denied$;
RESET ROLE;

-- Premium account A: invalid timezone is denied.
SELECT pg_catalog.set_config('request.jwt.claim.sub', account_premium::text, true)
  FROM potok_read_entry_acceptance_config;
SET LOCAL ROLE authenticated;
DO $invalid_timezone_denied$
DECLARE v_result jsonb;
BEGIN
  v_result := public.adaptive_nutrition_discover_current_v1('Not/A_Real_Timezone');
  IF v_result <> '{"kind":"denied"}'::jsonb THEN
    RAISE EXCEPTION 'invalid timezone must be denied';
  END IF;
END
$invalid_timezone_denied$;
RESET ROLE;

-- A has only an archived own selection; B's active row is foreign. Both must be
-- ignored and zero eligible own rows must return no_active_plan.
SELECT pg_catalog.set_config('request.jwt.claim.sub', account_premium::text, true)
  FROM potok_read_entry_acceptance_config;
SET LOCAL ROLE authenticated;
DO $zero_archived_foreign_ignored$
DECLARE v_result jsonb;
BEGIN
  v_result := public.adaptive_nutrition_discover_current_v1('Europe/Moscow');
  IF v_result <> '{"kind":"no_active_plan"}'::jsonb THEN
    RAISE EXCEPTION 'zero eligible own selections must return no_active_plan';
  END IF;
END
$zero_archived_foreign_ignored$;
RESET ROLE;

-- An active current-week row with retained-smoke lineage remains invisible.
UPDATE public.user_premium_plan_selections s
   SET status = 'active',
       origin_lineage = '{"source":"potok-retained-staging-smoke-v1"}'::jsonb
  FROM potok_read_entry_acceptance_config c
 WHERE s.id = c.selection_premium AND s.user_id = c.account_premium;
SELECT pg_catalog.set_config('request.jwt.claim.sub', account_premium::text, true)
  FROM potok_read_entry_acceptance_config;
SET LOCAL ROLE authenticated;
DO $retained_smoke_ignored$
DECLARE v_result jsonb;
BEGIN
  v_result := public.adaptive_nutrition_discover_current_v1('Europe/Moscow');
  IF v_result <> '{"kind":"no_active_plan"}'::jsonb THEN
    RAISE EXCEPTION 'retained smoke lineage must be excluded';
  END IF;
END
$retained_smoke_ignored$;
RESET ROLE;

-- Wrong local week is ignored.
UPDATE public.user_premium_plan_selections s
   SET status = 'archived'
  FROM potok_read_entry_acceptance_config c
 WHERE s.id = c.selection_premium AND s.user_id = c.account_premium;
UPDATE public.user_premium_plan_selections s
   SET status = 'active', week_anchor = c.week_anchor + 7,
       start_date = c.week_anchor + 7,
       origin_lineage = '{"source":"adaptive-read-entry-acceptance-v1","case":"wrong-week"}'::jsonb
  FROM potok_read_entry_acceptance_config c
 WHERE s.id = c.selection_premium AND s.user_id = c.account_premium;
SELECT pg_catalog.set_config('request.jwt.claim.sub', account_premium::text, true)
  FROM potok_read_entry_acceptance_config;
SET LOCAL ROLE authenticated;
DO $wrong_week_ignored$
DECLARE v_result jsonb;
BEGIN
  v_result := public.adaptive_nutrition_discover_current_v1('Europe/Moscow');
  IF v_result <> '{"kind":"no_active_plan"}'::jsonb THEN
    RAISE EXCEPTION 'wrong week selection must be ignored';
  END IF;
END
$wrong_week_ignored$;
RESET ROLE;

-- Current week with a different IANA timezone is ignored.
UPDATE public.user_premium_plan_selections s
   SET status = 'archived'
  FROM potok_read_entry_acceptance_config c
 WHERE s.id = c.selection_premium AND s.user_id = c.account_premium;
UPDATE public.user_premium_plan_selections s
   SET status = 'active', week_anchor = c.week_anchor, start_date = c.week_anchor,
       timezone = 'UTC',
       origin_lineage = '{"source":"adaptive-read-entry-acceptance-v1","case":"wrong-timezone"}'::jsonb
  FROM potok_read_entry_acceptance_config c
 WHERE s.id = c.selection_premium AND s.user_id = c.account_premium;
SELECT pg_catalog.set_config('request.jwt.claim.sub', account_premium::text, true)
  FROM potok_read_entry_acceptance_config;
SET LOCAL ROLE authenticated;
DO $wrong_timezone_ignored$
DECLARE v_result jsonb;
BEGIN
  v_result := public.adaptive_nutrition_discover_current_v1('Europe/Moscow');
  IF v_result <> '{"kind":"no_active_plan"}'::jsonb THEN
    RAISE EXCEPTION 'wrong timezone selection must be ignored';
  END IF;
END
$wrong_timezone_ignored$;
RESET ROLE;

-- Exactly one eligible own row returns only its identity/calendar contract.
UPDATE public.user_premium_plan_selections s
   SET status = 'archived'
  FROM potok_read_entry_acceptance_config c
 WHERE s.id = c.selection_premium AND s.user_id = c.account_premium;
UPDATE public.user_premium_plan_selections s
   SET status = 'active', timezone = 'Europe/Moscow',
       origin_lineage = '{"source":"adaptive-read-entry-acceptance-v1","case":"ready"}'::jsonb
  FROM potok_read_entry_acceptance_config c
 WHERE s.id = c.selection_premium AND s.user_id = c.account_premium;
SELECT pg_catalog.set_config('request.jwt.claim.sub', account_premium::text, true)
  FROM potok_read_entry_acceptance_config;
SELECT pg_catalog.set_config(
         'potok.acceptance.expected_selection', selection_premium::text, true
       ),
       pg_catalog.set_config(
         'potok.acceptance.expected_week_anchor', week_anchor::text, true
       )
  FROM potok_read_entry_acceptance_config;
SET LOCAL ROLE authenticated;
DO $one_ready_owned$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.adaptive_nutrition_discover_current_v1('Europe/Moscow');
  IF v_result ->> 'kind' <> 'ready'
     OR (v_result ->> 'selection_id')::uuid <>
       pg_catalog.current_setting('potok.acceptance.expected_selection')::uuid
     OR (v_result ->> 'week_anchor')::date <>
       pg_catalog.current_setting('potok.acceptance.expected_week_anchor')::date
     OR v_result ->> 'timezone' <> 'Europe/Moscow'
     OR v_result ->> 'status' <> 'active'
     OR (v_result ->> 'contract_version')::integer <> 1 THEN
    RAISE EXCEPTION 'ready result is not exactly bound to the authenticated owner';
  END IF;
END
$one_ready_owned$;
RESET ROLE;

DO $one_ready_owner_state_check$
DECLARE
  v potok_read_entry_acceptance_config%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v FROM potok_read_entry_acceptance_config;
  IF NOT EXISTS (
       SELECT 1 FROM public.user_premium_plan_selections s
        WHERE s.id = v.selection_premium
          AND s.user_id = v.account_premium
     ) OR v.selection_premium = v.selection_foreign THEN
    RAISE EXCEPTION 'ready fixture ownership is not exactly account-bound';
  END IF;
END
$one_ready_owner_state_check$;

-- The applied schema deliberately prevents two eligible rows for one user/week.
-- Verify the invariant instead of dropping the live-like unique index. The deployed
-- function definition was separately checked to retain its defensive ambiguous branch.
DO $two_eligible_schema_invariant$
DECLARE
  v potok_read_entry_acceptance_config%ROWTYPE;
  v_rejected boolean := false;
BEGIN
  SELECT * INTO STRICT v FROM potok_read_entry_acceptance_config;
  BEGIN
    INSERT INTO public.user_premium_plan_selections (
      id, user_id, user_goal_id, premium_plan_id, status, start_date,
      contract_version, week_anchor, timezone, plan_revision, goal_revision,
      history_revision, diary_revision, origin_kind, origin_lineage
    ) VALUES (
      pg_catalog.gen_random_uuid(), v.account_premium, v.account_premium, NULL,
      'active', v.week_anchor, 1, v.week_anchor, 'Europe/Moscow',
      pg_catalog.gen_random_uuid(), v.goal_revision_premium,
      pg_catalog.gen_random_uuid(), pg_catalog.gen_random_uuid(), 'generated',
      '{"source":"adaptive-read-entry-acceptance-v1","case":"second-eligible"}'::jsonb
    );
  EXCEPTION WHEN unique_violation THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'schema unexpectedly allowed a second eligible selection';
  END IF;
  IF (SELECT pg_catalog.count(*)
        FROM public.user_premium_plan_selections s
       WHERE s.user_id = v.account_premium
         AND s.week_anchor = v.week_anchor
         AND s.contract_version = 1
         AND s.status = 'active') <> 1 THEN
    RAISE EXCEPTION 'eligible selection invariant did not remain exact after rejection';
  END IF;
END
$two_eligible_schema_invariant$;

DO $no_discovery_side_effects$
DECLARE
  v potok_read_entry_acceptance_config%ROWTYPE;
  b potok_read_entry_effect_baseline%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v FROM potok_read_entry_acceptance_config;
  SELECT * INTO STRICT b FROM potok_read_entry_effect_baseline;
  IF (SELECT pg_catalog.count(*) FROM public.user_profiles p
       WHERE p.user_id IN (v.account_premium, v.account_free)) <> b.profiles
     OR (SELECT pg_catalog.count(*) FROM public.user_goals g
          WHERE g.user_id IN (v.account_premium, v.account_free)) <> b.goals
     OR (SELECT pg_catalog.count(*) FROM public.user_premium_plan_selections s
          WHERE s.user_id IN (v.account_premium, v.account_free)) <> b.selections
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_operations o
          WHERE o.user_id IN (v.account_premium, v.account_free)) <> b.operations
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_graph_revisions g
          WHERE g.user_id IN (v.account_premium, v.account_free)) <> b.graphs
     OR (SELECT pg_catalog.count(*) FROM public.adaptive_nutrition_events e
          WHERE e.user_id IN (v.account_premium, v.account_free)) <> b.events
     OR (SELECT pg_catalog.count(*) FROM public.food_diary_entries d
          WHERE d.user_id IN (v.account_premium, v.account_free)) <> b.diary_rows
     OR (SELECT pg_catalog.count(*) FROM public.user_premium_meal_selections m
          WHERE m.user_premium_plan_selection_id IN (
            v.selection_premium, v.selection_foreign
          )) <> b.meal_selections
     OR (SELECT pg_catalog.count(*)
           FROM potok_nutrition.validated_plan_replacement_offers_v1 o
          WHERE o.account_id IN (v.account_premium, v.account_free)) <> b.offers
     OR (SELECT pg_catalog.count(*) FROM potok_control.access_attestations a
          WHERE a.account_id IN (v.account_premium, v.account_free)) <> b.attestations THEN
    RAISE EXCEPTION 'discovery calls changed fixture/runtime/diary/offer counts';
  END IF;
  IF b.profiles <> 2 OR b.goals <> 2 OR b.selections <> 2
     OR b.operations <> 2 OR b.graphs <> 2 OR b.events <> 0
     OR b.diary_rows <> 0 OR b.meal_selections <> 0 OR b.offers <> 0
     OR b.attestations <> 1 THEN
    RAISE EXCEPTION 'fixture baseline differs from the bounded acceptance contract';
  END IF;
END
$no_discovery_side_effects$;

SELECT
  'adaptive_read_only_entry_behavioral_acceptance_pass'::text AS verdict,
  account_premium,
  account_free,
  selection_premium AS ready_selection,
  week_anchor,
  'second eligible row is prevented by the applied unique index; defensive ambiguous branch verified in function definition'::text
    AS ambiguity_evidence
FROM potok_read_entry_acceptance_config;

ROLLBACK;
