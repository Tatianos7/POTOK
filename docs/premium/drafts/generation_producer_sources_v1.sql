-- REVIEW CANDIDATE ONLY. Requires source storage PR267 and request-only preparation reader PR268.
-- Empty owner-admitted preparation storage, not a warning evaluator, food evidence issuer or publisher API.
-- No runtime/app writer, default profile/signals, source rows or generator activation are installed.
BEGIN;
SET LOCAL search_path=pg_catalog;
DO $preflight$
DECLARE expected record;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'GENERATION_PRODUCER_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
 IF to_regclass('potok_nutrition.generation_preparation_sources_v1') IS NOT NULL
  OR to_regclass('potok_nutrition.generation_preparation_source_revocations_v1') IS NOT NULL
  OR to_regprocedure('potok_nutrition.generation_producer_context_v1(uuid)') IS NOT NULL
  OR to_regprocedure('potok_nutrition.guard_generation_producer_source_v1()') IS NOT NULL
  OR to_regprocedure('potok_nutrition.guard_generation_producer_revocation_v1()') IS NOT NULL
  OR to_regprocedure('potok_nutrition.read_admitted_generation_producer_source_v1(uuid,text,bytea,uuid,bytea,bytea,bytea)') IS NOT NULL THEN
  RAISE EXCEPTION 'GENERATION_PRODUCER_ALREADY_OR_PARTIALLY_INSTALLED';
 END IF;
 IF to_regprocedure('potok_nutrition.read_admitted_generation_preparation_source_v1(uuid)') IS NULL
  OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname='potok_generation_reader_v1' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit)
  OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='potok_nutrition' AND has_function_privilege('potok_generation_reader_v1',p.oid,'EXECUTE'))<>2
  OR NOT has_function_privilege('potok_generation_reader_v1','potok_nutrition.read_admitted_generation_preparation_source_v1(uuid)','EXECUTE')
  OR NOT has_function_privilege('potok_generation_reader_v1','potok_nutrition.read_admitted_generation_validation_source_v1(uuid,bytea)','EXECUTE') THEN
  RAISE EXCEPTION 'GENERATION_PRODUCER_READER_BASELINE_MISMATCH';
 END IF;
 FOR expected IN SELECT * FROM (VALUES
  ('potok_nutrition.assert_generation_request_current_v2(uuid)','d47092345fb1a684eae62bd457ce8a98',false,'v'),
  ('potok_nutrition.acquire_shared_account_gate_v1(uuid)','0a7fc0c24f7bc22f6792781636ac2387',false,'v'),
  ('potok_nutrition.canonical_jsonb_text_v1(jsonb)','971923fd16799732f89f0f23782f984c',false,'i'),
  ('potok_nutrition.read_admitted_generation_preparation_source_v1(uuid)','c230a35cb30a71eb04f89bf4f7adf1fa',true,'v')
 ) AS f(signature,body_md5,is_definer,volatility) LOOP
  IF NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure(expected.signature)
   AND md5(p.prosrc)=expected.body_md5 AND pg_get_userbyid(p.proowner)='postgres'
   AND p.proconfig=ARRAY['search_path=pg_catalog'] AND p.prosecdef=expected.is_definer AND p.provolatile::text=expected.volatility) THEN
   RAISE EXCEPTION 'GENERATION_PRODUCER_PREREQUISITE_DRIFT';
  END IF;
 END LOOP;
END
$preflight$;

