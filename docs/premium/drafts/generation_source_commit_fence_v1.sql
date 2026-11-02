-- REVIEW CANDIDATE ONLY. No automatic apply, data publication or activation.
-- Revalidate stored source admission in the actual record/activate transaction.
BEGIN;
SET LOCAL search_path=pg_catalog;
DO $preflight$
DECLARE expected record;
BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' THEN
  RAISE EXCEPTION 'GENERATION_FENCE_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
 IF to_regprocedure('potok_nutrition.assert_generation_source_current_v1(uuid,bytea)') IS NOT NULL THEN
  RAISE EXCEPTION 'GENERATION_FENCE_ALREADY_INSTALLED'; END IF;
 FOR expected IN SELECT * FROM (VALUES
  ('potok_nutrition.assert_generation_request_current_v2(uuid)','d47092345fb1a684eae62bd457ce8a98',false),
  ('potok_nutrition.acquire_shared_account_gate_v1(uuid)','0a7fc0c24f7bc22f6792781636ac2387',false),
  ('potok_nutrition.guard_generation_receipt_revocation_v1()','67e93b80c68506c16e2ca8386bc5c10a',false),
  ('potok_nutrition.guard_generation_producer_revocation_v1()','66bcd181904a69fe3bd33c657a273fce',false),
  ('potok_nutrition.record_generated_week_gateway_v2(uuid,bytea)','bc354a26e7b84becdc7711f39f646a9d',true),
  ('potok_nutrition.activate_generated_week_gateway_v2(uuid)','6e9cf35c74c3c301b4ad86e3425ca05a',true)
 ) e(signature,body_md5,is_definer) LOOP
  IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure(expected.signature)
    AND md5(prosrc)=expected.body_md5 AND prosecdef=expected.is_definer AND provolatile='v'
    AND pg_get_userbyid(proowner)='postgres' AND proconfig=ARRAY['search_path=pg_catalog']) THEN
   RAISE EXCEPTION 'GENERATION_FENCE_PREREQUISITE_DRIFT'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT FROM pg_trigger WHERE tgrelid='potok_nutrition.generation_validation_receipt_revocations_v1'::regclass
   AND tgname='receipt_revocation_insert' AND tgfoid='potok_nutrition.guard_generation_receipt_revocation_v1()'::regprocedure AND tgtype=7 AND tgenabled='O')
  OR NOT EXISTS(SELECT FROM pg_trigger WHERE tgrelid='potok_nutrition.generation_preparation_source_revocations_v1'::regclass
   AND tgname='preparation_revocation_insert' AND tgfoid='potok_nutrition.guard_generation_producer_revocation_v1()'::regprocedure AND tgtype=7 AND tgenabled='O') THEN
  RAISE EXCEPTION 'GENERATION_FENCE_REVOCATION_GUARD_DRIFT'; END IF;
END $preflight$;

