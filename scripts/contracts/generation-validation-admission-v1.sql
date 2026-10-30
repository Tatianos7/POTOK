-- DISPOSABLE ONLY. Database role/receipt admission, not runtime deployment.
DO $guard$
DECLARE expected record;
BEGIN
 IF current_database()<>'potok_generation_store_disposable'
  OR current_setting('potok.disposable_generation_store',true) IS DISTINCT FROM 'on'
  OR session_user<>'postgres' OR current_user<>'postgres' THEN
  RAISE EXCEPTION 'DISPOSABLE_GENERATION_ADMISSION_REQUIRED' USING ERRCODE='42501';
 END IF;
 FOR expected IN SELECT * FROM (VALUES
  ('potok_control.is_effective_entitlement_v2(uuid,text,timestamptz)','afd14b981eeade127134246a7d69671d',true,'s'),
  ('potok_nutrition.assert_generation_request_current_v2(uuid)','d47092345fb1a684eae62bd457ce8a98',false,'v'),
  ('potok_nutrition.acquire_shared_account_gate_v1(uuid)','0a7fc0c24f7bc22f6792781636ac2387',false,'v'),
  ('potok_nutrition.require_canonical_json_v2(bytea)','4453774aeecef9584fb2f0312e30ef83',false,'s'),
  ('potok_nutrition.canonical_jsonb_text_v1(jsonb)','971923fd16799732f89f0f23782f984c',false,'i'),
  ('potok_nutrition.json_has_duplicate_keys_v1(json)','24924ecda9f7d1d0c5284c928c6805af',false,'i')
 ) AS f(signature,body_md5,is_definer,volatility) LOOP
  IF NOT EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure(expected.signature)
   AND md5(p.prosrc)=expected.body_md5 AND pg_get_userbyid(p.proowner)='postgres'
   AND p.proconfig=ARRAY['search_path=pg_catalog'] AND p.prosecdef=expected.is_definer AND p.provolatile::text=expected.volatility) THEN
   RAISE EXCEPTION 'GENERATION_ADMISSION_PREREQUISITE_DRIFT';
  END IF;
 END LOOP;
END
$guard$;

CREATE ROLE potok_generation_reader_v1 NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT USAGE ON SCHEMA potok_nutrition TO potok_generation_reader_v1;

-- These are owner-registered storage-review bindings, NOT food-source evidence
-- issuance or proof that a real recipe has been reviewed. No publisher is exposed.
CREATE TABLE potok_nutrition.generation_validation_receipt_bindings_v1 (
 receipt_ref text PRIMARY KEY CHECK(length(btrim(receipt_ref))>0),
 request_operation_id uuid NOT NULL REFERENCES potok_nutrition.adaptive_nutrition_generation_requests_v2(request_operation_id) ON DELETE RESTRICT,
 account_id uuid NOT NULL,
 source_kind text NOT NULL CHECK(source_kind IN ('INPUTS','WARNINGS')),
 proposal_raw_sha256 bytea,
 source_storage_sha256 bytea NOT NULL CHECK(octet_length(source_storage_sha256)=32),
 policies_storage_sha256 bytea,
 registered_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 registered_by name NOT NULL DEFAULT session_user CHECK(registered_by='postgres'),
 UNIQUE NULLS NOT DISTINCT(request_operation_id,source_kind,proposal_raw_sha256),
 CHECK((source_kind='INPUTS' AND proposal_raw_sha256 IS NULL AND policies_storage_sha256 IS NOT NULL AND octet_length(policies_storage_sha256)=32)
  OR(source_kind='WARNINGS' AND proposal_raw_sha256 IS NOT NULL AND octet_length(proposal_raw_sha256)=32 AND policies_storage_sha256 IS NULL))
);
CREATE TABLE potok_nutrition.generation_validation_receipt_revocations_v1 (
 receipt_ref text PRIMARY KEY REFERENCES potok_nutrition.generation_validation_receipt_bindings_v1(receipt_ref) ON DELETE RESTRICT,
 revoked_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 revoked_by name NOT NULL DEFAULT session_user CHECK(revoked_by='postgres'),
 reason_ref text NOT NULL CHECK(length(btrim(reason_ref))>0)
);
ALTER TABLE potok_nutrition.generation_validation_receipt_bindings_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.generation_validation_receipt_bindings_v1 FORCE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.generation_validation_receipt_revocations_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_nutrition.generation_validation_receipt_revocations_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON potok_nutrition.generation_validation_receipt_bindings_v1,potok_nutrition.generation_validation_receipt_revocations_v1
 FROM PUBLIC,anon,authenticated,service_role,potok_generation_reader_v1;

