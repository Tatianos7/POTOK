-- DISPOSABLE STORAGE CANDIDATE ONLY. Not a live migration or evidence issuer.
-- The fixed DB/session admission must remain intact. No runtime/app-role access.
DO $guard$
BEGIN
  IF current_database() <> 'potok_generation_store_disposable'
     OR current_setting('potok.disposable_generation_store', true) IS DISTINCT FROM 'on'
     OR current_setting('server_encoding') <> 'UTF8'
     OR session_user <> 'postgres' OR current_user <> 'postgres' THEN
    RAISE EXCEPTION 'DISPOSABLE_GENERATION_STORE_REQUIRED' USING ERRCODE='42501';
  END IF;
END
$guard$;

CREATE FUNCTION potok_nutrition.validation_store_json_has_duplicates_v1(value json)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE STRICT SET search_path=pg_catalog AS $fn$
DECLARE child json;
BEGIN
  IF json_typeof(value)='object' THEN
    IF EXISTS(SELECT 1 FROM json_each(value) GROUP BY key HAVING count(*)>1) THEN RETURN true; END IF;
    FOR child IN SELECT v.value FROM json_each(value) v LOOP
      IF potok_nutrition.validation_store_json_has_duplicates_v1(child) THEN RETURN true; END IF;
    END LOOP;
  ELSIF json_typeof(value)='array' THEN
    FOR child IN SELECT v.value FROM json_array_elements(value) v LOOP
      IF potok_nutrition.validation_store_json_has_duplicates_v1(child) THEN RETURN true; END IF;
    END LOOP;
  END IF;
  RETURN false;
END
$fn$;

CREATE TABLE potok_nutrition.generation_validation_inputs_v1 (
  request_operation_id uuid PRIMARY KEY
    REFERENCES potok_nutrition.adaptive_nutrition_generation_requests_v2(request_operation_id) ON DELETE RESTRICT,
  account_id uuid NOT NULL,
  generation_input_digest bytea NOT NULL CHECK(octet_length(generation_input_digest)=32),
  validation_evidence_raw text NOT NULL,
  policies_raw text NOT NULL,
  evidence_storage_sha256 bytea GENERATED ALWAYS AS (extensions.digest(validation_evidence_raw,'sha256')) STORED,
  policies_storage_sha256 bytea GENERATED ALWAYS AS (extensions.digest(policies_raw,'sha256')) STORED,
  source_receipt_ref text NOT NULL CHECK(length(btrim(source_receipt_ref))>0),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CHECK(json_typeof(validation_evidence_raw::json)='object' AND NOT potok_nutrition.validation_store_json_has_duplicates_v1(validation_evidence_raw::json)),
  CHECK(json_typeof(policies_raw::json)='object' AND NOT potok_nutrition.validation_store_json_has_duplicates_v1(policies_raw::json)),
  CHECK(COALESCE(validation_evidence_raw::jsonb->>'generationInputDigest'=encode(generation_input_digest,'hex'),false)),
  CHECK(COALESCE(policies_raw::jsonb->>'generationInputDigest'=encode(generation_input_digest,'hex'),false)),
  CHECK(COALESCE(policies_raw::jsonb->>'validationEvidenceDigest'=validation_evidence_raw::jsonb->>'digest',false))
);
CREATE TABLE potok_nutrition.generation_validation_warnings_v1 (
  request_operation_id uuid NOT NULL REFERENCES potok_nutrition.generation_validation_inputs_v1(request_operation_id) ON DELETE RESTRICT,
  proposal_raw_sha256 bytea NOT NULL CHECK(octet_length(proposal_raw_sha256)=32),
  warning_evidence_raw text NOT NULL,
  warning_storage_sha256 bytea GENERATED ALWAYS AS (extensions.digest(warning_evidence_raw,'sha256')) STORED,
  source_receipt_ref text NOT NULL CHECK(length(btrim(source_receipt_ref))>0),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY(request_operation_id,proposal_raw_sha256),
  CHECK(json_typeof(warning_evidence_raw::json)='object' AND NOT potok_nutrition.validation_store_json_has_duplicates_v1(warning_evidence_raw::json))
);
ALTER TABLE potok_nutrition.generation_validation_inputs_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.generation_validation_inputs_v1 FORCE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.generation_validation_warnings_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.generation_validation_warnings_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON potok_nutrition.generation_validation_inputs_v1, potok_nutrition.generation_validation_warnings_v1
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION potok_nutrition.validation_store_insert_binding_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
DECLARE request_record record; input_record record;
BEGIN
  IF TG_TABLE_NAME='generation_validation_inputs_v1' THEN
    SELECT account_id,generation_input_digest,status INTO STRICT request_record
      FROM potok_nutrition.adaptive_nutrition_generation_requests_v2
      WHERE request_operation_id=NEW.request_operation_id;
    IF request_record.account_id<>NEW.account_id OR request_record.generation_input_digest<>NEW.generation_input_digest
       OR request_record.status NOT IN ('REQUESTED','GENERATING') THEN
      RAISE EXCEPTION 'VALIDATION_REQUEST_BINDING_MISMATCH' USING ERRCODE='23514';
    END IF;
  ELSE
    SELECT validation_evidence_raw,policies_raw INTO STRICT input_record
      FROM potok_nutrition.generation_validation_inputs_v1 WHERE request_operation_id=NEW.request_operation_id;
    IF NOT COALESCE(NEW.warning_evidence_raw::jsonb->>'validationEvidenceDigest'=input_record.validation_evidence_raw::jsonb->>'digest',false)
       OR NOT COALESCE(NEW.warning_evidence_raw::jsonb->>'validationPoliciesDigest'=input_record.policies_raw::jsonb->>'digest',false) THEN
      RAISE EXCEPTION 'VALIDATION_WARNING_BINDING_MISMATCH' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;
