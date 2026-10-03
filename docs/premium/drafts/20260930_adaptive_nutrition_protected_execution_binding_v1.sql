-- POTOK Adaptive Nutrition protected execution binding v1.
-- RUNNABLE REVIEW DRAFT ONLY. Target, if separately approved: STAGING ozidryfvhkcbtpnulakq.
-- No manifest/policy/recipe data is published and the Edge generator remains disabled.

BEGIN;

DO $preflight$
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'postgres owner migration session required' USING ERRCODE='42501';
  END IF;
  IF pg_catalog.to_regclass('public.adaptive_nutrition_operations') IS NULL
     OR pg_catalog.to_regclass('public.user_premium_plan_selections') IS NULL
     OR pg_catalog.to_regclass('potok_nutrition.nutrition_authority_heads_v1') IS NULL
     OR pg_catalog.to_regclass('potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2') IS NULL
     OR pg_catalog.to_regprocedure('potok_nutrition.acquire_shared_account_gate_v1(uuid)') IS NULL
     OR pg_catalog.to_regprocedure('potok_nutrition.record_generated_week_v2(uuid,uuid,uuid,bytea,bytea)') IS NULL
     OR pg_catalog.to_regprocedure('potok_nutrition.activate_generated_week_v2(uuid,uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'accepted Graph v2 foundation is required';
  END IF;
  IF pg_catalog.to_regclass('potok_nutrition.adaptive_nutrition_generation_requests_v2') IS NOT NULL
     OR pg_catalog.to_regclass('potok_nutrition.adaptive_nutrition_generation_policy_head_v2') IS NOT NULL
     OR pg_catalog.to_regclass('potok_nutrition.adaptive_nutrition_goal_targets_v1') IS NOT NULL
     OR pg_catalog.to_regprocedure('public.adaptive_nutrition_request_generation_v2(text,uuid)') IS NOT NULL
     OR pg_catalog.to_regprocedure('public.adaptive_nutrition_generation_status_v2(uuid)') IS NOT NULL
     OR pg_catalog.to_regprocedure('potok_nutrition.load_generation_request_v2(uuid)') IS NOT NULL
     OR pg_catalog.to_regprocedure('potok_nutrition.record_generated_week_gateway_v2(uuid,bytea)') IS NOT NULL
     OR pg_catalog.to_regprocedure('potok_nutrition.activate_generated_week_gateway_v2(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'protected execution binding v1 already exists or is partially applied';
  END IF;
  IF pg_catalog.pg_get_functiondef(
       'potok_nutrition.record_generated_week_v2(uuid,uuid,uuid,bytea,bytea)'::pg_catalog.regprocedure
     ) NOT LIKE '%SESSION_USER <> ''postgres'' OR CURRENT_USER <> ''postgres''%'
     OR pg_catalog.pg_get_functiondef(
       'potok_nutrition.activate_generated_week_v2(uuid,uuid,uuid)'::pg_catalog.regprocedure
     ) NOT LIKE '%SESSION_USER <> ''postgres'' OR CURRENT_USER <> ''postgres''%' THEN
    RAISE EXCEPTION 'reviewed pre-binding writer sentinel not found';
  END IF;
END
$preflight$;

CREATE TABLE potok_nutrition.adaptive_nutrition_generation_policy_head_v2 (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  target_policy_revision uuid NOT NULL,
  composition_policy_revision uuid NOT NULL,
  validation_policy_revision uuid NOT NULL,
  optimization_policy_revision uuid NOT NULL,
  generation_policy_revision uuid NOT NULL,
  policy_head_revision uuid NOT NULL UNIQUE,
  publication_state text NOT NULL CHECK (publication_state='PUBLISHED'),
  published_at timestamptz NOT NULL,
  publication_evidence text NOT NULL CHECK (publication_evidence<>''),
  CONSTRAINT adaptive_nutrition_generation_policy_revisions_distinct_v2 CHECK (
    target_policy_revision<>composition_policy_revision
    AND target_policy_revision<>validation_policy_revision
    AND target_policy_revision<>optimization_policy_revision
    AND target_policy_revision<>generation_policy_revision
    AND composition_policy_revision<>validation_policy_revision
    AND composition_policy_revision<>optimization_policy_revision
    AND composition_policy_revision<>generation_policy_revision
    AND validation_policy_revision<>optimization_policy_revision
    AND validation_policy_revision<>generation_policy_revision
    AND optimization_policy_revision<>generation_policy_revision
  )
);

CREATE TABLE potok_nutrition.adaptive_nutrition_goal_targets_v1 (
  account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  goal_revision uuid NOT NULL,
  target_policy_revision uuid NOT NULL,
  canonical_bytes bytea NOT NULL,
  canonical_snapshot jsonb NOT NULL,
  canonical_digest bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.statement_timestamp(),
  evidence_ref text NOT NULL CHECK (evidence_ref<>''),
  CONSTRAINT adaptive_nutrition_goal_targets_v1_pkey
    PRIMARY KEY (account_id,goal_revision,target_policy_revision),
  CONSTRAINT adaptive_nutrition_goal_targets_v1_digest_check
    CHECK (pg_catalog.octet_length(canonical_digest)=32),
  CONSTRAINT adaptive_nutrition_goal_targets_v1_json_check
    CHECK (pg_catalog.jsonb_typeof(canonical_snapshot)='object')
);

CREATE TABLE potok_nutrition.adaptive_nutrition_generation_requests_v2 (
  account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  request_operation_id uuid PRIMARY KEY,
  selection_id uuid NOT NULL,
  request_idempotency_key uuid NOT NULL,
  attempt_operation_id uuid NOT NULL UNIQUE,
  attempt_idempotency_key uuid NOT NULL,
  record_idempotency_key uuid NOT NULL,
  activation_idempotency_key uuid NOT NULL,
  proposed_plan_revision uuid NOT NULL UNIQUE,
  generation_input_canonical bytea NOT NULL,
  generation_input_digest bytea NOT NULL,
  status text NOT NULL,
  reason_code text NULL,
  generated_operation_id uuid NULL,
  activation_operation_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.statement_timestamp(),
  CONSTRAINT adaptive_nutrition_generation_requests_account_request_fk_v2
    FOREIGN KEY (account_id,request_operation_id)
    REFERENCES public.adaptive_nutrition_operations(user_id,operation_id) ON DELETE RESTRICT,
  CONSTRAINT adaptive_nutrition_generation_requests_selection_fk_v2
    FOREIGN KEY (account_id,selection_id)
    REFERENCES public.user_premium_plan_selections(user_id,id) ON DELETE RESTRICT,
  CONSTRAINT adaptive_nutrition_generation_requests_generated_fk_v2
    FOREIGN KEY (account_id,generated_operation_id)
    REFERENCES public.adaptive_nutrition_operations(user_id,operation_id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT adaptive_nutrition_generation_requests_activation_fk_v2
    FOREIGN KEY (account_id,activation_operation_id)
    REFERENCES public.adaptive_nutrition_operations(user_id,operation_id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT adaptive_nutrition_generation_requests_selection_unique_v2
    UNIQUE (account_id,selection_id),
  CONSTRAINT adaptive_nutrition_generation_requests_key_unique_v2
    UNIQUE (account_id,request_idempotency_key),
  CONSTRAINT adaptive_nutrition_generation_requests_phase_keys_distinct_v2 CHECK (
    request_idempotency_key<>attempt_idempotency_key
    AND request_idempotency_key<>record_idempotency_key
    AND request_idempotency_key<>activation_idempotency_key
    AND attempt_idempotency_key<>record_idempotency_key
    AND attempt_idempotency_key<>activation_idempotency_key
    AND record_idempotency_key<>activation_idempotency_key
  ),
  CONSTRAINT adaptive_nutrition_generation_requests_digest_v2
    CHECK (pg_catalog.octet_length(generation_input_digest)=32),
  CONSTRAINT adaptive_nutrition_generation_requests_status_v2 CHECK (
    status IN ('REQUESTED','GENERATING','GENERATED','ACTIVATING','ACTIVE',
               'REJECTED','CONFLICT','UNKNOWN_RETRYABLE')
  ),
  CONSTRAINT adaptive_nutrition_generation_requests_phase_shape_v2 CHECK (
    (status IN ('REQUESTED','GENERATING')
      AND generated_operation_id IS NULL AND activation_operation_id IS NULL)
    OR (status='UNKNOWN_RETRYABLE' AND activation_operation_id IS NULL)
    OR (status IN ('GENERATED','ACTIVATING')
      AND generated_operation_id IS NOT NULL AND activation_operation_id IS NULL)
    OR (status='ACTIVE' AND generated_operation_id IS NOT NULL AND activation_operation_id IS NOT NULL)
    OR status IN ('REJECTED','CONFLICT')
  )
);

CREATE INDEX adaptive_nutrition_generation_requests_status_v2_idx
  ON potok_nutrition.adaptive_nutrition_generation_requests_v2(status,updated_at);

ALTER TABLE potok_nutrition.adaptive_nutrition_generation_policy_head_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.adaptive_nutrition_generation_policy_head_v2 FORCE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.adaptive_nutrition_goal_targets_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.adaptive_nutrition_goal_targets_v1 FORCE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.adaptive_nutrition_generation_requests_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.adaptive_nutrition_generation_requests_v2 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON potok_nutrition.adaptive_nutrition_generation_policy_head_v2,
  potok_nutrition.adaptive_nutrition_goal_targets_v1,
  potok_nutrition.adaptive_nutrition_generation_requests_v2
  FROM PUBLIC,anon,authenticated,service_role;

CREATE TRIGGER potok_goal_target_immutable_v1
BEFORE UPDATE OR DELETE OR TRUNCATE ON potok_nutrition.adaptive_nutrition_goal_targets_v1
FOR EACH STATEMENT EXECUTE FUNCTION potok_nutrition.reject_immutable_change_v2();

CREATE FUNCTION potok_nutrition.protect_generation_request_identity_v2()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
AS $function$
BEGIN
  IF CURRENT_USER<>'postgres' THEN
    RAISE EXCEPTION 'protected generation request writer required' USING ERRCODE='42501';
  END IF;
  IF ROW(NEW.account_id,NEW.request_operation_id,NEW.selection_id,NEW.request_idempotency_key,
         NEW.attempt_operation_id,NEW.attempt_idempotency_key,NEW.record_idempotency_key,
         NEW.activation_idempotency_key,NEW.proposed_plan_revision,NEW.generation_input_canonical,
         NEW.generation_input_digest,NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.account_id,OLD.request_operation_id,OLD.selection_id,OLD.request_idempotency_key,
         OLD.attempt_operation_id,OLD.attempt_idempotency_key,OLD.record_idempotency_key,
         OLD.activation_idempotency_key,OLD.proposed_plan_revision,OLD.generation_input_canonical,
         OLD.generation_input_digest,OLD.created_at) THEN
    RAISE EXCEPTION 'generation request identity is immutable' USING ERRCODE='55000';
  END IF;
  NEW.updated_at:=pg_catalog.statement_timestamp();
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION potok_nutrition.protect_generation_request_identity_v2()
  FROM PUBLIC,anon,authenticated,service_role;

CREATE TRIGGER potok_generation_request_update_guard_v2
BEFORE UPDATE ON potok_nutrition.adaptive_nutrition_generation_requests_v2
FOR EACH ROW EXECUTE FUNCTION potok_nutrition.protect_generation_request_identity_v2();
CREATE TRIGGER potok_generation_request_delete_guard_v2
BEFORE DELETE OR TRUNCATE ON potok_nutrition.adaptive_nutrition_generation_requests_v2
FOR EACH STATEMENT EXECUTE FUNCTION potok_nutrition.reject_immutable_change_v2();

CREATE FUNCTION potok_nutrition.generation_request_status_json_v2(
  p_request_operation_id uuid,p_status text,p_reason_code text
)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog
AS $function$
  SELECT pg_catalog.jsonb_build_object(
    'contract','potok-adaptive-generation-request-status-v2',
    'requestOperationId',p_request_operation_id,
    'status',p_status,
    'retryable',p_status IN ('REQUESTED','GENERATING','GENERATED','ACTIVATING','UNKNOWN_RETRYABLE'),
    'reasonCode',p_reason_code
  )
$function$;
REVOKE ALL ON FUNCTION potok_nutrition.generation_request_status_json_v2(uuid,text,text)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.adaptive_nutrition_request_generation_v2(
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
  IF v_actor IS NULL OR p_idempotency_key IS NULL OR p_protocol_version IS NULL
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

CREATE FUNCTION public.adaptive_nutrition_generation_status_v2(p_request_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $function$
DECLARE
  v_actor uuid:=auth.uid();
  v_state potok_nutrition.adaptive_nutrition_generation_requests_v2%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR p_request_operation_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_state FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 r
   WHERE r.account_id=v_actor AND r.request_operation_id=p_request_operation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  RETURN potok_nutrition.generation_request_status_json_v2(
    v_state.request_operation_id,v_state.status,v_state.reason_code);
END
$function$;

CREATE OR REPLACE FUNCTION potok_nutrition.record_generated_week_v2(
  p_account_id uuid,
  p_selection_id uuid,
  p_idempotency_key uuid,
  p_generation_input_canonical bytea,
  p_generated_week_plan_canonical bytea
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
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
  IF CURRENT_USER <> 'postgres' THEN
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

CREATE OR REPLACE FUNCTION potok_nutrition.activate_generated_week_v2(
  p_generation_operation_id uuid,
  p_activation_idempotency_key uuid,
  p_expected_plan_revision uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
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
  IF CURRENT_USER <> 'postgres' THEN
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


CREATE FUNCTION potok_nutrition.assert_generation_request_current_v2(p_request_operation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
AS $function$
DECLARE
  v_state potok_nutrition.adaptive_nutrition_generation_requests_v2%ROWTYPE;
  v_input jsonb;
  v_selection public.user_premium_plan_selections%ROWTYPE;
  v_authority potok_nutrition.nutrition_authority_heads_v1%ROWTYPE;
  v_manifest_head potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2%ROWTYPE;
  v_manifest potok_nutrition.adaptive_nutrition_candidate_manifests_v2%ROWTYPE;
  v_policy potok_nutrition.adaptive_nutrition_generation_policy_head_v2%ROWTYPE;
  v_entitlement_revision uuid;
BEGIN
  IF CURRENT_USER<>'postgres' THEN
    RAISE EXCEPTION 'PROTECTED_EXECUTION_CHANNEL_REQUIRED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO STRICT v_state FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 r
   WHERE r.request_operation_id=p_request_operation_id FOR UPDATE;
  PERFORM potok_nutrition.acquire_shared_account_gate_v1(v_state.account_id);
  v_input:=potok_nutrition.require_canonical_json_v2(v_state.generation_input_canonical);
  IF NOT potok_control.is_effective_entitlement_v2(
       v_state.account_id,'premium',pg_catalog.statement_timestamp()) THEN
    RAISE EXCEPTION 'VERIFIED_PREMIUM_REQUIRED' USING ERRCODE='42501';
  END IF;
  SELECT a.attestation_id INTO v_entitlement_revision FROM potok_control.access_attestations a
   WHERE a.account_id=v_state.account_id AND a.capability='premium'
     AND a.issued_at<=pg_catalog.statement_timestamp()
   ORDER BY a.lineage_sequence DESC LIMIT 1;
  SELECT * INTO STRICT v_selection FROM public.user_premium_plan_selections s
   WHERE s.user_id=v_state.account_id AND s.id=v_state.selection_id FOR UPDATE;
  IF v_selection.status<>'pending_generation' OR v_selection.plan_revision IS NOT NULL
     OR v_selection.week_anchor::text<>v_input->>'weekStartLocal'
     OR v_selection.timezone<>v_input->>'timezone'
     OR v_selection.goal_revision<>(v_input#>>'{goalNutritionTarget,goalRevision}')::uuid
     OR v_input#>>'{selection,planSelectionRevision}'<>
        v_selection.origin_lineage->>'provisionOperationId'
     OR v_entitlement_revision<>(v_input->>'entitlementEvidenceRevision')::uuid
     OR NOT EXISTS (SELECT 1 FROM public.user_goals g
                     WHERE g.user_id=v_state.account_id
                       AND g.goal_revision=v_selection.goal_revision) THEN
    RAISE EXCEPTION 'GENERATION_REQUEST_STALE_SELECTION' USING ERRCODE='40001';
  END IF;
  SELECT * INTO STRICT v_authority FROM potok_nutrition.nutrition_authority_heads_v1 h
   WHERE h.account_id=v_state.account_id FOR SHARE;
  IF v_authority.current_preference_revision<>(v_input->>'preferenceRevision')::uuid
     OR v_authority.current_safety_revision<>(v_input->>'safetyRevision')::uuid THEN
    RAISE EXCEPTION 'GENERATION_REQUEST_STALE_AUTHORITY' USING ERRCODE='40001';
  END IF;
  SELECT * INTO STRICT v_manifest_head
    FROM potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2 h
   WHERE h.singleton FOR SHARE;
  SELECT * INTO STRICT v_manifest
    FROM potok_nutrition.adaptive_nutrition_candidate_manifests_v2 m
   WHERE m.manifest_revision=v_manifest_head.current_manifest_revision FOR SHARE;
  IF v_manifest.publication_state<>'PUBLISHED'
     OR v_manifest.manifest_revision<>(v_input->>'candidateManifestRevision')::uuid
     OR v_manifest.canonical_digest<>pg_catalog.decode(v_input->>'candidateManifestDigest','hex')
     OR extensions.digest(v_manifest.canonical_bytes,'sha256')<>v_manifest.canonical_digest THEN
    RAISE EXCEPTION 'GENERATION_REQUEST_STALE_MANIFEST' USING ERRCODE='40001';
  END IF;
  SELECT * INTO STRICT v_policy
    FROM potok_nutrition.adaptive_nutrition_generation_policy_head_v2 p
   WHERE p.singleton AND p.publication_state='PUBLISHED' FOR SHARE;
  IF v_policy.target_policy_revision<>(v_input#>>'{goalNutritionTarget,targetPolicyRevision}')::uuid
     OR v_policy.composition_policy_revision<>(v_input->>'compositionPolicyRevision')::uuid
     OR v_policy.validation_policy_revision<>(v_input->>'validationPolicyRevision')::uuid
     OR v_policy.optimization_policy_revision<>(v_input->>'optimizationPolicyRevision')::uuid
     OR v_policy.generation_policy_revision<>(v_input->>'generationPolicyRevision')::uuid THEN
    RAISE EXCEPTION 'GENERATION_REQUEST_STALE_POLICY' USING ERRCODE='40001';
  END IF;
END
$function$;

CREATE FUNCTION potok_nutrition.settle_generation_request_failure_v2(
  p_request_operation_id uuid,p_status text,p_reason_code text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
AS $function$
DECLARE
  v_state potok_nutrition.adaptive_nutrition_generation_requests_v2%ROWTYPE;
  v_outcome text:=CASE WHEN p_status='CONFLICT' THEN 'conflict' ELSE 'rejected' END;
  v_result jsonb;
BEGIN
  IF CURRENT_USER<>'postgres' OR p_status NOT IN ('REJECTED','CONFLICT') THEN
    RAISE EXCEPTION 'invalid protected failure settlement' USING ERRCODE='42501';
  END IF;
  SELECT * INTO STRICT v_state FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 r
   WHERE r.request_operation_id=p_request_operation_id FOR UPDATE;
  v_result:=potok_nutrition.generation_request_status_json_v2(
    p_request_operation_id,p_status,p_reason_code);
  UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2
     SET status=p_status,reason_code=p_reason_code
   WHERE request_operation_id=p_request_operation_id;
  UPDATE public.adaptive_nutrition_operations
     SET outcome=v_outcome,reason=p_reason_code,result_references=v_result,
         committed_at=pg_catalog.statement_timestamp()
   WHERE user_id=v_state.account_id AND operation_id=p_request_operation_id
     AND outcome='in_progress';
  UPDATE public.adaptive_nutrition_operations
     SET outcome=v_outcome,reason=p_reason_code,result_references=v_result,
         committed_at=pg_catalog.statement_timestamp()
   WHERE user_id=v_state.account_id AND operation_id=v_state.attempt_operation_id
     AND outcome='in_progress';
  RETURN v_result;
END
$function$;

CREATE FUNCTION potok_nutrition.load_generation_request_v2(p_request_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $function$
DECLARE
  v_state potok_nutrition.adaptive_nutrition_generation_requests_v2%ROWTYPE;
  v_manifest potok_nutrition.adaptive_nutrition_candidate_manifests_v2%ROWTYPE;
  v_attempt public.adaptive_nutrition_operations%ROWTYPE;
  v_attempt_request bytea;
BEGIN
  IF p_request_operation_id IS NULL THEN
    RAISE EXCEPTION 'request operation required' USING ERRCODE='22023';
  END IF;
  SELECT * INTO STRICT v_state FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 r
   WHERE r.request_operation_id=p_request_operation_id FOR UPDATE;
  IF v_state.status='UNKNOWN_RETRYABLE' AND v_state.generated_operation_id IS NOT NULL
     AND EXISTS(SELECT 1 FROM public.adaptive_nutrition_operations o
                 WHERE o.user_id=v_state.account_id
                   AND o.operation_id=v_state.generated_operation_id
                   AND o.action_type='PLAN_GENERATED_V2' AND o.outcome='accepted') THEN
    UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2
       SET status='GENERATED',reason_code=NULL
     WHERE request_operation_id=p_request_operation_id;
    RETURN potok_nutrition.generation_request_status_json_v2(
      v_state.request_operation_id,'GENERATED',NULL)
      ||pg_catalog.jsonb_build_object('generationInputCanonicalHex',NULL,
         'candidateManifestCanonicalHex',NULL,'attemptOperationId',v_state.attempt_operation_id);
  END IF;
  IF v_state.status IN ('ACTIVE','REJECTED','CONFLICT','GENERATED','ACTIVATING') THEN
    RETURN potok_nutrition.generation_request_status_json_v2(
      v_state.request_operation_id,v_state.status,v_state.reason_code)
      ||pg_catalog.jsonb_build_object('generationInputCanonicalHex',NULL,
         'candidateManifestCanonicalHex',NULL,'attemptOperationId',v_state.attempt_operation_id);
  END IF;
  BEGIN
    PERFORM potok_nutrition.assert_generation_request_current_v2(p_request_operation_id);
  EXCEPTION WHEN serialization_failure THEN
    RETURN potok_nutrition.settle_generation_request_failure_v2(
      p_request_operation_id,'CONFLICT',SQLERRM)
      ||pg_catalog.jsonb_build_object('generationInputCanonicalHex',NULL,
         'candidateManifestCanonicalHex',NULL,'attemptOperationId',v_state.attempt_operation_id);
  WHEN insufficient_privilege THEN
    RETURN potok_nutrition.settle_generation_request_failure_v2(
      p_request_operation_id,'REJECTED',SQLERRM)
      ||pg_catalog.jsonb_build_object('generationInputCanonicalHex',NULL,
         'candidateManifestCanonicalHex',NULL,'attemptOperationId',v_state.attempt_operation_id);
  END;
  v_attempt_request:=pg_catalog.convert_to(potok_nutrition.canonical_jsonb_text_v1(
    pg_catalog.jsonb_build_object('contract','potok-adaptive-generation-attempt-v2',
      'requestOperationId',v_state.request_operation_id,
      'generationInputDigest',pg_catalog.encode(v_state.generation_input_digest,'hex'))),'UTF8');
  INSERT INTO public.adaptive_nutrition_operations(
    user_id,idempotency_key,operation_id,selection_id,contract_version,action_type,
    canonical_request,digest_version,request_digest,outcome
  ) VALUES (
    v_state.account_id,v_state.attempt_idempotency_key::text,v_state.attempt_operation_id,
    v_state.selection_id,'adaptive-nutrition-v2','GENERATION_ATTEMPTED_V2',
    v_attempt_request,'potok-adaptive-generation-attempt-v2/sha256',
    extensions.digest(v_attempt_request,'sha256'),'in_progress'
  ) ON CONFLICT (user_id,idempotency_key) DO NOTHING;
  SELECT * INTO STRICT v_attempt FROM public.adaptive_nutrition_operations o
   WHERE o.user_id=v_state.account_id
     AND o.idempotency_key=v_state.attempt_idempotency_key::text FOR UPDATE;
  IF v_attempt.operation_id<>v_state.attempt_operation_id
     OR v_attempt.selection_id<>v_state.selection_id
     OR v_attempt.action_type<>'GENERATION_ATTEMPTED_V2'
     OR v_attempt.canonical_request<>v_attempt_request
     OR v_attempt.request_digest<>extensions.digest(v_attempt_request,'sha256') THEN
    RAISE EXCEPTION 'IDEMPOTENCY_PAYLOAD_MISMATCH' USING ERRCODE='40001';
  END IF;
  UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2
     SET status='GENERATING',reason_code=NULL
   WHERE request_operation_id=p_request_operation_id;
  SELECT m.* INTO STRICT v_manifest
    FROM potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2 h
    JOIN potok_nutrition.adaptive_nutrition_candidate_manifests_v2 m
      ON m.manifest_revision=h.current_manifest_revision
   WHERE h.singleton;
  RETURN potok_nutrition.generation_request_status_json_v2(
    v_state.request_operation_id,'GENERATING',NULL)
    ||pg_catalog.jsonb_build_object(
      'generationInputCanonicalHex',pg_catalog.encode(v_state.generation_input_canonical,'hex'),
      'candidateManifestCanonicalHex',pg_catalog.encode(v_manifest.canonical_bytes,'hex'),
      'attemptOperationId',v_state.attempt_operation_id);
END
$function$;

CREATE FUNCTION potok_nutrition.record_generated_week_gateway_v2(
  p_request_operation_id uuid,p_generated_week_plan_canonical bytea
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $function$
DECLARE
  v_state potok_nutrition.adaptive_nutrition_generation_requests_v2%ROWTYPE;
  v_receipt jsonb;
  v_generated_operation_id uuid;
  v_result jsonb;
BEGIN
  SELECT * INTO STRICT v_state FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 r
   WHERE r.request_operation_id=p_request_operation_id FOR UPDATE;
  IF v_state.status IN ('GENERATED','ACTIVATING','ACTIVE') THEN
    RETURN potok_nutrition.generation_request_status_json_v2(
      v_state.request_operation_id,v_state.status,v_state.reason_code);
  END IF;
  IF v_state.status NOT IN ('GENERATING','UNKNOWN_RETRYABLE')
     OR p_generated_week_plan_canonical IS NULL THEN
    RAISE EXCEPTION 'generation request is not recordable' USING ERRCODE='40001';
  END IF;
  BEGIN
    PERFORM potok_nutrition.assert_generation_request_current_v2(p_request_operation_id);
    v_receipt:=potok_nutrition.record_generated_week_v2(
      v_state.account_id,v_state.selection_id,v_state.record_idempotency_key,
      v_state.generation_input_canonical,p_generated_week_plan_canonical);
    IF v_receipt->>'outcome'<>'accepted' OR v_receipt->>'operation_id' IS NULL THEN
      UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2
         SET status='UNKNOWN_RETRYABLE',reason_code='GENERATION_RESULT_UNKNOWN'
       WHERE request_operation_id=p_request_operation_id;
      RETURN potok_nutrition.generation_request_status_json_v2(
        p_request_operation_id,'UNKNOWN_RETRYABLE','GENERATION_RESULT_UNKNOWN');
    END IF;
    v_generated_operation_id:=(v_receipt->>'operation_id')::uuid;
  EXCEPTION WHEN serialization_failure THEN
    RETURN potok_nutrition.settle_generation_request_failure_v2(
      p_request_operation_id,'CONFLICT',SQLERRM);
  WHEN invalid_parameter_value OR data_exception THEN
    RETURN potok_nutrition.settle_generation_request_failure_v2(
      p_request_operation_id,'REJECTED',SQLERRM);
  WHEN insufficient_privilege THEN
    RETURN potok_nutrition.settle_generation_request_failure_v2(
      p_request_operation_id,'REJECTED',SQLERRM);
  END;
  v_result:=potok_nutrition.generation_request_status_json_v2(
    p_request_operation_id,'GENERATED',NULL);
  UPDATE public.adaptive_nutrition_operations
     SET outcome='accepted',result_references=pg_catalog.jsonb_build_object(
           'request_operation_id',p_request_operation_id,
           'generated_operation_id',v_generated_operation_id),
         committed_at=pg_catalog.statement_timestamp()
   WHERE user_id=v_state.account_id AND operation_id=v_state.attempt_operation_id
     AND outcome='in_progress';
  UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2
     SET status='GENERATED',reason_code=NULL,generated_operation_id=v_generated_operation_id
   WHERE request_operation_id=p_request_operation_id;
  RETURN v_result;
END
$function$;

CREATE FUNCTION potok_nutrition.activate_generated_week_gateway_v2(p_request_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $function$
DECLARE
  v_state potok_nutrition.adaptive_nutrition_generation_requests_v2%ROWTYPE;
  v_receipt jsonb;
  v_activation_operation_id uuid;
  v_result jsonb;
BEGIN
  SELECT * INTO STRICT v_state FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 r
   WHERE r.request_operation_id=p_request_operation_id FOR UPDATE;
  IF v_state.status='ACTIVE' THEN
    RETURN potok_nutrition.generation_request_status_json_v2(
      v_state.request_operation_id,'ACTIVE',NULL);
  END IF;
  IF v_state.status NOT IN ('GENERATED','ACTIVATING')
     OR v_state.generated_operation_id IS NULL THEN
    RAISE EXCEPTION 'generation request is not activatable' USING ERRCODE='40001';
  END IF;
  BEGIN
    PERFORM potok_nutrition.assert_generation_request_current_v2(p_request_operation_id);
    UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2
       SET status='ACTIVATING',reason_code=NULL
     WHERE request_operation_id=p_request_operation_id;
    v_receipt:=potok_nutrition.activate_generated_week_v2(
      v_state.generated_operation_id,v_state.activation_idempotency_key,NULL);
    IF v_receipt->>'outcome'<>'accepted' OR v_receipt->>'operation_id' IS NULL THEN
      UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2
         SET status='UNKNOWN_RETRYABLE',reason_code='ACTIVATION_RESULT_UNKNOWN'
       WHERE request_operation_id=p_request_operation_id;
      RETURN potok_nutrition.generation_request_status_json_v2(
        p_request_operation_id,'UNKNOWN_RETRYABLE','ACTIVATION_RESULT_UNKNOWN');
    END IF;
    v_activation_operation_id:=(v_receipt->>'operation_id')::uuid;
  EXCEPTION WHEN serialization_failure THEN
    RETURN potok_nutrition.settle_generation_request_failure_v2(
      p_request_operation_id,'CONFLICT',SQLERRM);
  WHEN insufficient_privilege THEN
    RETURN potok_nutrition.settle_generation_request_failure_v2(
      p_request_operation_id,'REJECTED',SQLERRM);
  END;
  v_result:=potok_nutrition.generation_request_status_json_v2(
    p_request_operation_id,'ACTIVE',NULL);
  UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2
     SET status='ACTIVE',reason_code=NULL,activation_operation_id=v_activation_operation_id
   WHERE request_operation_id=p_request_operation_id;
  UPDATE public.adaptive_nutrition_operations
     SET outcome='accepted',result_references=pg_catalog.jsonb_build_object(
           'request_operation_id',p_request_operation_id,
           'activation_operation_id',v_activation_operation_id,
           'selection_id',v_state.selection_id,
           'plan_revision',v_state.proposed_plan_revision),
         committed_at=pg_catalog.statement_timestamp()
   WHERE user_id=v_state.account_id AND operation_id=p_request_operation_id
     AND outcome='in_progress';
  RETURN v_result;
END
$function$;

REVOKE ALL ON FUNCTION public.adaptive_nutrition_request_generation_v2(text,uuid),
  public.adaptive_nutrition_generation_status_v2(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.adaptive_nutrition_request_generation_v2(text,uuid),
  public.adaptive_nutrition_generation_status_v2(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION potok_nutrition.load_generation_request_v2(uuid),
  potok_nutrition.record_generated_week_gateway_v2(uuid,bytea),
  potok_nutrition.activate_generated_week_gateway_v2(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION potok_nutrition.load_generation_request_v2(uuid),
  potok_nutrition.record_generated_week_gateway_v2(uuid,bytea),
  potok_nutrition.activate_generated_week_gateway_v2(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION potok_nutrition.assert_generation_request_current_v2(uuid),
  potok_nutrition.settle_generation_request_failure_v2(uuid,text,text),
  potok_nutrition.generation_request_status_json_v2(uuid,text,text),
  potok_nutrition.initialize_nutrition_authorities_v1(uuid,uuid,bytea,bytea,uuid),
  potok_nutrition.create_preference_successor_v1(uuid,uuid,uuid,bytea,uuid),
  potok_nutrition.create_safety_successor_v1(uuid,uuid,uuid,bytea,uuid),
  potok_nutrition.publish_candidate_manifest_v2(bytea,uuid,uuid,uuid),
  potok_nutrition.record_generated_week_v2(uuid,uuid,uuid,bytea,bytea),
  potok_nutrition.activate_generated_week_v2(uuid,uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role;

COMMENT ON FUNCTION potok_nutrition.record_generated_week_v2(uuid,uuid,uuid,bytea,bytea) IS
  'SECURITY INVOKER internal writer: callable only as postgres owner or through reviewed postgres-owned gateway; no application/service_role EXECUTE.';
COMMENT ON FUNCTION potok_nutrition.activate_generated_week_v2(uuid,uuid,uuid) IS
  'SECURITY INVOKER internal writer: callable only as postgres owner or through reviewed postgres-owned gateway; no application/service_role EXECUTE.';
COMMENT ON TABLE potok_nutrition.adaptive_nutrition_generation_policy_head_v2 IS
  'Empty after migration; a separately reviewed policy publication is required before generation requests can be accepted.';
COMMENT ON TABLE potok_nutrition.adaptive_nutrition_goal_targets_v1 IS
  'Immutable reviewed GoalNutritionTargetV1 authority; migration publishes no target and request generation fails closed without an exact Goal/policy binding.';
COMMENT ON TABLE potok_nutrition.adaptive_nutrition_generation_requests_v2 IS
  'Protected mutable lifecycle projection backed by immutable operations receipts; no direct application table access.';

COMMIT;