CREATE FUNCTION potok_nutrition.guard_generation_receipt_insert_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
DECLARE request_record record; matched boolean;
BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' THEN
  RAISE EXCEPTION 'OWNER_REVIEW_CHANNEL_NOT_BOUND' USING ERRCODE='42501';
 END IF;
 SELECT account_id,status INTO STRICT request_record FROM potok_nutrition.adaptive_nutrition_generation_requests_v2
  WHERE request_operation_id=NEW.request_operation_id FOR SHARE;
 PERFORM potok_nutrition.acquire_shared_account_gate_v1(request_record.account_id);
 IF request_record.account_id<>NEW.account_id OR request_record.status NOT IN ('REQUESTED','GENERATING') THEN
  RAISE EXCEPTION 'SOURCE_RECEIPT_BINDING_MISMATCH' USING ERRCODE='23514';
 END IF;
 IF NEW.source_kind='INPUTS' THEN
  SELECT EXISTS(SELECT FROM potok_nutrition.generation_validation_inputs_v1 v
   WHERE v.request_operation_id=NEW.request_operation_id AND v.account_id=NEW.account_id AND v.source_receipt_ref=NEW.receipt_ref
    AND v.evidence_storage_sha256=NEW.source_storage_sha256 AND v.policies_storage_sha256=NEW.policies_storage_sha256) INTO matched;
 ELSE
  SELECT EXISTS(SELECT FROM potok_nutrition.generation_validation_warnings_v1 w
   WHERE w.request_operation_id=NEW.request_operation_id AND w.proposal_raw_sha256=NEW.proposal_raw_sha256
    AND w.source_receipt_ref=NEW.receipt_ref AND w.warning_storage_sha256=NEW.source_storage_sha256) INTO matched;
 END IF;
 IF matched IS DISTINCT FROM true THEN RAISE EXCEPTION 'SOURCE_RECEIPT_BINDING_MISMATCH' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END
$fn$;
CREATE FUNCTION potok_nutrition.guard_generation_receipt_revocation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
DECLARE owner_account uuid;
BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' THEN
  RAISE EXCEPTION 'OWNER_REVIEW_CHANNEL_NOT_BOUND' USING ERRCODE='42501';
 END IF;
 SELECT account_id INTO STRICT owner_account FROM potok_nutrition.generation_validation_receipt_bindings_v1 WHERE receipt_ref=NEW.receipt_ref;
 PERFORM potok_nutrition.acquire_shared_account_gate_v1(owner_account);
 IF NEW.revoked_at>statement_timestamp() THEN RAISE EXCEPTION 'FUTURE_SOURCE_REVOCATION_NOT_ALLOWED' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END
$fn$;
CREATE TRIGGER receipt_binding_insert BEFORE INSERT ON potok_nutrition.generation_validation_receipt_bindings_v1
 FOR EACH ROW EXECUTE FUNCTION potok_nutrition.guard_generation_receipt_insert_v1();
CREATE TRIGGER receipt_revocation_insert BEFORE INSERT ON potok_nutrition.generation_validation_receipt_revocations_v1
 FOR EACH ROW EXECUTE FUNCTION potok_nutrition.guard_generation_receipt_revocation_v1();
CREATE TRIGGER receipt_binding_immutable BEFORE UPDATE OR DELETE ON potok_nutrition.generation_validation_receipt_bindings_v1
 FOR EACH ROW EXECUTE FUNCTION potok_nutrition.validation_store_immutable_v1();
CREATE TRIGGER receipt_binding_no_truncate BEFORE TRUNCATE ON potok_nutrition.generation_validation_receipt_bindings_v1
 FOR EACH STATEMENT EXECUTE FUNCTION potok_nutrition.validation_store_immutable_v1();
CREATE TRIGGER receipt_revocation_immutable BEFORE UPDATE OR DELETE ON potok_nutrition.generation_validation_receipt_revocations_v1
 FOR EACH ROW EXECUTE FUNCTION potok_nutrition.validation_store_immutable_v1();
CREATE TRIGGER receipt_revocation_no_truncate BEFORE TRUNCATE ON potok_nutrition.generation_validation_receipt_revocations_v1
 FOR EACH STATEMENT EXECUTE FUNCTION potok_nutrition.validation_store_immutable_v1();

