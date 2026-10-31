-- REVIEW CANDIDATE ONLY. Requires the approved/installed source-storage package from PR267.
-- Adds one private request-only reader and one EXECUTE grant to the existing NOLOGIN reader role.
-- No source writes, new tables, publication, producer metadata defaults or generation activation.
BEGIN;
SET LOCAL search_path=pg_catalog;
DO $preflight$
DECLARE expected record;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'PREPARATION_SOURCE_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
 IF to_regprocedure('potok_nutrition.read_admitted_generation_preparation_source_v1(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'PREPARATION_SOURCE_ALREADY_INSTALLED'; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='potok_generation_reader_v1'
    AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit AND NOT rolcreaterole AND NOT rolcreatedb)
   OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='potok_nutrition' AND has_function_privilege('potok_generation_reader_v1',p.oid,'EXECUTE'))<>1
   OR NOT has_function_privilege('potok_generation_reader_v1','potok_nutrition.read_admitted_generation_validation_source_v1(uuid,bytea)','EXECUTE') THEN
  RAISE EXCEPTION 'PREPARATION_SOURCE_READER_BASELINE_MISMATCH';
 END IF;
 FOR expected IN SELECT * FROM (VALUES
  ('potok_control.is_effective_entitlement_v2(uuid,text,timestamptz)','afd14b981eeade127134246a7d69671d',true,'s'),
  ('potok_nutrition.assert_generation_request_current_v2(uuid)','d47092345fb1a684eae62bd457ce8a98',false,'v'),
  ('potok_nutrition.acquire_shared_account_gate_v1(uuid)','0a7fc0c24f7bc22f6792781636ac2387',false,'v'),
  ('potok_nutrition.require_canonical_json_v2(bytea)','4453774aeecef9584fb2f0312e30ef83',false,'s'),
  ('potok_nutrition.canonical_jsonb_text_v1(jsonb)','971923fd16799732f89f0f23782f984c',false,'i'),
  ('potok_nutrition.json_has_duplicate_keys_v1(json)','24924ecda9f7d1d0c5284c928c6805af',false,'i')
 ) AS f(signature,body_md5,is_definer,volatility) LOOP
  IF NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure(expected.signature)
   AND md5(p.prosrc)=expected.body_md5 AND pg_get_userbyid(p.proowner)='postgres'
   AND p.proconfig=ARRAY['search_path=pg_catalog'] AND p.prosecdef=expected.is_definer AND p.provolatile::text=expected.volatility) THEN
   RAISE EXCEPTION 'GENERATION_ADMISSION_PREREQUISITE_DRIFT';
  END IF;
 END LOOP;
 FOR expected IN SELECT * FROM (VALUES
  ('potok_nutrition.read_generation_validation_source_v1(uuid,bytea)','839a6130293d0e096299aad6ea1814ce',false,'s'),
  ('potok_nutrition.read_admitted_generation_validation_source_v1(uuid,bytea)','c12b5e1198160e7b3b9df7eeb8a6661f',true,'v')
 ) AS f(signature,body_md5,is_definer,volatility) LOOP
  IF NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure(expected.signature)
   AND md5(p.prosrc)=expected.body_md5 AND pg_get_userbyid(p.proowner)='postgres'
   AND p.proconfig=ARRAY['search_path=pg_catalog'] AND p.prosecdef=expected.is_definer AND p.provolatile::text=expected.volatility) THEN
   RAISE EXCEPTION 'PREPARATION_SOURCE_STORAGE_BASELINE_DRIFT';
  END IF;
 END LOOP;
END
$preflight$;

