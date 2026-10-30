-- INACTIVE REVIEW DRAFT. No live Auth trigger, backfill or rollout is authorized.
BEGIN;
DO $preflight$
DECLARE actual text;
BEGIN
 IF current_setting('potok_closure.registration_rollout_target',true) IS DISTINCT FROM 'staging:ozidryfvhkcbtpnulakq' THEN
  RAISE EXCEPTION 'EXPLICIT_REGISTRATION_STAGING_TARGET_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF to_regprocedure('potok_closure.assert_active_v1()') IS NULL OR
    to_regclass('potok_closure.registration_records_v1') IS NOT NULL THEN
  RAISE EXCEPTION 'REVIEWED_CLOSURE_REGISTRATION_PREREQUISITES_REQUIRED';
 END IF;
 IF (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='potok_closure.accounts_v1'::regclass)<>current_user
    OR (SELECT encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex') FROM pg_proc
     WHERE oid='potok_closure.assert_active_v1()'::regprocedure)<>'d507cbc127b622a30cb37656f2133aaa7ba5cd23f71a4ac378ca36bd81f30f1a'
    OR (SELECT encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex') FROM pg_proc
     WHERE oid='public.account_closure_begin_v1(text)'::regprocedure)<>'d9ed2493052141906319877b7fb5361890e0de7a65325a45a46e0c61c0c87997' THEN
  RAISE EXCEPTION 'REVIEWED_ACCOUNT_ADMISSION_DEFINITION_REQUIRED';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='auth.users'::regclass
  AND attname='created_at' AND atttypid='timestamptz'::regtype AND NOT attisdropped) THEN
  RAISE EXCEPTION 'AUTH_CREATION_BINDING_REQUIRED';
 END IF;
 SELECT encode(extensions.digest(convert_to(coalesce(string_agg(pg_get_triggerdef(t.oid)||':'||t.tgenabled||':'||pg_get_userbyid(p.proowner)||':'||p.prosecdef::text||':'||coalesce(array_to_string(p.proconfig,','),'')||':'||
  encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex'),E'\n' ORDER BY t.tgname),''),'UTF8'),'sha256'),'hex')
 INTO actual FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
 WHERE t.tgrelid='auth.users'::regclass AND NOT t.tgisinternal;
 IF current_setting('potok_closure.reviewed_auth_triggers_sha256',true) IS DISTINCT FROM actual THEN
  RAISE EXCEPTION 'REVIEWED_AUTH_TRIGGER_INVENTORY_REQUIRED' USING ERRCODE='42501';
 END IF;
END $preflight$;

CREATE TABLE potok_closure.registration_permits_v1(
 permit_id uuid PRIMARY KEY,
 account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 expected_created_at timestamptz NOT NULL CHECK(isfinite(expected_created_at)),
 reviewed_source_sha256 text NOT NULL CHECK(reviewed_source_sha256 ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz NOT NULL CHECK(isfinite(expires_at))
);
CREATE TABLE potok_closure.registration_records_v1(
 account_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
 origin text NOT NULL CHECK(origin IN ('NEW_AUTH_INSERT','REVIEWED_EXISTING')),
 auth_created_at timestamptz NOT NULL CHECK(isfinite(auth_created_at)),
 permit_id uuid UNIQUE REFERENCES potok_closure.registration_permits_v1(permit_id) ON DELETE RESTRICT,
 CHECK((origin='NEW_AUTH_INSERT' AND permit_id IS NULL) OR (origin='REVIEWED_EXISTING' AND permit_id IS NOT NULL))
);
ALTER TABLE potok_closure.registration_permits_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_closure.registration_permits_v1 FORCE ROW LEVEL SECURITY;
ALTER TABLE potok_closure.registration_records_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_closure.registration_records_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON potok_closure.registration_permits_v1,potok_closure.registration_records_v1 FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY registration_permit_owner_v1 ON potok_closure.registration_permits_v1
 FOR ALL TO CURRENT_USER USING(true) WITH CHECK(true);
CREATE POLICY registration_record_owner_v1 ON potok_closure.registration_records_v1
 FOR ALL TO CURRENT_USER USING(true) WITH CHECK(true);

CREATE FUNCTION potok_closure.reject_registration_mutation_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_ACCOUNT_REGISTRATION'; END $$;
CREATE TRIGGER immutable_registration_permit_v1 BEFORE UPDATE OR DELETE OR TRUNCATE ON potok_closure.registration_permits_v1
 FOR EACH STATEMENT EXECUTE FUNCTION potok_closure.reject_registration_mutation_v1();
CREATE TRIGGER immutable_registration_record_v1 BEFORE UPDATE OR DELETE OR TRUNCATE ON potok_closure.registration_records_v1
 FOR EACH STATEMENT EXECUTE FUNCTION potok_closure.reject_registration_mutation_v1();

-- Called only by the Auth-table INSERT event. No JWT/profile/metadata field can call it.
CREATE FUNCTION potok_closure.register_new_auth_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_TABLE_SCHEMA<>'auth' OR TG_TABLE_NAME<>'users' OR TG_OP<>'INSERT' THEN
  RAISE EXCEPTION 'AUTH_INSERT_EVENT_REQUIRED';
 END IF;
 IF NEW.is_anonymous IS DISTINCT FROM false THEN RETURN NEW; END IF;
 IF NEW.created_at IS NULL THEN RAISE EXCEPTION 'AUTH_CREATION_BINDING_REQUIRED'; END IF;
 -- A genuinely new Auth row has no committed live session/reviewer yet.
 -- Do not invert the existing-account entitlement -> Auth-row lock order here.
 PERFORM pg_advisory_xact_lock(hashtextextended('potok-closure-v1:'||NEW.id::text,0));
 INSERT INTO potok_closure.registration_records_v1 VALUES(NEW.id,'NEW_AUTH_INSERT',NEW.created_at,NULL);
 INSERT INTO potok_closure.accounts_v1(account_id,state) VALUES(NEW.id,'ACTIVE');
 RETURN NEW;
END $$;

-- SQL-owner operational boundary only. No public RPC or client EXECUTE grant.
-- Permit contents must come from an independent reviewed lifecycle manifest.
-- Existence in Auth, email, profile flags or user_metadata never supply that approval.
CREATE FUNCTION potok_closure.register_reviewed_existing_v1(p_permit uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE permit potok_closure.registration_permits_v1%ROWTYPE;
 registration potok_closure.registration_records_v1%ROWTYPE;
 state_row potok_closure.accounts_v1%ROWTYPE;
 created timestamptz; anonymous_user boolean;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN
  RAISE EXCEPTION 'READ_COMMITTED_TRANSACTION_REQUIRED' USING ERRCODE='25000';
 END IF;
 SELECT * INTO permit FROM potok_closure.registration_permits_v1 WHERE permit_id=p_permit;
 IF NOT FOUND THEN RAISE EXCEPTION 'REVIEWED_REGISTRATION_PERMIT_REQUIRED' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('potok-entitlement-v2:'||permit.account_id::text||':admin',0));
 SELECT created_at,is_anonymous INTO created,anonymous_user FROM auth.users WHERE id=permit.account_id FOR SHARE;
 IF NOT FOUND OR created IS DISTINCT FROM permit.expected_created_at OR anonymous_user IS DISTINCT FROM false THEN
  RAISE EXCEPTION 'REGISTRATION_AUTH_BINDING_MISMATCH' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('potok-closure-v1:'||permit.account_id::text,0));
 SELECT * INTO state_row FROM potok_closure.accounts_v1 WHERE account_id=permit.account_id FOR UPDATE;
 IF FOUND AND state_row.state<>'ACTIVE' THEN RAISE EXCEPTION 'ACCOUNT_NOT_ACTIVE' USING ERRCODE='42501'; END IF;
 SELECT * INTO registration FROM potok_closure.registration_records_v1 WHERE account_id=permit.account_id;
 IF permit.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'REGISTRATION_PERMIT_EXPIRED' USING ERRCODE='42501'; END IF;
 IF registration.account_id IS NOT NULL THEN
  IF registration.origin<>'REVIEWED_EXISTING' OR registration.permit_id IS DISTINCT FROM p_permit OR state_row.account_id IS NULL THEN
   RAISE EXCEPTION 'REGISTRATION_CONFLICT' USING ERRCODE='PT409';
  END IF;
 ELSE
  IF state_row.account_id IS NOT NULL THEN RAISE EXCEPTION 'EXISTING_STATE_REVIEW_REQUIRED' USING ERRCODE='42501'; END IF;
  INSERT INTO potok_closure.registration_records_v1 VALUES(permit.account_id,'REVIEWED_EXISTING',created,p_permit);
  INSERT INTO potok_closure.accounts_v1(account_id,state) VALUES(permit.account_id,'ACTIVE') RETURNING * INTO state_row;
 END IF;
 RETURN jsonb_build_object('contract','potok-account-registration-receipt-v1','accountId',permit.account_id,
  'permitId',p_permit,'state',state_row.state,'revision',state_row.revision::text);
END $$;

CREATE FUNCTION potok_closure.registration_commit_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE permit potok_closure.registration_permits_v1%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM potok_closure.accounts_v1 WHERE account_id=NEW.account_id) THEN
  RAISE EXCEPTION 'REGISTRATION_STATE_BINDING_REQUIRED';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=NEW.account_id AND created_at=NEW.auth_created_at AND is_anonymous IS false) THEN
  RAISE EXCEPTION 'REGISTRATION_AUTH_BINDING_MISMATCH' USING ERRCODE='42501';
 END IF;
 IF NEW.origin='REVIEWED_EXISTING' THEN
  SELECT * INTO STRICT permit FROM potok_closure.registration_permits_v1 WHERE permit_id=NEW.permit_id;
  IF permit.account_id<>NEW.account_id OR permit.expected_created_at IS DISTINCT FROM NEW.auth_created_at
     OR permit.expires_at<=clock_timestamp() THEN
   RAISE EXCEPTION 'REGISTRATION_PERMIT_EXPIRED_OR_CHANGED' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER registration_commit_v1 AFTER INSERT ON potok_closure.registration_records_v1
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION potok_closure.registration_commit_v1();
REVOKE ALL ON FUNCTION potok_closure.register_new_auth_v1(),potok_closure.register_reviewed_existing_v1(uuid),
 potok_closure.registration_commit_v1(),potok_closure.reject_registration_mutation_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER potok_closure_register_new_auth_v1 AFTER INSERT ON auth.users
 FOR EACH ROW EXECUTE FUNCTION potok_closure.register_new_auth_v1();
-- No INSERT SELECT backfill, real permit creation, Auth UPDATE/DELETE or new client grants.
COMMIT;
