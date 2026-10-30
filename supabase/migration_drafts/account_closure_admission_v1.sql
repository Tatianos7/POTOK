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
DECLARE item record; p record; definition text; anchor_at integer; body_hash text;
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
  definition:=pg_get_functiondef(p.oid);
  anchor_at:=strpos(definition,item.anchor);
  IF anchor_at=0 OR (length(definition)-length(replace(definition,item.anchor,'')))/length(item.anchor)<>2
     OR strpos(definition,E'BEGIN\n'||item.anchor)=0 THEN
   RAISE EXCEPTION 'REVIEWED_ISSUER_ENTRY_SHAPE_REQUIRED';
  END IF;
  definition:=overlay(definition placing item.anchor||E'\n  PERFORM potok_closure.assert_active_v1();'
   FROM anchor_at FOR length(item.anchor));
  EXECUTE definition;
 END LOOP;
END $bind$;
COMMIT;
