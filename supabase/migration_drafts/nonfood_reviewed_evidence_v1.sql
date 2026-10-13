-- DISPOSABLE ONLY. NOT APPLIED. No persistent target is supported by this package.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
   OR current_setting('potok_nonfood.test_target',true) IS DISTINCT FROM 'disposable-postgresql-only'
   OR to_regprocedure('potok_food_evidence.authority_v1()') IS NULL
   OR to_regprocedure('potok_food_evidence.source_v1(jsonb,text,jsonb)') IS NULL
   OR to_regnamespace('potok_nonfood') IS NOT NULL THEN RAISE EXCEPTION 'NONFOOD_DISPOSABLE_PREFLIGHT_REQUIRED'; END IF;
END $$;
CREATE SCHEMA potok_nonfood;
REVOKE ALL ON SCHEMA potok_nonfood FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA potok_nonfood REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA potok_nonfood REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE potok_nonfood.roots_v1(definition_id uuid PRIMARY KEY,stable_key text UNIQUE NOT NULL);
CREATE TABLE potok_nonfood.sources_v1(source_id uuid PRIMARY KEY,snapshot jsonb NOT NULL,bytes bytea NOT NULL,
 CHECK(octet_length(bytes)=(snapshot->>'byteLength')::integer),
 CHECK(encode(extensions.digest(bytes,'sha256'),'hex')=snapshot->>'sourceBytesSha256'));
CREATE TABLE potok_nonfood.events_v1(event_id uuid PRIMARY KEY,actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 authority_id uuid NOT NULL,request_key uuid NOT NULL,definition_id uuid REFERENCES potok_nonfood.roots_v1 ON DELETE RESTRICT,
 source_id uuid NOT NULL REFERENCES potok_nonfood.sources_v1 ON DELETE RESTRICT,
 snapshot jsonb NOT NULL,bytes bytea NOT NULL,UNIQUE(actor_id,request_key),
 FOREIGN KEY(actor_id,authority_id) REFERENCES potok_control.access_attestations(account_id,attestation_id) ON DELETE RESTRICT);
CREATE TABLE potok_nonfood.definitions_v1(revision_id uuid PRIMARY KEY,definition_id uuid NOT NULL REFERENCES potok_nonfood.roots_v1 ON DELETE RESTRICT,
 digest text NOT NULL,supersedes uuid REFERENCES potok_nonfood.definitions_v1 ON DELETE RESTRICT,
 event_id uuid NOT NULL UNIQUE REFERENCES potok_nonfood.events_v1 ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
 snapshot jsonb NOT NULL,bytes bytea NOT NULL,UNIQUE(definition_id,revision_id,digest));
CREATE TABLE potok_nonfood.nutrition_v1(revision_id uuid PRIMARY KEY,definition_id uuid NOT NULL REFERENCES potok_nonfood.roots_v1 ON DELETE RESTRICT,
 definition_revision uuid NOT NULL,definition_digest text NOT NULL,digest text NOT NULL,
 supersedes uuid REFERENCES potok_nonfood.nutrition_v1 ON DELETE RESTRICT,
 event_id uuid NOT NULL UNIQUE REFERENCES potok_nonfood.events_v1 ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
 snapshot jsonb NOT NULL,bytes bytea NOT NULL,UNIQUE(definition_id,revision_id,digest),
 FOREIGN KEY(definition_id,definition_revision,definition_digest) REFERENCES potok_nonfood.definitions_v1(definition_id,revision_id,digest) ON DELETE RESTRICT);
CREATE TABLE potok_nonfood.heads_v1(definition_id uuid NOT NULL REFERENCES potok_nonfood.roots_v1 ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('DEFINITION','NUTRITION')),revision_id uuid NOT NULL,digest text NOT NULL,
 PRIMARY KEY(definition_id,kind));
CREATE TABLE potok_nonfood.receipts_v1(actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 request_key uuid NOT NULL,request_digest text NOT NULL,raw_bytes bytea NOT NULL,
 event_id uuid NOT NULL UNIQUE REFERENCES potok_nonfood.events_v1 ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
 receipt jsonb NOT NULL,PRIMARY KEY(actor_id,request_key));
