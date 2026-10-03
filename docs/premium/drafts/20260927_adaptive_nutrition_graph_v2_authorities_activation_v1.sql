-- POTOK Adaptive Nutrition Graph v2 authorities + activation v1
-- RUNNABLE REVIEW DRAFT / NOT APPLIED.
-- Target after separate approval: Supabase STAGING ozidryfvhkcbtpnulakq only.
-- PRODUCTION FORBIDDEN. No recipe is published and no generator is activated here.

BEGIN;

DO $preflight$
DECLARE
  v_signature text;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'postgres owner SQL session required' USING ERRCODE = '42501';
  END IF;
  IF pg_catalog.to_regprocedure('extensions.digest(bytea,text)') IS NULL
     OR pg_catalog.to_regprocedure('auth.uid()') IS NULL
     OR pg_catalog.to_regprocedure('potok_nutrition.json_has_duplicate_keys_v1(json)') IS NULL
     OR pg_catalog.to_regprocedure('potok_nutrition.canonical_jsonb_text_v1(jsonb)') IS NULL
     OR pg_catalog.to_regprocedure('potok_nutrition.jsonb_has_exact_keys_v1(jsonb,text[])') IS NULL
     OR pg_catalog.to_regprocedure('potok_control.is_effective_entitlement_v2(uuid,text,timestamp with time zone)') IS NULL
     OR pg_catalog.to_regclass('public.user_premium_plan_selections') IS NULL
     OR pg_catalog.to_regclass('public.adaptive_nutrition_operations') IS NULL
     OR pg_catalog.to_regclass('public.adaptive_nutrition_graph_revisions') IS NULL
     OR pg_catalog.to_regclass('public.adaptive_nutrition_events') IS NULL
     OR pg_catalog.to_regclass('public.user_goals') IS NULL THEN
    RAISE EXCEPTION 'reviewed entitlement/persistence/runtime baseline is incomplete';
  END IF;

  IF pg_catalog.to_regprocedure('potok_control.grant_entitlement_v2(uuid,text,timestamp with time zone,text,text)') IS NULL
     OR pg_catalog.to_regprocedure('potok_control.revoke_entitlement_v2(uuid,text,text,text)') IS NULL
     OR pg_catalog.to_regprocedure('public.adaptive_nutrition_provision_current_week_v1(text,uuid)') IS NULL
     OR pg_catalog.to_regprocedure('potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'one or more exact lock-repair writer signatures are missing';
  END IF;

  IF pg_catalog.pg_get_functiondef(
       'potok_control.grant_entitlement_v2(uuid,text,timestamp with time zone,text,text)'::pg_catalog.regprocedure
     ) NOT LIKE '%potok-entitlement-v2:%'
     OR pg_catalog.pg_get_functiondef(
       'potok_control.revoke_entitlement_v2(uuid,text,text,text)'::pg_catalog.regprocedure
     ) NOT LIKE '%potok-entitlement-v2:%'
     OR pg_catalog.pg_get_functiondef(
       'public.adaptive_nutrition_provision_current_week_v1(text,uuid)'::pg_catalog.regprocedure
     ) NOT LIKE '%potok-adaptive-v1:%'
     OR pg_catalog.pg_get_functiondef(
       'potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb)'::pg_catalog.regprocedure
     ) NOT LIKE '%potok-adaptive-v1:%' THEN
    RAISE EXCEPTION 'deployed writer lock bodies differ from the reviewed baseline';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'potok_nutrition' AND c.relname IN (
      'nutrition_preference_snapshots_v1', 'nutrition_safety_snapshots_v1',
      'nutrition_authority_heads_v1', 'adaptive_nutrition_candidate_manifests_v2',
      'adaptive_nutrition_candidate_manifest_entries_v2',
      'adaptive_nutrition_candidate_manifest_head_v2'
    )
  ) OR pg_catalog.to_regprocedure('potok_nutrition.acquire_shared_account_gate_v1(uuid)') IS NOT NULL
     OR pg_catalog.to_regprocedure('potok_nutrition.activate_generated_week_v2(uuid,uuid,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Graph v2 authority package objects already exist; inspect instead of reapplying';
  END IF;

  FOREACH v_signature IN ARRAY ARRAY[
    'potok_nutrition.require_canonical_json_v2(bytea)',
    'potok_nutrition.reject_immutable_change_v2()',
    'potok_nutrition.initialize_nutrition_authorities_v1(uuid,uuid,bytea,bytea,uuid)',
    'potok_nutrition.create_preference_successor_v1(uuid,uuid,uuid,bytea,uuid)',
    'potok_nutrition.create_safety_successor_v1(uuid,uuid,uuid,bytea,uuid)',
    'potok_nutrition.publish_candidate_manifest_v2(bytea,uuid,uuid,uuid)',
    'potok_nutrition.record_generated_week_v2(uuid,uuid,uuid,bytea,bytea)',
    'public.adaptive_nutrition_read_graph_v2(uuid,uuid,text)',
    'public.adaptive_nutrition_list_graph_history_v2(uuid)',
    'public.adaptive_nutrition_lookup_operation_v2(uuid)',
    'public.adaptive_nutrition_current_preference_v1()',
    'public.adaptive_nutrition_current_safety_v1()',
    'potok_nutrition.current_candidate_manifest_v2()'
  ] LOOP
    IF pg_catalog.to_regprocedure(v_signature) IS NOT NULL THEN
      RAISE EXCEPTION 'proposed function already exists: %',v_signature;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conname IN (
       'adaptive_nutrition_operations_v2_result_check',
       'adaptive_nutrition_graph_revisions_v2_shape_check',
       'adaptive_nutrition_graph_revisions_v2_manifest_fk',
       'adaptive_nutrition_graph_revisions_v2_generation_operation_fk',
       'adaptive_nutrition_graph_revisions_v2_activation_operation_fk',
       'adaptive_nutrition_graph_revisions_v2_supersedes_fk'
     ))
     OR pg_catalog.to_regclass('public.adaptive_nutrition_operations_operation_global_v2_idx') IS NOT NULL
     OR pg_catalog.to_regclass('public.adaptive_nutrition_graph_revisions_v2_digest_idx') IS NOT NULL
     OR pg_catalog.to_regclass('public.adaptive_nutrition_graph_revisions_v2_one_successor_idx') IS NOT NULL THEN
    RAISE EXCEPTION 'proposed public constraint/index name already exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = 'public.adaptive_nutrition_graph_revisions'::pg_catalog.regclass
      AND a.attname IN (
        'graph_contract', 'graph_contract_version', 'graph_canonical_bytes',
        'generated_week_plan_digest', 'generation_input_digest', 'target_policy_revision',
        'preference_revision', 'safety_revision', 'candidate_manifest_revision',
        'candidate_manifest_digest', 'composition_policy_revision',
        'validation_policy_revision', 'optimization_policy_revision',
        'generation_policy_revision', 'generation_operation_id',
        'activation_operation_id', 'supersedes_plan_revision'
      ) AND NOT a.attisdropped
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = 'public.adaptive_nutrition_operations'::pg_catalog.regclass
      AND a.attname IN (
        'result_canonical', 'result_digest', 'result_plan_revision', 'result_graph_digest'
      ) AND NOT a.attisdropped
  ) THEN
    RAISE EXCEPTION 'Graph v2 additive columns already exist or conflict';
  END IF;

  IF EXISTS (
    SELECT operation_id FROM public.adaptive_nutrition_operations
    GROUP BY operation_id HAVING pg_catalog.count(*) > 1
  ) THEN
    RAISE EXCEPTION 'operation_id is not globally unique; protected activation lookup would be ambiguous';
  END IF;
END
$preflight$;

CREATE FUNCTION potok_nutrition.acquire_shared_account_gate_v1(p_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'account gate requires account identity' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('potok-shared-account-gate-v1:' || p_account_id::text, 0)
  );
END
$function$;

REVOKE ALL ON FUNCTION potok_nutrition.acquire_shared_account_gate_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Existing business logic is retained verbatim; only the first account lock changes.
CREATE OR REPLACE FUNCTION potok_control.grant_entitlement_v2(
  p_account_id uuid,
  p_capability text,
  p_valid_until timestamptz,
  p_evidence_ref text,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_head potok_control.access_attestations%ROWTYPE;
  v_attestation_id uuid := pg_catalog.gen_random_uuid();
  v_sequence bigint;
  v_updated integer;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'owner-controlled entitlement channel required' USING ERRCODE = '42501';
  END IF;
  IF p_account_id IS NULL OR p_capability NOT IN ('premium', 'admin') THEN
    RAISE EXCEPTION 'invalid entitlement scope' USING ERRCODE = '22023';
  END IF;
  IF p_valid_until IS NOT NULL AND p_valid_until <= v_now THEN
    RAISE EXCEPTION 'grant expiry must be in the future' USING ERRCODE = '22023';
  END IF;
  IF p_evidence_ref IS NULL OR p_evidence_ref = '' OR p_evidence_ref <> pg_catalog.btrim(p_evidence_ref)
     OR p_reason IS NULL OR p_reason = '' OR p_reason <> pg_catalog.btrim(p_reason) THEN
    RAISE EXCEPTION 'evidence and reason are required' USING ERRCODE = '22023';
  END IF;

  PERFORM potok_nutrition.acquire_shared_account_gate_v1(p_account_id);
  -- Preserve the capability lineage lock, now strictly secondary.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('potok-entitlement-v2:' || p_account_id::text || ':' || p_capability, 0)
  );
  SELECT a.* INTO v_head
    FROM potok_control.access_attestations a
   WHERE a.account_id = p_account_id AND a.capability = p_capability
   ORDER BY a.lineage_sequence DESC LIMIT 1 FOR UPDATE;
  v_sequence := COALESCE(v_head.lineage_sequence, 0::bigint) + 1::bigint;

  INSERT INTO potok_control.access_attestations (
    attestation_id, account_id, capability, effect, previous_attestation_id,
    lineage_sequence, issued_at, valid_until, operator_db_role, evidence_ref, reason
  ) VALUES (
    v_attestation_id, p_account_id, p_capability, 'GRANT', v_head.attestation_id,
    v_sequence, v_now, p_valid_until, SESSION_USER::name, p_evidence_ref, p_reason
  );

  IF p_capability = 'premium' THEN
    UPDATE public.user_profiles
       SET has_premium = true,
           premium_provenance_id = v_attestation_id,
           premium_valid_until = p_valid_until
     WHERE user_id = p_account_id;
  ELSE
    UPDATE public.user_profiles
       SET is_admin = true,
           admin_provenance_id = v_attestation_id,
           admin_valid_until = p_valid_until
     WHERE user_id = p_account_id;
  END IF;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'exactly one user profile is required for entitlement grant';
  END IF;
  RETURN v_attestation_id;
END
$function$;

CREATE OR REPLACE FUNCTION potok_control.revoke_entitlement_v2(
  p_account_id uuid,
  p_capability text,
  p_evidence_ref text,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_head potok_control.access_attestations%ROWTYPE;
  v_attestation_id uuid := pg_catalog.gen_random_uuid();
  v_sequence bigint;
  v_updated integer;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'owner-controlled entitlement channel required' USING ERRCODE = '42501';
  END IF;
  IF p_account_id IS NULL OR p_capability NOT IN ('premium', 'admin') THEN
    RAISE EXCEPTION 'invalid entitlement scope' USING ERRCODE = '22023';
  END IF;
  IF p_evidence_ref IS NULL OR p_evidence_ref = '' OR p_evidence_ref <> pg_catalog.btrim(p_evidence_ref)
     OR p_reason IS NULL OR p_reason = '' OR p_reason <> pg_catalog.btrim(p_reason) THEN
    RAISE EXCEPTION 'evidence and reason are required' USING ERRCODE = '22023';
  END IF;

  PERFORM potok_nutrition.acquire_shared_account_gate_v1(p_account_id);
  -- Preserve the capability lineage lock, now strictly secondary.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('potok-entitlement-v2:' || p_account_id::text || ':' || p_capability, 0)
  );
  SELECT a.* INTO v_head
    FROM potok_control.access_attestations a
   WHERE a.account_id = p_account_id AND a.capability = p_capability
   ORDER BY a.lineage_sequence DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cannot revoke entitlement without prior lineage' USING ERRCODE = '23514';
  END IF;
  v_sequence := v_head.lineage_sequence + 1;

  INSERT INTO potok_control.access_attestations (
    attestation_id, account_id, capability, effect, previous_attestation_id,
    lineage_sequence, issued_at, valid_until, operator_db_role, evidence_ref, reason
  ) VALUES (
    v_attestation_id, p_account_id, p_capability, 'REVOKE', v_head.attestation_id,
    v_sequence, v_now, NULL, SESSION_USER::name, p_evidence_ref, p_reason
  );

  IF p_capability = 'premium' THEN
    UPDATE public.user_profiles
       SET has_premium = false,
           premium_provenance_id = v_attestation_id,
           premium_valid_until = NULL
     WHERE user_id = p_account_id;
  ELSE
    UPDATE public.user_profiles
       SET is_admin = false,
           admin_provenance_id = v_attestation_id,
           admin_valid_until = NULL
     WHERE user_id = p_account_id;
  END IF;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'exactly one user profile is required for entitlement revoke';
  END IF;
  RETURN v_attestation_id;
END
$function$;