CREATE FUNCTION potok_nutrition.validation_store_immutable_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
BEGIN RAISE EXCEPTION 'VALIDATION_HISTORY_IMMUTABLE' USING ERRCODE='42501'; END
$fn$;
CREATE TRIGGER validation_inputs_bind BEFORE INSERT ON potok_nutrition.generation_validation_inputs_v1
  FOR EACH ROW EXECUTE FUNCTION potok_nutrition.validation_store_insert_binding_v1();
CREATE TRIGGER validation_warnings_bind BEFORE INSERT ON potok_nutrition.generation_validation_warnings_v1
  FOR EACH ROW EXECUTE FUNCTION potok_nutrition.validation_store_insert_binding_v1();
CREATE TRIGGER validation_inputs_immutable BEFORE UPDATE OR DELETE ON potok_nutrition.generation_validation_inputs_v1
  FOR EACH ROW EXECUTE FUNCTION potok_nutrition.validation_store_immutable_v1();
CREATE TRIGGER validation_warnings_immutable BEFORE UPDATE OR DELETE ON potok_nutrition.generation_validation_warnings_v1
  FOR EACH ROW EXECUTE FUNCTION potok_nutrition.validation_store_immutable_v1();
CREATE TRIGGER validation_inputs_no_truncate BEFORE TRUNCATE ON potok_nutrition.generation_validation_inputs_v1
  FOR EACH STATEMENT EXECUTE FUNCTION potok_nutrition.validation_store_immutable_v1();
CREATE TRIGGER validation_warnings_no_truncate BEFORE TRUNCATE ON potok_nutrition.generation_validation_warnings_v1
  FOR EACH STATEMENT EXECUTE FUNCTION potok_nutrition.validation_store_immutable_v1();

-- One STABLE SELECT, no FOR UPDATE, ledger insertion or status change. Owner-only
-- disposable reader, never an application channel or entitlement authorization.
CREATE FUNCTION potok_nutrition.read_generation_validation_source_v1(request_id uuid,proposal_sha bytea)
RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE result text;
BEGIN
  IF session_user<>'postgres' OR current_user<>'postgres' THEN
    RAISE EXCEPTION 'PROTECTED_VALIDATION_READER_NOT_BOUND' USING ERRCODE='42501';
  END IF;
  IF request_id IS NULL OR proposal_sha IS NULL OR octet_length(proposal_sha)<>32 THEN
    RAISE EXCEPTION 'INVALID_VALIDATION_LOOKUP' USING ERRCODE='22023';
  END IF;
  SELECT jsonb_build_object('contract','potok-generation-validation-source-v1',
    'requestOperationId',r.request_operation_id,'accountId',r.account_id,
    'evaluatedPlanRawSha256',encode(w.proposal_raw_sha256,'hex'),
    'input',jsonb_build_object('canonicalHex',encode(r.generation_input_canonical,'hex'),'generationInputDigest',encode(r.generation_input_digest,'hex')),
    'manifest',jsonb_build_object('canonicalHex',encode(m.canonical_bytes,'hex'),'storageSha256',encode(m.canonical_digest,'hex')),
    'preference',jsonb_build_object('canonicalHex',encode(p.canonical_bytes,'hex'),'storageSha256',encode(p.canonical_digest,'hex')),
    'safety',jsonb_build_object('canonicalHex',encode(s.canonical_bytes,'hex'),'storageSha256',encode(s.canonical_digest,'hex')),
    'validationEvidenceRaw',v.validation_evidence_raw,'policiesRaw',v.policies_raw,'warningEvidenceRaw',w.warning_evidence_raw)::text
  INTO result
  FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 r
  CROSS JOIN LATERAL (SELECT convert_from(r.generation_input_canonical,'UTF8')::jsonb AS body) j
  JOIN potok_nutrition.generation_validation_inputs_v1 v ON v.request_operation_id=r.request_operation_id
    AND v.account_id=r.account_id AND v.generation_input_digest=r.generation_input_digest
  JOIN potok_nutrition.generation_validation_warnings_v1 w ON w.request_operation_id=r.request_operation_id AND w.proposal_raw_sha256=proposal_sha
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
  WHERE r.request_operation_id=request_id AND r.status IN ('REQUESTED','GENERATING');
  RETURN result;
END
$fn$;
REVOKE ALL ON FUNCTION potok_nutrition.validation_store_json_has_duplicates_v1(json),
  potok_nutrition.validation_store_insert_binding_v1(),potok_nutrition.validation_store_immutable_v1(),
  potok_nutrition.read_generation_validation_source_v1(uuid,bytea) FROM PUBLIC,anon,authenticated,service_role;
