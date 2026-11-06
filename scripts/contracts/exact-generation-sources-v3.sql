-- DISPOSABLE CANDIDATE ONLY. Retaining packets is not source/recipe/policy review approval.
DO $guard$
DECLARE f record;
BEGIN
 IF current_database()<>'potok_generation_store_disposable' OR current_setting('potok.disposable_generation_store',true) IS DISTINCT FROM 'on'
  OR current_user<>'postgres' OR session_user<>'postgres' OR current_setting('server_encoding')<>'UTF8' THEN RAISE EXCEPTION 'DISPOSABLE_EXACT_SOURCE_REQUIRED'; END IF;
 FOR f IN SELECT * FROM (VALUES
  ('potok_nutrition.load_locked_exact_plan_admission_v3(uuid,bytea)','b6da31d3b8236594096728bff3ce4f7e',true),
  ('potok_nutrition.assert_exact_plan_channel_v3()','cf70cd68994f3e6cca27de4406144f11',false),
  ('potok_nutrition.exact_plan_immutable_v3()','c141fb77c735c91d9b23b1e6ff75f6be',false)
 ) AS x(signature,body_md5,is_definer) LOOP
  IF NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure(f.signature) AND md5(p.prosrc)=f.body_md5 AND pg_get_userbyid(p.proowner)='postgres'
   AND p.proconfig=ARRAY['search_path=pg_catalog'] AND p.prosecdef=f.is_definer AND p.provolatile='v') THEN RAISE EXCEPTION 'EXACT_SOURCE_PREREQUISITE_DRIFT'; END IF;
 END LOOP;