ALTER TABLE potok_nonfood.events_v1 ADD FOREIGN KEY(actor_id,request_key)
 REFERENCES potok_nonfood.receipts_v1(actor_id,request_key) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['roots_v1','sources_v1','events_v1','definitions_v1','nutrition_v1','heads_v1','receipts_v1'] LOOP
 EXECUTE format('ALTER TABLE potok_nonfood.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE potok_nonfood.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON potok_nonfood.%I FROM PUBLIC,anon,authenticated,service_role',t);
 IF t<>'heads_v1' THEN EXECUTE format('CREATE TRIGGER immutable_v1 BEFORE UPDATE OR DELETE OR TRUNCATE ON potok_nonfood.%I FOR EACH STATEMENT EXECUTE FUNCTION potok_food_evidence.reject_mutation_v1()',t); END IF;
 END LOOP;
END $$;
-- Deferred event guard performs the SAME trusted authority at actual transaction commit.
CREATE FUNCTION potok_nonfood.commit_authority_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF auth.uid() IS DISTINCT FROM NEW.actor_id OR potok_food_evidence.authority_v1() IS DISTINCT FROM NEW.authority_id THEN
  RAISE EXCEPTION 'COMMIT_AUTHORITY_CHANGED' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER commit_authority_v1 AFTER INSERT ON potok_nonfood.events_v1
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION potok_nonfood.commit_authority_v1();
CREATE FUNCTION potok_nonfood.proposal_v1(p jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE k text;f text; s jsonb; n jsonb; a jsonb; e jsonb; last text; expected numeric;
BEGIN
 k:=potok_food_evidence.text_v1(p->'kind');
 a:=p->'applicability'; PERFORM potok_food_evidence.applicability_v1(a,a->>'foodState');
 IF k='DEFINITION' THEN
  PERFORM potok_food_evidence.exact_keys_v1(p,ARRAY['kind','definitionId','stableKey','displayName','applicability','exclusions']);
  IF p->'definitionId'<>'null'::jsonb THEN PERFORM potok_food_evidence.uuid_v1(p->'definitionId'); END IF;
  IF potok_food_evidence.text_v1(p->'stableKey') !~ '^[a-z0-9][a-z0-9_-]{0,127}$' THEN RAISE EXCEPTION 'STABLE_KEY_INVALID'; END IF;
  PERFORM potok_food_evidence.text_v1(p->'displayName');
  IF jsonb_typeof(p->'exclusions') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'EXCLUSIONS_REQUIRED'; END IF;
  FOR e IN SELECT value FROM jsonb_array_elements(p->'exclusions') LOOP
   f:=potok_food_evidence.text_v1(e); IF f !~ '^[a-z0-9][a-z0-9_-]{0,127}$' THEN RAISE EXCEPTION 'EXCLUSION_KEY_INVALID'; END IF; IF last IS NOT NULL AND last COLLATE "C">=f COLLATE "C" THEN RAISE EXCEPTION 'SORTED_UNIQUE_EXCLUSIONS_REQUIRED'; END IF; last:=f;
  END LOOP;
 ELSIF k='NUTRITION' THEN
  PERFORM potok_food_evidence.exact_keys_v1(p,ARRAY['kind','definitionId','definitionRevisionId','definitionRevisionDigest','applicability','basis','units','sourceValues','nutrition','carbohydrateSemantics','mappingPolicyVersion']);
  PERFORM potok_food_evidence.uuid_v1(p->'definitionId');PERFORM potok_food_evidence.uuid_v1(p->'definitionRevisionId');PERFORM potok_food_evidence.hash_v1(p->'definitionRevisionDigest');
  IF p->>'basis' IS DISTINCT FROM 'PER_100_G_EDIBLE' THEN RAISE EXCEPTION 'BASIS_REQUIRED'; END IF;
  s:=p->'sourceValues';n:=p->'nutrition';
  PERFORM potok_food_evidence.exact_keys_v1(s,ARRAY['calories','protein','fat','carbs','fiber']);
  PERFORM potok_food_evidence.exact_keys_v1(n,ARRAY['calories','protein','fat','carbs','fiber']);
  PERFORM potok_food_evidence.exact_keys_v1(p->'units',ARRAY['calories','protein','fat','carbs','fiber']);
  FOREACH f IN ARRAY ARRAY['calories','protein','fat','carbs','fiber'] LOOP
   IF potok_food_evidence.text_v1(s->f) !~ '^(0|[1-9][0-9]{0,8})\.[0-9]{3}$'
    OR potok_food_evidence.text_v1(n->f) !~ '^(0|[1-9][0-9]{0,8})\.[0-9]{3}$'
    OR p->'units'->>f IS DISTINCT FROM (CASE WHEN f='calories' THEN 'kcal' ELSE 'g' END) THEN RAISE EXCEPTION 'EXPLICIT_NUMERIC_OR_UNIT_REQUIRED'; END IF;
   IF (n->>f)::numeric<>0 OR (f<>'carbs' AND s->f IS DISTINCT FROM n->f) THEN RAISE EXCEPTION 'NON_NUTRITIVE_BINDING_REQUIRED'; END IF;
  END LOOP;
  IF p->>'carbohydrateSemantics'='TOTAL_INCLUDING_FIBER' AND p->>'mappingPolicyVersion'='potok-source-total-including-fiber-to-available-v1' THEN expected:=(s->>'carbs')::numeric-(s->>'fiber')::numeric;
  ELSIF p->>'carbohydrateSemantics'='AVAILABLE_EXCLUDING_FIBER' AND p->>'mappingPolicyVersion'='potok-source-available-direct-v1' THEN expected:=(s->>'carbs')::numeric;
  ELSE RAISE EXCEPTION 'MAPPING_POLICY_REQUIRED'; END IF;
  IF expected<0 OR expected<>(n->>'carbs')::numeric THEN RAISE EXCEPTION 'MAPPING_MISMATCH'; END IF;
 ELSE RAISE EXCEPTION 'PROPOSAL_KIND_INVALID'; END IF;
 RETURN k;
END $$;
CREATE FUNCTION potok_nonfood.heads_json_v1(d uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('definition',(SELECT jsonb_build_object('revisionId',revision_id,'digest',digest) FROM potok_nonfood.heads_v1 WHERE definition_id=d AND kind='DEFINITION'),
 'nutrition',(SELECT jsonb_build_object('revisionId',revision_id,'digest',digest) FROM potok_nonfood.heads_v1 WHERE definition_id=d AND kind='NUTRITION'))
$$;
CREATE FUNCTION potok_nonfood.revision_v1(k text,d uuid,r uuid,h text) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
DECLARE v jsonb; b bytea;
BEGIN
 IF k='DEFINITION' THEN SELECT snapshot,bytes INTO v,b FROM potok_nonfood.definitions_v1 WHERE definition_id=d AND revision_id=r AND digest=h;
 ELSIF k='NUTRITION' THEN SELECT snapshot,bytes INTO v,b FROM potok_nonfood.nutrition_v1 WHERE definition_id=d AND revision_id=r AND digest=h;
 ELSE RAISE EXCEPTION 'TARGET_KIND_INVALID'; END IF;
 IF v IS NULL THEN RAISE EXCEPTION 'EXACT_TARGET_REQUIRED' USING ERRCODE='PT409',DETAIL='POTOK_BUSINESS_CONFLICT_V1'; END IF;
 IF convert_to(potok_food_evidence.canonical_json_v1(v),'UTF8')<>b OR potok_food_evidence.digest_v1('potok-nonfood-revision-sha256-v1',v-'digest')<>h THEN
 RAISE EXCEPTION 'REVISION_INTEGRITY_FAILURE' USING ERRCODE='PT500',DETAIL='POTOK_INVARIANT_FAILURE_V1'; END IF;
 RETURN v;
END $$;
CREATE FUNCTION potok_nonfood.invalidated_v1(k text,r uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM potok_nonfood.events_v1 WHERE snapshot->>'kind'='INVALIDATION' AND snapshot->'target'->>'kind'=k AND snapshot->'target'->>'revisionId'=r::text)
$$;
CREATE FUNCTION public.nonfood_evidence_review_v1(p_request_text text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid();att uuid;v jsonb;p jsonb;s jsonb;source_bytes bytea;key uuid;rd text;old potok_nonfood.receipts_v1%ROWTYPE;
 k text;d uuid;rev jsonb;def jsonb;head jsonb;prev uuid;rid uuid;eid uuid;ev jsonb;receipt jsonb;target jsonb;action text;
BEGIN
 att:=potok_food_evidence.authority_v1();
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
 ev:=potok_food_evidence.artifact_v1('potok-nonfood-event-sha256-v1',jsonb_build_object('contract','potok-nonfood-review-event-v1','eventId',eid,'actorId',actor,
  'authorityReference','potok-control-admin-attestation-v2:'||att::text,'occurredAt',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'kind',action,'requestDigest',rd,'target',target,'retainedSource',s,'reason',v->'reason','severity',CASE WHEN action='INVALIDATION' THEN v->'severity' ELSE 'null'::jsonb END));
 INSERT INTO potok_nonfood.events_v1 VALUES(eid,actor,att,key,d,(s->>'sourceArtifactId')::uuid,ev,convert_to(potok_food_evidence.canonical_json_v1(ev),'UTF8'));
 IF action='REVIEW_APPROVED' THEN INSERT INTO potok_nonfood.heads_v1 VALUES(d,k,rid,rev->>'digest') ON CONFLICT(definition_id,kind) DO UPDATE SET revision_id=excluded.revision_id,digest=excluded.digest; END IF;
 IF action='INVALIDATION' AND k='NUTRITION' THEN def:=potok_nonfood.revision_v1('DEFINITION',d,(p->>'definitionRevisionId')::uuid,p->>'definitionRevisionDigest'); END IF;
 receipt:=jsonb_build_object('contract','potok-nonfood-receipt-v1','actorId',actor,'idempotencyReference',key,'requestDigest',rd,
  'rawRequestSha256',encode(extensions.digest(convert_to(p_request_text,'UTF8'),'sha256'),'hex'),'event',ev,'revision',rev,'definitionRevision',def,'heads',potok_nonfood.heads_json_v1(d));
 INSERT INTO potok_nonfood.receipts_v1 VALUES(actor,key,rd,convert_to(p_request_text,'UTF8'),eid,receipt);
 -- Last statement before return/outer COMMIT: real authority recheck; failure rolls EVERYTHING back.
 PERFORM potok_food_evidence.authority_v1();RETURN receipt||jsonb_build_object('replayed',false);
END $$;
CREATE FUNCTION public.nonfood_evidence_receipt_v1(p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v jsonb;BEGIN PERFORM potok_food_evidence.authority_v1();SELECT receipt INTO v FROM potok_nonfood.receipts_v1 WHERE actor_id=auth.uid() AND request_key=p_key;
 IF v IS NULL THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND' USING ERRCODE='P0002'; END IF;PERFORM potok_food_evidence.authority_v1();RETURN v||jsonb_build_object('replayed',true);END $$;
CREATE FUNCTION public.nonfood_evidence_current_v1(p_definition_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE h record;d jsonb;n jsonb;du boolean:=false;nu boolean:=false;events jsonb;BEGIN
 PERFORM potok_food_evidence.authority_v1();PERFORM pg_advisory_xact_lock(hashtextextended('potok-nonfood-v1:catalog',0));PERFORM potok_food_evidence.authority_v1();
 IF NOT EXISTS(SELECT 1 FROM potok_nonfood.roots_v1 WHERE definition_id=p_definition_id) THEN RAISE EXCEPTION 'DEFINITION_NOT_FOUND'; END IF;
 FOR h IN SELECT * FROM potok_nonfood.heads_v1 WHERE definition_id=p_definition_id ORDER BY kind LOOP
  IF h.kind='DEFINITION' THEN d:=potok_nonfood.revision_v1(h.kind,p_definition_id,h.revision_id,h.digest);du:=NOT potok_nonfood.invalidated_v1(h.kind,h.revision_id);
  ELSE n:=potok_nonfood.revision_v1(h.kind,p_definition_id,h.revision_id,h.digest);nu:=NOT potok_nonfood.invalidated_v1(h.kind,h.revision_id); END IF;
 END LOOP;
 nu:=du AND nu AND n->'proposal'->>'definitionRevisionId'=d->>'revisionId' AND n->'proposal'->>'definitionRevisionDigest'=d->>'digest'
  AND n->'proposal'->'applicability'=d->'proposal'->'applicability';
 SELECT coalesce(jsonb_agg(snapshot ORDER BY event_id),'[]'::jsonb) INTO events FROM potok_nonfood.events_v1 WHERE definition_id=p_definition_id;
 PERFORM potok_food_evidence.authority_v1();
 RETURN jsonb_build_object('contract','potok-nonfood-current-v1','definitionRevision',d,'nutritionRevision',n,'heads',potok_nonfood.heads_json_v1(p_definition_id),
 'definitionUsable',du,'nutritionUsable',coalesce(nu,false),'events',events);
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA potok_nonfood FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.nonfood_evidence_review_v1(text),public.nonfood_evidence_receipt_v1(uuid),public.nonfood_evidence_current_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.nonfood_evidence_review_v1(text),public.nonfood_evidence_receipt_v1(uuid),public.nonfood_evidence_current_v1(uuid) TO authenticated;
COMMIT;