CREATE OR REPLACE FUNCTION public.adaptive_nutrition_provision_current_week_v1(
  p_timezone text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_week_anchor date;
  v_goal public.user_goals%ROWTYPE;
  v_existing_operation public.adaptive_nutrition_operations%ROWTYPE;
  v_existing_selection public.user_premium_plan_selections%ROWTYPE;
  v_request jsonb;
  v_request_bytes bytea;
  v_request_digest bytea;
  v_operation_id uuid := pg_catalog.gen_random_uuid();
  v_selection_id uuid := pg_catalog.gen_random_uuid();
  v_history_revision uuid := pg_catalog.gen_random_uuid();
  v_diary_revision uuid := pg_catalog.gen_random_uuid();
  v_result jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('kind', 'denied', 'reason', 'authentication_required');
  END IF;
  IF p_idempotency_key IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('kind', 'invalid_request', 'reason', 'idempotency_key_required');
  END IF;
  IF p_timezone IS NULL OR p_timezone = '' OR p_timezone <> pg_catalog.btrim(p_timezone)
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = p_timezone
     ) THEN
    RETURN pg_catalog.jsonb_build_object('kind', 'invalid_request', 'reason', 'invalid_timezone');
  END IF;

  -- Canonical bytes contain only protocol, authenticated actor and explicit input.
  -- Current entitlement, Goal and calendar state are authoritative server results,
  -- so an exact retry remains replayable after those values later change.
  v_request := pg_catalog.jsonb_build_object(
    'protocol', 'adaptive-nutrition-plan-provision-v1',
    'account_id', v_actor,
    'timezone', p_timezone
  );
  v_request_bytes := pg_catalog.convert_to(v_request::text, 'UTF8');
  v_request_digest := extensions.digest(v_request_bytes, 'sha256');

  -- Same account-wide ordering as the applied Adaptive mutation boundary.
  PERFORM potok_nutrition.acquire_shared_account_gate_v1(v_actor);

  SELECT o.* INTO v_existing_operation
    FROM public.adaptive_nutrition_operations o
   WHERE o.user_id = v_actor
     AND o.idempotency_key = p_idempotency_key::text
   FOR UPDATE;
  IF FOUND THEN
    IF v_existing_operation.contract_version <> 'adaptive-nutrition-v1'
       OR v_existing_operation.action_type <> 'PLAN_PROVISIONED'
       OR v_existing_operation.canonical_request <> v_request_bytes
       OR v_existing_operation.digest_version <> 'adaptive-nutrition-plan-provision-v1/sha256'
       OR v_existing_operation.request_digest <> v_request_digest THEN
      RETURN pg_catalog.jsonb_build_object(
        'kind', 'conflict', 'reason', 'idempotency_payload_mismatch'
      );
    END IF;
    IF v_existing_operation.outcome = 'in_progress' THEN
      RETURN pg_catalog.jsonb_build_object('kind', 'unknown', 'reason', 'operation_unresolved');
    END IF;
    RETURN v_existing_operation.result_references;
  END IF;

  IF NOT potok_control.is_effective_entitlement_v2(v_actor, 'premium', v_now) THEN
    RETURN pg_catalog.jsonb_build_object('kind', 'denied', 'reason', 'verified_premium_required');
  END IF;

  SELECT g.* INTO v_goal
    FROM public.user_goals g
   WHERE g.user_id = v_actor
   FOR SHARE;
  IF NOT FOUND OR v_goal.goal_revision IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('kind', 'missing_goal', 'reason', 'active_goal_required');
  END IF;

  v_week_anchor := pg_catalog.date_trunc('week', v_now AT TIME ZONE p_timezone)::date;
  IF EXTRACT(isodow FROM v_week_anchor) <> 1 THEN
    RAISE EXCEPTION 'derived week anchor is not Monday';
  END IF;

  SELECT s.* INTO v_existing_selection
    FROM public.user_premium_plan_selections s
   WHERE s.user_id = v_actor
     AND s.contract_version = 1
     AND s.week_anchor = v_week_anchor
   FOR UPDATE;
  IF FOUND THEN
    IF v_existing_selection.origin_lineage ->> 'source'
         = 'potok-retained-staging-smoke-v1' THEN
      RETURN pg_catalog.jsonb_build_object(
        'kind', 'conflict', 'reason', 'fixture_lineage_blocked'
      );
    END IF;
    IF v_existing_selection.timezone <> p_timezone THEN
      RETURN pg_catalog.jsonb_build_object(
        'kind', 'conflict', 'reason', 'calendar_binding_conflict',
        'selection_id', v_existing_selection.id
      );
    END IF;
    v_result := pg_catalog.jsonb_build_object(
      'kind', 'existing',
      'contract', 'adaptive-nutrition-plan-provision-v1',
      'outcome', 'accepted',
      'operation_id', v_operation_id,
      'selection_id', v_existing_selection.id,
      'contract_version', 1,
      'status', v_existing_selection.status,
      'week_anchor', v_existing_selection.week_anchor,
      'timezone', v_existing_selection.timezone,
      'goal_revision', v_existing_selection.goal_revision,
      'plan_revision', v_existing_selection.plan_revision,
      'history_revision', v_existing_selection.history_revision,
      'diary_revision', v_existing_selection.diary_revision,
      'goal_change_pending', v_existing_selection.goal_revision <> v_goal.goal_revision,
      'event_ids', '[]'::jsonb
    );
    INSERT INTO public.adaptive_nutrition_operations (
      user_id, idempotency_key, operation_id, selection_id,
      contract_version, action_type, canonical_request, digest_version,
      request_digest, outcome, result_references, committed_at
    ) VALUES (
      v_actor, p_idempotency_key::text, v_operation_id, v_existing_selection.id,
      'adaptive-nutrition-v1', 'PLAN_PROVISIONED', v_request_bytes,
      'adaptive-nutrition-plan-provision-v1/sha256', v_request_digest,
      'accepted', v_result, v_now
    );
    RETURN v_result;
  END IF;

  v_result := pg_catalog.jsonb_build_object(
    'kind', 'provisioned',
    'contract', 'adaptive-nutrition-plan-provision-v1',
    'outcome', 'accepted',
    'operation_id', v_operation_id,
    'selection_id', v_selection_id,
    'contract_version', 1,
    'status', 'pending_generation',
    'week_anchor', v_week_anchor,
    'timezone', p_timezone,
    'goal_revision', v_goal.goal_revision,
    'plan_revision', NULL,
    'history_revision', v_history_revision,
    'diary_revision', v_diary_revision,
    'goal_change_pending', false,
    'event_ids', '[]'::jsonb
  );

  INSERT INTO public.user_premium_plan_selections (
    id, user_id, user_goal_id, premium_plan_id, status, start_date,
    contract_version, week_anchor, timezone, plan_revision, goal_revision,
    history_revision, diary_revision, origin_kind, origin_lineage
  ) VALUES (
    v_selection_id, v_actor, v_actor, NULL, 'pending_generation', v_week_anchor,
    1, v_week_anchor, p_timezone, NULL, v_goal.goal_revision,
    v_history_revision, v_diary_revision, 'generated',
    pg_catalog.jsonb_build_object(
      'source', 'potok-goal-plan-engine-v1',
      'foundationVersion', 1,
      'generationState', 'pending_generation',
      'provisionOperationId', v_operation_id,
      'goalRevision', v_goal.goal_revision
    )
  );

  INSERT INTO public.adaptive_nutrition_operations (
    user_id, idempotency_key, operation_id, selection_id,
    contract_version, action_type, canonical_request, digest_version,
    request_digest, outcome, result_references, committed_at
  ) VALUES (
    v_actor, p_idempotency_key::text, v_operation_id, v_selection_id,
    'adaptive-nutrition-v1', 'PLAN_PROVISIONED', v_request_bytes,
    'adaptive-nutrition-plan-provision-v1/sha256', v_request_digest,
    'accepted', v_result, v_now
  );

  RETURN v_result;
END
$function$;

CREATE OR REPLACE FUNCTION potok_nutrition.commit_prevalidated_plan_transition_v1(
  p_account_id uuid,
  p_selection_id uuid,
  p_idempotency_key text,
  p_contract_version text,
  p_action_type text,
  p_canonical_request bytea,
  p_digest_version text,
  p_request_digest bytea,
  p_expected_plan_revision uuid,
  p_expected_goal_revision uuid,
  p_expected_history_revision uuid,
  p_expected_diary_revision uuid,
  p_new_plan_revision uuid,
  p_new_history_revision uuid,
  p_goal_snapshot jsonb,
  p_graph_snapshot jsonb,
  p_snapshot_encoding_version text,
  p_graph_digest bytea,
  p_event jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_existing public.adaptive_nutrition_operations%ROWTYPE;
  v_selection public.user_premium_plan_selections%ROWTYPE;
  v_operation_id uuid := pg_catalog.gen_random_uuid();
  v_event_id uuid;
  v_stream_id uuid;
  v_event_sequence bigint;
  v_result jsonb;
BEGIN
  -- No application role has EXECUTE. A future duplicate-aware wire decoder may call
  -- this internal boundary only after validating and canonicalizing every field.
  IF p_account_id IS NULL OR p_selection_id IS NULL
     OR p_idempotency_key IS NULL OR p_idempotency_key = ''
     OR p_idempotency_key <> pg_catalog.btrim(p_idempotency_key)
     OR p_contract_version <> 'adaptive-nutrition-v1'
     OR p_action_type NOT IN ('PLAN_REPLACED', 'ANNOTATION', 'ANNOTATION_RETRACTION')
     OR p_canonical_request IS NULL OR p_digest_version IS NULL
     OR pg_catalog.octet_length(p_request_digest) <> 32 THEN
    RAISE EXCEPTION 'invalid prevalidated transition envelope' USING ERRCODE = '22023';
  END IF;
  IF p_action_type = 'PLAN_REPLACED' AND (
       p_new_plan_revision IS NULL OR p_goal_snapshot IS NULL OR p_graph_snapshot IS NULL
       OR p_snapshot_encoding_version IS NULL OR pg_catalog.octet_length(p_graph_digest) <> 32
       OR pg_catalog.jsonb_typeof(p_goal_snapshot) <> 'object'
       OR pg_catalog.jsonb_typeof(p_graph_snapshot) <> 'object'
       OR pg_catalog.jsonb_array_length(COALESCE(p_graph_snapshot -> 'days', '[]'::jsonb)) <> 7
     ) THEN
    RAISE EXCEPTION 'complete seven-day graph revision is required' USING ERRCODE = '22023';
  END IF;
  IF p_action_type = 'PLAN_REPLACED' AND EXISTS (
    SELECT 1
      FROM (
        SELECT pg_catalog.count(*) AS total,
               pg_catalog.count(DISTINCT (day_item ->> 'date')::date) AS distinct_dates,
               pg_catalog.min((day_item ->> 'date')::date) AS first_date,
               pg_catalog.max((day_item ->> 'date')::date) AS last_date
          FROM pg_catalog.jsonb_array_elements(p_graph_snapshot -> 'days') AS day(day_item)
      ) coverage
     WHERE coverage.total <> 7 OR coverage.distinct_dates <> 7
        OR coverage.first_date <> (
          SELECT s.week_anchor FROM public.user_premium_plan_selections s
           WHERE s.user_id = p_account_id AND s.id = p_selection_id
        )
        OR coverage.last_date <> (
          SELECT s.week_anchor + 6 FROM public.user_premium_plan_selections s
           WHERE s.user_id = p_account_id AND s.id = p_selection_id
        )
  ) THEN
    RAISE EXCEPTION 'graph must cover the bound Monday-Sunday week exactly' USING ERRCODE = '22023';
  END IF;
  IF p_action_type IN ('ANNOTATION', 'ANNOTATION_RETRACTION')
     AND (p_new_plan_revision IS NOT NULL OR p_graph_snapshot IS NOT NULL) THEN
    RAISE EXCEPTION 'annotation cannot replace the plan graph' USING ERRCODE = '22023';
  END IF;
  IF p_event IS NULL OR pg_catalog.jsonb_typeof(p_event) <> 'object'
     OR COALESCE(p_event ->> 'kind', '') <> p_action_type THEN
    RAISE EXCEPTION 'one matching event is required' USING ERRCODE = '22023';
  END IF;

  PERFORM potok_nutrition.acquire_shared_account_gate_v1(p_account_id);

  SELECT o.* INTO v_existing
    FROM public.adaptive_nutrition_operations o
   WHERE o.user_id = p_account_id AND o.idempotency_key = p_idempotency_key
   FOR UPDATE;
  IF FOUND THEN
    IF v_existing.canonical_request <> p_canonical_request
       OR v_existing.request_digest <> p_request_digest
       OR v_existing.digest_version <> p_digest_version
       OR v_existing.contract_version <> p_contract_version
       OR v_existing.action_type <> p_action_type
       OR v_existing.selection_id IS DISTINCT FROM p_selection_id THEN
      RAISE EXCEPTION 'idempotency key payload mismatch' USING ERRCODE = '40001';
    END IF;
    IF v_existing.outcome = 'in_progress' THEN
      RAISE EXCEPTION 'operation result is unresolved' USING ERRCODE = '40001';
    END IF;
    RETURN v_existing.result_references;
  END IF;

  IF NOT potok_control.is_effective_entitlement_v2(
      p_account_id, 'premium', pg_catalog.statement_timestamp()
    ) THEN
    RAISE EXCEPTION 'verified Premium entitlement required' USING ERRCODE = '42501';
  END IF;

  SELECT s.* INTO v_selection
    FROM public.user_premium_plan_selections s
   WHERE s.user_id = p_account_id AND s.id = p_selection_id
   FOR UPDATE;
  IF NOT FOUND OR v_selection.contract_version <> 1 THEN
    RAISE EXCEPTION 'owned adaptive plan instance required' USING ERRCODE = '42501';
  END IF;
  IF ROW(v_selection.plan_revision, v_selection.goal_revision,
         v_selection.history_revision, v_selection.diary_revision)
     IS DISTINCT FROM ROW(p_expected_plan_revision, p_expected_goal_revision,
                          p_expected_history_revision, p_expected_diary_revision) THEN
    RAISE EXCEPTION 'stale adaptive plan revision' USING ERRCODE = '40001';
  END IF;
  IF (p_event ->> 'local_date')::date < v_selection.week_anchor
     OR (p_event ->> 'local_date')::date > v_selection.week_anchor + 6 THEN
    RAISE EXCEPTION 'event date is outside the bound week' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.jsonb_typeof(COALESCE(p_event -> 'component_manifest', '[]'::jsonb)) <> 'array'
     OR pg_catalog.jsonb_array_length(COALESCE(p_event -> 'component_manifest', '[]'::jsonb)) <> 0 THEN
    RAISE EXCEPTION 'FACT/component writes are not enabled by this boundary' USING ERRCODE = '0A000';
  END IF;
  IF p_action_type = 'ANNOTATION_RETRACTION' THEN
    IF NULLIF(p_event ->> 'supersedes_event_id', '') IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.adaptive_nutrition_events target
       WHERE target.user_id = p_account_id
         AND target.selection_id = p_selection_id
         AND target.event_id = (p_event ->> 'supersedes_event_id')::uuid
         AND target.stream_id = (p_event ->> 'stream_id')::uuid
         AND target.kind = 'ANNOTATION'
         AND target.local_date = (p_event ->> 'local_date')::date
    ) THEN
      RAISE EXCEPTION 'annotation retraction must supersede its live owned annotation' USING ERRCODE = '40001';
    END IF;
  ELSIF NULLIF(p_event ->> 'supersedes_event_id', '') IS NOT NULL THEN
    RAISE EXCEPTION 'only annotation retraction may supersede in this bounded package' USING ERRCODE = '0A000';
  END IF;
  IF p_new_history_revision IS NULL
     OR p_new_history_revision = p_expected_history_revision THEN
    RAISE EXCEPTION 'new history revision required' USING ERRCODE = '22023';
  END IF;
  IF p_expected_goal_revision <> v_selection.goal_revision
     OR NOT EXISTS (
       SELECT 1 FROM public.user_goals g
        WHERE g.user_id = p_account_id AND g.goal_revision = p_expected_goal_revision
     ) THEN
    RAISE EXCEPTION 'goal revision is no longer authoritative' USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.adaptive_nutrition_operations (
    user_id, idempotency_key, operation_id, selection_id, contract_version,
    action_type, canonical_request, digest_version, request_digest, outcome
  ) VALUES (
    p_account_id, p_idempotency_key, v_operation_id, p_selection_id,
    p_contract_version, p_action_type, p_canonical_request, p_digest_version,
    p_request_digest, 'in_progress'
  );

  IF p_new_plan_revision IS NOT NULL THEN
    INSERT INTO public.adaptive_nutrition_graph_revisions (
      user_id, selection_id, plan_revision, goal_revision, goal_snapshot,
      graph_snapshot, snapshot_encoding_version, content_digest,
      created_by_operation_id
    ) VALUES (
      p_account_id, p_selection_id, p_new_plan_revision,
      p_expected_goal_revision, p_goal_snapshot, p_graph_snapshot,
      p_snapshot_encoding_version, p_graph_digest, v_operation_id
    );
  END IF;

  v_event_id := (p_event ->> 'event_id')::uuid;
  v_stream_id := (p_event ->> 'stream_id')::uuid;
  SELECT COALESCE(pg_catalog.max(e.event_sequence), 0::bigint) + 1::bigint
    INTO v_event_sequence
    FROM public.adaptive_nutrition_events e
   WHERE e.user_id = p_account_id;

  INSERT INTO public.adaptive_nutrition_events (
    user_id, selection_id, event_id, operation_id, stream_id,
    event_sequence, event_index, kind, local_date, slot_id,
    source_plan_revision, source_goal_revision, snapshot, component_manifest,
    supersedes_event_id
  ) VALUES (
    p_account_id, p_selection_id, v_event_id, v_operation_id, v_stream_id,
    v_event_sequence, 0, p_action_type, (p_event ->> 'local_date')::date,
    NULLIF(p_event ->> 'slot_id', '')::uuid,
    COALESCE(p_new_plan_revision, p_expected_plan_revision),
    p_expected_goal_revision,
    COALESCE(p_event -> 'snapshot', '{}'::jsonb),
    COALESCE(p_event -> 'component_manifest', '[]'::jsonb),
    NULLIF(p_event ->> 'supersedes_event_id', '')::uuid
  );

  UPDATE public.user_premium_plan_selections
     SET plan_revision = COALESCE(p_new_plan_revision, plan_revision),
         history_revision = p_new_history_revision,
         updated_at = pg_catalog.statement_timestamp()
   WHERE user_id = p_account_id AND id = p_selection_id;

  v_result := pg_catalog.jsonb_build_object(
    'contract', 'adaptive-nutrition-receipt-v1',
    'outcome', 'accepted',
    'operation_id', v_operation_id,
    'selection_id', p_selection_id,
    'plan_revision', COALESCE(p_new_plan_revision, p_expected_plan_revision),
    'goal_revision', p_expected_goal_revision,
    'history_revision', p_new_history_revision,
    'diary_revision', p_expected_diary_revision,
    'event_ids', pg_catalog.jsonb_build_array(v_event_id)
  );

  UPDATE public.adaptive_nutrition_operations
     SET outcome = 'accepted', result_references = v_result,
         committed_at = pg_catalog.statement_timestamp()
   WHERE user_id = p_account_id AND idempotency_key = p_idempotency_key;
  RETURN v_result;
