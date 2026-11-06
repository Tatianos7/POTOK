-- DISPOSABLE DATABASE CANDIDATE ONLY. No live migration, source/metric issuer or plan activation.
DO $guard$
DECLARE f record;
BEGIN
 IF current_database()<>'potok_generation_store_disposable' OR current_setting('potok.disposable_generation_store',true) IS DISTINCT FROM 'on'
  OR current_user<>'postgres' OR session_user<>'postgres' OR current_setting('server_encoding')<>'UTF8' THEN RAISE EXCEPTION 'DISPOSABLE_EXACT_PLAN_REQUIRED'; END IF;
 FOR f IN SELECT * FROM (VALUES
  ('potok_nutrition.assert_generation_request_current_v2(uuid)','d47092345fb1a684eae62bd457ce8a98',false,'v'),
  ('potok_nutrition.require_canonical_json_v2(bytea)','4453774aeecef9584fb2f0312e30ef83',false,'s'),
  ('potok_nutrition.canonical_jsonb_text_v1(jsonb)','971923fd16799732f89f0f23782f984c',false,'i'),
  ('potok_nutrition.acquire_shared_account_gate_v1(uuid)','0a7fc0c24f7bc22f6792781636ac2387',false,'v'),
  ('potok_control.is_effective_entitlement_v2(uuid,text,timestamptz)','afd14b981eeade127134246a7d69671d',true,'s')
 ) AS x(signature,body_md5,is_definer,volatility) LOOP
  IF NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure(f.signature) AND md5(p.prosrc)=f.body_md5 AND pg_get_userbyid(p.proowner)='postgres'
   AND p.proconfig=ARRAY['search_path=pg_catalog'] AND p.prosecdef=f.is_definer AND p.provolatile::text=f.volatility) THEN RAISE EXCEPTION 'EXACT_PLAN_PREREQUISITE_DRIFT'; END IF;
 END LOOP;
END
$guard$;

-- Retained unadmitted artifact only; existing request/selection remains the sole workflow identity/state.
CREATE TABLE potok_nutrition.exact_retained_plan_proposals_v3 (
 request_operation_id uuid PRIMARY KEY REFERENCES potok_nutrition.adaptive_nutrition_generation_requests_v2(request_operation_id) ON DELETE RESTRICT,
 account_id uuid NOT NULL,generation_input_digest bytea NOT NULL CHECK(octet_length(generation_input_digest)=32),canonical_raw text NOT NULL CHECK(octet_length(canonical_raw)<=4194304),
 storage_sha256 bytea GENERATED ALWAYS AS (extensions.digest(canonical_raw,'sha256')) STORED,
 retained_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
ALTER TABLE potok_nutrition.exact_retained_plan_proposals_v3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.exact_retained_plan_proposals_v3 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON potok_nutrition.exact_retained_plan_proposals_v3 FROM PUBLIC,anon,authenticated,service_role,potok_generation_gateway_v1;

CREATE FUNCTION potok_nutrition.exact_plan_immutable_v3() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
BEGIN RAISE EXCEPTION 'EXACT_RETAINED_HISTORY_IMMUTABLE' USING ERRCODE='42501'; END
$fn$;
CREATE TRIGGER exact_retained_immutable BEFORE UPDATE OR DELETE ON potok_nutrition.exact_retained_plan_proposals_v3 FOR EACH ROW EXECUTE FUNCTION potok_nutrition.exact_plan_immutable_v3();
CREATE TRIGGER exact_retained_no_truncate BEFORE TRUNCATE ON potok_nutrition.exact_retained_plan_proposals_v3 FOR EACH STATEMENT EXECUTE FUNCTION potok_nutrition.exact_plan_immutable_v3();

CREATE FUNCTION potok_nutrition.assert_exact_plan_channel_v3() RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
BEGIN
 IF current_user<>'postgres' OR session_user<>'potok_generation_gateway_v1'
  OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname=session_user AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication)
  OR EXISTS(SELECT FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=session_user)) THEN RAISE EXCEPTION 'EXACT_PLAN_CHANNEL_REQUIRED' USING ERRCODE='42501'; END IF;
END
$fn$;