CREATE FUNCTION potok_nutrition.read_admitted_generation_validation_source_v1(request_id uuid,proposal_sha bytea)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $fn$
BEGIN
 IF session_user<>'potok_generation_reader_v1' OR current_user<>'postgres' THEN
  RAISE EXCEPTION 'GENERATION_READER_IDENTITY_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF request_id IS NULL OR proposal_sha IS NULL OR octet_length(proposal_sha)<>32 THEN
  RAISE EXCEPTION 'INVALID_VALIDATION_LOOKUP' USING ERRCODE='22023';
 END IF;
 -- Reuse the exact existing Premium/selection/Goal/authority/manifest/policy gate.
 -- It locks the request and common account gate; it does not create an attempt.
 PERFORM potok_nutrition.assert_generation_request_current_v2(request_id);
 -- Missing JSON lineage/identity must also fail closed: SQL IF comparisons with
 -- NULL alone do not establish equality. The existing gate holds these rows.
 IF NOT EXISTS(
  SELECT FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 r
  CROSS JOIN LATERAL (SELECT convert_from(r.generation_input_canonical,'UTF8')::jsonb AS body) j
  JOIN public.user_premium_plan_selections s ON s.id=r.selection_id AND s.user_id=r.account_id
  JOIN public.user_goals g ON g.user_id=r.account_id AND g.goal_revision=s.goal_revision
  WHERE r.request_operation_id=request_id AND r.status IN('REQUESTED','GENERATING')
   AND r.account_id=(j.body->>'accountId')::uuid AND r.request_operation_id=(j.body#>>'{operation,requestId}')::uuid
   AND r.selection_id=(j.body#>>'{selection,selectionId}')::uuid
   AND s.status='pending_generation' AND s.plan_revision IS NULL
   AND s.week_anchor::text=j.body->>'weekStartLocal' AND s.timezone=j.body->>'timezone'
   AND s.goal_revision=(j.body#>>'{goalNutritionTarget,goalRevision}')::uuid
   AND s.origin_lineage->>'provisionOperationId'=j.body#>>'{selection,planSelectionRevision}'
   AND (j.body->>'entitlementEvidenceRevision')::uuid=(SELECT a.attestation_id FROM potok_control.access_attestations a
     WHERE a.account_id=r.account_id AND a.capability='premium' AND a.issued_at<=statement_timestamp()
     ORDER BY a.lineage_sequence DESC LIMIT 1)
 ) THEN RAISE EXCEPTION 'GENERATION_REQUEST_STALE_SELECTION' USING ERRCODE='40001'; END IF;
 IF NOT EXISTS(
  SELECT FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 r
  JOIN potok_nutrition.generation_validation_inputs_v1 v ON v.request_operation_id=r.request_operation_id AND v.account_id=r.account_id
  JOIN potok_nutrition.generation_validation_warnings_v1 w ON w.request_operation_id=r.request_operation_id AND w.proposal_raw_sha256=proposal_sha
  JOIN potok_nutrition.generation_validation_receipt_bindings_v1 vi ON vi.receipt_ref=v.source_receipt_ref
    AND vi.source_kind='INPUTS' AND vi.request_operation_id=r.request_operation_id AND vi.account_id=r.account_id
    AND vi.source_storage_sha256=v.evidence_storage_sha256 AND vi.policies_storage_sha256=v.policies_storage_sha256
  JOIN potok_nutrition.generation_validation_receipt_bindings_v1 wi ON wi.receipt_ref=w.source_receipt_ref
    AND wi.source_kind='WARNINGS' AND wi.request_operation_id=r.request_operation_id AND wi.account_id=r.account_id
    AND wi.proposal_raw_sha256=w.proposal_raw_sha256 AND wi.source_storage_sha256=w.warning_storage_sha256
  WHERE r.request_operation_id=request_id
    AND NOT EXISTS(SELECT FROM potok_nutrition.generation_validation_receipt_revocations_v1 x WHERE x.receipt_ref IN(vi.receipt_ref,wi.receipt_ref))
 ) THEN RAISE EXCEPTION 'SOURCE_PROVENANCE_UNAVAILABLE' USING ERRCODE='42501'; END IF;
 RETURN potok_nutrition.read_generation_validation_source_v1(request_id,proposal_sha);
END
$fn$;
REVOKE ALL ON FUNCTION potok_nutrition.guard_generation_receipt_insert_v1(),
 potok_nutrition.guard_generation_receipt_revocation_v1(),
 potok_nutrition.read_admitted_generation_validation_source_v1(uuid,bytea)
 FROM PUBLIC,anon,authenticated,service_role,potok_generation_reader_v1;
GRANT EXECUTE ON FUNCTION potok_nutrition.read_admitted_generation_validation_source_v1(uuid,bytea) TO potok_generation_reader_v1;