END
$function$;

CREATE TABLE potok_nutrition.nutrition_preference_snapshots_v1 (
  account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  revision_id uuid NOT NULL,
  supersedes_revision_id uuid NULL,
  canonical_bytes bytea NOT NULL,
  canonical_snapshot jsonb NOT NULL,
  canonical_digest bytea NOT NULL,
  dietary_pattern text NOT NULL,
  excluded_meal_types text[] NOT NULL,
  excluded_ingredient_ids uuid[] NOT NULL,
  excluded_recipe_ids uuid[] NOT NULL,
  liked_ingredient_ids uuid[] NOT NULL,
  disliked_ingredient_ids uuid[] NOT NULL,
  convenience_preference text NULL,
  meal_style_preferences text[] NOT NULL,
  created_at timestamptz NOT NULL,
  created_by_operation_id uuid NULL,
  CONSTRAINT nutrition_preference_snapshots_v1_pkey PRIMARY KEY (account_id, revision_id),
  CONSTRAINT nutrition_preference_snapshots_v1_supersedes_fk
    FOREIGN KEY (account_id, supersedes_revision_id)
    REFERENCES potok_nutrition.nutrition_preference_snapshots_v1(account_id, revision_id)
    ON DELETE RESTRICT,
  CONSTRAINT nutrition_preference_snapshots_v1_digest_check
    CHECK (pg_catalog.octet_length(canonical_digest) = 32),
  CONSTRAINT nutrition_preference_snapshots_v1_json_check
    CHECK (pg_catalog.jsonb_typeof(canonical_snapshot) = 'object'),
  CONSTRAINT nutrition_preference_snapshots_v1_pattern_check
    CHECK (dietary_pattern IN ('UNSPECIFIED', 'VEGETARIAN', 'VEGAN')),
  CONSTRAINT nutrition_preference_snapshots_v1_predecessor_check
    CHECK (revision_id IS DISTINCT FROM supersedes_revision_id)
);

CREATE UNIQUE INDEX nutrition_preference_snapshots_v1_one_successor_idx
  ON potok_nutrition.nutrition_preference_snapshots_v1(account_id, supersedes_revision_id)
  WHERE supersedes_revision_id IS NOT NULL;

CREATE TABLE potok_nutrition.nutrition_safety_snapshots_v1 (
  account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  revision_id uuid NOT NULL,
  supersedes_revision_id uuid NULL,
  canonical_bytes bytea NOT NULL,
  canonical_snapshot jsonb NOT NULL,
  canonical_digest bytea NOT NULL,
  declared_allergen_codes text[] NOT NULL,
  declared_intolerance_codes text[] NOT NULL,
  dietary_hard_exclusion_codes text[] NOT NULL,
  created_at timestamptz NOT NULL,
  created_by_operation_id uuid NULL,
  CONSTRAINT nutrition_safety_snapshots_v1_pkey PRIMARY KEY (account_id, revision_id),
  CONSTRAINT nutrition_safety_snapshots_v1_supersedes_fk
    FOREIGN KEY (account_id, supersedes_revision_id)
    REFERENCES potok_nutrition.nutrition_safety_snapshots_v1(account_id, revision_id)
    ON DELETE RESTRICT,
  CONSTRAINT nutrition_safety_snapshots_v1_digest_check
    CHECK (pg_catalog.octet_length(canonical_digest) = 32),
  CONSTRAINT nutrition_safety_snapshots_v1_json_check
    CHECK (pg_catalog.jsonb_typeof(canonical_snapshot) = 'object'),
  CONSTRAINT nutrition_safety_snapshots_v1_predecessor_check
    CHECK (revision_id IS DISTINCT FROM supersedes_revision_id)
);

CREATE UNIQUE INDEX nutrition_safety_snapshots_v1_one_successor_idx
  ON potok_nutrition.nutrition_safety_snapshots_v1(account_id, supersedes_revision_id)
  WHERE supersedes_revision_id IS NOT NULL;