CREATE FUNCTION potok_nutrition.read_admitted_generation_preparation_source_v1(request_id uuid)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE result text;
BEGIN
 IF session_user<>'potok_generation_reader_v1' OR current_user<>'postgres' THEN
  RAISE EXCEPTION 'GENERATION_READER_IDENTITY_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF request_id IS NULL THEN RAISE EXCEPTION 'INVALID_PREPARATION_LOOKUP' USING ERRCODE='22023'; END IF;
 PERFORM potok_nutrition.assert_generation_request_current_v2(request_id);
 SELECT jsonb_build_object('contract','potok-generation-preparation-context-source-v1',
    'requestOperationId',r.request_operation_id,'accountId',r.account_id,
    'input',jsonb_build_object('canonicalHex',encode(r.generation_input_canonical,'hex'),'generationInputDigest',encode(r.generation_input_digest,'hex')),
    'manifest',jsonb_build_object('canonicalHex',encode(m.canonical_bytes,'hex'),'storageSha256',encode(m.canonical_digest,'hex')),
    'preference',jsonb_build_object('canonicalHex',encode(p.canonical_bytes,'hex'),'storageSha256',encode(p.canonical_digest,'hex')),
    'safety',jsonb_build_object('canonicalHex',encode(s.canonical_bytes,'hex'),'storageSha256',encode(s.canonical_digest,'hex')),
    'validationEvidenceRaw',v.validation_evidence_raw,'policiesRaw',v.policies_raw)::text
 INTO result
  FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 r
  CROSS JOIN LATERAL (SELECT convert_from(r.generation_input_canonical,'UTF8')::jsonb AS body) j
  JOIN potok_nutrition.generation_validation_inputs_v1 v ON v.request_operation_id=r.request_operation_id
    AND v.account_id=r.account_id AND v.generation_input_digest=r.generation_input_digest
  JOIN potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2 mh ON mh.singleton
    AND mh.current_manifest_revision=(j.body->>'candidateManifestRevision')::uuid
  JOIN potok_nutrition.adaptive_nutrition_candidate_manifests_v2 m ON m.manifest_revision=mh.current_manifest_revision AND m.publication_state='PUBLISHED'
  JOIN potok_nutrition.nutrition_authority_heads_v1 a ON a.account_id=r.account_id
    AND a.current_preference_revision=(j.body->>'preferenceRevision')::uuid AND a.current_safety_revision=(j.body->>'safetyRevision')::uuid
  JOIN potok_nutrition.nutrition_preference_snapshots_v1 p ON p.account_id=r.account_id AND p.revision_id=a.current_preference_revision
  JOIN potok_nutrition.nutrition_safety_snapshots_v1 s ON s.account_id=r.account_id AND s.revision_id=a.current_safety_revision
  JOIN potok_nutrition.adaptive_nutrition_generation_policy_head_v2 ph ON ph.singleton AND ph.publication_state='PUBLISHED'
    AND ph.target_policy_revision=(j.body#>>'{goalNutritionTarget,targetPolicyRevision}')::uuid
    AND ph.composition_policy_revision=(j.body->>'compositionPolicyRevision')::uuid
    AND ph.validation_policy_revision=(j.body->>'validationPolicyRevision')::uuid
    AND ph.optimization_policy_revision=(j.body->>'optimizationPolicyRevision')::uuid
    AND ph.generation_policy_revision=(j.body->>'generationPolicyRevision')::uuid
  JOIN public.user_premium_plan_selections selection ON selection.id=r.selection_id AND selection.user_id=r.account_id
  JOIN public.user_goals goal ON goal.user_id=r.account_id AND goal.goal_revision=selection.goal_revision
  JOIN potok_nutrition.generation_validation_receipt_bindings_v1 receipt ON receipt.receipt_ref=v.source_receipt_ref
    AND receipt.request_operation_id=r.request_operation_id AND receipt.account_id=r.account_id AND receipt.source_kind='INPUTS'
    AND receipt.proposal_raw_sha256 IS NULL AND receipt.source_storage_sha256=v.evidence_storage_sha256
    AND receipt.policies_storage_sha256=v.policies_storage_sha256
  WHERE r.request_operation_id=request_id AND r.status IN ('REQUESTED','GENERATING')
    AND r.account_id=(j.body->>'accountId')::uuid AND r.request_operation_id=(j.body#>>'{operation,requestId}')::uuid
    AND r.selection_id=(j.body#>>'{selection,selectionId}')::uuid
    AND selection.status='pending_generation' AND selection.plan_revision IS NULL
    AND selection.week_anchor::text=j.body->>'weekStartLocal' AND selection.timezone=j.body->>'timezone'
    AND selection.goal_revision=(j.body#>>'{goalNutritionTarget,goalRevision}')::uuid
    AND selection.origin_lineage->>'provisionOperationId'=j.body#>>'{selection,planSelectionRevision}'
    AND (j.body->>'entitlementEvidenceRevision')::uuid=(SELECT a.attestation_id FROM potok_control.access_attestations a
      WHERE a.account_id=r.account_id AND a.capability='premium' AND a.issued_at<=statement_timestamp()
      ORDER BY a.lineage_sequence DESC LIMIT 1)
    AND NOT EXISTS(SELECT FROM potok_nutrition.generation_validation_receipt_revocations_v1 x WHERE x.receipt_ref=receipt.receipt_ref);

 IF result IS NULL THEN RAISE EXCEPTION 'SOURCE_PROVENANCE_UNAVAILABLE' USING ERRCODE='42501'; END IF;
 RETURN result;
END
$fn$;
REVOKE ALL ON FUNCTION potok_nutrition.read_admitted_generation_preparation_source_v1(uuid)
 FROM PUBLIC,anon,authenticated,service_role,potok_generation_reader_v1;
GRANT EXECUTE ON FUNCTION potok_nutrition.read_admitted_generation_preparation_source_v1(uuid) TO potok_generation_reader_v1;
DO $postcheck$
BEGIN
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='potok_nutrition' AND has_function_privilege('potok_generation_reader_v1',p.oid,'EXECUTE'))<>2
 OR EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='potok_nutrition' AND has_function_privilege('potok_generation_reader_v1',p.oid,'EXECUTE')
   AND p.oid NOT IN('potok_nutrition.read_admitted_generation_preparation_source_v1(uuid)'::regprocedure,
    'potok_nutrition.read_admitted_generation_validation_source_v1(uuid,bytea)'::regprocedure))
 OR EXISTS(SELECT FROM (VALUES('anon'),('authenticated'),('service_role')) r(name)
  WHERE has_function_privilege(r.name,'potok_nutrition.read_admitted_generation_preparation_source_v1(uuid)','EXECUTE')) THEN
  RAISE EXCEPTION 'PREPARATION_SOURCE_GRANT_POSTCHECK_FAILED';
 END IF;
END
$postcheck$;
COMMENT ON FUNCTION potok_nutrition.read_admitted_generation_preparation_source_v1(uuid) IS
 'Request-only preparation context from current admitted input storage. No proposal SHA or final warning required; never substitutes for independent proposal validation. Requires admitted SQL session and current Premium/source receipt.';
COMMIT;
