-- DISPOSABLE ACCEPTANCE CANDIDATE ONLY. Not a hosted migration or runtime activation.
-- Reuses deployed V1 authority/source/canonical identity; never installs another permission ledger.
BEGIN;
DO $guard$
DECLARE expected record;
BEGIN
  IF current_user<>'postgres' OR session_user<>'postgres'
    OR current_setting('potok_food_evidence.exact_test_target',true) IS DISTINCT FROM 'disposable-postgresql-only'
    OR current_setting('listen_addresses')<>'' OR current_setting('port')<>'54329'
    OR current_setting('data_directory') NOT LIKE '%/potok-food-evidence-pg-%/data' THEN
    RAISE EXCEPTION 'OWN_DISPOSABLE_CLUSTER_REQUIRED'; END IF;
  FOR expected IN SELECT * FROM (VALUES
    ('authority_v1','e322ada6e5dbadef65429126f7f2bb53'),('source_v1','6cae67ff524d56d19b19f7a5a122ae06'),
    ('canonical_json_v1','6016a334cae1796bf3e0cf2439cf4054'),('digest_v1','1dc7364e8c5289b13d7a556a8fe5a3f4'),
    ('revision_v1','ebbb559395c8d261c83ee0618f616078'),('shared_food_v1','f0a61577582d3057b1bbffbf40e5074b'),
    ('identity_v1','e410f479e947a1338a6604ef755483c2'),('invalidated_v1','17a1ef13c3b4a7209d84f33e1cb98b6e'),
    ('reject_mutation_v1','9709c4d215e140c3ab94b81a3f353ed5')) p(name,body_hash) LOOP
    IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='potok_food_evidence' AND p.proname=expected.name AND md5(p.prosrc)=expected.body_hash
          AND pg_get_userbyid(p.proowner)='postgres' AND NOT p.prosecdef
          AND coalesce('search_path=pg_catalog'=ANY(p.proconfig),false))<>1 THEN
      RAISE EXCEPTION 'REVIEWED_V1_PREREQUISITES_REQUIRED'; END IF;
  END LOOP;
END $guard$;

CREATE FUNCTION potok_food_evidence.parse_exact_json_v2(raw text, max_bytes integer) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE c text; quoted boolean:=false; escaped boolean:=false; depth integer:=0; parsed json;
BEGIN
  IF raw IS NULL OR octet_length(raw)>max_bytes THEN RAISE EXCEPTION 'RAW_BUDGET' USING ERRCODE='22023'; END IF;
  FOR i IN 1..length(raw) LOOP
    c:=substr(raw,i,1);
    IF quoted THEN
      IF escaped THEN escaped:=false; ELSIF c=chr(92) THEN escaped:=true; ELSIF c='"' THEN quoted:=false; END IF;
    ELSIF c='"' THEN quoted:=true;
    ELSIF c IN ('{','[') THEN depth:=depth+1; IF depth>12 THEN RAISE EXCEPTION 'RAW_DEPTH' USING ERRCODE='22023'; END IF;
    ELSIF c IN ('}',']') THEN depth:=depth-1;
    END IF;
  END LOOP;
  parsed:=raw::json;
  IF potok_nutrition.json_has_duplicate_keys_v1(parsed) THEN RAISE EXCEPTION 'DUPLICATE_JSON_KEYS' USING ERRCODE='22023'; END IF;
  PERFORM potok_food_evidence.reject_negative_zero_v1(parsed);
  PERFORM potok_food_evidence.canonical_json_v1(parsed::jsonb);
  RETURN parsed::jsonb;
END $$;