CREATE TABLE potok_nutrition.nutrition_authority_heads_v1 (
  account_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  current_preference_revision uuid NOT NULL,
  current_safety_revision uuid NOT NULL,
  head_revision uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.statement_timestamp(),
  updated_by_operation_id uuid NULL,
  CONSTRAINT nutrition_authority_heads_v1_preference_fk
    FOREIGN KEY (account_id, current_preference_revision)
    REFERENCES potok_nutrition.nutrition_preference_snapshots_v1(account_id, revision_id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT nutrition_authority_heads_v1_safety_fk
    FOREIGN KEY (account_id, current_safety_revision)
    REFERENCES potok_nutrition.nutrition_safety_snapshots_v1(account_id, revision_id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE potok_nutrition.adaptive_nutrition_candidate_manifests_v2 (
  manifest_revision uuid PRIMARY KEY,
  supersedes_manifest_revision uuid NULL REFERENCES
    potok_nutrition.adaptive_nutrition_candidate_manifests_v2(manifest_revision) ON DELETE RESTRICT,
  publication_state text NOT NULL,
  canonical_bytes bytea NOT NULL,
  manifest_snapshot jsonb NOT NULL,
  canonical_digest bytea NOT NULL,
  published_at timestamptz NULL,
  publication_operation_id uuid NOT NULL UNIQUE,
  published_by_role name NOT NULL,
  CONSTRAINT adaptive_nutrition_candidate_manifests_v2_state_check
    CHECK (publication_state IN ('DRAFT', 'PUBLISHED')),
  CONSTRAINT adaptive_nutrition_candidate_manifests_v2_publish_check CHECK (
    (publication_state = 'DRAFT' AND published_at IS NULL)
    OR (publication_state = 'PUBLISHED' AND published_at IS NOT NULL)
  ),
  CONSTRAINT adaptive_nutrition_candidate_manifests_v2_digest_check
    CHECK (pg_catalog.octet_length(canonical_digest) = 32),
  CONSTRAINT adaptive_nutrition_candidate_manifests_v2_json_check
    CHECK (pg_catalog.jsonb_typeof(manifest_snapshot) = 'object'),
  CONSTRAINT adaptive_nutrition_candidate_manifests_v2_predecessor_check
    CHECK (manifest_revision IS DISTINCT FROM supersedes_manifest_revision)
);

CREATE UNIQUE INDEX adaptive_nutrition_candidate_manifests_v2_one_successor_idx
  ON potok_nutrition.adaptive_nutrition_candidate_manifests_v2(supersedes_manifest_revision)
  WHERE supersedes_manifest_revision IS NOT NULL;

CREATE TABLE potok_nutrition.adaptive_nutrition_candidate_manifest_entries_v2 (
  manifest_revision uuid NOT NULL REFERENCES
    potok_nutrition.adaptive_nutrition_candidate_manifests_v2(manifest_revision) ON DELETE RESTRICT,
  entry_index integer NOT NULL,
  recipe_id uuid NOT NULL,
  recipe_revision_id uuid NOT NULL,
  portion_revision_id uuid NOT NULL,
  eligibility_revision_id uuid NOT NULL,
  publication_revision uuid NOT NULL,
  canonical_evidence_revision uuid NOT NULL,
  canonical_evidence_digest bytea NOT NULL,
  nutrition_evidence_revision uuid NOT NULL,
  nutrition_evidence_digest bytea NOT NULL,
  allergen_evidence_revision uuid NOT NULL,
  dietary_evidence_revision uuid NOT NULL,
  ingredient_ids uuid[] NOT NULL,
  allergen_codes text[] NOT NULL,
  intolerance_codes text[] NOT NULL,
  dietary_codes text[] NOT NULL,
  allowed_meal_types text[] NOT NULL,
  component_role text NOT NULL,
  anchor_kind text NOT NULL,
  required_companion_role_sets jsonb NOT NULL,
  pairing_tags text[] NOT NULL,
  incompatible_pairing_tags text[] NOT NULL,
  repeat_family text NOT NULL,
  dominant_ingredient_family text NOT NULL,
  energy_class text NOT NULL,
  beverage_class text NOT NULL,
  accessibility_class text NOT NULL,
  specialty boolean NOT NULL,
  expensive boolean NOT NULL,
  portion_rules jsonb NOT NULL,
  recipe_snapshot jsonb NOT NULL,
  recipe_snapshot_digest bytea NOT NULL,
  entry_snapshot jsonb NOT NULL,
  CONSTRAINT adaptive_nutrition_candidate_manifest_entries_v2_pkey
    PRIMARY KEY (manifest_revision, entry_index),
  CONSTRAINT adaptive_nutrition_candidate_manifest_entries_v2_identity_unique
    UNIQUE (manifest_revision, recipe_id, recipe_revision_id, portion_revision_id, eligibility_revision_id),
  CONSTRAINT adaptive_nutrition_candidate_manifest_entries_v2_index_check CHECK (entry_index >= 0),
  CONSTRAINT adaptive_nutrition_candidate_manifest_entries_v2_digest_check CHECK (
    pg_catalog.octet_length(canonical_evidence_digest) = 32
    AND pg_catalog.octet_length(nutrition_evidence_digest) = 32
    AND pg_catalog.octet_length(recipe_snapshot_digest) = 32
  ),
  CONSTRAINT adaptive_nutrition_candidate_manifest_entries_v2_role_check CHECK (
    component_role IN ('MAIN_COMPONENT','CARB_SIDE','VEGETABLE_SIDE','SALAD','EXTRA','SAUCE','BEVERAGE')
  ),
  CONSTRAINT adaptive_nutrition_candidate_manifest_entries_v2_anchor_check
    CHECK (anchor_kind IN ('COMPLETE','PARTIAL','NONE')),
  CONSTRAINT adaptive_nutrition_candidate_manifest_entries_v2_json_check CHECK (
    pg_catalog.jsonb_typeof(required_companion_role_sets) = 'array'
    AND pg_catalog.jsonb_typeof(portion_rules) = 'object'
    AND pg_catalog.jsonb_typeof(recipe_snapshot) = 'object'
    AND pg_catalog.jsonb_typeof(entry_snapshot) = 'object'
  )
);

CREATE TABLE potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2 (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  current_manifest_revision uuid NOT NULL REFERENCES
    potok_nutrition.adaptive_nutrition_candidate_manifests_v2(manifest_revision) ON DELETE RESTRICT,
  head_revision uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.statement_timestamp(),
  publication_operation_id uuid NOT NULL
);

ALTER TABLE public.adaptive_nutrition_operations
  ADD COLUMN result_canonical bytea NULL,
  ADD COLUMN result_digest bytea NULL,
  ADD COLUMN result_plan_revision uuid NULL,
  ADD COLUMN result_graph_digest bytea NULL,
  ADD CONSTRAINT adaptive_nutrition_operations_v2_result_check CHECK (
    (result_canonical IS NULL AND result_digest IS NULL AND result_plan_revision IS NULL
      AND result_graph_digest IS NULL)
    OR (result_canonical IS NOT NULL AND result_digest IS NOT NULL
      AND pg_catalog.octet_length(result_digest) = 32
      AND result_plan_revision IS NOT NULL AND result_graph_digest IS NOT NULL
      AND pg_catalog.octet_length(result_graph_digest) = 32
      AND action_type IN ('PLAN_GENERATED_V2','PLAN_ACTIVATED_V2'))
  );

CREATE UNIQUE INDEX adaptive_nutrition_operations_operation_global_v2_idx
  ON public.adaptive_nutrition_operations(operation_id);

ALTER TABLE public.adaptive_nutrition_graph_revisions
  ADD COLUMN graph_contract text NULL,
  ADD COLUMN graph_contract_version smallint NULL,
  ADD COLUMN graph_canonical_bytes bytea NULL,
  ADD COLUMN generated_week_plan_digest bytea NULL,
  ADD COLUMN generation_input_digest bytea NULL,
  ADD COLUMN target_policy_revision uuid NULL,
  ADD COLUMN preference_revision uuid NULL,
  ADD COLUMN safety_revision uuid NULL,
  ADD COLUMN candidate_manifest_revision uuid NULL,
  ADD COLUMN candidate_manifest_digest bytea NULL,
  ADD COLUMN composition_policy_revision uuid NULL,
  ADD COLUMN validation_policy_revision uuid NULL,
  ADD COLUMN optimization_policy_revision uuid NULL,
  ADD COLUMN generation_policy_revision uuid NULL,
  ADD COLUMN generation_operation_id uuid NULL,
  ADD COLUMN activation_operation_id uuid NULL,
  ADD COLUMN supersedes_plan_revision uuid NULL,
  ADD CONSTRAINT adaptive_nutrition_graph_revisions_v2_shape_check CHECK (
    (graph_contract IS NULL AND graph_contract_version IS NULL AND graph_canonical_bytes IS NULL
      AND generated_week_plan_digest IS NULL AND generation_input_digest IS NULL
      AND target_policy_revision IS NULL AND preference_revision IS NULL AND safety_revision IS NULL
      AND candidate_manifest_revision IS NULL AND candidate_manifest_digest IS NULL
      AND composition_policy_revision IS NULL AND validation_policy_revision IS NULL
      AND optimization_policy_revision IS NULL AND generation_policy_revision IS NULL
      AND generation_operation_id IS NULL AND activation_operation_id IS NULL
      AND supersedes_plan_revision IS NULL)
    OR (graph_contract = 'adaptive_nutrition_graph_v2' AND graph_contract_version = 2
      AND graph_canonical_bytes IS NOT NULL AND pg_catalog.octet_length(content_digest) = 32
      AND generated_week_plan_digest IS NOT NULL
      AND pg_catalog.octet_length(generated_week_plan_digest) = 32
      AND generation_input_digest IS NOT NULL
      AND pg_catalog.octet_length(generation_input_digest) = 32
      AND target_policy_revision IS NOT NULL AND preference_revision IS NOT NULL
      AND safety_revision IS NOT NULL AND candidate_manifest_revision IS NOT NULL
      AND candidate_manifest_digest IS NOT NULL
      AND pg_catalog.octet_length(candidate_manifest_digest) = 32
      AND composition_policy_revision IS NOT NULL AND validation_policy_revision IS NOT NULL
      AND optimization_policy_revision IS NOT NULL AND generation_policy_revision IS NOT NULL
      AND generation_operation_id IS NOT NULL AND activation_operation_id IS NOT NULL
      AND activation_operation_id = created_by_operation_id
      AND snapshot_encoding_version = 'potok-adaptive-nutrition-graph-v2-canonical-json-v1')
  ),
  ADD CONSTRAINT adaptive_nutrition_graph_revisions_v2_manifest_fk
    FOREIGN KEY (candidate_manifest_revision)
    REFERENCES potok_nutrition.adaptive_nutrition_candidate_manifests_v2(manifest_revision)
    ON DELETE RESTRICT,
  ADD CONSTRAINT adaptive_nutrition_graph_revisions_v2_generation_operation_fk
    FOREIGN KEY (user_id, generation_operation_id)
    REFERENCES public.adaptive_nutrition_operations(user_id, operation_id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT adaptive_nutrition_graph_revisions_v2_activation_operation_fk
    FOREIGN KEY (user_id, activation_operation_id)
    REFERENCES public.adaptive_nutrition_operations(user_id, operation_id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT adaptive_nutrition_graph_revisions_v2_supersedes_fk
    FOREIGN KEY (user_id, selection_id, supersedes_plan_revision)
    REFERENCES public.adaptive_nutrition_graph_revisions(user_id, selection_id, plan_revision)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

CREATE UNIQUE INDEX adaptive_nutrition_graph_revisions_v2_digest_idx
  ON public.adaptive_nutrition_graph_revisions(user_id, graph_contract, content_digest)
  WHERE graph_contract = 'adaptive_nutrition_graph_v2';
CREATE UNIQUE INDEX adaptive_nutrition_graph_revisions_v2_one_successor_idx
  ON public.adaptive_nutrition_graph_revisions(user_id, selection_id, supersedes_plan_revision)
  WHERE graph_contract = 'adaptive_nutrition_graph_v2' AND supersedes_plan_revision IS NOT NULL;

CREATE FUNCTION potok_nutrition.reject_immutable_change_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION '% is immutable history', TG_TABLE_NAME USING ERRCODE = '55000';
END
$function$;

REVOKE ALL ON FUNCTION potok_nutrition.reject_immutable_change_v2()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER potok_preference_snapshots_immutable_v1
BEFORE UPDATE OR DELETE OR TRUNCATE ON potok_nutrition.nutrition_preference_snapshots_v1
FOR EACH STATEMENT EXECUTE FUNCTION potok_nutrition.reject_immutable_change_v2();
CREATE TRIGGER potok_safety_snapshots_immutable_v1
BEFORE UPDATE OR DELETE OR TRUNCATE ON potok_nutrition.nutrition_safety_snapshots_v1
FOR EACH STATEMENT EXECUTE FUNCTION potok_nutrition.reject_immutable_change_v2();
CREATE TRIGGER potok_candidate_manifest_headers_immutable_v2
BEFORE UPDATE OR DELETE OR TRUNCATE ON potok_nutrition.adaptive_nutrition_candidate_manifests_v2
FOR EACH STATEMENT EXECUTE FUNCTION potok_nutrition.reject_immutable_change_v2();
CREATE TRIGGER potok_candidate_manifest_entries_immutable_v2
BEFORE UPDATE OR DELETE OR TRUNCATE ON potok_nutrition.adaptive_nutrition_candidate_manifest_entries_v2
FOR EACH STATEMENT EXECUTE FUNCTION potok_nutrition.reject_immutable_change_v2();

ALTER TABLE potok_nutrition.nutrition_preference_snapshots_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.nutrition_preference_snapshots_v1 FORCE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.nutrition_safety_snapshots_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.nutrition_safety_snapshots_v1 FORCE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.nutrition_authority_heads_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.nutrition_authority_heads_v1 FORCE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.adaptive_nutrition_candidate_manifests_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.adaptive_nutrition_candidate_manifests_v2 FORCE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.adaptive_nutrition_candidate_manifest_entries_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.adaptive_nutrition_candidate_manifest_entries_v2 FORCE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2 FORCE ROW LEVEL SECURITY;

REVOKE ALL ON potok_nutrition.nutrition_preference_snapshots_v1,
  potok_nutrition.nutrition_safety_snapshots_v1,
  potok_nutrition.nutrition_authority_heads_v1,
  potok_nutrition.adaptive_nutrition_candidate_manifests_v2,
  potok_nutrition.adaptive_nutrition_candidate_manifest_entries_v2,
  potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2
  FROM PUBLIC, anon, authenticated, service_role;


CREATE FUNCTION potok_nutrition.require_canonical_json_v2(p_canonical_bytes bytea)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_raw json;
  v_value jsonb;
BEGIN
  IF p_canonical_bytes IS NULL OR pg_catalog.octet_length(p_canonical_bytes) = 0 THEN
    RAISE EXCEPTION 'canonical bytes required' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_raw := pg_catalog.convert_from(p_canonical_bytes, 'UTF8')::json;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'canonical bytes must be UTF8 JSON' USING ERRCODE = '22023';
  END;
  IF potok_nutrition.json_has_duplicate_keys_v1(v_raw) THEN
    RAISE EXCEPTION 'duplicate JSON keys rejected before jsonb' USING ERRCODE = '22023';
  END IF;
  v_value := v_raw::jsonb;
  IF pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(v_value), 'UTF8') <> p_canonical_bytes THEN
    RAISE EXCEPTION 'noncanonical JSON bytes' USING ERRCODE = '22023';
  END IF;
  RETURN v_value;
END
$function$;

REVOKE ALL ON FUNCTION potok_nutrition.require_canonical_json_v2(bytea)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION potok_nutrition.initialize_nutrition_authorities_v1(
  p_account_id uuid,
  p_head_revision uuid,
  p_preference_canonical bytea,
  p_safety_canonical bytea,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_preference jsonb := potok_nutrition.require_canonical_json_v2(p_preference_canonical);
  v_safety jsonb := potok_nutrition.require_canonical_json_v2(p_safety_canonical);
  v_preference_revision uuid;
  v_safety_revision uuid;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'protected nutrition authority channel not bound' USING ERRCODE = '42501';
  END IF;
  IF p_account_id IS NULL OR p_head_revision IS NULL OR p_operation_id IS NULL THEN
    RAISE EXCEPTION 'authority initialization identities required' USING ERRCODE = '22023';
  END IF;
  PERFORM potok_nutrition.acquire_shared_account_gate_v1(p_account_id);
  IF EXISTS (SELECT 1 FROM potok_nutrition.nutrition_authority_heads_v1 h WHERE h.account_id = p_account_id) THEN
    RAISE EXCEPTION 'nutrition authority head already initialized' USING ERRCODE = '23505';
  END IF;
  IF v_preference ->> 'contract' <> 'potok-nutrition-preference-snapshot-v1'
     OR NOT potok_nutrition.jsonb_has_exact_keys_v1(v_preference, ARRAY[
       'contract','accountId','revisionId','supersedesRevisionId','hard','soft','createdAt'
     ])
     OR NOT potok_nutrition.jsonb_has_exact_keys_v1(v_preference -> 'hard', ARRAY[
       'dietaryPattern','excludedMealTypes','excludedIngredientIds','excludedRecipeIds'
     ])
     OR NOT potok_nutrition.jsonb_has_exact_keys_v1(v_preference -> 'soft', ARRAY[
       'likedIngredientIds','dislikedIngredientIds','conveniencePreference','mealStylePreferences'
     ])
     OR (v_preference ->> 'accountId')::uuid <> p_account_id
     OR v_preference -> 'supersedesRevisionId' <> 'null'::jsonb
     OR pg_catalog.jsonb_typeof(v_preference -> 'hard') <> 'object'
     OR pg_catalog.jsonb_typeof(v_preference -> 'soft') <> 'object'
     OR v_safety ->> 'contract' <> 'potok-nutrition-safety-snapshot-v1'
     OR NOT potok_nutrition.jsonb_has_exact_keys_v1(v_safety, ARRAY[
       'contract','accountId','revisionId','supersedesRevisionId','declaredAllergenCodes',
       'declaredIntoleranceCodes','dietaryHardExclusionCodes','createdAt'
     ])
     OR (v_safety ->> 'accountId')::uuid <> p_account_id
     OR v_safety -> 'supersedesRevisionId' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'invalid explicit initial authority snapshots' USING ERRCODE = '22023';
  END IF;
  v_preference_revision := (v_preference ->> 'revisionId')::uuid;
  v_safety_revision := (v_safety ->> 'revisionId')::uuid;
  INSERT INTO potok_nutrition.nutrition_preference_snapshots_v1 (
    account_id, revision_id, supersedes_revision_id, canonical_bytes, canonical_snapshot,
    canonical_digest, dietary_pattern, excluded_meal_types, excluded_ingredient_ids,
    excluded_recipe_ids, liked_ingredient_ids, disliked_ingredient_ids,
    convenience_preference, meal_style_preferences, created_at, created_by_operation_id
  ) VALUES (
    p_account_id, v_preference_revision, NULL, p_preference_canonical, v_preference,
    extensions.digest(p_preference_canonical, 'sha256'), v_preference #>> '{hard,dietaryPattern}',
    ARRAY(SELECT jsonb_array_elements_text(v_preference #> '{hard,excludedMealTypes}') ORDER BY 1),
    ARRAY(SELECT jsonb_array_elements_text(v_preference #> '{hard,excludedIngredientIds}')::uuid ORDER BY 1),
    ARRAY(SELECT jsonb_array_elements_text(v_preference #> '{hard,excludedRecipeIds}')::uuid ORDER BY 1),
    ARRAY(SELECT jsonb_array_elements_text(v_preference #> '{soft,likedIngredientIds}')::uuid ORDER BY 1),
    ARRAY(SELECT jsonb_array_elements_text(v_preference #> '{soft,dislikedIngredientIds}')::uuid ORDER BY 1),
    v_preference #>> '{soft,conveniencePreference}',
    ARRAY(SELECT jsonb_array_elements_text(v_preference #> '{soft,mealStylePreferences}') ORDER BY 1),
    (v_preference ->> 'createdAt')::timestamptz, p_operation_id
  );
  INSERT INTO potok_nutrition.nutrition_safety_snapshots_v1 (
    account_id, revision_id, supersedes_revision_id, canonical_bytes, canonical_snapshot,
    canonical_digest, declared_allergen_codes, declared_intolerance_codes,
    dietary_hard_exclusion_codes, created_at, created_by_operation_id
  ) VALUES (
    p_account_id, v_safety_revision, NULL, p_safety_canonical, v_safety,
    extensions.digest(p_safety_canonical, 'sha256'),
    ARRAY(SELECT jsonb_array_elements_text(v_safety -> 'declaredAllergenCodes') ORDER BY 1),
    ARRAY(SELECT jsonb_array_elements_text(v_safety -> 'declaredIntoleranceCodes') ORDER BY 1),
    ARRAY(SELECT jsonb_array_elements_text(v_safety -> 'dietaryHardExclusionCodes') ORDER BY 1),
    (v_safety ->> 'createdAt')::timestamptz, p_operation_id
  );
  INSERT INTO potok_nutrition.nutrition_authority_heads_v1 (
    account_id, current_preference_revision, current_safety_revision, head_revision,
    updated_by_operation_id
  ) VALUES (p_account_id, v_preference_revision, v_safety_revision, p_head_revision, p_operation_id);
  RETURN pg_catalog.jsonb_build_object(
    'preference_revision', v_preference_revision,
    'preference_digest', pg_catalog.encode(extensions.digest(p_preference_canonical, 'sha256'), 'hex'),
    'safety_revision', v_safety_revision,
    'safety_digest', pg_catalog.encode(extensions.digest(p_safety_canonical, 'sha256'), 'hex'),
    'head_revision', p_head_revision
  );
END
$function$;

CREATE FUNCTION potok_nutrition.create_preference_successor_v1(
  p_account_id uuid, p_expected_head_revision uuid, p_new_head_revision uuid,
  p_snapshot_canonical bytea, p_operation_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE
  v_snapshot jsonb := potok_nutrition.require_canonical_json_v2(p_snapshot_canonical);
  v_head potok_nutrition.nutrition_authority_heads_v1%ROWTYPE;
  v_revision uuid;
  v_updated integer;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'protected preference authority channel not bound' USING ERRCODE = '42501';
  END IF;
  PERFORM potok_nutrition.acquire_shared_account_gate_v1(p_account_id);
  SELECT * INTO v_head FROM potok_nutrition.nutrition_authority_heads_v1
   WHERE account_id = p_account_id FOR UPDATE;
  IF NOT FOUND OR v_head.head_revision <> p_expected_head_revision THEN
    RAISE EXCEPTION 'preference head CAS conflict' USING ERRCODE = '40001';
  END IF;
  IF v_snapshot ->> 'contract' <> 'potok-nutrition-preference-snapshot-v1'
     OR NOT potok_nutrition.jsonb_has_exact_keys_v1(v_snapshot, ARRAY[
       'contract','accountId','revisionId','supersedesRevisionId','hard','soft','createdAt'
     ])
     OR NOT potok_nutrition.jsonb_has_exact_keys_v1(v_snapshot -> 'hard', ARRAY[
       'dietaryPattern','excludedMealTypes','excludedIngredientIds','excludedRecipeIds'
     ])
     OR NOT potok_nutrition.jsonb_has_exact_keys_v1(v_snapshot -> 'soft', ARRAY[
       'likedIngredientIds','dislikedIngredientIds','conveniencePreference','mealStylePreferences'
     ])
     OR (v_snapshot ->> 'accountId')::uuid <> p_account_id
     OR (v_snapshot ->> 'supersedesRevisionId')::uuid <> v_head.current_preference_revision
     OR pg_catalog.jsonb_typeof(v_snapshot -> 'hard') <> 'object'
     OR pg_catalog.jsonb_typeof(v_snapshot -> 'soft') <> 'object' THEN
    RAISE EXCEPTION 'invalid preference successor' USING ERRCODE = '22023';
  END IF;
  v_revision := (v_snapshot ->> 'revisionId')::uuid;
  INSERT INTO potok_nutrition.nutrition_preference_snapshots_v1 (
    account_id, revision_id, supersedes_revision_id, canonical_bytes, canonical_snapshot,
    canonical_digest, dietary_pattern, excluded_meal_types, excluded_ingredient_ids,
    excluded_recipe_ids, liked_ingredient_ids, disliked_ingredient_ids,
    convenience_preference, meal_style_preferences, created_at, created_by_operation_id
  ) VALUES (
    p_account_id, v_revision, v_head.current_preference_revision, p_snapshot_canonical, v_snapshot,
    extensions.digest(p_snapshot_canonical, 'sha256'), v_snapshot #>> '{hard,dietaryPattern}',
    ARRAY(SELECT jsonb_array_elements_text(v_snapshot #> '{hard,excludedMealTypes}') ORDER BY 1),
    ARRAY(SELECT jsonb_array_elements_text(v_snapshot #> '{hard,excludedIngredientIds}')::uuid ORDER BY 1),
    ARRAY(SELECT jsonb_array_elements_text(v_snapshot #> '{hard,excludedRecipeIds}')::uuid ORDER BY 1),
    ARRAY(SELECT jsonb_array_elements_text(v_snapshot #> '{soft,likedIngredientIds}')::uuid ORDER BY 1),
    ARRAY(SELECT jsonb_array_elements_text(v_snapshot #> '{soft,dislikedIngredientIds}')::uuid ORDER BY 1),
    v_snapshot #>> '{soft,conveniencePreference}',
    ARRAY(SELECT jsonb_array_elements_text(v_snapshot #> '{soft,mealStylePreferences}') ORDER BY 1),
    (v_snapshot ->> 'createdAt')::timestamptz, p_operation_id
  );
  UPDATE potok_nutrition.nutrition_authority_heads_v1
     SET current_preference_revision = v_revision, head_revision = p_new_head_revision,
         updated_at = pg_catalog.statement_timestamp(), updated_by_operation_id = p_operation_id
   WHERE account_id = p_account_id AND head_revision = p_expected_head_revision;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN RAISE EXCEPTION 'preference head CAS lost' USING ERRCODE = '40001'; END IF;
  RETURN pg_catalog.jsonb_build_object('revision_id', v_revision,
    'digest', pg_catalog.encode(extensions.digest(p_snapshot_canonical, 'sha256'), 'hex'),
    'head_revision', p_new_head_revision);
END
$function$;

CREATE FUNCTION potok_nutrition.create_safety_successor_v1(
  p_account_id uuid, p_expected_head_revision uuid, p_new_head_revision uuid,
  p_snapshot_canonical bytea, p_operation_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE
  v_snapshot jsonb := potok_nutrition.require_canonical_json_v2(p_snapshot_canonical);
  v_head potok_nutrition.nutrition_authority_heads_v1%ROWTYPE;
  v_revision uuid;
  v_updated integer;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'protected safety authority channel not bound' USING ERRCODE = '42501';
  END IF;
  PERFORM potok_nutrition.acquire_shared_account_gate_v1(p_account_id);
  SELECT * INTO v_head FROM potok_nutrition.nutrition_authority_heads_v1
   WHERE account_id = p_account_id FOR UPDATE;
  IF NOT FOUND OR v_head.head_revision <> p_expected_head_revision THEN
    RAISE EXCEPTION 'safety head CAS conflict' USING ERRCODE = '40001';
  END IF;
  IF v_snapshot ->> 'contract' <> 'potok-nutrition-safety-snapshot-v1'
     OR NOT potok_nutrition.jsonb_has_exact_keys_v1(v_snapshot, ARRAY[
       'contract','accountId','revisionId','supersedesRevisionId','declaredAllergenCodes',
       'declaredIntoleranceCodes','dietaryHardExclusionCodes','createdAt'
     ])
     OR (v_snapshot ->> 'accountId')::uuid <> p_account_id
     OR (v_snapshot ->> 'supersedesRevisionId')::uuid <> v_head.current_safety_revision THEN
    RAISE EXCEPTION 'invalid safety successor' USING ERRCODE = '22023';
  END IF;
  v_revision := (v_snapshot ->> 'revisionId')::uuid;
  INSERT INTO potok_nutrition.nutrition_safety_snapshots_v1 (
    account_id, revision_id, supersedes_revision_id, canonical_bytes, canonical_snapshot,
    canonical_digest, declared_allergen_codes, declared_intolerance_codes,
    dietary_hard_exclusion_codes, created_at, created_by_operation_id
  ) VALUES (
    p_account_id, v_revision, v_head.current_safety_revision, p_snapshot_canonical, v_snapshot,
    extensions.digest(p_snapshot_canonical, 'sha256'),
    ARRAY(SELECT jsonb_array_elements_text(v_snapshot -> 'declaredAllergenCodes') ORDER BY 1),
    ARRAY(SELECT jsonb_array_elements_text(v_snapshot -> 'declaredIntoleranceCodes') ORDER BY 1),
    ARRAY(SELECT jsonb_array_elements_text(v_snapshot -> 'dietaryHardExclusionCodes') ORDER BY 1),
    (v_snapshot ->> 'createdAt')::timestamptz, p_operation_id
  );
  UPDATE potok_nutrition.nutrition_authority_heads_v1
     SET current_safety_revision = v_revision, head_revision = p_new_head_revision,
         updated_at = pg_catalog.statement_timestamp(), updated_by_operation_id = p_operation_id
   WHERE account_id = p_account_id AND head_revision = p_expected_head_revision;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN RAISE EXCEPTION 'safety head CAS lost' USING ERRCODE = '40001'; END IF;
  RETURN pg_catalog.jsonb_build_object('revision_id', v_revision,
    'digest', pg_catalog.encode(extensions.digest(p_snapshot_canonical, 'sha256'), 'hex'),
    'head_revision', p_new_head_revision);
END
$function$;

CREATE FUNCTION potok_nutrition.publish_candidate_manifest_v2(
  p_manifest_canonical bytea,
  p_expected_head_revision uuid,
  p_new_head_revision uuid,
  p_publication_operation_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE
  v_manifest jsonb := potok_nutrition.require_canonical_json_v2(p_manifest_canonical);
  v_revision uuid;
  v_supersedes uuid;
  v_existing_head potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2%ROWTYPE;
  v_entry jsonb;
  v_index integer;
  v_had_head boolean;
  v_updated integer;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'owner-controlled manifest publication required' USING ERRCODE = '42501';
  END IF;
  IF p_new_head_revision IS NULL OR p_publication_operation_id IS NULL THEN
    RAISE EXCEPTION 'publication identities required' USING ERRCODE = '22023';
  END IF;
  IF v_manifest ->> 'contract' <> 'potok-adaptive-candidate-manifest-v2'
     OR v_manifest ->> 'encoding' <> 'potok-adaptive-candidate-manifest-v2-canonical-json-v1'
     OR NOT potok_nutrition.jsonb_has_exact_keys_v1(v_manifest, ARRAY[
       'contract','encoding','manifestRevision','supersedesManifestRevision',
       'publicationState','publishedAt','entries'
     ])
     OR v_manifest ->> 'publicationState' <> 'PUBLISHED'
     OR pg_catalog.jsonb_typeof(v_manifest -> 'entries') <> 'array'
     OR pg_catalog.jsonb_array_length(v_manifest -> 'entries') = 0 THEN
    RAISE EXCEPTION 'only non-empty reviewed PUBLISHED manifest v2 may be published' USING ERRCODE = '22023';
  END IF;
  v_revision := (v_manifest ->> 'manifestRevision')::uuid;
  v_supersedes := NULLIF(v_manifest ->> 'supersedesManifestRevision', '')::uuid;
  SELECT * INTO v_existing_head FROM potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2
   WHERE singleton FOR UPDATE;
  v_had_head := FOUND;
  IF v_had_head THEN
    IF v_existing_head.head_revision <> p_expected_head_revision
       OR v_existing_head.current_manifest_revision IS DISTINCT FROM v_supersedes THEN
      RAISE EXCEPTION 'manifest head CAS conflict' USING ERRCODE = '40001';
    END IF;
  ELSIF p_expected_head_revision IS NOT NULL OR v_supersedes IS NOT NULL THEN
    RAISE EXCEPTION 'initial manifest publication requires null predecessor/head' USING ERRCODE = '40001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (
      SELECT e.value ->> 'recipeId' recipe_id, e.value ->> 'recipeRevisionId' recipe_revision_id,
             e.value ->> 'portionRevisionId' portion_revision_id,
             e.value ->> 'eligibilityRevisionId' eligibility_revision_id,
             pg_catalog.count(*) OVER (PARTITION BY e.value ->> 'recipeId', e.value ->> 'recipeRevisionId',
               e.value ->> 'portionRevisionId', e.value ->> 'eligibilityRevisionId') duplicates
        FROM pg_catalog.jsonb_array_elements(v_manifest -> 'entries') e(value)
    ) x WHERE x.duplicates > 1
  ) THEN
    RAISE EXCEPTION 'duplicate manifest component identity' USING ERRCODE = '23505';
  END IF;
  INSERT INTO potok_nutrition.adaptive_nutrition_candidate_manifests_v2 (
    manifest_revision, supersedes_manifest_revision, publication_state, canonical_bytes,
    manifest_snapshot, canonical_digest, published_at, publication_operation_id, published_by_role
  ) VALUES (
    v_revision, v_supersedes, 'PUBLISHED', p_manifest_canonical, v_manifest,
    extensions.digest(p_manifest_canonical, 'sha256'),
    (v_manifest ->> 'publishedAt')::timestamptz, p_publication_operation_id, SESSION_USER::name
  );
  FOR v_entry, v_index IN
    SELECT e.value, (e.ordinality - 1)::integer
      FROM pg_catalog.jsonb_array_elements(v_manifest -> 'entries') WITH ORDINALITY e(value, ordinality)
  LOOP
    IF v_entry ->> 'publicationStatus' <> 'PUBLISHED'
       OR NOT potok_nutrition.jsonb_has_exact_keys_v1(v_entry, ARRAY[
         'recipeId','recipeRevisionId','portionRevisionId','eligibilityRevisionId',
         'publicationRevision','publicationStatus','canonicalEvidenceRevision',
         'canonicalEvidenceDigest','nutritionEvidenceRevision','nutritionEvidenceDigest',
         'allergenEvidenceRevision','dietaryEvidenceRevision','ingredientIds','allergenCodes',
         'intoleranceCodes','dietaryCodes','allowedMealTypes','role','anchorKind',
         'requiredCompanionRoleSets','pairingTags','incompatiblePairingTags','repeatFamily',
         'energyClass','beverageClass','dominantIngredientFamily','accessibility','specialty',
         'expensive','portionRules','recipeSnapshot','recipeSnapshotDigest'
       ])
       OR v_entry #>> '{portionRules,mode}' <> 'HYBRID'
       OR pg_catalog.jsonb_typeof(v_entry -> 'recipeSnapshot') <> 'object'
       OR pg_catalog.jsonb_typeof(v_entry -> 'allowedMealTypes') <> 'array'
       OR NOT (v_entry ->> 'canonicalEvidenceDigest' ~ '^[0-9a-f]{64}$')
       OR NOT (v_entry ->> 'nutritionEvidenceDigest' ~ '^[0-9a-f]{64}$')
       OR NOT (v_entry ->> 'recipeSnapshotDigest' ~ '^[0-9a-f]{64}$') THEN
      RAISE EXCEPTION 'invalid manifest entry at index %', v_index USING ERRCODE = '22023';
    END IF;
    IF extensions.digest(pg_catalog.convert_to(
         potok_nutrition.canonical_jsonb_text_v1(v_entry -> 'recipeSnapshot'), 'UTF8'
       ), 'sha256') <> pg_catalog.decode(v_entry ->> 'recipeSnapshotDigest', 'hex') THEN
      RAISE EXCEPTION 'recipe snapshot digest mismatch at index %', v_index USING ERRCODE = '22023';
    END IF;
    INSERT INTO potok_nutrition.adaptive_nutrition_candidate_manifest_entries_v2 (
      manifest_revision, entry_index, recipe_id, recipe_revision_id, portion_revision_id,
      eligibility_revision_id, publication_revision, canonical_evidence_revision,
      canonical_evidence_digest, nutrition_evidence_revision, nutrition_evidence_digest,
      allergen_evidence_revision, dietary_evidence_revision, ingredient_ids, allergen_codes,
      intolerance_codes, dietary_codes, allowed_meal_types, component_role, anchor_kind,
      required_companion_role_sets, pairing_tags, incompatible_pairing_tags, repeat_family,
      dominant_ingredient_family, energy_class, beverage_class, accessibility_class,
      specialty, expensive, portion_rules, recipe_snapshot, recipe_snapshot_digest, entry_snapshot
    ) VALUES (
      v_revision, v_index, (v_entry ->> 'recipeId')::uuid, (v_entry ->> 'recipeRevisionId')::uuid,
      (v_entry ->> 'portionRevisionId')::uuid, (v_entry ->> 'eligibilityRevisionId')::uuid,
      (v_entry ->> 'publicationRevision')::uuid, (v_entry ->> 'canonicalEvidenceRevision')::uuid,
      pg_catalog.decode(v_entry ->> 'canonicalEvidenceDigest', 'hex'),
      (v_entry ->> 'nutritionEvidenceRevision')::uuid,
      pg_catalog.decode(v_entry ->> 'nutritionEvidenceDigest', 'hex'),
      (v_entry ->> 'allergenEvidenceRevision')::uuid, (v_entry ->> 'dietaryEvidenceRevision')::uuid,
      ARRAY(SELECT jsonb_array_elements_text(v_entry -> 'ingredientIds')::uuid ORDER BY 1),
      ARRAY(SELECT jsonb_array_elements_text(v_entry -> 'allergenCodes') ORDER BY 1),
      ARRAY(SELECT jsonb_array_elements_text(v_entry -> 'intoleranceCodes') ORDER BY 1),
      ARRAY(SELECT jsonb_array_elements_text(v_entry -> 'dietaryCodes') ORDER BY 1),
      ARRAY(SELECT jsonb_array_elements_text(v_entry -> 'allowedMealTypes') ORDER BY 1),
      v_entry ->> 'role', v_entry ->> 'anchorKind', v_entry -> 'requiredCompanionRoleSets',
      ARRAY(SELECT jsonb_array_elements_text(v_entry -> 'pairingTags') ORDER BY 1),
      ARRAY(SELECT jsonb_array_elements_text(v_entry -> 'incompatiblePairingTags') ORDER BY 1),
      v_entry ->> 'repeatFamily', v_entry ->> 'dominantIngredientFamily',
      v_entry ->> 'energyClass', v_entry ->> 'beverageClass', v_entry ->> 'accessibility',
      (v_entry ->> 'specialty')::boolean, (v_entry ->> 'expensive')::boolean,
      v_entry -> 'portionRules', v_entry -> 'recipeSnapshot',
      pg_catalog.decode(v_entry ->> 'recipeSnapshotDigest', 'hex'), v_entry
    );
  END LOOP;
  IF v_had_head THEN
    UPDATE potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2
       SET current_manifest_revision = v_revision, head_revision = p_new_head_revision,
           updated_at = pg_catalog.statement_timestamp(), publication_operation_id = p_publication_operation_id
     WHERE singleton AND head_revision = p_expected_head_revision;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 1 THEN
      RAISE EXCEPTION 'manifest head CAS lost' USING ERRCODE = '40001';
    END IF;
  ELSE
    INSERT INTO potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2 (
      singleton, current_manifest_revision, head_revision, publication_operation_id
    ) VALUES (true, v_revision, p_new_head_revision, p_publication_operation_id);
  END IF;
  RETURN pg_catalog.jsonb_build_object('manifest_revision', v_revision,
    'digest', pg_catalog.encode(extensions.digest(p_manifest_canonical, 'sha256'), 'hex'),
    'entry_count', pg_catalog.jsonb_array_length(v_manifest -> 'entries'),
    'head_revision', p_new_head_revision);
END
$function$;

CREATE FUNCTION potok_nutrition.record_generated_week_v2(
  p_account_id uuid,
  p_selection_id uuid,
  p_idempotency_key uuid,
  p_generation_input_canonical bytea,
  p_generated_week_plan_canonical bytea
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE
  v_input jsonb := potok_nutrition.require_canonical_json_v2(p_generation_input_canonical);
  v_result jsonb := potok_nutrition.require_canonical_json_v2(p_generated_week_plan_canonical);
  v_existing public.adaptive_nutrition_operations%ROWTYPE;
  v_operation_id uuid := pg_catalog.gen_random_uuid();
  v_plan_revision uuid;
  v_graph_digest bytea;
  v_graph jsonb;
  v_graph_bytes bytea;
  v_input_digest bytea;
  v_content_digest bytea;
  v_receipt jsonb;
  v_selection public.user_premium_plan_selections%ROWTYPE;
  v_authority potok_nutrition.nutrition_authority_heads_v1%ROWTYPE;
  v_manifest_head potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2%ROWTYPE;
  v_manifest potok_nutrition.adaptive_nutrition_candidate_manifests_v2%ROWTYPE;
  v_entitlement_revision uuid;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'PROTECTED_EXECUTION_CHANNEL_NOT_YET_BOUND' USING ERRCODE = '42501';
  END IF;
  IF p_account_id IS NULL OR p_selection_id IS NULL OR p_idempotency_key IS NULL
     OR v_input ->> 'contract' <> 'potok-adaptive-trusted-generation-input-v1'
     OR v_input ->> 'accountGateContract' <> 'potok-shared-account-gate-v1'
     OR NOT potok_nutrition.jsonb_has_exact_keys_v1(v_input, ARRAY[
       'contract','accountGateContract','accountId','selection','weekStartLocal','timezone',
       'goalNutritionTarget','preferenceRevision','safetyRevision','entitlementEvidenceRevision',
       'candidateManifestRevision','candidateManifestDigest','compositionPolicyRevision',
       'validationPolicyRevision','optimizationPolicyRevision','generationPolicyRevision','operation'
     ])
     OR NOT potok_nutrition.jsonb_has_exact_keys_v1(v_input -> 'selection', ARRAY[
       'selectionId','planSelectionRevision','expectedStatus','expectedPlanRevision','proposedPlanRevision'
     ])
     OR (v_input ->> 'accountId')::uuid <> p_account_id
     OR (v_input #>> '{selection,selectionId}')::uuid <> p_selection_id
     OR v_input #>> '{selection,expectedStatus}' <> 'pending_generation'
     OR v_input #> '{selection,expectedPlanRevision}' <> 'null'::jsonb
     OR v_result ->> 'contract' <> 'potok-adaptive-generated-week-plan-v1'
     OR NOT potok_nutrition.jsonb_has_exact_keys_v1(v_result, ARRAY[
       'contract','accountId','selectionId','planSelectionRevision','weekStartLocal','timezone',
       'generationInputDigest','generationPolicyRevision','candidateManifestDigest','goalRevision',
       'targetPolicyRevision','proposedPlanRevision','graph','graphDigest','generatedAt','facts',
       'deterministicContentDigest'
     ])
     OR v_result ->> 'accountId' <> p_account_id::text
     OR v_result ->> 'selectionId' <> p_selection_id::text
     OR v_result -> 'generatedAt' <> 'null'::jsonb
     OR v_result -> 'facts' <> '[]'::jsonb THEN
    RAISE EXCEPTION 'invalid trusted generation envelope' USING ERRCODE = '22023';
  END IF;
  v_plan_revision := (v_input #>> '{selection,proposedPlanRevision}')::uuid;
  v_graph := v_result -> 'graph';
  v_graph_bytes := pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(
    pg_catalog.jsonb_build_object(
      'encoding','potok-adaptive-nutrition-graph-v2-canonical-json-v1',
      'contract','adaptive_nutrition_graph_v2','graph',v_graph
    )
  ),'UTF8');
  v_graph_digest := extensions.digest(v_graph_bytes,'sha256');
  v_input_digest := extensions.digest(pg_catalog.convert_to(
    potok_nutrition.canonical_jsonb_text_v1(pg_catalog.jsonb_build_object(
      'contract','potok-adaptive-trusted-generation-input-v1','input',v_input
    )),'UTF8'),'sha256');
  v_content_digest := extensions.digest(pg_catalog.convert_to(
    potok_nutrition.canonical_jsonb_text_v1(v_result - 'deterministicContentDigest'),'UTF8'),'sha256');
  IF NOT (v_result ->> 'graphDigest' ~ '^[0-9a-f]{64}$')
     OR NOT (v_result ->> 'generationInputDigest' ~ '^[0-9a-f]{64}$')
     OR NOT (v_result ->> 'deterministicContentDigest' ~ '^[0-9a-f]{64}$')
     OR pg_catalog.decode(v_result ->> 'graphDigest','hex') <> v_graph_digest
     OR pg_catalog.decode(v_result ->> 'generationInputDigest','hex') <> v_input_digest
     OR pg_catalog.decode(v_result ->> 'deterministicContentDigest','hex') <> v_content_digest
     OR v_result ->> 'planSelectionRevision' <> v_input #>> '{selection,planSelectionRevision}'
     OR v_result ->> 'weekStartLocal' <> v_input ->> 'weekStartLocal'
     OR v_result ->> 'timezone' <> v_input ->> 'timezone'
     OR v_result ->> 'generationPolicyRevision' <> v_input ->> 'generationPolicyRevision'
     OR v_result ->> 'candidateManifestDigest' <> v_input ->> 'candidateManifestDigest'
     OR v_result ->> 'goalRevision' <> v_input #>> '{goalNutritionTarget,goalRevision}'
     OR v_result ->> 'targetPolicyRevision' <> v_input #>> '{goalNutritionTarget,targetPolicyRevision}'
     OR v_result ->> 'proposedPlanRevision' <> v_plan_revision::text
     OR v_graph ->> 'contract' <> 'adaptive_nutrition_graph_v2'
     OR (v_graph ->> 'contractVersion')::integer <> 2
     OR v_graph ->> 'selectionId' <> p_selection_id::text
     OR v_graph ->> 'planSelectionRevision' <> v_input #>> '{selection,planSelectionRevision}'
     OR v_graph ->> 'planRevision' <> v_plan_revision::text
     OR v_graph ->> 'weekStartLocal' <> v_input ->> 'weekStartLocal'
     OR v_graph ->> 'timezone' <> v_input ->> 'timezone'
     OR v_graph ->> 'goalRevision' <> v_input #>> '{goalNutritionTarget,goalRevision}'
     OR v_graph ->> 'targetPolicyRevision' <> v_input #>> '{goalNutritionTarget,targetPolicyRevision}'
     OR v_graph ->> 'preferenceRevision' <> v_input ->> 'preferenceRevision'
     OR v_graph ->> 'safetyRevision' <> v_input ->> 'safetyRevision'
     OR v_graph ->> 'catalogManifestRevision' <> v_input ->> 'candidateManifestRevision'
     OR v_graph ->> 'candidateManifestDigest' <> v_input ->> 'candidateManifestDigest'
     OR v_graph ->> 'compositionPolicyRevision' <> v_input ->> 'compositionPolicyRevision'
     OR v_graph ->> 'validationPolicyRevision' <> v_input ->> 'validationPolicyRevision'
     OR v_graph ->> 'optimizationPolicyRevision' <> v_input ->> 'optimizationPolicyRevision'
     OR v_graph ->> 'generationPolicyRevision' <> v_input ->> 'generationPolicyRevision'
     OR pg_catalog.jsonb_typeof(v_graph -> 'days') <> 'array'
     OR pg_catalog.jsonb_array_length(v_graph -> 'days') <> 7 THEN
    RAISE EXCEPTION 'generated week binding/digest mismatch' USING ERRCODE = '22023';
  END IF;
  PERFORM potok_nutrition.acquire_shared_account_gate_v1(p_account_id);
  SELECT * INTO v_existing FROM public.adaptive_nutrition_operations
   WHERE user_id = p_account_id AND idempotency_key = p_idempotency_key::text FOR UPDATE;
  IF FOUND THEN
    IF v_existing.action_type <> 'PLAN_GENERATED_V2'
       OR v_existing.canonical_request <> p_generation_input_canonical
       OR v_existing.request_digest <> extensions.digest(p_generation_input_canonical, 'sha256') THEN
      RAISE EXCEPTION 'IDEMPOTENCY_PAYLOAD_MISMATCH' USING ERRCODE = '40001';
    END IF;
    IF v_existing.outcome = 'in_progress' THEN
      RETURN pg_catalog.jsonb_build_object('kind','unknown','operation_id',v_existing.operation_id);
    END IF;
    RETURN v_existing.result_references;
  END IF;
  IF NOT potok_control.is_effective_entitlement_v2(p_account_id, 'premium', pg_catalog.statement_timestamp()) THEN
    RAISE EXCEPTION 'verified Premium entitlement required' USING ERRCODE = '42501';
  END IF;
  SELECT a.attestation_id INTO v_entitlement_revision
    FROM potok_control.access_attestations a
   WHERE a.account_id=p_account_id AND a.capability='premium'
     AND a.issued_at <= pg_catalog.statement_timestamp()
   ORDER BY a.lineage_sequence DESC LIMIT 1;
  SELECT * INTO v_selection FROM public.user_premium_plan_selections s
   WHERE s.user_id=p_account_id AND s.id=p_selection_id FOR UPDATE;
  IF NOT FOUND OR v_selection.status <> 'pending_generation' OR v_selection.plan_revision IS NOT NULL
     OR v_selection.goal_revision <> (v_input #>> '{goalNutritionTarget,goalRevision}')::uuid
     OR v_input #>> '{selection,planSelectionRevision}' <>
       v_selection.origin_lineage ->> 'provisionOperationId'
     OR v_input ->> 'weekStartLocal' <> v_selection.week_anchor::text
     OR v_input ->> 'timezone' <> v_selection.timezone
     OR (v_input ->> 'entitlementEvidenceRevision')::uuid IS DISTINCT FROM v_entitlement_revision THEN
    RAISE EXCEPTION 'selection/Goal/week/entitlement CAS conflict' USING ERRCODE = '40001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_goals g
    WHERE g.user_id=p_account_id AND g.goal_revision=v_selection.goal_revision FOR SHARE) THEN
    RAISE EXCEPTION 'Goal revision stale' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO v_authority FROM potok_nutrition.nutrition_authority_heads_v1
   WHERE account_id=p_account_id FOR UPDATE;
  IF NOT FOUND OR v_authority.current_preference_revision <> (v_input ->> 'preferenceRevision')::uuid
     OR v_authority.current_safety_revision <> (v_input ->> 'safetyRevision')::uuid THEN
    RAISE EXCEPTION 'preference/safety authority stale' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO STRICT v_manifest_head
    FROM potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2 WHERE singleton FOR SHARE;
  SELECT * INTO STRICT v_manifest FROM potok_nutrition.adaptive_nutrition_candidate_manifests_v2
   WHERE manifest_revision=v_manifest_head.current_manifest_revision FOR SHARE;
  IF v_manifest.publication_state <> 'PUBLISHED'
     OR v_manifest.manifest_revision <> (v_input ->> 'candidateManifestRevision')::uuid
     OR v_manifest.canonical_digest <> pg_catalog.decode(v_input ->> 'candidateManifestDigest','hex')
     OR extensions.digest(v_manifest.canonical_bytes,'sha256') <> v_manifest.canonical_digest THEN
    RAISE EXCEPTION 'candidate manifest CAS/integrity conflict' USING ERRCODE = '40001';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_array_elements(v_graph -> 'days') d(day_item),
           LATERAL pg_catalog.jsonb_array_elements(d.day_item -> 'slots') s(slot_item),
           LATERAL pg_catalog.jsonb_array_elements(s.slot_item #> '{mealSnapshot,components}') c(component)
     WHERE NOT EXISTS (
       SELECT 1 FROM potok_nutrition.adaptive_nutrition_candidate_manifest_entries_v2 e
        WHERE e.manifest_revision=v_manifest.manifest_revision
          AND e.recipe_id=(c.component ->> 'recipeId')::uuid
          AND e.recipe_revision_id=(c.component ->> 'recipeRevision')::uuid
          AND e.portion_revision_id=(c.component ->> 'portionRevision')::uuid
          AND e.eligibility_revision_id=(c.component #>> '{eligibility,eligibilityRevisionId}')::uuid
          AND e.recipe_snapshot=c.component -> 'recipe'
     )
  ) THEN RAISE EXCEPTION 'manifest component missing' USING ERRCODE = '22023'; END IF;
  v_receipt := pg_catalog.jsonb_build_object(
    'kind','settled','contract','potok-adaptive-plan-generated-v2','outcome','accepted',
    'operation_id',v_operation_id,'selection_id',p_selection_id,
    'plan_revision',v_plan_revision,'graph_digest_hex',pg_catalog.encode(v_graph_digest,'hex')
  );
  INSERT INTO public.adaptive_nutrition_operations (
    user_id,idempotency_key,operation_id,selection_id,contract_version,action_type,
    canonical_request,digest_version,request_digest,outcome,result_references,committed_at,
    result_canonical,result_digest,result_plan_revision,result_graph_digest
  ) VALUES (
    p_account_id,p_idempotency_key::text,v_operation_id,p_selection_id,
    'adaptive-nutrition-v2','PLAN_GENERATED_V2',p_generation_input_canonical,
    'potok-adaptive-trusted-generation-input-v1/sha256',
    extensions.digest(p_generation_input_canonical,'sha256'),'accepted',v_receipt,
    pg_catalog.statement_timestamp(),p_generated_week_plan_canonical,
    extensions.digest(p_generated_week_plan_canonical,'sha256'),v_plan_revision,v_graph_digest
  );
  RETURN v_receipt;
END
$function$;

CREATE FUNCTION potok_nutrition.activate_generated_week_v2(
  p_generation_operation_id uuid,
  p_activation_idempotency_key uuid,
  p_expected_plan_revision uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE
  v_generation public.adaptive_nutrition_operations%ROWTYPE;
  v_existing public.adaptive_nutrition_operations%ROWTYPE;
  v_selection public.user_premium_plan_selections%ROWTYPE;
  v_authority potok_nutrition.nutrition_authority_heads_v1%ROWTYPE;
  v_manifest_head potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2%ROWTYPE;
  v_manifest potok_nutrition.adaptive_nutrition_candidate_manifests_v2%ROWTYPE;
  v_input jsonb;
  v_plan jsonb;
  v_graph jsonb;
  v_graph_bytes bytea;
  v_account_id uuid;
  v_selection_id uuid;
  v_plan_revision uuid;
  v_operation_id uuid := pg_catalog.gen_random_uuid();
  v_request bytea;
  v_request_digest bytea;
  v_receipt jsonb;
  v_updated integer;
  v_entitlement_revision uuid;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'PROTECTED_EXECUTION_CHANNEL_NOT_YET_BOUND' USING ERRCODE = '42501';
  END IF;
  IF p_generation_operation_id IS NULL OR p_activation_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'activation identities required' USING ERRCODE = '22023';
  END IF;
  IF p_expected_plan_revision IS NOT NULL THEN
    RAISE EXCEPTION 'initial pending-to-active activation requires null expected head'
      USING ERRCODE = '40001';
  END IF;
  SELECT * INTO STRICT v_generation FROM public.adaptive_nutrition_operations
   WHERE operation_id = p_generation_operation_id;
  IF v_generation.action_type <> 'PLAN_GENERATED_V2' OR v_generation.outcome <> 'accepted'
     OR v_generation.result_canonical IS NULL OR v_generation.result_digest IS NULL THEN
    RAISE EXCEPTION 'settled generation receipt required' USING ERRCODE = '40001';
  END IF;
  v_account_id := v_generation.user_id;
  v_selection_id := v_generation.selection_id;
  v_plan_revision := v_generation.result_plan_revision;
  PERFORM potok_nutrition.acquire_shared_account_gate_v1(v_account_id);
  v_request := pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(
    pg_catalog.jsonb_build_object('contract','potok-adaptive-activate-generated-week-v2',
      'generationOperationId',p_generation_operation_id,
      'expectedPlanRevision',p_expected_plan_revision)
  ), 'UTF8');
  v_request_digest := extensions.digest(v_request,'sha256');
  SELECT * INTO v_existing FROM public.adaptive_nutrition_operations
   WHERE user_id = v_account_id AND idempotency_key = p_activation_idempotency_key::text FOR UPDATE;
  IF FOUND THEN
    IF v_existing.action_type <> 'PLAN_ACTIVATED_V2'
       OR v_existing.canonical_request <> v_request
       OR v_existing.request_digest <> v_request_digest THEN
      RAISE EXCEPTION 'IDEMPOTENCY_PAYLOAD_MISMATCH' USING ERRCODE = '40001';
    END IF;
    IF v_existing.outcome = 'in_progress' THEN
      RETURN pg_catalog.jsonb_build_object('kind','unknown','operation_id',v_existing.operation_id);
    END IF;
    RETURN v_existing.result_references;
  END IF;
  IF NOT potok_control.is_effective_entitlement_v2(v_account_id,'premium',pg_catalog.statement_timestamp()) THEN
    RAISE EXCEPTION 'verified Premium entitlement required' USING ERRCODE = '42501';
  END IF;
  SELECT a.attestation_id INTO v_entitlement_revision
    FROM potok_control.access_attestations a
   WHERE a.account_id=v_account_id AND a.capability='premium'
     AND a.issued_at <= pg_catalog.statement_timestamp()
   ORDER BY a.lineage_sequence DESC LIMIT 1;
  SELECT * INTO v_selection FROM public.user_premium_plan_selections
   WHERE user_id = v_account_id AND id = v_selection_id FOR UPDATE;
  IF NOT FOUND OR v_selection.status <> 'pending_generation' OR v_selection.plan_revision IS NOT NULL
     OR v_selection.goal_revision <> (potok_nutrition.require_canonical_json_v2(v_generation.canonical_request)
       #>> '{goalNutritionTarget,goalRevision}')::uuid THEN
    RAISE EXCEPTION 'selection/Goal CAS conflict' USING ERRCODE = '40001';
  END IF;
  v_input := potok_nutrition.require_canonical_json_v2(v_generation.canonical_request);
  v_plan := potok_nutrition.require_canonical_json_v2(v_generation.result_canonical);
  v_graph := v_plan -> 'graph';
  v_graph_bytes := pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(
    pg_catalog.jsonb_build_object(
      'encoding','potok-adaptive-nutrition-graph-v2-canonical-json-v1',
      'contract','adaptive_nutrition_graph_v2','graph',v_graph
    )
  ),'UTF8');
  IF extensions.digest(v_generation.result_canonical,'sha256') <> v_generation.result_digest
     OR extensions.digest(v_graph_bytes,'sha256') <> v_generation.result_graph_digest
     OR pg_catalog.decode(v_plan ->> 'graphDigest','hex') <> v_generation.result_graph_digest
     OR pg_catalog.decode(v_plan ->> 'generationInputDigest','hex') <>
       extensions.digest(pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(
         pg_catalog.jsonb_build_object(
           'contract','potok-adaptive-trusted-generation-input-v1','input',v_input
         )),'UTF8'),'sha256')
     OR pg_catalog.decode(v_plan ->> 'deterministicContentDigest','hex') <>
       extensions.digest(pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(
         v_plan - 'deterministicContentDigest'
       ),'UTF8'),'sha256')
     OR (v_graph ->> 'planRevision')::uuid <> v_plan_revision
     OR (v_graph ->> 'selectionId')::uuid <> v_selection_id
     OR (v_graph ->> 'goalRevision')::uuid <> v_selection.goal_revision
     OR v_graph ->> 'contract' <> 'adaptive_nutrition_graph_v2'
     OR (v_graph ->> 'contractVersion')::integer <> 2
     OR v_input #>> '{selection,expectedStatus}' <> 'pending_generation'
     OR v_input #> '{selection,expectedPlanRevision}' <> 'null'::jsonb
     OR (v_input #>> '{selection,proposedPlanRevision}')::uuid <> v_plan_revision
     OR v_input #>> '{selection,planSelectionRevision}' <>
       v_selection.origin_lineage ->> 'provisionOperationId'
     OR v_graph ->> 'planSelectionRevision' <>
       v_selection.origin_lineage ->> 'provisionOperationId'
     OR (v_input ->> 'entitlementEvidenceRevision')::uuid IS DISTINCT FROM v_entitlement_revision
     OR v_input ->> 'weekStartLocal' <> v_selection.week_anchor::text
     OR v_graph ->> 'weekStartLocal' <> v_selection.week_anchor::text
     OR v_input ->> 'timezone' <> v_selection.timezone
     OR v_graph ->> 'timezone' <> v_selection.timezone
     OR v_graph ->> 'preferenceRevision' <> v_input ->> 'preferenceRevision'
     OR v_graph ->> 'safetyRevision' <> v_input ->> 'safetyRevision'
     OR v_graph ->> 'catalogManifestRevision' <> v_input ->> 'candidateManifestRevision'
     OR v_graph ->> 'candidateManifestDigest' <> v_input ->> 'candidateManifestDigest'
     OR v_graph ->> 'compositionPolicyRevision' <> v_input ->> 'compositionPolicyRevision'
     OR v_graph ->> 'validationPolicyRevision' <> v_input ->> 'validationPolicyRevision'
     OR v_graph ->> 'optimizationPolicyRevision' <> v_input ->> 'optimizationPolicyRevision'
     OR v_graph ->> 'generationPolicyRevision' <> v_input ->> 'generationPolicyRevision'
     OR pg_catalog.jsonb_typeof(v_graph -> 'days') <> 'array'
     OR pg_catalog.jsonb_array_length(v_graph -> 'days') <> 7 THEN
    RAISE EXCEPTION 'Graph v2 / GeneratedWeekPlan digest or identity mismatch' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_goals g
    WHERE g.user_id = v_account_id AND g.goal_revision = v_selection.goal_revision FOR SHARE) THEN
    RAISE EXCEPTION 'Goal revision stale' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO v_authority FROM potok_nutrition.nutrition_authority_heads_v1
   WHERE account_id = v_account_id FOR UPDATE;
  IF NOT FOUND OR v_authority.current_preference_revision <> (v_input ->> 'preferenceRevision')::uuid
     OR v_authority.current_safety_revision <> (v_input ->> 'safetyRevision')::uuid THEN
    RAISE EXCEPTION 'preference/safety authority stale' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO STRICT v_manifest_head
    FROM potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2 WHERE singleton FOR SHARE;
  SELECT * INTO STRICT v_manifest FROM potok_nutrition.adaptive_nutrition_candidate_manifests_v2
   WHERE manifest_revision = v_manifest_head.current_manifest_revision FOR SHARE;
  IF v_manifest.publication_state <> 'PUBLISHED'
     OR v_manifest.manifest_revision <> (v_input ->> 'candidateManifestRevision')::uuid
     OR v_manifest.canonical_digest <> pg_catalog.decode(v_input ->> 'candidateManifestDigest','hex')
     OR extensions.digest(v_manifest.canonical_bytes,'sha256') <> v_manifest.canonical_digest THEN
    RAISE EXCEPTION 'candidate manifest CAS/integrity conflict' USING ERRCODE = '40001';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_array_elements(v_graph -> 'days') d(day_item),
           LATERAL pg_catalog.jsonb_array_elements(d.day_item -> 'slots') s(slot_item),
           LATERAL pg_catalog.jsonb_array_elements(s.slot_item #> '{mealSnapshot,components}') c(component)
     WHERE NOT EXISTS (
       SELECT 1 FROM potok_nutrition.adaptive_nutrition_candidate_manifest_entries_v2 e
        WHERE e.manifest_revision = v_manifest.manifest_revision
          AND e.recipe_id = (c.component ->> 'recipeId')::uuid
          AND e.recipe_revision_id = (c.component ->> 'recipeRevision')::uuid
          AND e.portion_revision_id = (c.component ->> 'portionRevision')::uuid
          AND e.eligibility_revision_id = (c.component #>> '{eligibility,eligibilityRevisionId}')::uuid
          AND e.recipe_snapshot = c.component -> 'recipe'
     )
  ) THEN RAISE EXCEPTION 'manifest component missing' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.adaptive_nutrition_operations (
    user_id,idempotency_key,operation_id,selection_id,contract_version,action_type,
    canonical_request,digest_version,request_digest,outcome
  ) VALUES (
    v_account_id,p_activation_idempotency_key::text,v_operation_id,v_selection_id,
    'adaptive-nutrition-v2','PLAN_ACTIVATED_V2',v_request,
    'potok-adaptive-activate-generated-week-v2/sha256',v_request_digest,'in_progress'
  );
  INSERT INTO public.adaptive_nutrition_graph_revisions (
    user_id,selection_id,plan_revision,goal_revision,goal_snapshot,graph_snapshot,
    snapshot_encoding_version,content_digest,created_by_operation_id,
    graph_contract,graph_contract_version,graph_canonical_bytes,generated_week_plan_digest,
    generation_input_digest,target_policy_revision,preference_revision,safety_revision,
    candidate_manifest_revision,candidate_manifest_digest,composition_policy_revision,
    validation_policy_revision,optimization_policy_revision,generation_policy_revision,
    generation_operation_id,activation_operation_id,supersedes_plan_revision
  ) VALUES (
    v_account_id,v_selection_id,v_plan_revision,v_selection.goal_revision,
    v_input -> 'goalNutritionTarget',v_graph,
    'potok-adaptive-nutrition-graph-v2-canonical-json-v1',v_generation.result_graph_digest,
    v_operation_id,'adaptive_nutrition_graph_v2',2,v_graph_bytes,
    v_generation.result_digest,extensions.digest(v_generation.canonical_request,'sha256'),
    (v_input #>> '{goalNutritionTarget,targetPolicyRevision}')::uuid,
    (v_input ->> 'preferenceRevision')::uuid,(v_input ->> 'safetyRevision')::uuid,
    v_manifest.manifest_revision,v_manifest.canonical_digest,
    (v_input ->> 'compositionPolicyRevision')::uuid,(v_input ->> 'validationPolicyRevision')::uuid,
    (v_input ->> 'optimizationPolicyRevision')::uuid,(v_input ->> 'generationPolicyRevision')::uuid,
    v_generation.operation_id,v_operation_id,p_expected_plan_revision
  );
  UPDATE public.user_premium_plan_selections
     SET status='active', plan_revision=v_plan_revision, updated_at=pg_catalog.statement_timestamp(),
         origin_lineage=origin_lineage || pg_catalog.jsonb_build_object(
           'generationState','active','graphContract','adaptive_nutrition_graph_v2',
           'activationOperationId',v_operation_id,'generationOperationId',v_generation.operation_id)
   WHERE user_id=v_account_id AND id=v_selection_id AND status='pending_generation'
     AND plan_revision IS NULL AND goal_revision=v_selection.goal_revision;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN RAISE EXCEPTION 'selection activation CAS lost' USING ERRCODE='40001'; END IF;
  v_receipt := pg_catalog.jsonb_build_object('kind','settled','outcome','accepted',
    'contract','potok-adaptive-plan-activated-v2','operation_id',v_operation_id,
    'selection_id',v_selection_id,'plan_revision',v_plan_revision,
    'graph_digest_hex',pg_catalog.encode(v_generation.result_graph_digest,'hex'),'event_ids','[]'::jsonb);
  UPDATE public.adaptive_nutrition_operations SET outcome='accepted',result_references=v_receipt,
    committed_at=pg_catalog.statement_timestamp(),result_canonical=pg_catalog.convert_to(
      potok_nutrition.canonical_jsonb_text_v1(v_receipt),'UTF8'),
    result_digest=extensions.digest(pg_catalog.convert_to(
      potok_nutrition.canonical_jsonb_text_v1(v_receipt),'UTF8'),'sha256'),
    result_plan_revision=v_plan_revision,result_graph_digest=v_generation.result_graph_digest
   WHERE user_id=v_account_id AND operation_id=v_operation_id AND outcome='in_progress';
  RETURN v_receipt;
END
$function$;

CREATE FUNCTION public.adaptive_nutrition_read_graph_v2(
  p_selection_id uuid, p_plan_revision uuid DEFAULT NULL, p_graph_digest_hex text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE v_actor uuid:=auth.uid(); v_selection public.user_premium_plan_selections%ROWTYPE;
  v_graph public.adaptive_nutrition_graph_revisions%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RETURN pg_catalog.jsonb_build_object('kind','denied'); END IF;
  SELECT * INTO v_selection FROM public.user_premium_plan_selections
   WHERE user_id=v_actor AND id=p_selection_id;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('kind','not_found'); END IF;
  IF p_plan_revision IS NULL AND p_graph_digest_hex IS NULL THEN
    IF NOT potok_control.is_effective_entitlement_v2(v_actor,'premium',pg_catalog.statement_timestamp()) THEN
      RETURN pg_catalog.jsonb_build_object('kind','denied','reason','verified_premium_required');
    END IF;
    IF v_selection.status <> 'active' OR v_selection.plan_revision IS NULL THEN
      RETURN pg_catalog.jsonb_build_object('kind','no_active_plan');
    END IF;
    SELECT * INTO v_graph FROM public.adaptive_nutrition_graph_revisions
     WHERE user_id=v_actor AND selection_id=p_selection_id AND plan_revision=v_selection.plan_revision
       AND graph_contract='adaptive_nutrition_graph_v2' AND graph_contract_version=2;
  ELSE
    SELECT * INTO v_graph FROM public.adaptive_nutrition_graph_revisions
     WHERE user_id=v_actor AND selection_id=p_selection_id
       AND graph_contract='adaptive_nutrition_graph_v2' AND graph_contract_version=2
       AND (p_plan_revision IS NULL OR plan_revision=p_plan_revision)
       AND (p_graph_digest_hex IS NULL OR content_digest=pg_catalog.decode(p_graph_digest_hex,'hex'));
  END IF;
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('kind','not_found'); END IF;
  RETURN pg_catalog.jsonb_build_object('kind','ready','selection_id',v_graph.selection_id,
    'plan_revision',v_graph.plan_revision,'graph_contract',v_graph.graph_contract,
    'graph_contract_version',v_graph.graph_contract_version,
    'graph_digest_hex',pg_catalog.encode(v_graph.content_digest,'hex'),'graph',v_graph.graph_snapshot);
END
$function$;

CREATE FUNCTION public.adaptive_nutrition_list_graph_history_v2(p_selection_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $function$
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'plan_revision',g.plan_revision,'supersedes_plan_revision',g.supersedes_plan_revision,
    'graph_digest_hex',pg_catalog.encode(g.content_digest,'hex'),'created_at',g.created_at)
    ORDER BY g.created_at,g.plan_revision),'[]'::jsonb)
  FROM public.adaptive_nutrition_graph_revisions g
  WHERE g.user_id=auth.uid() AND g.selection_id=p_selection_id
    AND g.graph_contract='adaptive_nutrition_graph_v2' AND g.graph_contract_version=2
$function$;

CREATE FUNCTION public.adaptive_nutrition_lookup_operation_v2(p_operation_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $function$
  SELECT COALESCE((SELECT pg_catalog.jsonb_build_object('kind',o.outcome,
    'operation_id',o.operation_id,'action_type',o.action_type,'result',o.result_references)
    FROM public.adaptive_nutrition_operations o
    WHERE o.user_id=auth.uid() AND o.operation_id=p_operation_id
      AND o.action_type IN ('PLAN_GENERATED_V2','PLAN_ACTIVATED_V2')),
    pg_catalog.jsonb_build_object('kind','not_found'))
$function$;

CREATE FUNCTION public.adaptive_nutrition_current_preference_v1()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $function$
  SELECT COALESCE((SELECT p.canonical_snapshot FROM potok_nutrition.nutrition_authority_heads_v1 h
    JOIN potok_nutrition.nutrition_preference_snapshots_v1 p
      ON p.account_id=h.account_id AND p.revision_id=h.current_preference_revision
    WHERE h.account_id=auth.uid()),pg_catalog.jsonb_build_object('kind','not_initialized'))
$function$;

CREATE FUNCTION public.adaptive_nutrition_current_safety_v1()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $function$
  SELECT COALESCE((SELECT s.canonical_snapshot FROM potok_nutrition.nutrition_authority_heads_v1 h
    JOIN potok_nutrition.nutrition_safety_snapshots_v1 s
      ON s.account_id=h.account_id AND s.revision_id=h.current_safety_revision
    WHERE h.account_id=auth.uid()),pg_catalog.jsonb_build_object('kind','not_initialized'))
$function$;

CREATE FUNCTION potok_nutrition.current_candidate_manifest_v2()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $function$
  SELECT m.manifest_snapshot FROM potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2 h
  JOIN potok_nutrition.adaptive_nutrition_candidate_manifests_v2 m
    ON m.manifest_revision=h.current_manifest_revision
  WHERE h.singleton AND m.publication_state='PUBLISHED'
$function$;

REVOKE ALL ON FUNCTION potok_nutrition.initialize_nutrition_authorities_v1(uuid,uuid,bytea,bytea,uuid),
  potok_nutrition.create_preference_successor_v1(uuid,uuid,uuid,bytea,uuid),
  potok_nutrition.create_safety_successor_v1(uuid,uuid,uuid,bytea,uuid),
  potok_nutrition.publish_candidate_manifest_v2(bytea,uuid,uuid,uuid),
  potok_nutrition.record_generated_week_v2(uuid,uuid,uuid,bytea,bytea),
  potok_nutrition.activate_generated_week_v2(uuid,uuid,uuid),
  potok_nutrition.current_candidate_manifest_v2()
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.adaptive_nutrition_read_graph_v2(uuid,uuid,text),
  public.adaptive_nutrition_list_graph_history_v2(uuid),
  public.adaptive_nutrition_lookup_operation_v2(uuid),
  public.adaptive_nutrition_current_preference_v1(),
  public.adaptive_nutrition_current_safety_v1()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.adaptive_nutrition_read_graph_v2(uuid,uuid,text),
  public.adaptive_nutrition_list_graph_history_v2(uuid),
  public.adaptive_nutrition_lookup_operation_v2(uuid),
  public.adaptive_nutrition_current_preference_v1(),
  public.adaptive_nutrition_current_safety_v1()
  TO authenticated;

COMMENT ON FUNCTION potok_nutrition.activate_generated_week_v2(uuid,uuid,uuid) IS
  'PROTECTED_EXECUTION_CHANNEL_NOT_YET_BOUND. Event-free PLAN-only Graph v2 activation; no client EXECUTE grant.';

COMMIT;

-- Intentionally absent: runtime/worker grant, real authority snapshots, manifest
-- publication, recipe eligibility, Graph/PLAN/FACT/event/diary data, or Graph v1 row rewrite.
