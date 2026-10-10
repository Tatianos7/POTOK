-- DISPOSABLE ACCEPTANCE DRAFT ONLY. Persistent apply/retention/consumer rollout NOT APPROVED.
-- Install after the Food Evidence package on this implementation branch, in ONE disposable cluster.
BEGIN;
DO $preflight$
BEGIN
  IF current_user <> 'postgres' OR current_setting('potok_shared_food_eligibility.test_target',true)
    IS DISTINCT FROM 'disposable-postgresql-only' THEN
    RAISE EXCEPTION 'DISPOSABLE_ELIGIBILITY_TARGET_REQUIRED'; END IF;
  IF to_regprocedure('potok_food_evidence.authority_v1()') IS NULL
    OR to_regprocedure('potok_food_evidence.digest_v1(text,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'TRUSTED_FOOD_EVIDENCE_INFRASTRUCTURE_REQUIRED'; END IF;
  IF to_regnamespace('potok_shared_food_eligibility') IS NOT NULL THEN
    RAISE EXCEPTION 'ELIGIBILITY_ALREADY_INSTALLED'; END IF;
END $preflight$;
CREATE SCHEMA potok_shared_food_eligibility;
REVOKE ALL ON SCHEMA potok_shared_food_eligibility FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE potok_shared_food_eligibility.roots_v1 (
  food_id uuid PRIMARY KEY REFERENCES public.foods(id) ON DELETE RESTRICT,
  stable_key text NOT NULL UNIQUE CHECK(stable_key ~ '^[a-z0-9][a-z0-9_-]{0,127}$'),
  identity_epoch bigint NOT NULL CHECK(identity_epoch>=0)
);
CREATE TABLE potok_shared_food_eligibility.decisions_v1 (
  decision_id uuid PRIMARY KEY,
  food_id uuid NOT NULL REFERENCES potok_shared_food_eligibility.roots_v1(food_id) ON DELETE RESTRICT,
  version bigint NOT NULL CHECK(version>0),
  status text NOT NULL CHECK(status IN ('PENDING','ELIGIBLE','HIDDEN','BLOCKED')),
  identity_epoch bigint NOT NULL CHECK(identity_epoch>=0), fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  authority_reference uuid NOT NULL REFERENCES potok_control.access_attestations(attestation_id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL, reason text NOT NULL CHECK(length(btrim(reason))>0),
  request_digest text NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
  UNIQUE(food_id,version), UNIQUE(food_id,decision_id)
);
CREATE TABLE potok_shared_food_eligibility.heads_v1 (
  food_id uuid PRIMARY KEY REFERENCES potok_shared_food_eligibility.roots_v1(food_id) ON DELETE RESTRICT,
  decision_id uuid NOT NULL,
  FOREIGN KEY(food_id,decision_id) REFERENCES potok_shared_food_eligibility.decisions_v1(food_id,decision_id) ON DELETE RESTRICT
);
CREATE TABLE potok_shared_food_eligibility.receipts_v1 (
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  idempotency_reference uuid NOT NULL, request_digest text NOT NULL,
  decision_id uuid NOT NULL REFERENCES potok_shared_food_eligibility.decisions_v1(decision_id) ON DELETE RESTRICT,
  receipt jsonb NOT NULL, PRIMARY KEY(actor_id,idempotency_reference)
);
-- Metadata outside Phase 1 wire/digests. Prevents old evidence becoming usable after ABA/reapproval.
CREATE TABLE potok_shared_food_eligibility.evidence_bindings_v1 (
  event_id uuid PRIMARY KEY REFERENCES potok_food_evidence.review_events_v1(event_id) ON DELETE RESTRICT,
  decision_id uuid NOT NULL REFERENCES potok_shared_food_eligibility.decisions_v1(decision_id) ON DELETE RESTRICT,
  identity_epoch bigint NOT NULL CHECK(identity_epoch>=0), fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$')
);
DO $tables$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['roots_v1','decisions_v1','heads_v1','receipts_v1','evidence_bindings_v1'] LOOP
    EXECUTE format('ALTER TABLE potok_shared_food_eligibility.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE potok_shared_food_eligibility.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON potok_shared_food_eligibility.%I FROM PUBLIC,anon,authenticated,service_role',t);
    IF t IN ('decisions_v1','receipts_v1','evidence_bindings_v1') THEN
      EXECUTE format('CREATE TRIGGER immutable_v1 BEFORE UPDATE OR DELETE OR TRUNCATE ON potok_shared_food_eligibility.%I FOR EACH STATEMENT EXECUTE FUNCTION potok_food_evidence.reject_mutation_v1()',t);
    END IF;
  END LOOP;
END $tables$;

-- Includes NULL vs [] aliases and all exact identity bytes. No normalization/defaults.
CREATE FUNCTION potok_shared_food_eligibility.identity_v1(f jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
  SELECT jsonb_build_object('contract','potok-shared-food-identity-v1','encoding','canonical-json-utf8-v1',
    'foodId',f->'id','canonicalFoodId',f->'canonical_food_id','foodStableId',f->'stable_food_id',
    'source',f->'source','createdByUserId',f->'created_by_user_id','identitySnapshot',jsonb_build_object(
    'name',f->'name','nameOriginal',f->'name_original','normalizedName',f->'normalized_name',
    'brand',f->'brand','normalizedBrand',f->'normalized_brand','barcode',f->'barcode','aliases',f->'aliases'))
$$;
CREATE FUNCTION potok_shared_food_eligibility.fingerprint_v1(f jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
  SELECT potok_food_evidence.digest_v1('potok-shared-food-identity-fingerprint-sha256-v1',potok_shared_food_eligibility.identity_v1(f))
$$;
CREATE FUNCTION potok_shared_food_eligibility.counter_v1(v jsonb) RETURNS bigint
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE s text:=potok_food_evidence.text_v1(v);
BEGIN
  IF s !~ '^(0|[1-9][0-9]{0,18})$' OR s::numeric>9223372036854775807 THEN RAISE EXCEPTION 'COUNTER_INVALID' USING ERRCODE='22023'; END IF;
  RETURN s::bigint;
END $$;

-- Lock order: caller's actor gate -> root row -> stable-key gate -> registry -> evidence.
-- Trigger already holds root row; NEVER acquires actor/entitlement locks.
-- Guards only claimed keys: unrelated/private foods retain their existing behavior.
CREATE FUNCTION potok_shared_food_eligibility.catalog_mutation_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE k text; claimed uuid; original_key text;
BEGIN
  -- Repeatable snapshots can miss a claim committed while waiting for a key lock.
  -- This disposable writer constraint requires explicit C review before persistent apply.
  IF current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'READ_COMMITTED_CATALOG_WRITER_REQUIRED' USING ERRCODE='25000'; END IF;
  IF TG_OP='TRUNCATE' THEN
    RAISE EXCEPTION 'REGISTERED_IDENTITY_TRUNCATE_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  IF TG_OP='DELETE' THEN
    IF EXISTS(SELECT 1 FROM potok_shared_food_eligibility.roots_v1 r WHERE r.food_id=OLD.id) THEN
      RAISE EXCEPTION 'REGISTERED_IDENTITY_DELETE_FORBIDDEN' USING ERRCODE='42501'; END IF;
    RETURN OLD;
  END IF;
  FOR k IN SELECT DISTINCT x FROM unnest(CASE WHEN TG_OP='UPDATE' THEN ARRAY[OLD.stable_food_id,NEW.stable_food_id]
      ELSE ARRAY[NEW.stable_food_id] END) x WHERE x IS NOT NULL ORDER BY x LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('potok-shared-food-key-v1:'||k,0));
    SELECT r.food_id INTO claimed FROM potok_shared_food_eligibility.roots_v1 r WHERE r.stable_key=k;
    IF claimed IS NOT NULL AND claimed<>NEW.id AND NEW.stable_food_id=k THEN
      RAISE EXCEPTION 'STABLE_KEY_ALREADY_CLAIMED' USING ERRCODE='40001', DETAIL='POTOK_BUSINESS_CONFLICT_V1'; END IF;
  END LOOP;
  IF TG_OP='UPDATE' THEN
    SELECT r.stable_key INTO original_key FROM potok_shared_food_eligibility.roots_v1 r WHERE r.food_id=OLD.id;
    IF original_key IS NOT NULL THEN
      IF NEW.id IS DISTINCT FROM OLD.id OR NEW.stable_food_id IS DISTINCT FROM original_key THEN
        RAISE EXCEPTION 'REGISTERED_IDENTITY_KEY_IMMUTABLE' USING ERRCODE='42501'; END IF;
      IF potok_shared_food_eligibility.identity_v1(to_jsonb(OLD)) IS DISTINCT FROM potok_shared_food_eligibility.identity_v1(to_jsonb(NEW)) THEN
        UPDATE potok_shared_food_eligibility.roots_v1 SET identity_epoch=identity_epoch+1 WHERE food_id=OLD.id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER shared_food_identity_mutation_v1 BEFORE INSERT OR UPDATE OR DELETE ON public.foods
  FOR EACH ROW EXECUTE FUNCTION potok_shared_food_eligibility.catalog_mutation_v1();
CREATE TRIGGER shared_food_identity_truncate_v1 BEFORE TRUNCATE ON public.foods
  FOR EACH STATEMENT EXECUTE FUNCTION potok_shared_food_eligibility.catalog_mutation_v1();

CREATE FUNCTION potok_shared_food_eligibility.eligible_v1(f jsonb) RETURNS boolean
LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$
  SELECT coalesce((SELECT d.status='ELIGIBLE' AND d.identity_epoch=r.identity_epoch
    AND d.fingerprint=potok_shared_food_eligibility.fingerprint_v1(f)
    AND f->>'canonical_food_id'=f->>'id' AND f->>'source' IN ('core','brand')
    AND f->'created_by_user_id'='null'::jsonb AND f->>'stable_food_id'=r.stable_key
    FROM potok_shared_food_eligibility.roots_v1 r
    JOIN potok_shared_food_eligibility.heads_v1 h USING(food_id)
    JOIN potok_shared_food_eligibility.decisions_v1 d ON d.decision_id=h.decision_id
    WHERE r.food_id=(f->>'id')::uuid),false)
$$;

CREATE FUNCTION potok_shared_food_eligibility.bind_evidence_v1(p_event_id uuid,f jsonb) RETURNS void
LANGUAGE plpgsql VOLATILE SET search_path=pg_catalog AS $$
BEGIN
  IF NOT potok_shared_food_eligibility.eligible_v1(f) OR NOT EXISTS(SELECT 1 FROM potok_food_evidence.review_events_v1 e
    WHERE e.event_id=p_event_id AND e.kind='REVIEW_APPROVED' AND e.canonical_food_id=(f->>'id')::uuid) THEN
    RAISE EXCEPTION 'EXPLICIT_SHARED_FOOD_ELIGIBILITY_REQUIRED'; END IF;
  INSERT INTO potok_shared_food_eligibility.evidence_bindings_v1
    SELECT p_event_id,h.decision_id,r.identity_epoch,potok_shared_food_eligibility.fingerprint_v1(f)
    FROM potok_shared_food_eligibility.roots_v1 r JOIN potok_shared_food_eligibility.heads_v1 h USING(food_id)
    WHERE r.food_id=(f->>'id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'ELIGIBILITY_BINDING_MISSING'; END IF;
END $$;
CREATE FUNCTION potok_shared_food_eligibility.evidence_bound_v1(p_kind text,p_revision_id uuid,f jsonb) RETURNS boolean
LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$
  SELECT EXISTS(SELECT 1 FROM potok_shared_food_eligibility.evidence_bindings_v1 b
    JOIN potok_food_evidence.review_events_v1 e ON e.event_id=b.event_id
    JOIN potok_shared_food_eligibility.roots_v1 r ON r.food_id=e.canonical_food_id
    JOIN potok_shared_food_eligibility.decisions_v1 d ON d.decision_id=b.decision_id
    WHERE e.kind='REVIEW_APPROVED' AND e.target_kind=p_kind AND e.target_revision_id=p_revision_id
    AND e.canonical_food_id=(f->>'id')::uuid AND b.identity_epoch=r.identity_epoch
    AND b.fingerprint=potok_shared_food_eligibility.fingerprint_v1(f)
    AND d.food_id=r.food_id AND d.status='ELIGIBLE' AND d.identity_epoch=b.identity_epoch AND d.fingerprint=b.fingerprint)
$$;
CREATE FUNCTION public.shared_food_eligibility_decide_v1(p_request_text text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
<<decision_scope>>
DECLARE actor uuid:=auth.uid(); att uuid; v jsonb; f jsonb; food_id uuid; key text; epoch bigint; fp text;
  previous potok_shared_food_eligibility.decisions_v1%ROWTYPE; receipt jsonb; existing_digest text;
  request_digest text; decision_id uuid; version bigint; request_key uuid; next_status text;
BEGIN
  att:=potok_food_evidence.authority_v1();
  IF p_request_text IS NULL OR octet_length(p_request_text)>16384 THEN RAISE EXCEPTION 'REQUEST_SIZE_INVALID'; END IF;
  IF potok_nutrition.json_has_duplicate_keys_v1(p_request_text::json) THEN RAISE EXCEPTION 'DUPLICATE_JSON_KEY'; END IF;
  v:=p_request_text::jsonb;
  PERFORM potok_food_evidence.exact_keys_v1(v,ARRAY['contract','foodId','idempotencyReference','expectedHead','catalogIdentityEpoch','identityFingerprint','status','reason']);
  IF v->>'contract' IS DISTINCT FROM 'potok-shared-food-eligibility-request-v1' THEN RAISE EXCEPTION 'CONTRACT_INVALID'; END IF;
  food_id:=potok_food_evidence.uuid_v1(v->'foodId'); request_key:=potok_food_evidence.uuid_v1(v->'idempotencyReference');
  PERFORM potok_shared_food_eligibility.counter_v1(v->'catalogIdentityEpoch');
  PERFORM potok_food_evidence.hash_v1(v->'identityFingerprint'); PERFORM potok_food_evidence.text_v1(v->'reason');
  next_status:=potok_food_evidence.text_v1(v->'status');
  IF next_status NOT IN ('PENDING','ELIGIBLE','HIDDEN','BLOCKED') THEN RAISE EXCEPTION 'STATUS_NOT_IMPLEMENTED'; END IF;
  IF v->'expectedHead'<>'null'::jsonb THEN
    PERFORM potok_food_evidence.exact_keys_v1(v->'expectedHead',ARRAY['decisionId','version']);
    PERFORM potok_food_evidence.uuid_v1(v->'expectedHead'->'decisionId');
    PERFORM potok_shared_food_eligibility.counter_v1(v->'expectedHead'->'version');
  END IF;
  request_digest:=potok_food_evidence.digest_v1('potok-shared-food-eligibility-request-sha256-v1',v);
  SELECT r.receipt,r.request_digest INTO receipt,existing_digest FROM potok_shared_food_eligibility.receipts_v1 r
    WHERE r.actor_id=actor AND r.idempotency_reference=request_key;
  IF FOUND THEN
    IF existing_digest<>request_digest THEN RAISE EXCEPTION 'IDEMPOTENCY_CONTENT_CONFLICT' USING ERRCODE='40001', DETAIL='POTOK_BUSINESS_CONFLICT_V1'; END IF;
    PERFORM potok_food_evidence.authority_v1(); RETURN receipt||jsonb_build_object('replayed',true);
  END IF;
  PERFORM potok_food_evidence.catalog_gate_v1();
  SELECT to_jsonb(x) INTO f FROM public.foods x WHERE x.id=decision_scope.food_id FOR UPDATE;
  -- Recheck BEFORE further semantics, so expired/revoked callers cannot write after waiting.
  att:=potok_food_evidence.authority_v1();
  IF f IS NULL OR f->>'canonical_food_id' IS DISTINCT FROM food_id::text OR f->>'source' NOT IN ('core','brand')
    OR f->'created_by_user_id' IS DISTINCT FROM 'null'::jsonb OR coalesce(f->>'stable_food_id','') !~ '^[a-z0-9][a-z0-9_-]{0,127}$' THEN
    RAISE EXCEPTION 'SHARED_CANONICAL_ROOT_REQUIRED'; END IF;
  key:=f->>'stable_food_id';
  PERFORM pg_advisory_xact_lock(hashtextextended('potok-shared-food-key-v1:'||key,0));
  -- A new writer of the same key must pass this same gate in the mutation trigger.
  IF (SELECT count(*) FROM public.foods x WHERE x.stable_food_id=key)<>1 THEN RAISE EXCEPTION 'DUPLICATE_STABLE_KEY'; END IF;
  SELECT r.identity_epoch INTO epoch FROM potok_shared_food_eligibility.roots_v1 r WHERE r.food_id=decision_scope.food_id FOR UPDATE;
  IF NOT FOUND THEN
    IF next_status<>'PENDING' OR v->'expectedHead'<>'null'::jsonb THEN RAISE EXCEPTION 'EXPLICIT_PENDING_REQUIRED'; END IF;
    epoch:=0;
    INSERT INTO potok_shared_food_eligibility.roots_v1 VALUES(food_id,key,epoch);
  END IF;
  fp:=potok_shared_food_eligibility.fingerprint_v1(f);
  IF epoch<>potok_shared_food_eligibility.counter_v1(v->'catalogIdentityEpoch') OR fp<>v->>'identityFingerprint' THEN
    RAISE EXCEPTION 'IDENTITY_BINDING_CONFLICT' USING ERRCODE='40001', DETAIL='POTOK_BUSINESS_CONFLICT_V1'; END IF;
  SELECT d.* INTO previous FROM potok_shared_food_eligibility.heads_v1 h
    JOIN potok_shared_food_eligibility.decisions_v1 d ON d.decision_id=h.decision_id WHERE h.food_id=decision_scope.food_id FOR UPDATE OF h;
  IF FOUND THEN
    IF v->'expectedHead'='null'::jsonb OR previous.decision_id<>potok_food_evidence.uuid_v1(v->'expectedHead'->'decisionId')
      OR previous.version<>potok_shared_food_eligibility.counter_v1(v->'expectedHead'->'version') THEN
      RAISE EXCEPTION 'DECISION_HEAD_CONFLICT' USING ERRCODE='40001', DETAIL='POTOK_BUSINESS_CONFLICT_V1'; END IF;
    IF previous.status='BLOCKED' THEN RAISE EXCEPTION 'BLOCKED_CLEARANCE_NOT_APPROVED'; END IF;
    IF NOT ((previous.status='PENDING' AND next_status IN ('ELIGIBLE','HIDDEN','BLOCKED'))
      OR (previous.status='ELIGIBLE' AND next_status IN ('HIDDEN','BLOCKED'))
      OR (previous.status='HIDDEN' AND next_status IN ('ELIGIBLE','BLOCKED'))) THEN
      RAISE EXCEPTION 'TRANSITION_NOT_APPROVED'; END IF;
    version:=previous.version+1;
  ELSE version:=1; END IF;
  att:=potok_food_evidence.authority_v1();
  decision_id:=gen_random_uuid();
  INSERT INTO potok_shared_food_eligibility.decisions_v1 VALUES(decision_id,food_id,version,next_status,epoch,fp,actor,att,clock_timestamp(),v->>'reason',request_digest);
  INSERT INTO potok_shared_food_eligibility.heads_v1 VALUES(food_id,decision_id)
    ON CONFLICT ON CONSTRAINT heads_v1_pkey DO UPDATE SET decision_id=excluded.decision_id;
  receipt:=jsonb_build_object('contract','potok-shared-food-eligibility-receipt-v1','decisionId',decision_id,'version',version::text,
    'foodId',food_id,'status',next_status,'catalogIdentityEpoch',epoch::text,'identityFingerprint',fp,'requestDigest',request_digest,'replayed',false);
  INSERT INTO potok_shared_food_eligibility.receipts_v1 VALUES(actor,request_key,request_digest,decision_id,receipt);
  RETURN receipt;
END $$;
CREATE FUNCTION public.shared_food_eligibility_current_v1(p_food_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE f jsonb; result jsonb;
BEGIN
  PERFORM potok_food_evidence.authority_v1();
  PERFORM potok_food_evidence.catalog_gate_v1();
  SELECT to_jsonb(x) INTO f FROM public.foods x WHERE x.id=p_food_id FOR UPDATE;
  PERFORM potok_food_evidence.authority_v1();
  IF f IS NULL THEN RAISE EXCEPTION 'FOOD_NOT_FOUND'; END IF;
  SELECT jsonb_build_object('decisionId',d.decision_id,'version',d.version::text,'status',d.status)
    INTO result FROM potok_shared_food_eligibility.heads_v1 h
    JOIN potok_shared_food_eligibility.decisions_v1 d ON d.decision_id=h.decision_id WHERE h.food_id=p_food_id;
  RETURN jsonb_build_object('contract','potok-shared-food-eligibility-current-v1','foodId',p_food_id,'head',result,
    'catalogIdentityEpoch',coalesce((SELECT r.identity_epoch::text FROM potok_shared_food_eligibility.roots_v1 r WHERE r.food_id=p_food_id),'0'),
    'identityFingerprint',potok_shared_food_eligibility.fingerprint_v1(f),'eligible',potok_shared_food_eligibility.eligible_v1(f));
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA potok_shared_food_eligibility FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.shared_food_eligibility_decide_v1(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.shared_food_eligibility_decide_v1(text) TO authenticated;
REVOKE ALL ON FUNCTION public.shared_food_eligibility_current_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.shared_food_eligibility_current_v1(uuid) TO authenticated;
COMMIT;