CREATE FUNCTION potok_nutrition.load_locked_exact_plan_admission_v3(operation uuid,proposal_sha bytea) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE r potok_nutrition.adaptive_nutrition_generation_requests_v2%ROWTYPE;j jsonb;authority jsonb;
BEGIN
 PERFORM potok_nutrition.assert_exact_plan_channel_v3();
 IF operation IS NULL OR (proposal_sha IS NOT NULL AND octet_length(proposal_sha)<>32) THEN RAISE EXCEPTION 'EXACT_ADMISSION_LOOKUP_INVALID'; END IF;
 PERFORM potok_nutrition.assert_generation_request_current_v2(operation);
 SELECT * INTO STRICT r FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 WHERE request_operation_id=operation FOR UPDATE;
 j:=potok_nutrition.require_canonical_json_v2(r.generation_input_canonical);
 IF r.status NOT IN('REQUESTED','GENERATING') OR (j->>'accountId')::uuid IS DISTINCT FROM r.account_id OR (j#>>'{operation,requestId}')::uuid IS DISTINCT FROM operation
  OR r.generation_input_digest IS DISTINCT FROM extensions.digest(convert_to(potok_nutrition.canonical_jsonb_text_v1(jsonb_build_object('contract','potok-adaptive-trusted-generation-input-v1','input',j)),'UTF8'),'sha256')
 THEN RAISE EXCEPTION 'EXACT_ADMISSION_REQUEST_STALE' USING ERRCODE='40001'; END IF;
 authority:=jsonb_build_object('accountGateContract',j->'accountGateContract','accountId',r.account_id,'selectionId',j#>'{selection,selectionId}',
  'weekStartLocal',j->'weekStartLocal','timezone',j->'timezone','entitlement','verified','planSelectionRevision',j#>'{selection,planSelectionRevision}',
  'expectedStatus','pending_generation','expectedPlanRevision',NULL,'goalRevision',j#>'{goalNutritionTarget,goalRevision}',
  'targetPolicyRevision',j#>'{goalNutritionTarget,targetPolicyRevision}','preferenceRevision',j->'preferenceRevision','safetyRevision',j->'safetyRevision',
  'entitlementEvidenceRevision',j->'entitlementEvidenceRevision','candidateManifestRevision',j->'candidateManifestRevision','candidateManifestDigest',j->'candidateManifestDigest',
  'compositionPolicyRevision',j->'compositionPolicyRevision','validationPolicyRevision',j->'validationPolicyRevision','optimizationPolicyRevision',j->'optimizationPolicyRevision','generationPolicyRevision',j->'generationPolicyRevision');
 RETURN potok_nutrition.canonical_jsonb_text_v1(jsonb_build_object('contract','potok-exact-plan-locked-admission-source-v3','requestOperationId',operation,
  'actorAccountId',r.account_id,'accountId',r.account_id,'generationInputDigest',encode(r.generation_input_digest,'hex'),
  'evaluatedProposalRawSha256',CASE WHEN proposal_sha IS NULL THEN NULL ELSE encode(proposal_sha,'hex') END,
  'trustedGenerationInputRaw',convert_from(r.generation_input_canonical,'UTF8'),'currentAuthority',authority));
END
$fn$;

CREATE FUNCTION potok_nutrition.read_exact_retained_plan_v3(operation uuid) RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE answer text;
BEGIN
 PERFORM potok_nutrition.load_locked_exact_plan_admission_v3(operation,NULL);
 SELECT canonical_raw INTO answer FROM potok_nutrition.exact_retained_plan_proposals_v3 WHERE request_operation_id=operation;
 RETURN answer;
END
$fn$;

CREATE FUNCTION potok_nutrition.retain_exact_plan_v3(operation uuid,account uuid,input_digest bytea,body text) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE j jsonb;p jsonb;g jsonb;o jsonb;input jsonb;admission text;proposal_raw text;proposal_sha bytea;existing text;
BEGIN
 PERFORM potok_nutrition.assert_exact_plan_channel_v3();
 IF body IS NULL OR octet_length(body)>4194304 OR operation IS NULL OR account IS NULL OR octet_length(input_digest) IS DISTINCT FROM 32 THEN RAISE EXCEPTION 'EXACT_RECORD_ARGUMENTS_INVALID'; END IF;
 j:=potok_nutrition.require_canonical_json_v2(convert_to(body,'UTF8'));
 IF (SELECT count(*) FROM jsonb_object_keys(j))<>14 OR j->>'contract' IS DISTINCT FROM 'potok-exact-retained-plan-proposal-v3'
  OR j->>'purpose' IS DISTINCT FROM 'RETAINED_PROPOSAL_NOT_ACTIVE_PLAN' OR j->>'requestOperationId' IS DISTINCT FROM operation::text
  OR j->>'accountId' IS DISTINCT FROM account::text OR j->>'generationInputDigest' IS DISTINCT FROM encode(input_digest,'hex') OR j->'facts' IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION 'EXACT_RECORD_BINDING_INVALID'; END IF;
 proposal_raw:=j->>'proposalCanonicalRaw';IF proposal_raw IS NULL THEN RAISE EXCEPTION 'EXACT_PROPOSAL_MISSING'; END IF;
 p:=potok_nutrition.require_canonical_json_v2(convert_to(proposal_raw,'UTF8'));g:=p->'graph';
 o:=potok_nutrition.require_canonical_json_v2(convert_to(p->>'optimizationReceiptRaw','UTF8'));
 proposal_sha:=extensions.digest(convert_to(proposal_raw,'UTF8'),'sha256');
 admission:=potok_nutrition.load_locked_exact_plan_admission_v3(operation,proposal_sha);
 SELECT potok_nutrition.require_canonical_json_v2(generation_input_canonical) INTO STRICT input FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 WHERE request_operation_id=operation AND account_id=account AND generation_input_digest=input_digest;
 IF j->>'proposedPlanRevision' IS DISTINCT FROM input#>>'{selection,proposedPlanRevision}' OR g->'input' IS DISTINCT FROM input
  OR p->>'contract' IS DISTINCT FROM 'potok-exact-generated-week-proposal-v3' OR p->>'requestOperationId' IS DISTINCT FROM operation::text
  OR p->>'generationInputDigest' IS DISTINCT FROM encode(input_digest,'hex') OR p->>'authority' IS DISTINCT FROM 'NONE'
  OR p->'accepted' IS DISTINCT FROM 'false'::jsonb OR p->'canRecord' IS DISTINCT FROM 'false'::jsonb OR p->'canActivate' IS DISTINCT FROM 'false'::jsonb OR p->'facts' IS DISTINCT FROM '[]'::jsonb
  OR g->>'contract' IS DISTINCT FROM 'adaptive_nutrition_graph_v3' OR g->>'authority' IS DISTINCT FROM 'NONE' OR g->'accepted' IS DISTINCT FROM 'false'::jsonb OR g->'canRecord' IS DISTINCT FROM 'false'::jsonb OR g->'canActivate' IS DISTINCT FROM 'false'::jsonb OR g->'facts' IS DISTINCT FROM '[]'::jsonb
  OR o->>'contract' IS DISTINCT FROM 'potok-exact-week-optimization-receipt-v3'
  OR j->>'proposalRawSha256' IS DISTINCT FROM encode(proposal_sha,'hex') OR j->>'proposalDigest' IS DISTINCT FROM p->>'digest' OR j->>'graphDigest' IS DISTINCT FROM g->>'digest'
  OR j->>'optimizationResultDigest' IS DISTINCT FROM o->>'digest' OR p->>'optimizationResultDigest' IS DISTINCT FROM o->>'digest'
  OR j->>'admissionSourceRawSha256' IS DISTINCT FROM encode(extensions.digest(convert_to(admission,'UTF8'),'sha256'),'hex')
 THEN RAISE EXCEPTION 'EXACT_RECORD_CONTENT_INVALID'; END IF;
 IF j->>'digest' IS DISTINCT FROM encode(extensions.digest(convert_to(potok_nutrition.canonical_jsonb_text_v1(jsonb_build_object('domain','potok-exact-retained-plan-proposal-sha256-v3','payload',j-'digest')),'UTF8'),'sha256'),'hex')
  OR p->>'digest' IS DISTINCT FROM encode(extensions.digest(convert_to(potok_nutrition.canonical_jsonb_text_v1(jsonb_build_object('domain','potok-exact-generated-week-proposal-sha256-v3','payload',p-'digest')),'UTF8'),'sha256'),'hex')
  OR g->>'digest' IS DISTINCT FROM encode(extensions.digest(convert_to(potok_nutrition.canonical_jsonb_text_v1(jsonb_build_object('domain','potok-exact-week-graph-sha256-v3','payload',g-'digest')),'UTF8'),'sha256'),'hex')
  OR o->>'digest' IS DISTINCT FROM encode(extensions.digest(convert_to(potok_nutrition.canonical_jsonb_text_v1(jsonb_build_object('domain','potok-exact-week-optimization-receipt-sha256-v3','payload',o-'digest')),'UTF8'),'sha256'),'hex')
 THEN RAISE EXCEPTION 'EXACT_RECORD_DIGEST_INVALID'; END IF;
 INSERT INTO potok_nutrition.exact_retained_plan_proposals_v3(request_operation_id,account_id,generation_input_digest,canonical_raw) VALUES(operation,account,input_digest,body) ON CONFLICT(request_operation_id) DO NOTHING;
 SELECT canonical_raw INTO STRICT existing FROM potok_nutrition.exact_retained_plan_proposals_v3 WHERE request_operation_id=operation;
 IF existing IS DISTINCT FROM body THEN RAISE EXCEPTION 'EXACT_RETAINED_IDEMPOTENCY_CONFLICT' USING ERRCODE='40001'; END IF;
 RETURN existing;
END
$fn$;

REVOKE ALL ON FUNCTION potok_nutrition.exact_plan_immutable_v3(),potok_nutrition.assert_exact_plan_channel_v3(),potok_nutrition.load_locked_exact_plan_admission_v3(uuid,bytea),potok_nutrition.read_exact_retained_plan_v3(uuid),potok_nutrition.retain_exact_plan_v3(uuid,uuid,bytea,text) FROM PUBLIC,anon,authenticated,service_role,potok_generation_gateway_v1;
GRANT USAGE ON SCHEMA potok_nutrition TO potok_generation_gateway_v1;
GRANT EXECUTE ON FUNCTION potok_nutrition.load_locked_exact_plan_admission_v3(uuid,bytea),potok_nutrition.read_exact_retained_plan_v3(uuid),potok_nutrition.retain_exact_plan_v3(uuid,uuid,bytea,text) TO potok_generation_gateway_v1;
