-- POTOK protected execution binding v1 — minimal auth-contract repair.
-- Target: STAGING ozidryfvhkcbtpnulakq only. Prepared for owner review; NOT APPLIED.
-- CREATE OR REPLACE preserves the deployed function owner and ACL.

BEGIN;

DO $owner_session_guard$
BEGIN
  IF CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'POSTGRES_OWNER_SESSION_REQUIRED' USING ERRCODE='42501';
  END IF;
END
$owner_session_guard$;

CREATE OR REPLACE FUNCTION public.adaptive_nutrition_request_generation_v2(
  p_protocol_version text,p_idempotency_key uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $function$
DECLARE
  v_actor uuid:=auth.uid();
  v_request jsonb;
  v_request_canonical bytea;
  v_existing public.adaptive_nutrition_operations%ROWTYPE;
  v_state potok_nutrition.adaptive_nutrition_generation_requests_v2%ROWTYPE;
  v_selection public.user_premium_plan_selections%ROWTYPE;
  v_goal public.user_goals%ROWTYPE;
  v_authority potok_nutrition.nutrition_authority_heads_v1%ROWTYPE;
  v_manifest potok_nutrition.adaptive_nutrition_candidate_manifests_v2%ROWTYPE;
  v_manifest_head potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2%ROWTYPE;
  v_policy potok_nutrition.adaptive_nutrition_generation_policy_head_v2%ROWTYPE;
  v_goal_target potok_nutrition.adaptive_nutrition_goal_targets_v1%ROWTYPE;
  v_entitlement_revision uuid;
  v_request_operation_id uuid:=pg_catalog.gen_random_uuid();
  v_attempt_operation_id uuid:=pg_catalog.gen_random_uuid();
  v_attempt_key uuid:=pg_catalog.gen_random_uuid();
  v_record_key uuid:=pg_catalog.gen_random_uuid();
  v_activation_key uuid:=pg_catalog.gen_random_uuid();
  v_plan_revision uuid:=pg_catalog.gen_random_uuid();
  v_input jsonb;
  v_input_canonical bytea;
  v_target jsonb;
  v_count integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_idempotency_key IS NULL OR p_protocol_version IS NULL
     OR p_protocol_version='' OR p_protocol_version<>pg_catalog.btrim(p_protocol_version) THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE='22023';
  END IF;
  v_request:=pg_catalog.jsonb_build_object(
    'contract','potok-adaptive-generation-request-v2',
    'protocolVersion',p_protocol_version,'idempotencyKey',p_idempotency_key
  );
  v_request_canonical:=pg_catalog.convert_to(
    potok_nutrition.canonical_jsonb_text_v1(v_request),'UTF8');
  PERFORM potok_nutrition.acquire_shared_account_gate_v1(v_actor);
  SELECT * INTO v_existing FROM public.adaptive_nutrition_operations o
   WHERE o.user_id=v_actor AND o.idempotency_key=p_idempotency_key::text FOR UPDATE;
  IF FOUND THEN
    IF v_existing.action_type<>'GENERATION_REQUESTED_V2'
       OR v_existing.canonical_request<>v_request_canonical
       OR v_existing.request_digest<>extensions.digest(v_request_canonical,'sha256') THEN
      RAISE EXCEPTION 'IDEMPOTENCY_PAYLOAD_MISMATCH' USING ERRCODE='40001';
    END IF;
    SELECT * INTO STRICT v_state
      FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 r
     WHERE r.account_id=v_actor AND r.request_operation_id=v_existing.operation_id;
    RETURN potok_nutrition.generation_request_status_json_v2(
      v_state.request_operation_id,v_state.status,v_state.reason_code);
  END IF;
  IF p_protocol_version<>'potok-adaptive-generation-request-v2' THEN
    RAISE EXCEPTION 'UNSUPPORTED_PROTOCOL' USING ERRCODE='22023';
  END IF;
  IF NOT potok_control.is_effective_entitlement_v2(
       v_actor,'premium',pg_catalog.statement_timestamp()) THEN
    RAISE EXCEPTION 'VERIFIED_PREMIUM_REQUIRED' USING ERRCODE='42501';
  END IF;
  SELECT a.attestation_id INTO v_entitlement_revision
    FROM potok_control.access_attestations a
   WHERE a.account_id=v_actor AND a.capability='premium'
     AND a.issued_at<=pg_catalog.statement_timestamp()
   ORDER BY a.lineage_sequence DESC LIMIT 1;
  SELECT pg_catalog.count(*) INTO v_count
    FROM public.user_premium_plan_selections s
   WHERE s.user_id=v_actor AND s.contract_version=1 AND s.status='pending_generation'
     AND s.plan_revision IS NULL
     AND s.week_anchor=pg_catalog.date_trunc(
       'week',pg_catalog.statement_timestamp() AT TIME ZONE s.timezone)::date
     AND COALESCE(s.origin_lineage->>'source','')<>'potok-retained-staging-smoke-v1';
  IF v_count<>1 THEN
    RAISE EXCEPTION '%',CASE WHEN v_count=0 THEN 'PENDING_SELECTION_REQUIRED'
                             ELSE 'AMBIGUOUS_PENDING_SELECTION' END USING ERRCODE='40001';
  END IF;
  SELECT * INTO STRICT v_selection FROM public.user_premium_plan_selections s
   WHERE s.user_id=v_actor AND s.contract_version=1 AND s.status='pending_generation'
     AND s.plan_revision IS NULL
     AND s.week_anchor=pg_catalog.date_trunc(
       'week',pg_catalog.statement_timestamp() AT TIME ZONE s.timezone)::date
     AND COALESCE(s.origin_lineage->>'source','')<>'potok-retained-staging-smoke-v1'
   FOR UPDATE;
  IF EXISTS (SELECT 1 FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 r
              WHERE r.account_id=v_actor AND r.selection_id=v_selection.id) THEN
    RAISE EXCEPTION 'GENERATION_REQUEST_ALREADY_EXISTS' USING ERRCODE='40001';
  END IF;
  SELECT * INTO STRICT v_goal FROM public.user_goals g
   WHERE g.user_id=v_actor AND g.goal_revision=v_selection.goal_revision FOR SHARE;
  SELECT * INTO STRICT v_authority FROM potok_nutrition.nutrition_authority_heads_v1 h
   WHERE h.account_id=v_actor FOR SHARE;
  SELECT * INTO STRICT v_manifest_head
    FROM potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2 h
   WHERE h.singleton FOR SHARE;
  SELECT * INTO STRICT v_manifest
    FROM potok_nutrition.adaptive_nutrition_candidate_manifests_v2 m
   WHERE m.manifest_revision=v_manifest_head.current_manifest_revision
     AND m.publication_state='PUBLISHED' FOR SHARE;
  IF extensions.digest(v_manifest.canonical_bytes,'sha256')<>v_manifest.canonical_digest THEN
    RAISE EXCEPTION 'CANDIDATE_MANIFEST_DIGEST_MISMATCH' USING ERRCODE='40001';
  END IF;
  SELECT * INTO STRICT v_policy
    FROM potok_nutrition.adaptive_nutrition_generation_policy_head_v2 p
   WHERE p.singleton AND p.publication_state='PUBLISHED' FOR SHARE;
  SELECT * INTO STRICT v_goal_target
    FROM potok_nutrition.adaptive_nutrition_goal_targets_v1 t
   WHERE t.account_id=v_actor AND t.goal_revision=v_goal.goal_revision
     AND t.target_policy_revision=v_policy.target_policy_revision FOR SHARE;
  IF extensions.digest(v_goal_target.canonical_bytes,'sha256')<>v_goal_target.canonical_digest
     OR v_goal_target.canonical_snapshot<>
        potok_nutrition.require_canonical_json_v2(v_goal_target.canonical_bytes)
     OR v_goal_target.canonical_snapshot->>'contract'<>'potok-adaptive-goal-nutrition-target-v1'
     OR (v_goal_target.canonical_snapshot->>'goalRevision')::uuid<>v_goal.goal_revision
     OR (v_goal_target.canonical_snapshot->>'targetPolicyRevision')::uuid<>
        v_policy.target_policy_revision THEN
    RAISE EXCEPTION 'GOAL_NUTRITION_TARGET_INVALID' USING ERRCODE='40001';
  END IF;
  v_target:=v_goal_target.canonical_snapshot;
  v_input:=pg_catalog.jsonb_build_object(
    'contract','potok-adaptive-trusted-generation-input-v1',
    'accountGateContract','potok-shared-account-gate-v1','accountId',v_actor,
    'selection',pg_catalog.jsonb_build_object(
      'selectionId',v_selection.id,
      'planSelectionRevision',(v_selection.origin_lineage->>'provisionOperationId')::uuid,
      'expectedStatus','pending_generation','expectedPlanRevision',NULL,
      'proposedPlanRevision',v_plan_revision),
    'weekStartLocal',v_selection.week_anchor,'timezone',v_selection.timezone,
    'goalNutritionTarget',v_target,
    'preferenceRevision',v_authority.current_preference_revision,
    'safetyRevision',v_authority.current_safety_revision,
    'entitlementEvidenceRevision',v_entitlement_revision,
    'candidateManifestRevision',v_manifest.manifest_revision,
    'candidateManifestDigest',pg_catalog.encode(v_manifest.canonical_digest,'hex'),
    'compositionPolicyRevision',v_policy.composition_policy_revision,
    'validationPolicyRevision',v_policy.validation_policy_revision,
    'optimizationPolicyRevision',v_policy.optimization_policy_revision,
    'generationPolicyRevision',v_policy.generation_policy_revision,
    'operation',pg_catalog.jsonb_build_object(
      'requestId',v_request_operation_id,'idempotencyKey',v_record_key)
  );
  v_input_canonical:=pg_catalog.convert_to(
    potok_nutrition.canonical_jsonb_text_v1(v_input),'UTF8');
  INSERT INTO public.adaptive_nutrition_operations(
    user_id,idempotency_key,operation_id,selection_id,contract_version,action_type,
    canonical_request,digest_version,request_digest,outcome
  ) VALUES (
    v_actor,p_idempotency_key::text,v_request_operation_id,v_selection.id,
    'adaptive-nutrition-v2','GENERATION_REQUESTED_V2',v_request_canonical,
    'potok-adaptive-generation-request-v2/sha256',
    extensions.digest(v_request_canonical,'sha256'),'in_progress'
  );
  INSERT INTO potok_nutrition.adaptive_nutrition_generation_requests_v2(
    account_id,request_operation_id,selection_id,request_idempotency_key,
    attempt_operation_id,attempt_idempotency_key,record_idempotency_key,
    activation_idempotency_key,proposed_plan_revision,generation_input_canonical,
    generation_input_digest,status
  ) VALUES (
    v_actor,v_request_operation_id,v_selection.id,p_idempotency_key,
    v_attempt_operation_id,v_attempt_key,v_record_key,v_activation_key,v_plan_revision,
    v_input_canonical,extensions.digest(pg_catalog.convert_to(
      potok_nutrition.canonical_jsonb_text_v1(pg_catalog.jsonb_build_object(
        'contract','potok-adaptive-trusted-generation-input-v1','input',v_input)),'UTF8'),'sha256'),
    'REQUESTED'
  );
  RETURN potok_nutrition.generation_request_status_json_v2(
    v_request_operation_id,'REQUESTED',NULL);
END
$function$;

COMMIT;