CREATE FUNCTION potok_food_evidence.numeric_input_exact_v2(v jsonb, source_hash text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE ref jsonb:=v->'reference'; field text; q jsonb; n numeric; d numeric; a numeric; b numeric; r numeric; decimal_text text;
BEGIN
  PERFORM potok_food_evidence.exact_keys_v1(v,ARRAY['contract','encoding','reference','mappedDecimalText','values']);
  IF v->>'contract' IS DISTINCT FROM 'potok-exact-nutrition-numeric-input-v2'
    OR v->>'encoding' IS DISTINCT FROM 'potok-exact-nutrition-canonical-json-v2' THEN RAISE EXCEPTION 'EXACT_NUMERIC_CONTRACT'; END IF;
  PERFORM potok_food_evidence.exact_keys_v1(ref,ARRAY['sourceRecord','declaredRetainedArtifactSha256','basis','units','carbohydrateSemantics','mappingPolicyRef']);
  IF length(potok_food_evidence.text_v1(ref->'sourceRecord'))>256 OR length(potok_food_evidence.text_v1(ref->'mappingPolicyRef'))>256
    OR potok_food_evidence.hash_v1(ref->'declaredRetainedArtifactSha256') IS DISTINCT FROM source_hash
    OR NOT coalesce(ref->>'basis' IN ('PER_100_G_EDIBLE','PER_100_G_FOOD'),false)
    OR ref->>'carbohydrateSemantics' IS DISTINCT FROM 'AVAILABLE_EXCLUDING_FIBER' THEN RAISE EXCEPTION 'EXACT_NUMERIC_REFERENCE'; END IF;
  PERFORM potok_food_evidence.exact_keys_v1(ref->'units',ARRAY['calories','protein','fat','carbs','fiber']);
  PERFORM potok_food_evidence.exact_keys_v1(v->'mappedDecimalText',ARRAY['calories','protein','fat','carbs','fiber']);
  PERFORM potok_food_evidence.exact_keys_v1(v->'values',ARRAY['calories','protein','fat','carbs','fiber']);
  FOREACH field IN ARRAY ARRAY['calories','protein','fat','carbs','fiber'] LOOP
    IF ref->'units'->>field IS DISTINCT FROM (CASE WHEN field='calories' THEN 'kcal' ELSE 'g' END) THEN RAISE EXCEPTION 'EXACT_UNITS'; END IF;
    decimal_text:=potok_food_evidence.text_v1(v->'mappedDecimalText'->field);
    IF decimal_text !~ '^(0|[1-9][0-9]{0,8})(\.[0-9]{1,18})?$' THEN RAISE EXCEPTION 'EXACT_DECIMAL'; END IF;
    q:=v->'values'->field;
    PERFORM potok_food_evidence.exact_keys_v1(q,ARRAY['numerator','denominator']);
    IF potok_food_evidence.text_v1(q->'numerator') !~ '^(0|[1-9][0-9]{0,79})$'
      OR potok_food_evidence.text_v1(q->'denominator') !~ '^[1-9][0-9]{0,79}$' THEN RAISE EXCEPTION 'EXACT_RATIONAL'; END IF;
    n:=(q->>'numerator')::numeric; d:=(q->>'denominator')::numeric; a:=n; b:=d;
    WHILE b<>0 LOOP r:=mod(a,b); a:=b; b:=r; END LOOP;
    -- Cross multiplication only: numeric division could silently round recurring fractions.
    IF a<>1 OR n<>decimal_text::numeric*d THEN RAISE EXCEPTION 'EXACT_SOURCE_VALUE_MISMATCH'; END IF;
  END LOOP;
  -- Numeric-input domain intentionally uses "value", unlike the evidence artifact domains.
  RETURN encode(extensions.digest(convert_to(potok_food_evidence.canonical_json_v1(jsonb_build_object(
    'domain','potok-exact-nutrition-numeric-input-sha256-v2','value',v)),'UTF8'),'sha256'),'hex');
END $$;

CREATE TABLE potok_food_evidence.exact_sources_v2 (
  digest text PRIMARY KEY CHECK(digest~'^[a-f0-9]{64}$'), canonical_food_id uuid NOT NULL,
  canonical_revision_id uuid NOT NULL, canonical_revision_digest text NOT NULL, food_state text NOT NULL,
  source_artifact_id uuid NOT NULL REFERENCES potok_food_evidence.retained_sources_v1 ON DELETE RESTRICT,
  proposal jsonb NOT NULL, pins jsonb NOT NULL, proposal_bytes bytea NOT NULL, pins_bytes bytea NOT NULL,
  FOREIGN KEY(canonical_revision_id,canonical_revision_digest,canonical_food_id,food_state)
    REFERENCES potok_food_evidence.canonical_revisions_v1(revision_id,digest,canonical_food_id,food_state) ON DELETE RESTRICT
);
CREATE TABLE potok_food_evidence.exact_revisions_v2 (
  revision_id uuid PRIMARY KEY, digest text NOT NULL CHECK(digest~'^[a-f0-9]{64}$'), canonical_food_id uuid NOT NULL,
  food_state text NOT NULL, source_digest text NOT NULL REFERENCES potok_food_evidence.exact_sources_v2 ON DELETE RESTRICT,
  supersedes_revision_id uuid REFERENCES potok_food_evidence.exact_revisions_v2 ON DELETE RESTRICT,
  review_event_id uuid NOT NULL UNIQUE, snapshot jsonb NOT NULL, canonical_bytes bytea NOT NULL,
  CHECK(revision_id IS DISTINCT FROM supersedes_revision_id), UNIQUE(revision_id,digest,canonical_food_id,food_state)
);
CREATE TABLE potok_food_evidence.exact_events_v2 (
  event_id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES auth.users ON DELETE RESTRICT,
  idempotency_reference uuid NOT NULL, authority_attestation_id uuid NOT NULL,
  source_digest text NOT NULL REFERENCES potok_food_evidence.exact_sources_v2 ON DELETE RESTRICT,
  target_revision_id uuid REFERENCES potok_food_evidence.exact_revisions_v2 ON DELETE RESTRICT,
  kind text NOT NULL CHECK(kind IN ('REVIEW_APPROVED','REVIEW_REJECTED','INVALIDATION')),
  digest text NOT NULL CHECK(digest~'^[a-f0-9]{64}$'), snapshot jsonb NOT NULL, canonical_bytes bytea NOT NULL,
  UNIQUE(actor_id,idempotency_reference),
  FOREIGN KEY(actor_id,authority_attestation_id) REFERENCES potok_control.access_attestations(account_id,attestation_id) ON DELETE RESTRICT,
  CHECK((kind='REVIEW_REJECTED')=(target_revision_id IS NULL))
);
CREATE INDEX exact_events_target_v2 ON potok_food_evidence.exact_events_v2(target_revision_id,kind);
CREATE TABLE potok_food_evidence.exact_requests_v2 (
  actor_id uuid NOT NULL REFERENCES auth.users ON DELETE RESTRICT, idempotency_reference uuid NOT NULL,
  request_digest text NOT NULL, raw_request bytea NOT NULL, raw_sha256 text NOT NULL,
  event_id uuid NOT NULL UNIQUE REFERENCES potok_food_evidence.exact_events_v2 ON DELETE RESTRICT,
  receipt jsonb NOT NULL, PRIMARY KEY(actor_id,idempotency_reference)
);
ALTER TABLE potok_food_evidence.exact_events_v2 ADD FOREIGN KEY(actor_id,idempotency_reference)
  REFERENCES potok_food_evidence.exact_requests_v2 ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE potok_food_evidence.exact_revisions_v2 ADD FOREIGN KEY(review_event_id)
  REFERENCES potok_food_evidence.exact_events_v2 ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE potok_food_evidence.exact_heads_v2 (
  canonical_food_id uuid NOT NULL, food_state text NOT NULL, revision_id uuid NOT NULL, digest text NOT NULL,
  PRIMARY KEY(canonical_food_id,food_state),
  FOREIGN KEY(revision_id,digest,canonical_food_id,food_state)
    REFERENCES potok_food_evidence.exact_revisions_v2(revision_id,digest,canonical_food_id,food_state) ON DELETE RESTRICT
);
DO $private$
DECLARE name text;
BEGIN
  FOREACH name IN ARRAY ARRAY['exact_sources_v2','exact_revisions_v2','exact_events_v2','exact_requests_v2','exact_heads_v2'] LOOP
    EXECUTE format('ALTER TABLE potok_food_evidence.%I ENABLE ROW LEVEL SECURITY',name);
    EXECUTE format('ALTER TABLE potok_food_evidence.%I FORCE ROW LEVEL SECURITY',name);
    EXECUTE format('REVOKE ALL ON potok_food_evidence.%I FROM PUBLIC,anon,authenticated,service_role',name);
    IF name<>'exact_heads_v2' THEN
      EXECUTE format('CREATE TRIGGER immutable_v2 BEFORE UPDATE OR DELETE OR TRUNCATE ON potok_food_evidence.%I FOR EACH STATEMENT EXECUTE FUNCTION potok_food_evidence.reject_mutation_v1()',name);
    END IF;
  END LOOP;
END $private$;

CREATE FUNCTION potok_food_evidence.live_canonical_exact_v2(c jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SET search_path=pg_catalog AS $$
DECLARE food jsonb; stored jsonb;
BEGIN
  stored:=potok_food_evidence.revision_v1(jsonb_build_object('kind','CANONICAL_REVIEWED_REVISION',
    'revisionId',c->'revisionId','digest',c->'digest','canonicalFoodId',c->'canonicalFoodId'));
  food:=potok_food_evidence.shared_food_v1((c->>'canonicalFoodId')::uuid);
  IF stored IS DISTINCT FROM c OR potok_food_evidence.invalidated_v1('CANONICAL_REVIEWED_REVISION',(c->>'revisionId')::uuid) IS NOT NULL
    OR c->'identitySnapshot' IS DISTINCT FROM potok_food_evidence.identity_v1(food)
    OR c->'foodStableId' IS DISTINCT FROM food->'stable_food_id' OR c->'source' IS DISTINCT FROM food->'source'
    OR NOT EXISTS(SELECT 1 FROM potok_food_evidence.current_heads_v1 h WHERE h.target_kind='CANONICAL_REVIEWED_REVISION'
      AND h.canonical_food_id=(c->>'canonicalFoodId')::uuid AND h.food_state=c->>'foodState'
      AND h.revision_id=(c->>'revisionId')::uuid AND h.digest=c->>'digest') THEN
    RAISE EXCEPTION 'LIVE_CANONICAL_BINDING_REQUIRED' USING ERRCODE='40001'; END IF;
END $$;

-- Owner-only preparation. Neither a client endpoint nor approval. Pins are independently supplied here.
CREATE FUNCTION potok_food_evidence.register_exact_source_v2(proposal_raw text,pins_raw text) RETURNS text
LANGUAGE plpgsql VOLATILE SET search_path=pg_catalog AS $$
<<source_scope>>
DECLARE p jsonb; pins jsonb; c jsonb; s jsonb; source_bytes bytea; stored potok_food_evidence.retained_sources_v1%ROWTYPE;
  digest text; existing potok_food_evidence.exact_sources_v2%ROWTYPE;
BEGIN
  IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'OWNER_PREPARATION_REQUIRED' USING ERRCODE='42501'; END IF;
  p:=potok_food_evidence.parse_exact_json_v2(proposal_raw,262144); pins:=potok_food_evidence.parse_exact_json_v2(pins_raw,1024);
  PERFORM potok_food_evidence.exact_keys_v1(p,ARRAY['contract','encoding','authority','status','canonical','retainedSource','numericInput','digest']);
  PERFORM potok_food_evidence.exact_keys_v1(pins,ARRAY['canonicalRevisionDigest','numericInputDigest','retainedSnapshotDigest']);
  IF p->>'contract' IS DISTINCT FROM 'potok-food-nutrition-source-binding-proposal-v2'
    OR p->>'encoding' IS DISTINCT FROM 'potok-food-nutrition-source-binding-json-v2'
    OR p->>'authority' IS DISTINCT FROM 'NONE' OR p->>'status' IS DISTINCT FROM 'REVIEW_REQUIRED' THEN RAISE EXCEPTION 'SOURCE_PROPOSAL_CONTRACT'; END IF;
  c:=p->'canonical'; s:=p->'retainedSource';
  PERFORM pg_advisory_xact_lock(hashtextextended('potok-food-evidence-v1:'||potok_food_evidence.uuid_v1(c->'canonicalFoodId')::text,0));
  PERFORM potok_food_evidence.live_canonical_exact_v2(c);
  source_bytes:=potok_food_evidence.source_v1(s,'NUTRITION_REVIEWED_REVISION',c->'applicability');
  IF potok_food_evidence.hash_v1(pins->'canonicalRevisionDigest') IS DISTINCT FROM c->>'digest'
    OR potok_food_evidence.hash_v1(pins->'numericInputDigest') IS DISTINCT FROM potok_food_evidence.numeric_input_exact_v2(p->'numericInput',s->>'sourceBytesSha256')
    OR potok_food_evidence.hash_v1(pins->'retainedSnapshotDigest') IS DISTINCT FROM potok_food_evidence.digest_v1('potok-retained-food-source-snapshot-sha256-v2',s) THEN
    RAISE EXCEPTION 'INDEPENDENT_SOURCE_PIN_MISMATCH'; END IF;
  digest:=potok_food_evidence.hash_v1(p->'digest');
  IF digest<>potok_food_evidence.digest_v1('potok-food-nutrition-source-binding-proposal-sha256-v2',p-'digest') THEN RAISE EXCEPTION 'SOURCE_PROPOSAL_DIGEST_MISMATCH'; END IF;
  -- Source IDs can occur across foods. Serialize before comparing immutable retained bytes.
  PERFORM pg_advisory_xact_lock(hashtextextended('potok-retained-source-v1:'||(s->>'sourceArtifactId'),0));
  SELECT * INTO stored FROM potok_food_evidence.retained_sources_v1 WHERE source_artifact_id=(s->>'sourceArtifactId')::uuid;
  IF FOUND THEN
    IF stored.snapshot IS DISTINCT FROM s OR stored.source_bytes IS DISTINCT FROM source_bytes THEN RAISE EXCEPTION 'SOURCE_ARTIFACT_ID_CONFLICT'; END IF;
  ELSE INSERT INTO potok_food_evidence.retained_sources_v1 VALUES((s->>'sourceArtifactId')::uuid,s,source_bytes); END IF;
  SELECT * INTO existing FROM potok_food_evidence.exact_sources_v2 x WHERE x.digest=source_scope.digest;
  IF FOUND THEN
    IF existing.proposal IS DISTINCT FROM p OR existing.pins IS DISTINCT FROM pins THEN RAISE EXCEPTION 'SOURCE_PROPOSAL_CONFLICT'; END IF;
  ELSE
    INSERT INTO potok_food_evidence.exact_sources_v2 VALUES(digest,(c->>'canonicalFoodId')::uuid,(c->>'revisionId')::uuid,c->>'digest',c->>'foodState',
      (s->>'sourceArtifactId')::uuid,p,pins,convert_to(potok_food_evidence.canonical_json_v1(p),'UTF8'),convert_to(potok_food_evidence.canonical_json_v1(pins),'UTF8'));
  END IF;
  RETURN digest;
END $$;

-- First V2 lane is deliberately disjoint from existing V1 nutrition heads. No implicit migration/fallback.
CREATE FUNCTION potok_food_evidence.reject_dual_nutrition_head_v2() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF NEW.target_kind='NUTRITION_REVIEWED_REVISION' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('potok-food-evidence-v1:'||NEW.canonical_food_id::text,0));
    IF EXISTS(SELECT 1 FROM potok_food_evidence.exact_heads_v2 WHERE canonical_food_id=NEW.canonical_food_id AND food_state=NEW.food_state) THEN
      RAISE EXCEPTION 'EXPLICIT_NUTRITION_VERSION_MIGRATION_REQUIRED' USING ERRCODE='40001'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reject_dual_nutrition_head_v2 BEFORE INSERT OR UPDATE ON potok_food_evidence.current_heads_v1
  FOR EACH ROW EXECUTE FUNCTION potok_food_evidence.reject_dual_nutrition_head_v2();

CREATE FUNCTION potok_food_evidence.exact_commit_authority_v2() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM NEW.actor_id OR potok_food_evidence.authority_v1() IS DISTINCT FROM NEW.authority_attestation_id THEN
    RAISE EXCEPTION 'COMMIT_AUTHORITY_REQUIRED' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER exact_commit_authority_v2 AFTER INSERT ON potok_food_evidence.exact_events_v2
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION potok_food_evidence.exact_commit_authority_v2();

CREATE FUNCTION public.food_nutrition_review_v2(p_request_text text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
<<review_scope>>
DECLARE actor uuid:=auth.uid(); att uuid; req jsonb; key uuid; kind text; request_digest text; raw_bytes bytea; raw_hash text;
  dossier potok_food_evidence.exact_sources_v2%ROWTYPE; old potok_food_evidence.exact_requests_v2%ROWTYPE;
  rev potok_food_evidence.exact_revisions_v2%ROWTYPE; head potok_food_evidence.exact_heads_v2%ROWTYPE;
  revision jsonb; event jsonb; target jsonb; receipt jsonb; event_id uuid:=gen_random_uuid(); revision_id uuid; food_id uuid; state text; reason text;
BEGIN
  att:=potok_food_evidence.authority_v1();
  req:=potok_food_evidence.parse_exact_json_v2(p_request_text,65536); kind:=req->>'kind';
  IF kind IS NULL OR kind NOT IN ('REVIEW_APPROVED','REVIEW_REJECTED','INVALIDATION') THEN RAISE EXCEPTION 'REVIEW_KIND_INVALID' USING ERRCODE='22023'; END IF;
  PERFORM potok_food_evidence.exact_keys_v1(req,ARRAY['contract','kind','idempotencyReference']||CASE kind
    WHEN 'REVIEW_APPROVED' THEN ARRAY['sourceProposalDigest','expectedHead'] WHEN 'REVIEW_REJECTED' THEN ARRAY['sourceProposalDigest','reason'] ELSE ARRAY['target','severity','reason'] END);
  IF req->>'contract' IS DISTINCT FROM 'potok-exact-food-nutrition-review-request-v2' THEN RAISE EXCEPTION 'REVIEW_CONTRACT_INVALID' USING ERRCODE='22023'; END IF;
  key:=potok_food_evidence.uuid_v1(req->'idempotencyReference');
  IF kind<>'REVIEW_APPROVED' THEN
    reason:=potok_food_evidence.text_v1(req->'reason'); IF length(reason)>1024 THEN RAISE EXCEPTION 'REASON_BUDGET' USING ERRCODE='22023'; END IF;
  END IF;
  IF kind='INVALIDATION' THEN
    PERFORM potok_food_evidence.exact_keys_v1(req->'target',ARRAY['canonicalFoodId','revisionId','digest']);
    food_id:=potok_food_evidence.uuid_v1(req->'target'->'canonicalFoodId');
    revision_id:=potok_food_evidence.uuid_v1(req->'target'->'revisionId');
    PERFORM potok_food_evidence.hash_v1(req->'target'->'digest');
    IF NOT coalesce(req->>'severity' IN ('CORRECTION','SAFETY_CRITICAL'),false) THEN RAISE EXCEPTION 'SEVERITY_INVALID' USING ERRCODE='22023'; END IF;
    SELECT * INTO rev FROM potok_food_evidence.exact_revisions_v2 x WHERE x.revision_id=review_scope.revision_id
      AND x.canonical_food_id=food_id AND x.digest=req->'target'->>'digest';
    IF NOT FOUND THEN RAISE EXCEPTION 'EXACT_TARGET_REQUIRED' USING ERRCODE='40001'; END IF;
    SELECT * INTO STRICT dossier FROM potok_food_evidence.exact_sources_v2 x WHERE x.digest=rev.source_digest;
  ELSE
    SELECT * INTO dossier FROM potok_food_evidence.exact_sources_v2 x WHERE x.digest=potok_food_evidence.hash_v1(req->'sourceProposalDigest');
    IF NOT FOUND THEN RAISE EXCEPTION 'PREPARED_SOURCE_REQUIRED' USING ERRCODE='40001'; END IF;
    food_id:=dossier.canonical_food_id;
    IF kind='REVIEW_APPROVED' AND req->'expectedHead'<>'null'::jsonb THEN
      PERFORM potok_food_evidence.exact_keys_v1(req->'expectedHead',ARRAY['revisionId','digest']);
      PERFORM potok_food_evidence.uuid_v1(req->'expectedHead'->'revisionId'); PERFORM potok_food_evidence.hash_v1(req->'expectedHead'->'digest');
    END IF;
  END IF;
  state:=dossier.food_state;
  PERFORM pg_advisory_xact_lock(hashtextextended('potok-food-evidence-v1:'||food_id::text,0));
  att:=potok_food_evidence.authority_v1();
  request_digest:=potok_food_evidence.digest_v1('potok-exact-food-nutrition-review-request-sha256-v2',req);
  raw_bytes:=convert_to(p_request_text,'UTF8'); raw_hash:=encode(extensions.digest(raw_bytes,'sha256'),'hex');
  SELECT * INTO old FROM potok_food_evidence.exact_requests_v2 x WHERE x.actor_id=actor AND x.idempotency_reference=key;
  IF FOUND THEN
    IF old.raw_request IS DISTINCT FROM raw_bytes OR old.request_digest IS DISTINCT FROM request_digest THEN
      RAISE EXCEPTION 'IDEMPOTENCY_PAYLOAD_CONFLICT' USING ERRCODE='40001'; END IF;
    RETURN old.receipt||jsonb_build_object('replayed',true);
  END IF;
  IF kind='REVIEW_APPROVED' THEN
    PERFORM potok_food_evidence.live_canonical_exact_v2(dossier.proposal->'canonical');
    IF EXISTS(SELECT 1 FROM potok_food_evidence.current_heads_v1 h WHERE h.target_kind='NUTRITION_REVIEWED_REVISION' AND h.canonical_food_id=food_id AND h.food_state=state) THEN
      RAISE EXCEPTION 'EXPLICIT_NUTRITION_VERSION_MIGRATION_REQUIRED' USING ERRCODE='40001'; END IF;
    SELECT * INTO head FROM potok_food_evidence.exact_heads_v2 h WHERE h.canonical_food_id=food_id AND h.food_state=state;
    IF req->'expectedHead' IS DISTINCT FROM (CASE WHEN head.revision_id IS NULL THEN 'null'::jsonb ELSE jsonb_build_object('revisionId',head.revision_id,'digest',head.digest) END) THEN
      RAISE EXCEPTION 'CURRENT_HEAD_CONFLICT' USING ERRCODE='40001'; END IF;
    revision_id:=gen_random_uuid();
    revision:=potok_food_evidence.artifact_v1('potok-exact-food-nutrition-revision-sha256-v2',jsonb_build_object(
      'contract','potok-exact-food-nutrition-revision-v2','encoding','potok-exact-food-nutrition-evidence-json-v2',
      'revisionId',revision_id,'supersedesRevisionId',head.revision_id,'reviewEventId',event_id,'sourceProposal',dossier.proposal));
    INSERT INTO potok_food_evidence.exact_revisions_v2 VALUES(revision_id,revision->>'digest',food_id,state,dossier.digest,head.revision_id,event_id,revision,
      convert_to(potok_food_evidence.canonical_json_v1(revision),'UTF8'));
  ELSIF kind='INVALIDATION' THEN revision:=rev.snapshot;
  END IF;
  target:=CASE WHEN kind='REVIEW_REJECTED' THEN jsonb_build_object('kind','SOURCE_BINDING_PROPOSAL_V2','digest',dossier.digest,'canonicalFoodId',food_id)
    ELSE jsonb_build_object('kind','EXACT_NUTRITION_REVISION_V2','revisionId',revision_id,'digest',revision->'digest','canonicalFoodId',food_id) END;
  att:=potok_food_evidence.authority_v1();
  event:=jsonb_build_object('contract','potok-exact-food-nutrition-review-event-v2','encoding','potok-exact-food-nutrition-evidence-json-v2',
    'kind',kind,'eventId',event_id,'occurredAt',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'timestampOrigin','SERVER',
    'authorityContext',jsonb_build_object('boundary','OWNER_ADMIN_REVIEW','actorId',actor,'role','ADMIN','authorityReference','potok-control-admin-attestation-v2:'||att::text),
    'idempotencyReference',key,'requestDigest',request_digest,'target',target);
  IF kind<>'REVIEW_APPROVED' THEN event:=event||jsonb_build_object('reason',reason); END IF;
  IF kind='INVALIDATION' THEN event:=event||jsonb_build_object('severity',req->'severity'); END IF;
  event:=potok_food_evidence.artifact_v1('potok-exact-food-nutrition-review-event-sha256-v2',event);
  INSERT INTO potok_food_evidence.exact_events_v2 VALUES(event_id,actor,key,att,dossier.digest,revision_id,kind,event->>'digest',event,
    convert_to(potok_food_evidence.canonical_json_v1(event),'UTF8'));
  IF kind='REVIEW_APPROVED' THEN
    INSERT INTO potok_food_evidence.exact_heads_v2 VALUES(food_id,state,revision_id,revision->>'digest')
      ON CONFLICT ON CONSTRAINT exact_heads_v2_pkey DO UPDATE SET revision_id=excluded.revision_id,digest=excluded.digest;
  END IF;
  receipt:=jsonb_build_object('contract','potok-exact-food-nutrition-review-receipt-v2','actorId',actor,'idempotencyReference',key,
    'requestDigest',request_digest,'rawRequestSha256',raw_hash,'eventRaw',potok_food_evidence.canonical_json_v1(event),
    'targetRaw',potok_food_evidence.canonical_json_v1(CASE WHEN kind='REVIEW_REJECTED' THEN dossier.proposal ELSE revision END),
    'sourcePinsRaw',potok_food_evidence.canonical_json_v1(dossier.pins));
  INSERT INTO potok_food_evidence.exact_requests_v2 VALUES(actor,key,request_digest,raw_bytes,raw_hash,event_id,receipt);
  RETURN receipt||jsonb_build_object('replayed',false);
END $$;

CREATE FUNCTION public.food_nutrition_receipt_v2(p_idempotency_reference uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
  PERFORM potok_food_evidence.authority_v1();
  SELECT receipt INTO result FROM potok_food_evidence.exact_requests_v2 WHERE actor_id=auth.uid() AND idempotency_reference=p_idempotency_reference;
  IF result IS NULL THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  RETURN result||jsonb_build_object('replayed',true);
END $$;

-- Event-time attestation check. A subsequent admin revocation is not retroactive evidence invalidation.
CREATE FUNCTION potok_food_evidence.event_authorized_exact_v2(event jsonb,actor uuid,att uuid,digest text,canonical_bytes bytea) RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
DECLARE occurred timestamptz:=(event->>'occurredAt')::timestamptz; latest uuid; domain text;
BEGIN
  domain:=CASE event->>'contract' WHEN 'potok-food-evidence-review-event-v1' THEN 'potok-food-evidence-review-event-sha256-v1'
    WHEN 'potok-exact-food-nutrition-review-event-v2' THEN 'potok-exact-food-nutrition-review-event-sha256-v2' ELSE NULL END;
  SELECT attestation_id INTO latest FROM potok_control.access_attestations WHERE account_id=actor AND capability='admin' AND issued_at<=occurred ORDER BY lineage_sequence DESC LIMIT 1;
  RETURN domain IS NOT NULL AND latest=att AND potok_control.is_effective_entitlement_v2(actor,'admin',occurred)
    AND event->'authorityContext'=jsonb_build_object('boundary','OWNER_ADMIN_REVIEW','actorId',actor,'role','ADMIN','authorityReference','potok-control-admin-attestation-v2:'||att::text)
    AND event->>'digest'=digest AND digest=potok_food_evidence.digest_v1(domain,event-'digest')
    AND canonical_bytes=convert_to(potok_food_evidence.canonical_json_v1(event),'UTF8');
END $$;

CREATE FUNCTION public.food_nutrition_current_v2(p_canonical_food_id uuid,p_food_state text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE head potok_food_evidence.exact_heads_v2%ROWTYPE; rev potok_food_evidence.exact_revisions_v2%ROWTYPE;
  dossier potok_food_evidence.exact_sources_v2%ROWTYPE; c jsonb; ca jsonb; na jsonb; events jsonb; authorities jsonb; snapshot jsonb;
BEGIN
  PERFORM potok_food_evidence.authority_v1();
  PERFORM potok_food_evidence.applicability_v1(jsonb_build_object('kind','EXACT_FOOD_STATE','foodState',p_food_state),p_food_state);
  PERFORM pg_advisory_xact_lock(hashtextextended('potok-food-evidence-v1:'||p_canonical_food_id::text,0));
  PERFORM potok_food_evidence.authority_v1();
  SELECT * INTO head FROM potok_food_evidence.exact_heads_v2 h WHERE h.canonical_food_id=p_canonical_food_id AND h.food_state=p_food_state;
  IF NOT FOUND THEN RETURN jsonb_build_object('kind','UNRESOLVED','foodId',p_canonical_food_id); END IF;
  SELECT * INTO STRICT rev FROM potok_food_evidence.exact_revisions_v2 WHERE revision_id=head.revision_id;
  SELECT * INTO STRICT dossier FROM potok_food_evidence.exact_sources_v2 WHERE digest=rev.source_digest;
  c:=dossier.proposal->'canonical';
  BEGIN PERFORM potok_food_evidence.live_canonical_exact_v2(c);
  EXCEPTION WHEN SQLSTATE '40001' OR SQLSTATE '42501' THEN RETURN jsonb_build_object('kind','UNRESOLVED','foodId',p_canonical_food_id); END;
  IF EXISTS(SELECT 1 FROM potok_food_evidence.exact_events_v2 WHERE target_revision_id=rev.revision_id AND kind='INVALIDATION')
    OR EXISTS(SELECT 1 FROM potok_food_evidence.current_heads_v1 WHERE target_kind='NUTRITION_REVIEWED_REVISION' AND canonical_food_id=p_canonical_food_id AND food_state=p_food_state)
    OR rev.digest<>potok_food_evidence.digest_v1('potok-exact-food-nutrition-revision-sha256-v2',rev.snapshot-'digest')
    OR rev.canonical_bytes<>convert_to(potok_food_evidence.canonical_json_v1(rev.snapshot),'UTF8')
    OR rev.snapshot->'sourceProposal' IS DISTINCT FROM dossier.proposal THEN
    RETURN jsonb_build_object('kind','UNRESOLVED','foodId',p_canonical_food_id); END IF;
  SELECT e.snapshot INTO ca FROM potok_food_evidence.review_events_v1 e WHERE e.event_id=(c->>'reviewEventId')::uuid;
  SELECT e.snapshot INTO na FROM potok_food_evidence.exact_events_v2 e WHERE e.event_id=rev.review_event_id;
  SELECT jsonb_agg(potok_food_evidence.canonical_json_v1(e.snapshot) ORDER BY e.event_id),
    jsonb_agg(jsonb_build_object('eventId',e.event_id,'digest',e.digest,'authorized',
      potok_food_evidence.event_authorized_exact_v2(e.snapshot,e.actor_id,e.authority_attestation_id,e.digest,e.canonical_bytes)) ORDER BY e.event_id)
    INTO events,authorities FROM (
      SELECT event_id,actor_id,authority_attestation_id,digest,snapshot,canonical_bytes FROM potok_food_evidence.review_events_v1
        WHERE target_kind='CANONICAL_REVIEWED_REVISION' AND target_revision_id=(c->>'revisionId')::uuid
      UNION ALL SELECT event_id,actor_id,authority_attestation_id,digest,snapshot,canonical_bytes FROM potok_food_evidence.exact_events_v2
        WHERE target_revision_id=rev.revision_id
    ) e;
  snapshot:=jsonb_build_object('requestedFoodId',p_canonical_food_id,'nutritionRaw',potok_food_evidence.canonical_json_v1(rev.snapshot),
    'sourcePinsRaw',potok_food_evidence.canonical_json_v1(dossier.pins),'canonicalApprovalRaw',potok_food_evidence.canonical_json_v1(ca),
    'nutritionApprovalRaw',potok_food_evidence.canonical_json_v1(na),'relevantEventRaws',events,'activeCanonicalRevisionId',c->'revisionId',
    'activeNutritionRevisionId',rev.revision_id,'currentFoodState',p_food_state);
  RETURN jsonb_build_object('kind','COMPLETE_TRUSTED_STORE_SNAPSHOT_V2','snapshot',snapshot,'eventAuthorizations',authorities);
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA potok_food_evidence FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.food_nutrition_review_v2(text),public.food_nutrition_receipt_v2(uuid),public.food_nutrition_current_v2(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.food_nutrition_review_v2(text),public.food_nutrition_receipt_v2(uuid),public.food_nutrition_current_v2(uuid,text) TO authenticated;
COMMIT;