END
$guard$;
CREATE TABLE potok_nutrition.exact_generation_sources_v3 (
 source_ref text PRIMARY KEY CHECK(length(source_ref) BETWEEN 1 AND 256),
 request_operation_id uuid NOT NULL REFERENCES potok_nutrition.adaptive_nutrition_generation_requests_v2 ON DELETE RESTRICT,
 account_id uuid NOT NULL,generation_input_digest bytea NOT NULL CHECK(octet_length(generation_input_digest)=32),
 source_kind text NOT NULL CHECK(source_kind IN('POOL','GRAPH','METRIC_POLICY','CONVENIENCE','TITLES')),
 subject_sha256 bytea, payload_raw text NOT NULL CHECK(octet_length(payload_raw) BETWEEN 2 AND 4194304),
 storage_sha256 bytea GENERATED ALWAYS AS(extensions.digest(payload_raw,'sha256')) STORED,
 retained_by name NOT NULL DEFAULT session_user CHECK(retained_by='postgres'),retained_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 UNIQUE NULLS NOT DISTINCT(request_operation_id,source_kind,subject_sha256),
 CHECK((source_kind IN('POOL','METRIC_POLICY') AND subject_sha256 IS NULL)
  OR(source_kind IN('GRAPH','CONVENIENCE','TITLES') AND subject_sha256 IS NOT NULL AND octet_length(subject_sha256)=32))
);
CREATE TABLE potok_nutrition.exact_generation_source_revocations_v3 (
 source_ref text PRIMARY KEY REFERENCES potok_nutrition.exact_generation_sources_v3 ON DELETE RESTRICT,
 reason_ref text NOT NULL CHECK(length(btrim(reason_ref)) BETWEEN 1 AND 256),
 revoked_by name NOT NULL DEFAULT session_user CHECK(revoked_by='postgres'),revoked_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
ALTER TABLE potok_nutrition.exact_generation_sources_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.exact_generation_sources_v3 FORCE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.exact_generation_source_revocations_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.exact_generation_source_revocations_v3 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON potok_nutrition.exact_generation_sources_v3,potok_nutrition.exact_generation_source_revocations_v3 FROM PUBLIC,anon,authenticated,service_role,potok_generation_gateway_v1;

CREATE FUNCTION potok_nutrition.guard_exact_generation_source_v3() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
DECLARE r potok_nutrition.adaptive_nutrition_generation_requests_v2%ROWTYPE;p jsonb;i jsonb;expected_contract text;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'EXACT_SOURCE_OWNER_CHANNEL_REQUIRED' USING ERRCODE='42501'; END IF;
 -- Same request -> account -> heads lock order as existing admission. No new authority ledger.
 PERFORM potok_nutrition.assert_generation_request_current_v2(NEW.request_operation_id);
 SELECT * INTO STRICT r FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 WHERE request_operation_id=NEW.request_operation_id;
 i:=potok_nutrition.require_canonical_json_v2(r.generation_input_canonical);
 p:=potok_nutrition.require_canonical_json_v2(convert_to(NEW.payload_raw,'UTF8'));
 IF NEW.account_id IS DISTINCT FROM r.account_id OR NEW.generation_input_digest IS DISTINCT FROM r.generation_input_digest OR NEW.retained_at>statement_timestamp()
  OR jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'EXACT_SOURCE_BINDING_INVALID'; END IF;
 expected_contract:=CASE NEW.source_kind WHEN 'POOL' THEN 'potok-exact-week-optimization-pool-v3' WHEN 'GRAPH' THEN 'potok-exact-week-graph-source-v3'
  WHEN 'METRIC_POLICY' THEN 'potok-exact-week-metric-policy-v3' WHEN 'CONVENIENCE' THEN 'potok-exact-week-convenience-v3' WHEN 'TITLES' THEN 'potok-exact-plan-preview-titles-v3' END;
 IF expected_contract IS NULL OR p->>'contract' IS DISTINCT FROM expected_contract THEN RAISE EXCEPTION 'EXACT_SOURCE_CONTRACT_INVALID'; END IF;
 IF NEW.source_kind='METRIC_POLICY' THEN
  IF p->>'optimizationPolicyRevision' IS DISTINCT FROM i->>'optimizationPolicyRevision' THEN RAISE EXCEPTION 'EXACT_SOURCE_POLICY_STALE'; END IF;
 ELSE
  IF p->>'requestOperationId' IS DISTINCT FROM NEW.request_operation_id::text THEN RAISE EXCEPTION 'EXACT_SOURCE_OPERATION_INVALID'; END IF;
 END IF;
 IF NEW.source_kind='POOL' AND potok_nutrition.require_canonical_json_v2(convert_to(p->>'trustedGenerationInputRaw','UTF8')) IS DISTINCT FROM i
  THEN RAISE EXCEPTION 'EXACT_SOURCE_POOL_INPUT_INVALID'; END IF;
 IF NEW.source_kind='GRAPH' AND p->>'evaluatedSnapshotRawSha256' IS DISTINCT FROM encode(NEW.subject_sha256,'hex')
  OR NEW.source_kind='CONVENIENCE' AND (p->>'graphRawSha256' IS DISTINCT FROM encode(NEW.subject_sha256,'hex') OR p->>'generationInputDigest' IS DISTINCT FROM encode(r.generation_input_digest,'hex'))
  OR NEW.source_kind='TITLES' AND (p->>'graphDigest' IS DISTINCT FROM encode(NEW.subject_sha256,'hex') OR p->>'accountId' IS DISTINCT FROM r.account_id::text)
  THEN RAISE EXCEPTION 'EXACT_SOURCE_SUBJECT_INVALID'; END IF;
 RETURN NEW;
END
$fn$;
CREATE FUNCTION potok_nutrition.guard_exact_generation_revocation_v3() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
DECLARE operation uuid;account uuid;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'EXACT_SOURCE_OWNER_CHANNEL_REQUIRED' USING ERRCODE='42501'; END IF;
 SELECT request_operation_id INTO STRICT operation FROM potok_nutrition.exact_generation_sources_v3 WHERE source_ref=NEW.source_ref;
 -- Revocation must remain possible after Premium/heads become stale. Fence the same request first.
 SELECT account_id INTO STRICT account FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 WHERE request_operation_id=operation FOR UPDATE;
 PERFORM potok_nutrition.acquire_shared_account_gate_v1(account);
 IF NEW.revoked_at>statement_timestamp() THEN RAISE EXCEPTION 'EXACT_SOURCE_FUTURE_REVOCATION'; END IF;
 RETURN NEW;
END
$fn$;
CREATE TRIGGER exact_source_insert BEFORE INSERT ON potok_nutrition.exact_generation_sources_v3 FOR EACH ROW EXECUTE FUNCTION potok_nutrition.guard_exact_generation_source_v3();
CREATE TRIGGER exact_source_immutable BEFORE UPDATE OR DELETE ON potok_nutrition.exact_generation_sources_v3 FOR EACH ROW EXECUTE FUNCTION potok_nutrition.exact_plan_immutable_v3();
CREATE TRIGGER exact_source_no_truncate BEFORE TRUNCATE ON potok_nutrition.exact_generation_sources_v3 FOR EACH STATEMENT EXECUTE FUNCTION potok_nutrition.exact_plan_immutable_v3();
CREATE TRIGGER exact_source_revoke BEFORE INSERT ON potok_nutrition.exact_generation_source_revocations_v3 FOR EACH ROW EXECUTE FUNCTION potok_nutrition.guard_exact_generation_revocation_v3();
CREATE TRIGGER exact_source_revocation_immutable BEFORE UPDATE OR DELETE ON potok_nutrition.exact_generation_source_revocations_v3 FOR EACH ROW EXECUTE FUNCTION potok_nutrition.exact_plan_immutable_v3();
CREATE TRIGGER exact_source_revocation_no_truncate BEFORE TRUNCATE ON potok_nutrition.exact_generation_source_revocations_v3 FOR EACH STATEMENT EXECUTE FUNCTION potok_nutrition.exact_plan_immutable_v3();

CREATE FUNCTION potok_nutrition.read_exact_generation_source_v3(operation uuid,kind text,subject bytea) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE admission jsonb;s potok_nutrition.exact_generation_sources_v3%ROWTYPE;
BEGIN
 PERFORM potok_nutrition.assert_exact_plan_channel_v3();
 IF operation IS NULL OR kind IS NULL OR kind NOT IN('POOL','GRAPH','METRIC_POLICY','CONVENIENCE','TITLES')
  OR kind IN('POOL','METRIC_POLICY') AND subject IS NOT NULL
  OR kind IN('GRAPH','CONVENIENCE','TITLES') AND (subject IS NULL OR octet_length(subject)<>32) THEN RAISE EXCEPTION 'EXACT_SOURCE_LOOKUP_INVALID'; END IF;
 admission:=potok_nutrition.load_locked_exact_plan_admission_v3(operation,NULL)::jsonb;
 SELECT * INTO s FROM potok_nutrition.exact_generation_sources_v3 WHERE request_operation_id=operation AND source_kind=kind AND subject_sha256 IS NOT DISTINCT FROM subject FOR SHARE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF s.account_id::text IS DISTINCT FROM admission->>'accountId' OR encode(s.generation_input_digest,'hex') IS DISTINCT FROM admission->>'generationInputDigest'
  THEN RAISE EXCEPTION 'EXACT_SOURCE_CURRENT_BINDING_INVALID'; END IF;
 IF EXISTS(SELECT FROM potok_nutrition.exact_generation_source_revocations_v3 WHERE source_ref=s.source_ref) THEN RETURN NULL; END IF;
 RETURN potok_nutrition.canonical_jsonb_text_v1(jsonb_build_object('contract','potok-exact-generation-source-envelope-v3','purpose','RETAINED_SOURCE_NOT_REVIEW_APPROVAL',
  'requestOperationId',operation,'accountId',s.account_id,'generationInputDigest',encode(s.generation_input_digest,'hex'),'sourceKind',kind,
  'subjectSha256',CASE WHEN subject IS NULL THEN NULL ELSE encode(subject,'hex') END,'payloadRaw',s.payload_raw,'storageSha256',encode(s.storage_sha256,'hex'),'sourceRef',s.source_ref));
END
$fn$;
REVOKE ALL ON FUNCTION potok_nutrition.guard_exact_generation_source_v3(),potok_nutrition.guard_exact_generation_revocation_v3(),potok_nutrition.read_exact_generation_source_v3(uuid,text,bytea) FROM PUBLIC,anon,authenticated,service_role,potok_generation_gateway_v1;
GRANT EXECUTE ON FUNCTION potok_nutrition.read_exact_generation_source_v3(uuid,text,bytea) TO potok_generation_gateway_v1;
