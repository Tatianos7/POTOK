-- REVIEW DRAFT ONLY. Not a migration or deployment instruction.
-- Requires the protected execution and Graph V2 packages; installs no data.
BEGIN;
DO $guard$
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres'
    OR to_regprocedure('public.adaptive_nutrition_read_graph_v2(uuid,uuid,text)') IS NULL
    OR to_regclass('potok_nutrition.adaptive_nutrition_generation_requests_v2') IS NULL THEN
    RAISE EXCEPTION 'GENERATION_READBACK_FOUNDATION_REQUIRED';
  END IF;
END
$guard$;

CREATE FUNCTION public.adaptive_nutrition_read_generation_plan_v2(p_request_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_state potok_nutrition.adaptive_nutrition_generation_requests_v2%ROWTYPE;
  v_generated public.adaptive_nutrition_operations%ROWTYPE;
  v_activation public.adaptive_nutrition_operations%ROWTYPE;
  v_graph public.adaptive_nutrition_graph_revisions%ROWTYPE;
  v_read jsonb;
  v_plan jsonb;
  v_input jsonb;
  v_activation_request jsonb;
  v_bytes bytea;
BEGIN
  IF v_actor IS NULL THEN RETURN jsonb_build_object('kind','denied'); END IF;
  IF NOT potok_control.is_effective_entitlement_v2(v_actor,'premium',statement_timestamp()) THEN
    RETURN jsonb_build_object('kind','denied');
  END IF;
  SELECT * INTO v_state FROM potok_nutrition.adaptive_nutrition_generation_requests_v2
    WHERE account_id=v_actor AND request_operation_id=p_request_operation_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('kind','not_found'); END IF;
  IF v_state.status IN ('REJECTED','CONFLICT') THEN RETURN jsonb_build_object('kind','unavailable'); END IF;
  IF v_state.status IS DISTINCT FROM 'ACTIVE' THEN RETURN jsonb_build_object('kind','not_ready'); END IF;
  -- Null revision/digest invokes the existing current-head/Premium reader, never its history path.
  v_read := public.adaptive_nutrition_read_graph_v2(v_state.selection_id,NULL,NULL);
  IF v_read->>'kind' IS DISTINCT FROM 'ready' THEN RETURN jsonb_build_object('kind','unavailable'); END IF;
  SELECT * INTO v_generated FROM public.adaptive_nutrition_operations
    WHERE user_id=v_actor AND operation_id=v_state.generated_operation_id
      AND selection_id=v_state.selection_id AND action_type='PLAN_GENERATED_V2' AND outcome='accepted';
  IF NOT FOUND THEN RETURN jsonb_build_object('kind','unavailable'); END IF;
  SELECT * INTO v_activation FROM public.adaptive_nutrition_operations
    WHERE user_id=v_actor AND operation_id=v_state.activation_operation_id
      AND selection_id=v_state.selection_id AND action_type='PLAN_ACTIVATED_V2' AND outcome='accepted';
  IF NOT FOUND THEN RETURN jsonb_build_object('kind','unavailable'); END IF;
  SELECT * INTO v_graph FROM public.adaptive_nutrition_graph_revisions
    WHERE user_id=v_actor AND selection_id=v_state.selection_id AND plan_revision=v_state.proposed_plan_revision
      AND graph_contract='adaptive_nutrition_graph_v2' AND graph_contract_version=2;
  IF NOT FOUND THEN RETURN jsonb_build_object('kind','unavailable'); END IF;
  v_plan := potok_nutrition.require_canonical_json_v2(v_generated.result_canonical);
  v_input := potok_nutrition.require_canonical_json_v2(v_generated.canonical_request);
  v_activation_request := potok_nutrition.require_canonical_json_v2(v_activation.canonical_request);
  v_bytes := convert_to(potok_nutrition.canonical_jsonb_text_v1(jsonb_build_object(
    'encoding','potok-adaptive-nutrition-graph-v2-canonical-json-v1',
    'contract','adaptive_nutrition_graph_v2','graph',v_plan->'graph')),'UTF8');
  IF v_generated.canonical_request IS DISTINCT FROM v_state.generation_input_canonical
    OR v_input->>'contract' IS DISTINCT FROM 'potok-adaptive-trusted-generation-input-v1'
    OR v_state.generation_input_digest IS DISTINCT FROM extensions.digest(convert_to(
      potok_nutrition.canonical_jsonb_text_v1(jsonb_build_object(
        'contract','potok-adaptive-trusted-generation-input-v1','input',v_input)),'UTF8'),'sha256')
    OR v_plan->>'contract' IS DISTINCT FROM 'potok-adaptive-generated-week-plan-v1'
    OR v_plan->>'generationInputDigest' IS DISTINCT FROM encode(v_state.generation_input_digest,'hex')
    OR v_plan->>'deterministicContentDigest' IS DISTINCT FROM encode(extensions.digest(convert_to(
      potok_nutrition.canonical_jsonb_text_v1(v_plan-'deterministicContentDigest'),'UTF8'),'sha256'),'hex')
    OR v_input->>'accountId' IS DISTINCT FROM v_actor::text
    OR v_input#>>'{operation,requestId}' IS DISTINCT FROM p_request_operation_id::text
    OR v_plan->>'accountId' IS DISTINCT FROM v_actor::text
    OR v_plan->>'selectionId' IS DISTINCT FROM v_state.selection_id::text
    OR v_plan->>'proposedPlanRevision' IS DISTINCT FROM v_state.proposed_plan_revision::text
    OR v_plan->'facts' IS DISTINCT FROM '[]'::jsonb
    OR v_plan->'generatedAt' IS DISTINCT FROM 'null'::jsonb
    OR v_read->>'plan_revision' IS DISTINCT FROM v_state.proposed_plan_revision::text
    OR v_read->'graph' IS DISTINCT FROM v_plan->'graph'
    OR v_graph.graph_snapshot IS DISTINCT FROM v_plan->'graph'
    OR v_graph.graph_canonical_bytes IS DISTINCT FROM v_bytes
    OR v_graph.content_digest IS DISTINCT FROM extensions.digest(v_bytes,'sha256')
    OR v_generated.result_graph_digest IS DISTINCT FROM v_graph.content_digest
    OR v_plan->>'graphDigest' IS DISTINCT FROM encode(v_graph.content_digest,'hex')
    OR v_read->>'graph_digest_hex' IS DISTINCT FROM encode(v_graph.content_digest,'hex')
    OR v_generated.result_plan_revision IS DISTINCT FROM v_state.proposed_plan_revision
    OR v_generated.result_digest IS DISTINCT FROM extensions.digest(v_generated.result_canonical,'sha256')
    OR v_graph.generated_week_plan_digest IS DISTINCT FROM v_generated.result_digest
    OR v_graph.generation_input_digest IS DISTINCT FROM extensions.digest(v_generated.canonical_request,'sha256')
    OR v_graph.generation_operation_id IS DISTINCT FROM v_generated.operation_id
    OR v_graph.activation_operation_id IS DISTINCT FROM v_activation.operation_id
    OR v_activation_request->>'contract' IS DISTINCT FROM 'potok-adaptive-activate-generated-week-v2'
    OR v_activation_request->>'generationOperationId' IS DISTINCT FROM v_generated.operation_id::text
    OR v_activation_request->'expectedPlanRevision' IS DISTINCT FROM 'null'::jsonb
    OR v_activation.result_plan_revision IS DISTINCT FROM v_state.proposed_plan_revision
    OR v_activation.result_graph_digest IS DISTINCT FROM v_graph.content_digest
    OR v_activation.result_digest IS DISTINCT FROM extensions.digest(v_activation.result_canonical,'sha256')
    OR potok_nutrition.require_canonical_json_v2(v_activation.result_canonical) IS DISTINCT FROM v_activation.result_references
    OR v_activation.result_references->>'contract' IS DISTINCT FROM 'potok-adaptive-plan-activated-v2'
    OR v_activation.result_references->>'kind' IS DISTINCT FROM 'settled'
    OR v_activation.result_references->>'outcome' IS DISTINCT FROM 'accepted'
    OR v_activation.result_references->>'operation_id' IS DISTINCT FROM v_activation.operation_id::text
    OR v_activation.result_references->>'selection_id' IS DISTINCT FROM v_state.selection_id::text
    OR v_activation.result_references->>'plan_revision' IS DISTINCT FROM v_state.proposed_plan_revision::text
    OR v_activation.result_references->>'graph_digest_hex' IS DISTINCT FROM encode(v_graph.content_digest,'hex') THEN
    RETURN jsonb_build_object('kind','unavailable');
  END IF;
  RETURN jsonb_build_object('kind','ready','contract','potok-generation-plan-readback-v2',
    'request_operation_id',p_request_operation_id,'account_id',v_actor,'selection_id',v_state.selection_id,
    'plan_revision',v_state.proposed_plan_revision,'generation_operation_id',v_generated.operation_id,
    'activation_operation_id',v_activation.operation_id,'graph_digest_hex',encode(v_graph.content_digest,'hex'),
    'graph',v_graph.graph_snapshot);
END
$function$;
REVOKE ALL ON FUNCTION public.adaptive_nutrition_read_generation_plan_v2(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.adaptive_nutrition_read_generation_plan_v2(uuid) TO authenticated;
COMMENT ON FUNCTION public.adaptive_nutrition_read_generation_plan_v2(uuid) IS
  'Read-only own ACTIVE request to current Graph V2, bound to accepted generation/activation records and canonical bytes. No history fallback or writes.';
COMMIT;
