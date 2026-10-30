-- INACTIVE REVIEW DRAFT. No live apply/rollout is authorized by this file.
-- Admission + owner CLOSING request only. No deletion, CLOSED, backfill or activation.
BEGIN;
DO $preflight$
BEGIN
 IF current_setting('potok_closure.rollout_target',true) IS DISTINCT FROM 'staging:ozidryfvhkcbtpnulakq' THEN
  RAISE EXCEPTION 'EXPLICIT_CLOSURE_STAGING_TARGET_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF to_regnamespace('potok_closure') IS NOT NULL
    OR to_regprocedure('public.account_closure_begin_v1(text)') IS NOT NULL THEN
  RAISE EXCEPTION 'CLOSURE_INFRASTRUCTURE_ALREADY_EXISTS_REVIEW_REQUIRED';
 END IF;
 IF to_regprocedure('potok_food_evidence.authority_v1()') IS NULL
    OR to_regprocedure('public.food_evidence_review_v1(text)') IS NULL
    OR to_regprocedure('public.nonfood_evidence_review_v1(text)') IS NULL THEN
  RAISE EXCEPTION 'REVIEWED_REAL_ISSUERS_REQUIRED';
 END IF;
END $preflight$;

CREATE SCHEMA potok_closure;
REVOKE ALL ON SCHEMA potok_closure FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE potok_closure.accounts_v1 (
 account_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
 state text NOT NULL CHECK(state IN ('ACTIVE','CLOSING')),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 closure_key uuid,
 CHECK((state='ACTIVE' AND closure_key IS NULL) OR (state='CLOSING' AND closure_key IS NOT NULL))
);
ALTER TABLE potok_closure.accounts_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_closure.accounts_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON potok_closure.accounts_v1 FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY closure_sql_owner_v1 ON potok_closure.accounts_v1
 FOR ALL TO CURRENT_USER USING(true) WITH CHECK(true);
-- No client policies, automatic ACTIVE registration, backfill or reset path.
-- SQL owner is an operational trust boundary. Registration requires a separate rollout design.

CREATE FUNCTION potok_closure.owner_v1() RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); claims jsonb:=auth.jwt(); anonymous_user boolean;
 session_not_after timestamptz; now_at timestamptz;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN
  RAISE EXCEPTION 'READ_COMMITTED_TRANSACTION_REQUIRED' USING ERRCODE='25000';
 END IF;
 IF actor IS NULL OR claims->>'role' IS DISTINCT FROM 'authenticated'
    OR claims->>'sub' IS DISTINCT FROM actor::text THEN
  RAISE EXCEPTION 'CLOSURE_AUTH_REQUIRED' USING ERRCODE='42501';
 END IF;
 -- Same shared gate/order as reviewer authority; this is NOT an admin permission check.
 -- Ordinary owners may close themselves without possessing admin entitlement.
 PERFORM pg_advisory_xact_lock(hashtextextended('potok-entitlement-v2:'||actor::text||':admin',0));
 SELECT is_anonymous INTO anonymous_user FROM auth.users WHERE id=actor FOR SHARE;
 IF NOT FOUND OR anonymous_user IS DISTINCT FROM false THEN
  RAISE EXCEPTION 'LIVE_AUTH_SESSION_REQUIRED' USING ERRCODE='42501';
 END IF;
 SELECT not_after INTO session_not_after FROM auth.sessions
  WHERE id=potok_food_evidence.uuid_v1(claims->'session_id') AND user_id=actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'LIVE_AUTH_SESSION_REQUIRED' USING ERRCODE='42501'; END IF;
 now_at:=clock_timestamp();
 IF coalesce(claims->>'exp','') !~ '^[0-9]{1,12}$'
    OR (claims->>'exp')::numeric<=extract(epoch FROM now_at) THEN
  RAISE EXCEPTION 'JWT_EXPIRED' USING ERRCODE='42501';
 END IF;
 IF session_not_after IS NOT NULL AND session_not_after<=now_at THEN
  RAISE EXCEPTION 'LIVE_AUTH_SESSION_REQUIRED' USING ERRCODE='42501';
 END IF;
 RETURN actor;
END $$;

CREATE FUNCTION potok_closure.assert_active_v1() RETURNS bigint
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE actor uuid; v potok_closure.accounts_v1%ROWTYPE;
BEGIN
 actor:=potok_closure.owner_v1();
 PERFORM pg_advisory_xact_lock(hashtextextended('potok-closure-v1:'||actor::text,0));
 SELECT * INTO v FROM potok_closure.accounts_v1 WHERE account_id=actor FOR UPDATE;
 IF NOT FOUND OR v.state<>'ACTIVE' THEN
  RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE' USING ERRCODE='42501';
 END IF;
 RETURN v.revision;