CREATE FUNCTION potok_nutrition.assert_generation_source_current_v1(request_id uuid,plan_raw bytea)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE r record; sources record; input jsonb; plan jsonb; metadata jsonb; final_warnings jsonb;
 evidence_digest bytea; policies_digest bytea; slot_count bigint;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'GENERATION_FENCE_CHANNEL_REQUIRED' USING ERRCODE='42501'; END IF;
 -- A pre-lock transaction snapshot must never hide a newly committed revocation.
 IF current_setting('transaction_isolation')<>'read committed' THEN
  RAISE EXCEPTION 'GENERATION_FENCE_READ_COMMITTED_REQUIRED' USING ERRCODE='22023'; END IF;
 IF request_id IS NULL OR plan_raw IS NULL OR octet_length(plan_raw) NOT BETWEEN 2 AND 8000000 THEN
  RAISE EXCEPTION 'GENERATION_FENCE_INVALID_PROPOSAL' USING ERRCODE='22023'; END IF;
 -- Existing order: request row -> common exclusive account gate -> current heads.
 -- Both append-only revocation triggers take this same account gate. Locks live
 -- until this record/activation transaction commits, not merely until this call.
 PERFORM potok_nutrition.assert_generation_request_current_v2(request_id);
 SELECT * INTO STRICT r FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 WHERE request_operation_id=request_id;
 input:=potok_nutrition.require_canonical_json_v2(r.generation_input_canonical);
 plan:=potok_nutrition.require_canonical_json_v2(plan_raw);
 IF r.status NOT IN('GENERATING','UNKNOWN_RETRYABLE','GENERATED','ACTIVATING')
  OR input->>'accountId' IS DISTINCT FROM r.account_id::text
  OR input#>>'{operation,requestId}' IS DISTINCT FROM request_id::text
  OR input#>>'{selection,selectionId}' IS DISTINCT FROM r.selection_id::text
  OR plan->>'accountId' IS DISTINCT FROM r.account_id::text
  OR plan->>'selectionId' IS DISTINCT FROM r.selection_id::text
  OR plan->>'generationInputDigest' IS DISTINCT FROM encode(r.generation_input_digest,'hex')
  OR plan->>'proposedPlanRevision' IS DISTINCT FROM input#>>'{selection,proposedPlanRevision}'
  OR jsonb_typeof(plan#>'{graph,days}') IS DISTINCT FROM 'array'
  OR jsonb_array_length(plan#>'{graph,days}')<>7 THEN
  RAISE EXCEPTION 'GENERATION_FENCE_PROPOSAL_BINDING_MISMATCH' USING ERRCODE='22023'; END IF;
 -- Null-safe lineage checks supplement the retained gate's legacy comparisons.
 IF NOT EXISTS(SELECT FROM public.user_premium_plan_selections s
   JOIN public.user_goals g ON g.user_id=s.user_id AND g.goal_revision=s.goal_revision
   WHERE s.id=r.selection_id AND s.user_id=r.account_id AND s.status='pending_generation' AND s.plan_revision IS NULL
    AND s.week_anchor::text=input->>'weekStartLocal' AND s.timezone=input->>'timezone'
    AND s.goal_revision::text=input#>>'{goalNutritionTarget,goalRevision}'
    AND s.origin_lineage->>'provisionOperationId'=input#>>'{selection,planSelectionRevision}'
    AND input->>'entitlementEvidenceRevision'=(SELECT a.attestation_id::text FROM potok_control.access_attestations a
      WHERE a.account_id=r.account_id AND a.capability='premium' AND a.issued_at<=statement_timestamp()
      ORDER BY a.lineage_sequence DESC LIMIT 1)) THEN
  RAISE EXCEPTION 'GENERATION_FENCE_SELECTION_UNAVAILABLE' USING ERRCODE='42501'; END IF;
 SELECT v.validation_evidence_raw,v.policies_raw,w.warning_evidence_raw,
   v.evidence_storage_sha256,v.policies_storage_sha256,w.warning_storage_sha256
 INTO sources
 FROM potok_nutrition.generation_validation_inputs_v1 v
 JOIN potok_nutrition.generation_validation_warnings_v1 w ON w.request_operation_id=v.request_operation_id
   AND w.proposal_raw_sha256=extensions.digest(plan_raw,'sha256')
 JOIN potok_nutrition.generation_validation_receipt_bindings_v1 vi ON vi.receipt_ref=v.source_receipt_ref
   AND vi.request_operation_id=v.request_operation_id AND vi.account_id=v.account_id AND vi.source_kind='INPUTS'
   AND vi.proposal_raw_sha256 IS NULL AND vi.source_storage_sha256=v.evidence_storage_sha256 AND vi.policies_storage_sha256=v.policies_storage_sha256
 JOIN potok_nutrition.generation_validation_receipt_bindings_v1 wi ON wi.receipt_ref=w.source_receipt_ref
   AND wi.request_operation_id=v.request_operation_id AND wi.account_id=v.account_id AND wi.source_kind='WARNINGS'
   AND wi.proposal_raw_sha256=w.proposal_raw_sha256 AND wi.source_storage_sha256=w.warning_storage_sha256
 WHERE v.request_operation_id=request_id AND v.account_id=r.account_id AND v.generation_input_digest=r.generation_input_digest
  AND NOT EXISTS(SELECT FROM potok_nutrition.generation_validation_receipt_revocations_v1 x WHERE x.receipt_ref IN(vi.receipt_ref,wi.receipt_ref));
 IF NOT FOUND THEN RAISE EXCEPTION 'GENERATION_SOURCE_PROVENANCE_UNAVAILABLE' USING ERRCODE='42501'; END IF;
 IF extensions.digest(sources.validation_evidence_raw,'sha256') IS DISTINCT FROM sources.evidence_storage_sha256
   OR extensions.digest(sources.policies_raw,'sha256') IS DISTINCT FROM sources.policies_storage_sha256
   OR extensions.digest(sources.warning_evidence_raw,'sha256') IS DISTINCT FROM sources.warning_storage_sha256 THEN
  RAISE EXCEPTION 'GENERATION_SOURCE_STORAGE_CORRUPT' USING ERRCODE='42501'; END IF;
 evidence_digest:=decode(sources.validation_evidence_raw::jsonb->>'digest','hex');
 policies_digest:=decode(sources.policies_raw::jsonb->>'digest','hex');
 final_warnings:=sources.warning_evidence_raw::jsonb;
 IF evidence_digest IS NULL OR octet_length(evidence_digest)<>32 OR policies_digest IS NULL OR octet_length(policies_digest)<>32
  OR final_warnings->>'validationEvidenceDigest' IS DISTINCT FROM encode(evidence_digest,'hex')
  OR final_warnings->>'validationPoliciesDigest' IS DISTINCT FROM encode(policies_digest,'hex')
  OR jsonb_typeof(final_warnings->'entries') IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION 'GENERATION_SOURCE_CONTEXT_MISMATCH' USING ERRCODE='42501'; END IF;
 SELECT s.payload_raw::jsonb INTO metadata FROM potok_nutrition.generation_preparation_sources_v1 s
 WHERE s.request_operation_id=request_id AND s.account_id=r.account_id AND s.source_kind='METADATA'
  AND s.generation_input_digest=r.generation_input_digest AND s.validation_evidence_digest=evidence_digest AND s.validation_policies_digest=policies_digest
  AND s.payload_storage_sha256=extensions.digest(s.payload_raw,'sha256')
  AND NOT EXISTS(SELECT FROM potok_nutrition.generation_preparation_source_revocations_v1 x WHERE x.source_ref=s.source_ref);
 IF metadata IS NULL OR jsonb_typeof(metadata->'slotRevisions') IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION 'GENERATION_METADATA_PROVENANCE_UNAVAILABLE' USING ERRCODE='42501'; END IF;
 SELECT count(*) INTO slot_count FROM jsonb_array_elements(plan#>'{graph,days}') d,LATERAL jsonb_array_elements(d.value->'slots') s;
 IF slot_count=0 OR slot_count<>jsonb_array_length(metadata->'slotRevisions') OR slot_count<>jsonb_array_length(final_warnings->'entries')
  OR EXISTS(SELECT FROM jsonb_array_elements(plan#>'{graph,days}') d,LATERAL jsonb_array_elements(d.value->'slots') s
    GROUP BY s.value->>'slotId' HAVING count(*)<>1) THEN
  RAISE EXCEPTION 'GENERATION_SOURCE_SLOT_COVERAGE_MISMATCH' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT FROM jsonb_array_elements(plan#>'{graph,days}') d,LATERAL jsonb_array_elements(d.value->'slots') slot
  WHERE NOT EXISTS(SELECT FROM jsonb_array_elements(metadata->'slotRevisions') m
    WHERE m.value->>'slotId'=slot.value->>'slotId' AND m.value->>'mealSnapshotRevision'=slot.value->>'mealSnapshotRevision')
   OR (SELECT count(*) FROM jsonb_array_elements(final_warnings->'entries') w
     JOIN potok_nutrition.generation_preparation_sources_v1 s ON s.request_operation_id=request_id AND s.account_id=r.account_id
       AND s.source_kind='MEAL_WARNING' AND s.slot_id::text=slot.value->>'slotId'
       AND encode(s.meal_snapshot_digest,'hex')=slot.value#>>'{mealSnapshot,digest}'
       AND s.generation_input_digest=r.generation_input_digest AND s.validation_evidence_digest=evidence_digest AND s.validation_policies_digest=policies_digest
       AND s.payload_storage_sha256=extensions.digest(s.payload_raw,'sha256') AND s.payload_raw::jsonb=w.value
     WHERE w.value->>'slotId'=slot.value->>'slotId' AND w.value->>'mealSnapshotDigest'=slot.value#>>'{mealSnapshot,digest}'
      AND NOT EXISTS(SELECT FROM potok_nutrition.generation_preparation_source_revocations_v1 x WHERE x.source_ref=s.source_ref))<>1) THEN
  RAISE EXCEPTION 'GENERATION_MEAL_SOURCE_PROVENANCE_UNAVAILABLE' USING ERRCODE='42501'; END IF;
END $fn$;
REVOKE ALL ON FUNCTION potok_nutrition.assert_generation_source_current_v1(uuid,bytea)
 FROM PUBLIC,anon,authenticated,service_role,potok_generation_reader_v1,potok_generation_gateway_v1;

-- Exact retained definitions only. CREATE OR REPLACE preserves each existing ACL.
DO $patch$
DECLARE signature text; body text; replacement text; acl_before aclitem[];
 needle text:='    PERFORM potok_nutrition.assert_generation_request_current_v2(p_request_operation_id);';
BEGIN
 FOREACH signature IN ARRAY ARRAY['potok_nutrition.record_generated_week_gateway_v2(uuid,bytea)',
   'potok_nutrition.activate_generated_week_gateway_v2(uuid)'] LOOP
  SELECT pg_get_functiondef(oid),proacl INTO body,acl_before FROM pg_proc WHERE oid=to_regprocedure(signature);
  IF array_length(string_to_array(body,needle),1)<>2 THEN RAISE EXCEPTION 'GENERATION_FENCE_PATCH_ANCHOR_DRIFT'; END IF;
  replacement:=CASE WHEN signature LIKE '%record_generated%' THEN
   '    PERFORM potok_nutrition.assert_generation_source_current_v1(p_request_operation_id,p_generated_week_plan_canonical);'
  ELSE
   '    PERFORM potok_nutrition.assert_generation_source_current_v1(p_request_operation_id,(SELECT o.result_canonical FROM public.adaptive_nutrition_operations o WHERE o.operation_id=v_state.generated_operation_id AND o.user_id=v_state.account_id AND o.selection_id=v_state.selection_id AND o.action_type=''PLAN_GENERATED_V2'' AND o.outcome=''accepted'' AND o.canonical_request=v_state.generation_input_canonical AND o.result_digest=extensions.digest(o.result_canonical,''sha256'')));'
  END;
  EXECUTE replace(body,needle,replacement);
  IF NOT EXISTS(SELECT FROM pg_proc WHERE oid=to_regprocedure(signature) AND proacl IS NOT DISTINCT FROM acl_before
    AND prosecdef AND provolatile='v' AND proconfig=ARRAY['search_path=pg_catalog'] AND pg_get_userbyid(proowner)='postgres') THEN
   RAISE EXCEPTION 'GENERATION_FENCE_GATEWAY_POSTCHECK_FAILED'; END IF;
 END LOOP;
END $patch$;
COMMIT;