CREATE TABLE potok_nutrition.generation_preparation_sources_v1 (
 source_ref text PRIMARY KEY CHECK(length(btrim(source_ref))>0),
 request_operation_id uuid NOT NULL REFERENCES potok_nutrition.generation_validation_inputs_v1(request_operation_id) ON DELETE RESTRICT,
 account_id uuid NOT NULL,
 source_kind text NOT NULL CHECK(source_kind IN('METADATA','MEAL_WARNING')),
 generation_input_digest bytea NOT NULL CHECK(octet_length(generation_input_digest)=32),
 validation_evidence_digest bytea NOT NULL CHECK(octet_length(validation_evidence_digest)=32),
 validation_policies_digest bytea NOT NULL CHECK(octet_length(validation_policies_digest)=32),
 slot_id uuid,
 meal_snapshot_digest bytea,
 payload_raw text NOT NULL CHECK(octet_length(payload_raw) BETWEEN 2 AND 8000000),
 payload_storage_sha256 bytea GENERATED ALWAYS AS (extensions.digest(payload_raw,'sha256')) STORED,
 admitted_by name NOT NULL DEFAULT session_user CHECK(admitted_by='postgres'),
 admitted_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 UNIQUE NULLS NOT DISTINCT(request_operation_id,source_kind,slot_id,meal_snapshot_digest),
 CHECK((source_kind='METADATA' AND slot_id IS NULL AND meal_snapshot_digest IS NULL)
   OR(source_kind='MEAL_WARNING' AND slot_id IS NOT NULL AND meal_snapshot_digest IS NOT NULL AND octet_length(meal_snapshot_digest)=32)),
 CHECK(json_typeof(payload_raw::json)='object' AND NOT potok_nutrition.validation_store_json_has_duplicates_v1(payload_raw::json))
);
CREATE TABLE potok_nutrition.generation_preparation_source_revocations_v1 (
 source_ref text PRIMARY KEY REFERENCES potok_nutrition.generation_preparation_sources_v1(source_ref) ON DELETE RESTRICT,
 reason_ref text NOT NULL CHECK(length(btrim(reason_ref))>0),
 revoked_by name NOT NULL DEFAULT session_user CHECK(revoked_by='postgres'),
 revoked_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
ALTER TABLE potok_nutrition.generation_preparation_sources_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.generation_preparation_sources_v1 FORCE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.generation_preparation_source_revocations_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.generation_preparation_source_revocations_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON potok_nutrition.generation_preparation_sources_v1,potok_nutrition.generation_preparation_source_revocations_v1
 FROM PUBLIC,anon,authenticated,service_role,potok_generation_reader_v1;

-- Internal current input/provenance gate; no catalog serialization on every per-meal lookup.
CREATE FUNCTION potok_nutrition.generation_producer_context_v1(request_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE result jsonb;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'PROTECTED_PRODUCER_CONTEXT_REQUIRED' USING ERRCODE='42501'; END IF;
 PERFORM potok_nutrition.assert_generation_request_current_v2(request_id);
 SELECT jsonb_build_object('accountId',r.account_id,'generationInputDigest',encode(r.generation_input_digest,'hex'),
   'validationEvidenceDigest',v.validation_evidence_raw::jsonb->>'digest','validationPoliciesDigest',v.policies_raw::jsonb->>'digest',
   'validationPolicyRevision',j.body->>'validationPolicyRevision','distributionPolicy',v.validation_evidence_raw::jsonb->'distributionPolicy')
 INTO result FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 r
 CROSS JOIN LATERAL(SELECT convert_from(r.generation_input_canonical,'UTF8')::jsonb AS body) j
 JOIN potok_nutrition.generation_validation_inputs_v1 v ON v.request_operation_id=r.request_operation_id
   AND v.account_id=r.account_id AND v.generation_input_digest=r.generation_input_digest
 JOIN public.user_premium_plan_selections selection ON selection.id=r.selection_id AND selection.user_id=r.account_id
 JOIN public.user_goals goal ON goal.user_id=r.account_id AND goal.goal_revision=selection.goal_revision
 JOIN potok_nutrition.generation_validation_receipt_bindings_v1 receipt ON receipt.receipt_ref=v.source_receipt_ref
   AND receipt.request_operation_id=r.request_operation_id AND receipt.account_id=r.account_id AND receipt.source_kind='INPUTS'
   AND receipt.proposal_raw_sha256 IS NULL AND receipt.source_storage_sha256=v.evidence_storage_sha256 AND receipt.policies_storage_sha256=v.policies_storage_sha256
 WHERE r.request_operation_id=request_id AND r.status IN('REQUESTED','GENERATING')
   AND r.account_id=(j.body->>'accountId')::uuid AND r.request_operation_id=(j.body#>>'{operation,requestId}')::uuid
   AND r.selection_id=(j.body#>>'{selection,selectionId}')::uuid
   AND selection.status='pending_generation' AND selection.plan_revision IS NULL
   AND selection.week_anchor::text=j.body->>'weekStartLocal' AND selection.timezone=j.body->>'timezone'
   AND selection.goal_revision=(j.body#>>'{goalNutritionTarget,goalRevision}')::uuid
   AND selection.origin_lineage->>'provisionOperationId'=j.body#>>'{selection,planSelectionRevision}'
   AND (j.body->>'entitlementEvidenceRevision')::uuid=(SELECT a.attestation_id FROM potok_control.access_attestations a
      WHERE a.account_id=r.account_id AND a.capability='premium' AND a.issued_at<=statement_timestamp() ORDER BY a.lineage_sequence DESC LIMIT 1)
   AND NOT EXISTS(SELECT FROM potok_nutrition.generation_validation_receipt_revocations_v1 x WHERE x.receipt_ref=receipt.receipt_ref);
 IF result IS NULL THEN RAISE EXCEPTION 'SOURCE_PROVENANCE_UNAVAILABLE' USING ERRCODE='42501'; END IF;
 RETURN result;
END
$fn$;

CREATE FUNCTION potok_nutrition.guard_generation_producer_source_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
DECLARE context jsonb; body jsonb:=NEW.payload_raw::jsonb; item jsonb; expected_count integer; uuid_pattern text:='^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' THEN RAISE EXCEPTION 'OWNER_PRODUCER_ADMISSION_NOT_BOUND' USING ERRCODE='42501'; END IF;
 context:=potok_nutrition.generation_producer_context_v1(NEW.request_operation_id);
 IF NEW.account_id::text IS DISTINCT FROM context->>'accountId'
   OR encode(NEW.generation_input_digest,'hex') IS DISTINCT FROM context->>'generationInputDigest'
   OR encode(NEW.validation_evidence_digest,'hex') IS DISTINCT FROM context->>'validationEvidenceDigest'
   OR encode(NEW.validation_policies_digest,'hex') IS DISTINCT FROM context->>'validationPoliciesDigest'
   OR NEW.admitted_at>statement_timestamp() THEN RAISE EXCEPTION 'GENERATION_PRODUCER_SOURCE_BINDING_MISMATCH' USING ERRCODE='23514'; END IF;
 IF NEW.source_kind='METADATA' THEN
  IF (SELECT count(*) FROM jsonb_object_keys(body))<>5 OR NOT body ?& ARRAY['contract','requestOperationId','generationInputDigest','goalProfile','slotRevisions']
    OR body->>'contract' IS DISTINCT FROM 'potok-generation-preparation-metadata-v1'
    OR body->>'requestOperationId' IS DISTINCT FROM NEW.request_operation_id::text
    OR body->>'generationInputDigest' IS DISTINCT FROM encode(NEW.generation_input_digest,'hex')
    OR NOT COALESCE(body->>'goalProfile' IN('WEIGHT_LOSS','CUT','MAINTENANCE','MASS_GAIN'),false)
    OR jsonb_typeof(body->'slotRevisions') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_STORED_PREPARATION_METADATA' USING ERRCODE='23514'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(body->'slotRevisions') LOOP
   IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_STORED_SLOT_METADATA' USING ERRCODE='23514'; END IF;
   IF (SELECT count(*) FROM jsonb_object_keys(item))<>2 OR NOT item ?& ARRAY['slotId','mealSnapshotRevision']
    OR jsonb_typeof(item->'slotId') IS DISTINCT FROM 'string' OR NOT COALESCE(item->>'slotId'~uuid_pattern,false)
    OR jsonb_typeof(item->'mealSnapshotRevision') IS DISTINCT FROM 'string' OR NOT COALESCE(item->>'mealSnapshotRevision'~uuid_pattern,false)
    THEN RAISE EXCEPTION 'INVALID_STORED_SLOT_METADATA' USING ERRCODE='23514'; END IF;
  END LOOP;
  SELECT count(*) INTO expected_count FROM jsonb_array_elements(context#>'{distributionPolicy,days}') d,
    LATERAL jsonb_array_elements(d.value->'requiredSlots') s;
  IF jsonb_array_length(body->'slotRevisions')<>expected_count
   OR EXISTS(SELECT FROM jsonb_array_elements(body->'slotRevisions') GROUP BY value->>'slotId' HAVING count(*)>1)
   OR EXISTS(SELECT FROM jsonb_array_elements(context#>'{distributionPolicy,days}') d,LATERAL jsonb_array_elements(d.value->'requiredSlots') s
     WHERE NOT EXISTS(SELECT FROM jsonb_array_elements(body->'slotRevisions') a WHERE a.value->>'slotId'=s.value->>'slotId'))
   THEN RAISE EXCEPTION 'STORED_PREPARATION_SLOT_COVERAGE_MISMATCH' USING ERRCODE='23514'; END IF;
 ELSIF NEW.source_kind='MEAL_WARNING' THEN
  IF (SELECT count(*) FROM jsonb_object_keys(body))<>8 OR NOT body ?& ARRAY['contract','slotId','validationPolicyRevision','validationEvidenceDigest','mealSnapshotDigest','signals','evidenceRevision','digest']
    OR body->>'contract' IS DISTINCT FROM 'potok-meal-warning-evidence-v1'
    OR body->>'slotId' IS DISTINCT FROM NEW.slot_id::text
    OR body->>'mealSnapshotDigest' IS DISTINCT FROM encode(NEW.meal_snapshot_digest,'hex')
    OR body->>'validationEvidenceDigest' IS DISTINCT FROM encode(NEW.validation_evidence_digest,'hex')
    OR body->>'validationPolicyRevision' IS DISTINCT FROM context->>'validationPolicyRevision'
    OR NOT COALESCE(body->>'evidenceRevision'~uuid_pattern,false)
    OR jsonb_typeof(body->'signals') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_STORED_MEAL_WARNING' USING ERRCODE='23514'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(body->'signals'))<>5
    OR NOT (body->'signals') ?& ARRAY['softTargetFitDeviation','longPreparationBurden','shoppingListBurden','lowerConvenienceScore','repetitionApproachingLimit']
    OR EXISTS(SELECT FROM jsonb_each(body->'signals') WHERE jsonb_typeof(value) IS DISTINCT FROM 'boolean')
    THEN RAISE EXCEPTION 'INVALID_STORED_MEAL_WARNING_SIGNALS' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT FROM jsonb_array_elements(context#>'{distributionPolicy,days}') d,LATERAL jsonb_array_elements(d.value->'requiredSlots') s
    WHERE s.value->>'slotId'=NEW.slot_id::text) THEN RAISE EXCEPTION 'STORED_MEAL_WARNING_SLOT_UNKNOWN' USING ERRCODE='23514'; END IF;
  IF body->>'digest' IS DISTINCT FROM encode(extensions.digest(convert_to(potok_nutrition.canonical_jsonb_text_v1(jsonb_build_object(
    'contract','potok-meal-warning-evidence-v1','encoding','potok-meal-warning-evidence-canonical-json-v1','evidence',body-'digest')),'UTF8'),'sha256'),'hex')
    THEN RAISE EXCEPTION 'STORED_MEAL_WARNING_DIGEST_MISMATCH' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END
$fn$;
CREATE FUNCTION potok_nutrition.guard_generation_producer_revocation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
DECLARE account uuid;
BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' THEN RAISE EXCEPTION 'OWNER_PRODUCER_ADMISSION_NOT_BOUND' USING ERRCODE='42501'; END IF;
 SELECT account_id INTO STRICT account FROM potok_nutrition.generation_preparation_sources_v1 WHERE source_ref=NEW.source_ref;
 PERFORM potok_nutrition.acquire_shared_account_gate_v1(account);
 IF NEW.revoked_at>statement_timestamp() THEN RAISE EXCEPTION 'FUTURE_SOURCE_REVOCATION_NOT_ALLOWED' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END
$fn$;
CREATE TRIGGER preparation_source_insert BEFORE INSERT ON potok_nutrition.generation_preparation_sources_v1 FOR EACH ROW EXECUTE FUNCTION potok_nutrition.guard_generation_producer_source_v1();
CREATE TRIGGER preparation_source_immutable BEFORE UPDATE OR DELETE ON potok_nutrition.generation_preparation_sources_v1 FOR EACH ROW EXECUTE FUNCTION potok_nutrition.validation_store_immutable_v1();
CREATE TRIGGER preparation_source_no_truncate BEFORE TRUNCATE ON potok_nutrition.generation_preparation_sources_v1 FOR EACH STATEMENT EXECUTE FUNCTION potok_nutrition.validation_store_immutable_v1();
CREATE TRIGGER preparation_revocation_insert BEFORE INSERT ON potok_nutrition.generation_preparation_source_revocations_v1 FOR EACH ROW EXECUTE FUNCTION potok_nutrition.guard_generation_producer_revocation_v1();
CREATE TRIGGER preparation_revocation_immutable BEFORE UPDATE OR DELETE ON potok_nutrition.generation_preparation_source_revocations_v1 FOR EACH ROW EXECUTE FUNCTION potok_nutrition.validation_store_immutable_v1();
CREATE TRIGGER preparation_revocation_no_truncate BEFORE TRUNCATE ON potok_nutrition.generation_preparation_source_revocations_v1 FOR EACH STATEMENT EXECUTE FUNCTION potok_nutrition.validation_store_immutable_v1();

CREATE FUNCTION potok_nutrition.read_admitted_generation_producer_source_v1(request_id uuid,kind text,input_sha bytea,meal_slot uuid,meal_sha bytea,evidence_sha bytea,policies_sha bytea)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE context jsonb; result text;
BEGIN
 IF session_user<>'potok_generation_reader_v1' OR current_user<>'postgres' THEN RAISE EXCEPTION 'GENERATION_READER_IDENTITY_REQUIRED' USING ERRCODE='42501'; END IF;
 IF request_id IS NULL OR kind NOT IN('METADATA','MEAL_WARNING') OR kind IS NULL
  OR NOT ((kind='METADATA' AND input_sha IS NOT NULL AND octet_length(input_sha)=32 AND meal_slot IS NULL AND meal_sha IS NULL AND evidence_sha IS NULL AND policies_sha IS NULL)
   OR(kind='MEAL_WARNING' AND input_sha IS NULL AND meal_slot IS NOT NULL AND meal_sha IS NOT NULL AND octet_length(meal_sha)=32
    AND evidence_sha IS NOT NULL AND octet_length(evidence_sha)=32 AND policies_sha IS NOT NULL AND octet_length(policies_sha)=32)) THEN
  RAISE EXCEPTION 'INVALID_GENERATION_PRODUCER_LOOKUP' USING ERRCODE='22023';
 END IF;
 context:=potok_nutrition.generation_producer_context_v1(request_id);
 SELECT jsonb_build_object('contract','potok-generation-producer-source-v1','requestOperationId',s.request_operation_id,'sourceKind',s.source_kind,
   'generationInputDigest',encode(s.generation_input_digest,'hex'),'validationEvidenceDigest',encode(s.validation_evidence_digest,'hex'),
   'validationPoliciesDigest',encode(s.validation_policies_digest,'hex'),'slotId',s.slot_id,'mealSnapshotDigest',encode(s.meal_snapshot_digest,'hex'),
   'payloadRaw',s.payload_raw,'storageSha256',encode(s.payload_storage_sha256,'hex'),'sourceRef',s.source_ref)::text
 INTO result FROM potok_nutrition.generation_preparation_sources_v1 s
 WHERE s.request_operation_id=request_id AND s.source_kind=kind AND s.account_id::text=context->>'accountId'
   AND encode(s.generation_input_digest,'hex')=context->>'generationInputDigest'
   AND encode(s.validation_evidence_digest,'hex')=context->>'validationEvidenceDigest' AND encode(s.validation_policies_digest,'hex')=context->>'validationPoliciesDigest'
   AND ((kind='METADATA' AND s.generation_input_digest=input_sha AND s.slot_id IS NULL AND s.meal_snapshot_digest IS NULL)
     OR(kind='MEAL_WARNING' AND s.slot_id=meal_slot AND s.meal_snapshot_digest=meal_sha AND s.validation_evidence_digest=evidence_sha AND s.validation_policies_digest=policies_sha))
   AND NOT EXISTS(SELECT FROM potok_nutrition.generation_preparation_source_revocations_v1 x WHERE x.source_ref=s.source_ref);
 RETURN result;
END
$fn$;
REVOKE ALL ON FUNCTION potok_nutrition.generation_producer_context_v1(uuid),potok_nutrition.guard_generation_producer_source_v1(),
 potok_nutrition.guard_generation_producer_revocation_v1(),potok_nutrition.read_admitted_generation_producer_source_v1(uuid,text,bytea,uuid,bytea,bytea,bytea)
 FROM PUBLIC,anon,authenticated,service_role,potok_generation_reader_v1;
GRANT EXECUTE ON FUNCTION potok_nutrition.read_admitted_generation_producer_source_v1(uuid,text,bytea,uuid,bytea,bytea,bytea) TO potok_generation_reader_v1;
DO $postcheck$
BEGIN
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='potok_nutrition' AND has_function_privilege('potok_generation_reader_v1',p.oid,'EXECUTE'))<>3
  OR EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='potok_nutrition' AND has_function_privilege('potok_generation_reader_v1',p.oid,'EXECUTE')
   AND p.oid NOT IN('potok_nutrition.read_admitted_generation_preparation_source_v1(uuid)'::regprocedure,'potok_nutrition.read_admitted_generation_validation_source_v1(uuid,bytea)'::regprocedure,
     'potok_nutrition.read_admitted_generation_producer_source_v1(uuid,text,bytea,uuid,bytea,bytea,bytea)'::regprocedure))
  OR EXISTS(SELECT FROM (VALUES('anon'),('authenticated'),('service_role'),('potok_generation_reader_v1')) r(name)
   CROSS JOIN (VALUES('potok_nutrition.generation_preparation_sources_v1'),('potok_nutrition.generation_preparation_source_revocations_v1')) t(name)
   WHERE has_table_privilege(r.name,t.name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
  OR (SELECT count(*) FROM pg_class WHERE oid IN('potok_nutrition.generation_preparation_sources_v1'::regclass,'potok_nutrition.generation_preparation_source_revocations_v1'::regclass) AND relrowsecurity AND relforcerowsecurity)<>2 THEN
  RAISE EXCEPTION 'GENERATION_PRODUCER_PRIVILEGE_POSTCHECK_FAILED';
 END IF;
END
$postcheck$;
COMMENT ON TABLE potok_nutrition.generation_preparation_sources_v1 IS 'Owner-admitted immutable storage of producer metadata and independently supplied per-meal warning inputs. Not proof of food review, a warning evaluator, automatic publisher or final proposal acceptance. No application/runtime writer is granted.';
COMMIT;