END $$;

CREATE FUNCTION public.account_closure_begin_v1(p_request_text text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid; request jsonb; key uuid; v potok_closure.accounts_v1%ROWTYPE;
BEGIN
 actor:=potok_closure.owner_v1();
 IF p_request_text IS NULL OR octet_length(p_request_text)>1024 THEN
  RAISE EXCEPTION 'CLOSURE_REQUEST_INVALID' USING ERRCODE='22023';
 END IF;
 IF potok_nutrition.json_has_duplicate_keys_v1(p_request_text::json) THEN
  RAISE EXCEPTION 'DUPLICATE_JSON_KEY' USING ERRCODE='22023';
 END IF;
 request:=p_request_text::jsonb;
 PERFORM potok_food_evidence.exact_keys_v1(request,ARRAY['contract','closureKey']);
 IF request->>'contract' IS DISTINCT FROM 'potok-account-closure-request-v1' THEN
  RAISE EXCEPTION 'CLOSURE_REQUEST_INVALID' USING ERRCODE='22023';
 END IF;
 key:=potok_food_evidence.uuid_v1(to_jsonb(lower(request->>'closureKey')));
 PERFORM pg_advisory_xact_lock(hashtextextended('potok-closure-v1:'||actor::text,0));
 SELECT * INTO v FROM potok_closure.accounts_v1 WHERE account_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_UNVERIFIED' USING ERRCODE='42501'; END IF;
 -- Revalidate current token/session time after any account-row wait.
 PERFORM potok_closure.owner_v1();
 IF v.state='ACTIVE' THEN
  UPDATE potok_closure.accounts_v1 SET state='CLOSING',revision=revision+1,closure_key=key
   WHERE account_id=actor RETURNING * INTO v;
 ELSIF v.state<>'CLOSING' OR v.closure_key IS DISTINCT FROM key THEN
  RAISE EXCEPTION 'CLOSURE_CONFLICT' USING ERRCODE='PT409',DETAIL='POTOK_BUSINESS_CONFLICT_V1';
 END IF;
 RETURN jsonb_build_object('contract','potok-account-closure-receipt-v1','accountId',actor,
  'closureKey',request->>'closureKey','state','CLOSING','revision',v.revision::text);
END $$;

CREATE FUNCTION potok_closure.guard_transition_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'CLOSURE_STATE_RETIREMENT_NOT_REVIEWED'; END IF;
 IF OLD.state<>'ACTIVE' OR NEW.state<>'CLOSING' OR NEW.account_id IS DISTINCT FROM OLD.account_id
    OR NEW.revision<>OLD.revision+1 OR NEW.closure_key IS NULL THEN
  RAISE EXCEPTION 'CLOSURE_TRANSITION_INVALID';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER monotonic_state_v1 BEFORE UPDATE OR DELETE ON potok_closure.accounts_v1
 FOR EACH ROW EXECUTE FUNCTION potok_closure.guard_transition_v1();
CREATE TRIGGER no_truncate_v1 BEFORE TRUNCATE ON potok_closure.accounts_v1
 FOR EACH STATEMENT EXECUTE FUNCTION potok_closure.guard_transition_v1();

CREATE FUNCTION potok_closure.commit_owner_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.account_id IS DISTINCT FROM potok_closure.owner_v1() THEN
  RAISE EXCEPTION 'CLOSURE_OWNER_MISMATCH' USING ERRCODE='42501';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER commit_owner_v1 AFTER UPDATE ON potok_closure.accounts_v1
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION potok_closure.commit_owner_v1();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA potok_closure FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.account_closure_begin_v1(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.account_closure_begin_v1(text) TO authenticated;

-- Bind to the exact reviewed original bodies. Never wrap a stale or unknown issuer.
-- This changes the original public RPC bodies, preserving their signatures/owners/ACLs.
DO $bind$
DECLARE item record; p record; body_hash text;
BEGIN
 FOR item IN SELECT * FROM (VALUES
  ('public.food_evidence_review_v1(text)','  attestation:=potok_food_evidence.authority_v1();',
   'f3033bd8d6a3183e61c31f90a175237d716f53e5ab1d95507518e42896019023'),
  ('public.nonfood_evidence_review_v1(text)',' att:=potok_food_evidence.authority_v1();',
   'd7c654d864ef0b5a64fed63173a5756284932bc4b491f8c31ef8ae19b9a22af5')
 ) AS specs(signature,anchor,expected_sha256) LOOP
  SELECT * INTO STRICT p FROM pg_proc WHERE oid=item.signature::regprocedure;
  body_hash:=encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex');
  IF body_hash<>item.expected_sha256 OR NOT p.prosecdef
     OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
     OR pg_get_userbyid(p.proowner)<>current_user THEN
   RAISE EXCEPTION 'REVIEWED_ISSUER_DEFINITION_REQUIRED: %',item.signature;
  END IF;
 END LOOP;
END $bind$;

-- Explicit reviewed definitions; no runtime source-text rewriting.
CREATE OR REPLACE FUNCTION public.food_evidence_review_v1(p_request_text text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
<<food_review_scope>>
DECLARE actor uuid:=auth.uid(); attestation uuid; raw json; request jsonb; canonical_request bytea; request_digest text;
  proposal jsonb; target jsonb; target_kind text; food_id uuid; food jsonb; state text; source jsonb; source_bytes bytea;
  app jsonb; head potok_food_evidence.current_heads_v1%ROWTYPE; previous uuid; event_id uuid; revision_id uuid;
  revision jsonb; canonical jsonb; event jsonb; receipt jsonb; existing potok_food_evidence.review_requests_v1%ROWTYPE;
  key uuid; prop_digest text; prop_domain text; timestamp_text text; proposal_bytes bytea;
BEGIN
  attestation:=potok_food_evidence.authority_v1();
  PERFORM potok_closure.assert_active_v1();
  IF p_request_text IS NULL OR octet_length(p_request_text)>1048576 THEN RAISE EXCEPTION 'REQUEST_TOO_LARGE' USING ERRCODE='22023'; END IF;
  raw:=p_request_text::json;
  IF potok_nutrition.json_has_duplicate_keys_v1(raw) THEN RAISE EXCEPTION 'DUPLICATE_JSON_KEY' USING ERRCODE='22023'; END IF;
  PERFORM potok_food_evidence.reject_negative_zero_v1(raw);
  request:=raw::jsonb;
  IF request->>'kind'='REVIEW_APPROVED' THEN
    PERFORM potok_food_evidence.exact_keys_v1(request,ARRAY['contract','kind','idempotencyReference','proposal','proposalDigest','retainedSource','expectedHead']);
  ELSIF request->>'kind'='REVIEW_REJECTED' THEN
    PERFORM potok_food_evidence.exact_keys_v1(request,ARRAY['contract','kind','idempotencyReference','proposal','proposalDigest','retainedSource','reason']);
  ELSIF request->>'kind'='INVALIDATION' THEN
    PERFORM potok_food_evidence.exact_keys_v1(request,ARRAY['contract','kind','idempotencyReference','target','retainedSource','reason','severity']);
  ELSE RAISE EXCEPTION 'EVENT_VARIANT_INVALID' USING ERRCODE='22023'; END IF;
  IF request->>'contract' IS DISTINCT FROM 'potok-food-evidence-review-request-v1' THEN RAISE EXCEPTION 'REQUEST_CONTRACT_INVALID' USING ERRCODE='22023'; END IF;
  key:=potok_food_evidence.uuid_v1(request->'idempotencyReference');
  canonical_request:=convert_to(potok_food_evidence.canonical_json_v1(jsonb_build_object(
    'domain','potok-food-evidence-review-request-sha256-v1','payload',request)),'UTF8');
  request_digest:=encode(extensions.digest(canonical_request,'sha256'),'hex');
  SELECT * INTO existing FROM potok_food_evidence.review_requests_v1 WHERE actor_id=actor AND idempotency_reference=key;
  IF FOUND THEN
    IF existing.canonical_request<>canonical_request OR existing.request_digest<>request_digest THEN
      RAISE EXCEPTION 'IDEMPOTENCY_PAYLOAD_CONFLICT' USING ERRCODE='40001'; END IF;
    RETURN existing.receipt||jsonb_build_object('replayed',true);
  END IF;
  IF request->>'kind'='INVALIDATION' THEN
    target:=request->'target'; revision:=potok_food_evidence.revision_v1(target);
    target_kind:=target->>'kind'; food_id:=potok_food_evidence.uuid_v1(target->'canonicalFoodId');
    state:=revision->>'foodState'; app:=revision->'applicability';
    IF target_kind='NUTRITION_REVIEWED_REVISION' THEN
      canonical:=potok_food_evidence.revision_v1(jsonb_build_object('kind','CANONICAL_REVIEWED_REVISION',
        'revisionId',revision->'canonicalRevisionId','digest',revision->'canonicalRevisionDigest','canonicalFoodId',food_id));
    END IF;
    IF request->>'severity' NOT IN ('CORRECTION','SAFETY_CRITICAL') OR request->>'severity' IS NULL THEN
      RAISE EXCEPTION 'INVALIDATION_SEVERITY_INVALID' USING ERRCODE='22023'; END IF;
  ELSE
    proposal:=request->'proposal'; target_kind:=potok_food_evidence.proposal_v1(proposal);
    food_id:=potok_food_evidence.uuid_v1(proposal->'canonicalFoodId'); state:=proposal->>'foodState'; app:=proposal->'applicability';
    prop_domain:=CASE WHEN target_kind='CANONICAL_REVIEWED_REVISION' THEN 'potok-canonical-food-review-proposal-sha256-v1' ELSE 'potok-nutrition-review-proposal-sha256-v1' END;
    prop_digest:=potok_food_evidence.hash_v1(request->'proposalDigest');
    IF potok_food_evidence.digest_v1(prop_domain,proposal)<>prop_digest THEN RAISE EXCEPTION 'PROPOSAL_DIGEST_MISMATCH' USING ERRCODE='22023'; END IF;
    -- Retain both exact raw JSON representation and its canonical semantic digest.
    proposal_bytes:=convert_to((raw->'proposal')::text,'UTF8');
  END IF;
  -- Actor gate alone does not serialize different reviewers of shared catalog data.
  PERFORM pg_advisory_xact_lock(hashtextextended('potok-food-evidence-v1:'||food_id::text,0));
  food:=potok_food_evidence.shared_food_v1(food_id);
  source:=request->'retainedSource';
  IF request->>'kind'='REVIEW_REJECTED' AND source='null'::jsonb THEN source:=NULL;
  ELSE source_bytes:=potok_food_evidence.source_v1(source,target_kind,app); END IF;
  IF request->>'kind'<>'REVIEW_APPROVED' THEN PERFORM potok_food_evidence.text_v1(request->'reason'); END IF;
  IF request->>'kind'='REVIEW_APPROVED' THEN
    SELECT * INTO head FROM potok_food_evidence.current_heads_v1
      WHERE current_heads_v1.target_kind=food_review_scope.target_kind AND canonical_food_id=food_id AND food_state=state FOR UPDATE;
    IF FOUND THEN
      PERFORM potok_food_evidence.exact_keys_v1(request->'expectedHead',ARRAY['revisionId','digest']);
      IF potok_food_evidence.uuid_v1(request->'expectedHead'->'revisionId')<>head.revision_id
        OR potok_food_evidence.hash_v1(request->'expectedHead'->'digest')<>head.digest THEN RAISE EXCEPTION 'CURRENT_HEAD_CONFLICT' USING ERRCODE='40001'; END IF;
      previous:=head.revision_id;
    ELSIF request->'expectedHead' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'CURRENT_HEAD_CONFLICT' USING ERRCODE='40001'; END IF;
    IF target_kind='CANONICAL_REVIEWED_REVISION' THEN
      IF proposal->'identitySnapshot' IS DISTINCT FROM potok_food_evidence.identity_v1(food)
        OR proposal->'foodStableId' IS DISTINCT FROM food->'stable_food_id' OR proposal->'source' IS DISTINCT FROM food->'source' THEN
        RAISE EXCEPTION 'CATALOG_SNAPSHOT_CONFLICT' USING ERRCODE='40001'; END IF;
    ELSE
      target:=jsonb_build_object('kind','CANONICAL_REVIEWED_REVISION','revisionId',proposal->'canonicalRevisionId',
        'digest',proposal->'canonicalRevisionDigest','canonicalFoodId',food_id);
      canonical:=potok_food_evidence.revision_v1(target);
      IF canonical->'applicability' IS DISTINCT FROM app
        OR potok_food_evidence.invalidated_v1('CANONICAL_REVIEWED_REVISION',(canonical->>'revisionId')::uuid) IS NOT NULL
        OR NOT EXISTS (SELECT 1 FROM potok_food_evidence.current_heads_v1
          WHERE current_heads_v1.target_kind='CANONICAL_REVIEWED_REVISION' AND canonical_food_id=food_id AND food_state=state
            AND current_heads_v1.revision_id=(canonical->>'revisionId')::uuid AND digest=canonical->>'digest')
        OR canonical->'identitySnapshot' IS DISTINCT FROM potok_food_evidence.identity_v1(food)
        OR canonical->'foodStableId' IS DISTINCT FROM food->'stable_food_id' OR canonical->'source' IS DISTINCT FROM food->'source' THEN
        RAISE EXCEPTION 'LIVE_CANONICAL_BINDING_REQUIRED' USING ERRCODE='40001'; END IF;
    END IF;
  END IF;
  -- Locks/source checks may have waited. Recheck token/session/expiry at issuance,
  -- before any artifact is written, under the same trusted entitlement gate.
  attestation:=potok_food_evidence.authority_v1();
  event_id:=gen_random_uuid();
  timestamp_text:=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  IF source IS NOT NULL THEN
    INSERT INTO potok_food_evidence.retained_sources_v1 VALUES((source->>'sourceArtifactId')::uuid,source,source_bytes) ON CONFLICT DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM potok_food_evidence.retained_sources_v1
      WHERE source_artifact_id=(source->>'sourceArtifactId')::uuid AND snapshot=source AND retained_sources_v1.source_bytes=food_review_scope.source_bytes) THEN
      RAISE EXCEPTION 'SOURCE_ARTIFACT_ID_CONFLICT' USING ERRCODE='40001'; END IF;
  END IF;
  IF request->>'kind'='REVIEW_APPROVED' THEN
    revision_id:=gen_random_uuid();
    revision:=(proposal-'contract')||jsonb_build_object('contract',CASE WHEN target_kind='CANONICAL_REVIEWED_REVISION'
      THEN 'potok-canonical-food-reviewed-revision-v1' ELSE 'potok-nutrition-reviewed-revision-v1' END,
      'encoding','potok-food-reviewed-evidence-canonical-json-v1','revisionId',revision_id,'supersedesRevisionId',previous,'reviewEventId',event_id);
    IF target_kind='CANONICAL_REVIEWED_REVISION' THEN revision:=revision||jsonb_build_object('foodId',food_id); END IF;
    revision:=potok_food_evidence.artifact_v1(CASE WHEN target_kind='CANONICAL_REVIEWED_REVISION'
      THEN 'potok-canonical-food-reviewed-revision-sha256-v1' ELSE 'potok-nutrition-reviewed-revision-sha256-v1' END,revision);
    IF target_kind='CANONICAL_REVIEWED_REVISION' THEN
      INSERT INTO potok_food_evidence.canonical_revisions_v1 VALUES(revision_id,food_id,state,revision->>'digest',previous,event_id,revision,
        convert_to(potok_food_evidence.canonical_json_v1(revision),'UTF8'));
    ELSE
      INSERT INTO potok_food_evidence.nutrition_revisions_v1 VALUES(revision_id,food_id,state,revision->>'digest',
        (proposal->>'canonicalRevisionId')::uuid,proposal->>'canonicalRevisionDigest',previous,event_id,revision,
        convert_to(potok_food_evidence.canonical_json_v1(revision),'UTF8'));
    END IF;
    target:=jsonb_build_object('kind',target_kind,'revisionId',revision_id,'digest',revision->'digest','canonicalFoodId',food_id);
  ELSIF request->>'kind'='REVIEW_REJECTED' THEN
    target:=jsonb_build_object('kind',CASE WHEN target_kind='CANONICAL_REVIEWED_REVISION' THEN 'CANONICAL_PROPOSAL' ELSE 'NUTRITION_PROPOSAL' END,
      'canonicalFoodId',food_id,'proposalDigest',prop_digest,'applicability',app);
    revision:=NULL;
  END IF;
  event:=jsonb_build_object('contract','potok-food-evidence-review-event-v1','encoding','potok-food-reviewed-evidence-canonical-json-v1',
    'kind',request->'kind','eventId',event_id,'occurredAt',timestamp_text,'timestampOrigin','SERVER','idempotencyReference',key,'requestDigest',request_digest,
    'authorityContext',jsonb_build_object('boundary','OWNER_ADMIN_REVIEW','actorId',actor,'role','ADMIN',
      'authorityReference','potok-control-admin-attestation-v2:'||attestation::text),'target',target,'retainedSource',source);
  IF request->>'kind'<>'REVIEW_APPROVED' THEN event:=event||jsonb_build_object('reason',request->'reason'); END IF;
  IF request->>'kind'='INVALIDATION' THEN event:=event||jsonb_build_object('severity',request->'severity'); END IF;
  event:=potok_food_evidence.artifact_v1('potok-food-evidence-review-event-sha256-v1',event);
  INSERT INTO potok_food_evidence.review_events_v1 VALUES(event_id,actor,key,attestation,(source->>'sourceArtifactId')::uuid,target_kind,
    CASE WHEN request->>'kind'='REVIEW_REJECTED' THEN NULL ELSE (target->>'revisionId')::uuid END,food_id,request->>'kind',request->>'severity',
    event->>'digest',event,convert_to(potok_food_evidence.canonical_json_v1(event),'UTF8'));
  IF request->>'kind'='REVIEW_APPROVED' THEN
    INSERT INTO potok_food_evidence.current_heads_v1 VALUES(target_kind,food_id,state,revision_id,revision->>'digest',event_id)
      ON CONFLICT ON CONSTRAINT current_heads_v1_pkey DO UPDATE SET revision_id=excluded.revision_id,digest=excluded.digest,last_event_id=excluded.last_event_id;
  ELSIF request->>'kind'='INVALIDATION' THEN
    -- No head rollback and no implicit invalidation of superseded history. Severity is derived from ALL invalidations.
    UPDATE potok_food_evidence.current_heads_v1 SET last_event_id=event_id
      WHERE current_heads_v1.target_kind=food_review_scope.target_kind AND canonical_food_id=food_id AND food_state=state
        AND current_heads_v1.revision_id=(target->>'revisionId')::uuid;
  END IF;
  receipt:=jsonb_build_object('contract','potok-food-evidence-review-receipt-v1','event',event,'revision',revision,'canonicalRevision',canonical,'proposalTarget',
    CASE WHEN request->>'kind'='REVIEW_REJECTED' THEN target ELSE NULL END);
  INSERT INTO potok_food_evidence.review_requests_v1 VALUES(actor,key,request_digest,canonical_request,proposal_bytes,prop_digest,event_id,receipt);
  RETURN receipt||jsonb_build_object('replayed',false);
END $$;

CREATE OR REPLACE FUNCTION public.nonfood_evidence_review_v1(p_request_text text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid();att uuid;v jsonb;p jsonb;s jsonb;source_bytes bytea;key uuid;rd text;old potok_nonfood.receipts_v1%ROWTYPE;
 k text;d uuid;rev jsonb;def jsonb;head jsonb;prev uuid;rid uuid;eid uuid;event_at timestamptz;ev jsonb;receipt jsonb;target jsonb;action text;
BEGIN
 att:=potok_food_evidence.authority_v1();
  PERFORM potok_closure.assert_active_v1();
 IF p_request_text IS NULL OR octet_length(p_request_text)>1048576 THEN RAISE EXCEPTION 'REQUEST_SIZE_INVALID'; END IF;
 IF potok_nutrition.json_has_duplicate_keys_v1(p_request_text::json) THEN RAISE EXCEPTION 'DUPLICATE_JSON_KEY'; END IF;
 PERFORM potok_food_evidence.reject_negative_zero_v1(p_request_text::json);v:=p_request_text::jsonb;action:=v->>'kind';
 IF action='INVALIDATION' THEN PERFORM potok_food_evidence.exact_keys_v1(v,ARRAY['contract','kind','idempotencyReference','retainedSource','target','severity','reason']);
 ELSIF action IN ('REVIEW_APPROVED','REVIEW_REJECTED') THEN PERFORM potok_food_evidence.exact_keys_v1(v,ARRAY['contract','kind','idempotencyReference','retainedSource','proposal','expectedHead','reason']);
 ELSE RAISE EXCEPTION 'ACTION_INVALID'; END IF;
 IF v->>'contract' IS DISTINCT FROM 'potok-nonfood-review-request-v1' THEN RAISE EXCEPTION 'CONTRACT_INVALID'; END IF;
 key:=potok_food_evidence.uuid_v1(v->'idempotencyReference');rd:=potok_food_evidence.digest_v1('potok-nonfood-request-sha256-v1',v);
 -- Shared trusted actor gate is already held. Global private gate precedes all nonfood row locks.
 PERFORM pg_advisory_xact_lock(hashtextextended('potok-nonfood-v1:catalog',0));
 att:=potok_food_evidence.authority_v1();
 SELECT * INTO old FROM potok_nonfood.receipts_v1 WHERE actor_id=actor AND request_key=key;
 IF FOUND THEN
  IF old.raw_bytes<>convert_to(p_request_text,'UTF8') OR old.request_digest<>rd THEN RAISE EXCEPTION 'IDEMPOTENCY_BYTES_CONFLICT' USING ERRCODE='PT409',DETAIL='POTOK_BUSINESS_CONFLICT_V1'; END IF;
  PERFORM potok_food_evidence.authority_v1();RETURN old.receipt||jsonb_build_object('replayed',true);
 END IF;
 IF action='INVALIDATION' THEN
  target:=v->'target';PERFORM potok_food_evidence.exact_keys_v1(target,ARRAY['kind','definitionId','revisionId','digest']);
  k:=potok_food_evidence.text_v1(target->'kind');d:=potok_food_evidence.uuid_v1(target->'definitionId');
  rev:=potok_nonfood.revision_v1(k,d,potok_food_evidence.uuid_v1(target->'revisionId'),potok_food_evidence.hash_v1(target->'digest'));
  p:=rev->'proposal'; IF v->>'severity' IS NULL OR v->>'severity' NOT IN ('CORRECTION','SAFETY_CRITICAL') THEN RAISE EXCEPTION 'SEVERITY_INVALID'; END IF;
 ELSE
  p:=v->'proposal';k:=potok_nonfood.proposal_v1(p);
  IF v->'expectedHead'<>'null'::jsonb THEN PERFORM potok_food_evidence.exact_keys_v1(v->'expectedHead',ARRAY['revisionId','digest']);PERFORM potok_food_evidence.uuid_v1(v->'expectedHead'->'revisionId');PERFORM potok_food_evidence.hash_v1(v->'expectedHead'->'digest'); END IF;
  IF k='DEFINITION' THEN
   IF p->'definitionId'='null'::jsonb THEN
    IF EXISTS(SELECT 1 FROM potok_nonfood.roots_v1 WHERE stable_key=p->>'stableKey') OR v->'expectedHead'<>'null'::jsonb THEN RAISE EXCEPTION 'DEFINITION_KEY_CONFLICT' USING ERRCODE='PT409',DETAIL='POTOK_BUSINESS_CONFLICT_V1'; END IF;
    IF action='REVIEW_APPROVED' THEN d:=gen_random_uuid();INSERT INTO potok_nonfood.roots_v1 VALUES(d,p->>'stableKey'); END IF;
   ELSE
    d:=potok_food_evidence.uuid_v1(p->'definitionId');
    IF NOT EXISTS(SELECT 1 FROM potok_nonfood.roots_v1 WHERE definition_id=d AND stable_key=p->>'stableKey') THEN RAISE EXCEPTION 'DEFINITION_IDENTITY_CONFLICT' USING ERRCODE='PT409',DETAIL='POTOK_BUSINESS_CONFLICT_V1'; END IF;
   END IF;
  ELSE
   d:=potok_food_evidence.uuid_v1(p->'definitionId');def:=potok_nonfood.revision_v1('DEFINITION',d,potok_food_evidence.uuid_v1(p->'definitionRevisionId'),potok_food_evidence.hash_v1(p->'definitionRevisionDigest'));
   IF NOT EXISTS(SELECT 1 FROM potok_nonfood.heads_v1 WHERE definition_id=d AND kind='DEFINITION' AND revision_id=(p->>'definitionRevisionId')::uuid AND digest=p->>'definitionRevisionDigest')
    OR potok_nonfood.invalidated_v1('DEFINITION',(p->>'definitionRevisionId')::uuid) OR def->'proposal'->'applicability' IS DISTINCT FROM p->'applicability' THEN RAISE EXCEPTION 'LIVE_DEFINITION_BINDING_REQUIRED' USING ERRCODE='PT409',DETAIL='POTOK_BUSINESS_CONFLICT_V1'; END IF;
  END IF;
  SELECT jsonb_build_object('revisionId',revision_id,'digest',digest) INTO head FROM potok_nonfood.heads_v1 WHERE definition_id=d AND kind=k;
  IF action='REVIEW_APPROVED' THEN
   IF head IS DISTINCT FROM v->'expectedHead' AND NOT(head IS NULL AND v->'expectedHead'='null'::jsonb) THEN RAISE EXCEPTION 'EXPECTED_HEAD_CONFLICT' USING ERRCODE='PT409',DETAIL='POTOK_BUSINESS_CONFLICT_V1'; END IF;
   prev:=(head->>'revisionId')::uuid;
  END IF;
 END IF;
 IF action='REVIEW_APPROVED' THEN IF v->'reason' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'APPROVAL_REASON_INVALID'; END IF;
 ELSE PERFORM potok_food_evidence.text_v1(v->'reason'); END IF;
 s:=v->'retainedSource';source_bytes:=potok_food_evidence.source_v1(s,CASE WHEN k='DEFINITION' THEN 'CANONICAL_REVIEWED_REVISION' ELSE 'NUTRITION_REVIEWED_REVISION' END,p->'applicability');
 INSERT INTO potok_nonfood.sources_v1 VALUES((s->>'sourceArtifactId')::uuid,s,source_bytes) ON CONFLICT DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM potok_nonfood.sources_v1 WHERE source_id=(s->>'sourceArtifactId')::uuid AND snapshot=s AND sources_v1.bytes=source_bytes) THEN RAISE EXCEPTION 'SOURCE_ID_CONFLICT' USING ERRCODE='PT409',DETAIL='POTOK_BUSINESS_CONFLICT_V1'; END IF;
 eid:=gen_random_uuid();
 IF action='REVIEW_APPROVED' THEN
  rid:=gen_random_uuid();IF k='DEFINITION' THEN p:=p||jsonb_build_object('definitionId',d); END IF;
  rev:=potok_food_evidence.artifact_v1('potok-nonfood-revision-sha256-v1',jsonb_build_object('contract',CASE WHEN k='DEFINITION' THEN 'potok-nonfood-definition-revision-v1' ELSE 'potok-nonfood-nutrition-revision-v1' END,
   'definitionId',d,'revisionId',rid,'supersedesRevisionId',prev,'reviewEventId',eid,'proposal',p,'retainedSource',s));
  IF k='DEFINITION' THEN INSERT INTO potok_nonfood.definitions_v1 VALUES(rid,d,rev->>'digest',prev,eid,rev,convert_to(potok_food_evidence.canonical_json_v1(rev),'UTF8'));
  ELSE INSERT INTO potok_nonfood.nutrition_v1 VALUES(rid,d,(p->>'definitionRevisionId')::uuid,p->>'definitionRevisionDigest',rev->>'digest',prev,eid,rev,convert_to(potok_food_evidence.canonical_json_v1(rev),'UTF8')); END IF;
  target:=jsonb_build_object('kind',k,'definitionId',d,'revisionId',rid,'digest',rev->>'digest');
 ELSIF action='REVIEW_REJECTED' THEN target:=jsonb_build_object('kind',k,'proposal',p);rev:=NULL; END IF;
 event_at:=date_trunc('milliseconds',clock_timestamp());
 ev:=potok_food_evidence.artifact_v1('potok-nonfood-event-sha256-v1',jsonb_build_object('contract','potok-nonfood-review-event-v1','eventId',eid,'actorId',actor,
  'authorityReference','potok-control-admin-attestation-v2:'||att::text,'occurredAt',to_char(event_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'kind',action,'requestDigest',rd,'target',target,'retainedSource',s,'reason',v->'reason','severity',CASE WHEN action='INVALIDATION' THEN v->'severity' ELSE 'null'::jsonb END));
 INSERT INTO potok_nonfood.events_v1 VALUES(eid,actor,att,key,d,(s->>'sourceArtifactId')::uuid,event_at,ev,convert_to(potok_food_evidence.canonical_json_v1(ev),'UTF8'));
 IF action='REVIEW_APPROVED' THEN INSERT INTO potok_nonfood.heads_v1 VALUES(d,k,rid,rev->>'digest') ON CONFLICT(definition_id,kind) DO UPDATE SET revision_id=excluded.revision_id,digest=excluded.digest; END IF;
 IF action='INVALIDATION' AND k='NUTRITION' THEN def:=potok_nonfood.revision_v1('DEFINITION',d,(p->>'definitionRevisionId')::uuid,p->>'definitionRevisionDigest'); END IF;
 receipt:=jsonb_build_object('contract','potok-nonfood-receipt-v1','actorId',actor,'idempotencyReference',key,'requestDigest',rd,
  'rawRequestSha256',encode(extensions.digest(convert_to(p_request_text,'UTF8'),'sha256'),'hex'),'event',ev,'revision',rev,'definitionRevision',def,'heads',potok_nonfood.heads_json_v1(d));
 INSERT INTO potok_nonfood.receipts_v1 VALUES(actor,key,rd,convert_to(p_request_text,'UTF8'),eid,receipt);
 -- Last statement before return/outer COMMIT: real authority recheck; failure rolls EVERYTHING back.
 PERFORM potok_food_evidence.authority_v1();RETURN receipt||jsonb_build_object('replayed',false);
END $$;
COMMIT;
