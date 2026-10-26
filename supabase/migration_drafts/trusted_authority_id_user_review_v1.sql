-- REVIEW ONLY. Fresh id_user authority adaptation. Always ROLLBACK.
-- Derived from existing trusted v2 ledger/readers and later shared-account gate.
-- No profile mutation/projection/backfill, authority issuance, payments or activation.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';
DO $preflight$
DECLARE names text[]; p record;
BEGIN
 IF SESSION_USER<>'postgres' OR CURRENT_USER<>'postgres'
  OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
  OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname='postgres' AND NOT rolsuper AND rolbypassrls)
 THEN RAISE EXCEPTION 'Expected existing nonsuperuser postgres/BYPASSRLS owner SQL channel';END IF;
 IF to_regnamespace('potok_control') IS NOT NULL OR to_regnamespace('potok_nutrition') IS NOT NULL
  OR to_regprocedure('public.has_verified_entitlement_v1(text)') IS NOT NULL
  OR to_regprocedure('public.has_verified_entitlement_v2(text)') IS NOT NULL
 THEN RAISE EXCEPTION 'Fresh authority install only; existing infrastructure requires separate compatibility review';END IF;
 IF has_schema_privilege('anon','public','CREATE') OR has_schema_privilege('authenticated','public','CREATE')
  THEN RAISE EXCEPTION 'Client schema CREATE requires separate containment';END IF;
 IF NOT EXISTS(SELECT FROM pg_class WHERE oid=to_regclass('public.user_profiles') AND relkind='r' AND relowner='postgres'::regrole AND relrowsecurity)
  THEN RAISE EXCEPTION 'Profile ownership/RLS drift';END IF;
 SELECT array_agg(attname::text ORDER BY attname) INTO names FROM pg_attribute WHERE attrelid='public.user_profiles'::regclass AND attnum>0 AND NOT attisdropped;
 IF names IS DISTINCT FROM ARRAY['age','avatar_url','birth_date','coach_settings','created_at','email','first_name','goal','has_premium','height','id_user','is_admin','last_name','middle_name','phone','updated_at','voice_settings']::text[]
  THEN RAISE EXCEPTION 'Expected unchanged 17-column id_user profile contract';END IF;
 IF NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.user_profiles'::regclass AND attname='id_user' AND atttypid='uuid'::regtype AND attnotnull)
  OR NOT EXISTS(SELECT FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attname='id_user' WHERE i.indrelid='public.user_profiles'::regclass AND i.indisprimary AND i.indisvalid AND i.indnkeyatts=1 AND i.indkey[0]=a.attnum)
  THEN RAISE EXCEPTION 'Expected UUID profile primary key';END IF;
 IF (SELECT count(*) FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.user_profiles'::regclass AND a.attname IN('is_admin','has_premium') AND a.atttypid='boolean'::regtype AND a.attnotnull AND pg_get_expr(d.adbin,d.adrelid)='false')<>2
  THEN RAISE EXCEPTION 'Expected false protected defaults';END IF;
 IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) r(role),unnest(ARRAY['is_admin','has_premium','created_at','updated_at']) c(col) WHERE has_column_privilege(r.role,'public.user_profiles',c.col,'INSERT') OR has_column_privilege(r.role,'public.user_profiles',c.col,'UPDATE'))
  THEN RAISE EXCEPTION 'Apply reviewed profile column containment before authority installation';END IF;
 IF NOT has_table_privilege('authenticated','public.user_profiles','SELECT') OR EXISTS(SELECT FROM unnest(ARRAY['id_user','first_name','last_name','middle_name','birth_date','age','height','goal','email','phone','avatar_url','coach_settings','voice_settings']) c(col) WHERE NOT has_column_privilege('authenticated','public.user_profiles',c.col,'INSERT') OR NOT has_column_privilege('authenticated','public.user_profiles',c.col,'UPDATE'))
  THEN RAISE EXCEPTION 'Ordinary profile access drift';END IF;
 IF (SELECT count(*) FROM pg_policy WHERE polrelid='public.user_profiles'::regclass)<>3 THEN RAISE EXCEPTION 'Expected three profile ownership policies';END IF;
 FOR p IN SELECT *,regexp_replace(coalesce(pg_get_expr(polqual,polrelid),''),'[[:space:]()]','','g') q,regexp_replace(coalesce(pg_get_expr(polwithcheck,polrelid),''),'[[:space:]()]','','g') w FROM pg_policy WHERE polrelid='public.user_profiles'::regclass LOOP
  IF NOT p.polpermissive OR p.polroles<>ARRAY['authenticated'::regrole::oid] OR p.polcmd NOT IN('r','a','w')
   OR (p.polcmd IN('r','w') AND p.q<>'auth.uid=id_user') OR (p.polcmd IN('a','w') AND p.w<>'auth.uid=id_user')
   THEN RAISE EXCEPTION 'Profile ownership policy semantics drift';END IF;
 END LOOP;
 IF (SELECT count(DISTINCT polcmd) FROM pg_policy WHERE polrelid='public.user_profiles'::regclass)<>3 THEN RAISE EXCEPTION 'Missing profile command policy';END IF;
END
$preflight$;
CREATE SCHEMA potok_control;
REVOKE ALL ON SCHEMA potok_control FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA potok_control
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA potok_control
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE potok_control.access_attestations (
  attestation_id uuid PRIMARY KEY,
  account_id uuid NOT NULL,
  capability text NOT NULL,
  effect text NOT NULL,
  previous_attestation_id uuid NULL,
  lineage_sequence bigint NOT NULL,
  issued_at timestamptz NOT NULL,
  valid_until timestamptz NULL,
  operator_db_role name NOT NULL,
  evidence_ref text NOT NULL,
  reason text NOT NULL,
  CONSTRAINT access_attestations_account_fk
    FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT access_attestations_capability_check
    CHECK (capability IN ('premium', 'admin')),
  CONSTRAINT access_attestations_effect_check
    CHECK (effect IN ('GRANT', 'REVOKE')),
  CONSTRAINT access_attestations_sequence_check
    CHECK (lineage_sequence > 0),
  CONSTRAINT access_attestations_validity_check
    CHECK (
      (effect = 'GRANT' AND (valid_until IS NULL OR valid_until > issued_at))
      OR (effect = 'REVOKE' AND valid_until IS NULL)
    ),
  CONSTRAINT access_attestations_evidence_check
    CHECK (evidence_ref <> '' AND evidence_ref = pg_catalog.btrim(evidence_ref)),
  CONSTRAINT access_attestations_reason_check
    CHECK (reason <> '' AND reason = pg_catalog.btrim(reason)),
  CONSTRAINT access_attestations_scope_id_unique
    UNIQUE (account_id, capability, attestation_id),
  CONSTRAINT access_attestations_account_id_unique
    UNIQUE (account_id, attestation_id),
  CONSTRAINT access_attestations_scope_sequence_unique
    UNIQUE (account_id, capability, lineage_sequence),
  CONSTRAINT access_attestations_previous_fk
    FOREIGN KEY (account_id, capability, previous_attestation_id)
    REFERENCES potok_control.access_attestations (account_id, capability, attestation_id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX access_attestations_one_successor_idx
  ON potok_control.access_attestations (account_id, capability, previous_attestation_id)
  WHERE previous_attestation_id IS NOT NULL;

ALTER TABLE potok_control.access_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE potok_control.access_attestations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON potok_control.access_attestations FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION potok_control.validate_access_attestation_insert_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_head potok_control.access_attestations%ROWTYPE;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'owner-controlled entitlement channel required' USING ERRCODE = '42501';
  END IF;
  IF NEW.capability NOT IN ('premium', 'admin') OR NEW.effect NOT IN ('GRANT', 'REVOKE') THEN
    RAISE EXCEPTION 'invalid entitlement capability/effect' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('potok-entitlement-v2:' || NEW.account_id::text || ':' || NEW.capability, 0)
  );
  SELECT a.*
    INTO v_head
    FROM potok_control.access_attestations a
   WHERE a.account_id = NEW.account_id
     AND a.capability = NEW.capability
   ORDER BY a.lineage_sequence DESC
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    IF NEW.lineage_sequence <> v_head.lineage_sequence + 1
       OR NEW.previous_attestation_id IS DISTINCT FROM v_head.attestation_id
       OR NEW.issued_at < v_head.issued_at THEN
      RAISE EXCEPTION 'invalid entitlement lineage successor' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.lineage_sequence <> 1 OR NEW.previous_attestation_id IS NOT NULL THEN
    RAISE EXCEPTION 'invalid entitlement lineage root' USING ERRCODE = '23514';
  END IF;

  IF NEW.operator_db_role IS DISTINCT FROM SESSION_USER::name THEN
    RAISE EXCEPTION 'operator identity must be derived from session_user' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION potok_control.validate_access_attestation_insert_v2()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER validate_access_attestation_insert_v2
BEFORE INSERT ON potok_control.access_attestations
FOR EACH ROW EXECUTE FUNCTION potok_control.validate_access_attestation_insert_v2();

CREATE FUNCTION potok_control.reject_access_attestation_mutation_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION 'entitlement attestations are append-only' USING ERRCODE = '42501';
END
$function$;
REVOKE ALL ON FUNCTION potok_control.reject_access_attestation_mutation_v2()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER reject_access_attestation_update_delete_v2
BEFORE UPDATE OR DELETE ON potok_control.access_attestations
FOR EACH ROW EXECUTE FUNCTION potok_control.reject_access_attestation_mutation_v2();
CREATE TRIGGER reject_access_attestation_truncate_v2
BEFORE TRUNCATE ON potok_control.access_attestations
FOR EACH STATEMENT EXECUTE FUNCTION potok_control.reject_access_attestation_mutation_v2();

CREATE SCHEMA potok_nutrition;
REVOKE ALL ON SCHEMA potok_nutrition FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA potok_nutrition REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION potok_nutrition.acquire_shared_account_gate_v1(p_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'account gate requires account identity' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('potok-shared-account-gate-v1:' || p_account_id::text, 0)
  );
END
$function$;
REVOKE ALL ON FUNCTION potok_nutrition.acquire_shared_account_gate_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION potok_control.grant_entitlement_v2(
  p_account_id uuid,
  p_capability text,
  p_valid_until timestamptz,
  p_evidence_ref text,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_head potok_control.access_attestations%ROWTYPE;
  v_attestation_id uuid := pg_catalog.gen_random_uuid();
  v_sequence bigint;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'owner-controlled entitlement channel required' USING ERRCODE = '42501';
  END IF;
  IF p_account_id IS NULL OR p_capability IS NULL OR p_capability NOT IN ('premium', 'admin') THEN
    RAISE EXCEPTION 'invalid entitlement scope' USING ERRCODE = '22023';
  END IF;
  IF p_valid_until IS NOT NULL AND p_valid_until <= v_now THEN
    RAISE EXCEPTION 'grant expiry must be in the future' USING ERRCODE = '22023';
  END IF;
  IF p_evidence_ref IS NULL OR p_evidence_ref = '' OR p_evidence_ref <> pg_catalog.btrim(p_evidence_ref)
     OR p_reason IS NULL OR p_reason = '' OR p_reason <> pg_catalog.btrim(p_reason) THEN
    RAISE EXCEPTION 'evidence and reason are required' USING ERRCODE = '22023';
  END IF;

  PERFORM potok_nutrition.acquire_shared_account_gate_v1(p_account_id);
  -- Require the existing profile without modifying its legacy fields.
  PERFORM 1 FROM public.user_profiles WHERE id_user=p_account_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'existing account profile required' USING ERRCODE='23503';END IF;
  -- Preserve the capability lineage lock, now strictly secondary.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('potok-entitlement-v2:' || p_account_id::text || ':' || p_capability, 0)
  );
  SELECT a.* INTO v_head
    FROM potok_control.access_attestations a
   WHERE a.account_id = p_account_id AND a.capability = p_capability
   ORDER BY a.lineage_sequence DESC LIMIT 1 FOR UPDATE;
  v_sequence := COALESCE(v_head.lineage_sequence, 0::bigint) + 1::bigint;

  INSERT INTO potok_control.access_attestations (
    attestation_id, account_id, capability, effect, previous_attestation_id,
    lineage_sequence, issued_at, valid_until, operator_db_role, evidence_ref, reason
  ) VALUES (
    v_attestation_id, p_account_id, p_capability, 'GRANT', v_head.attestation_id,
    v_sequence, v_now, p_valid_until, SESSION_USER::name, p_evidence_ref, p_reason
  );

  RETURN v_attestation_id;
END
$function$;
CREATE FUNCTION potok_control.revoke_entitlement_v2(
  p_account_id uuid,
  p_capability text,
  p_evidence_ref text,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_head potok_control.access_attestations%ROWTYPE;
  v_attestation_id uuid := pg_catalog.gen_random_uuid();
  v_sequence bigint;
BEGIN
  IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN
    RAISE EXCEPTION 'owner-controlled entitlement channel required' USING ERRCODE = '42501';
  END IF;
  IF p_account_id IS NULL OR p_capability IS NULL OR p_capability NOT IN ('premium', 'admin') THEN
    RAISE EXCEPTION 'invalid entitlement scope' USING ERRCODE = '22023';
  END IF;
  IF p_evidence_ref IS NULL OR p_evidence_ref = '' OR p_evidence_ref <> pg_catalog.btrim(p_evidence_ref)
     OR p_reason IS NULL OR p_reason = '' OR p_reason <> pg_catalog.btrim(p_reason) THEN
    RAISE EXCEPTION 'evidence and reason are required' USING ERRCODE = '22023';
  END IF;

  PERFORM potok_nutrition.acquire_shared_account_gate_v1(p_account_id);
  -- Require the existing profile without modifying its legacy fields.
  PERFORM 1 FROM public.user_profiles WHERE id_user=p_account_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'existing account profile required' USING ERRCODE='23503';END IF;
  -- Preserve the capability lineage lock, now strictly secondary.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('potok-entitlement-v2:' || p_account_id::text || ':' || p_capability, 0)
  );
  SELECT a.* INTO v_head
    FROM potok_control.access_attestations a
   WHERE a.account_id = p_account_id AND a.capability = p_capability
   ORDER BY a.lineage_sequence DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cannot revoke entitlement without prior lineage' USING ERRCODE = '23514';
  END IF;
  v_sequence := v_head.lineage_sequence + 1;

  INSERT INTO potok_control.access_attestations (
    attestation_id, account_id, capability, effect, previous_attestation_id,
    lineage_sequence, issued_at, valid_until, operator_db_role, evidence_ref, reason
  ) VALUES (
    v_attestation_id, p_account_id, p_capability, 'REVOKE', v_head.attestation_id,
    v_sequence, v_now, NULL, SESSION_USER::name, p_evidence_ref, p_reason
  );

  RETURN v_attestation_id;
END
$function$;
REVOKE ALL ON FUNCTION potok_control.grant_entitlement_v2(uuid,text,timestamptz,text,text),potok_control.revoke_entitlement_v2(uuid,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION potok_control.is_effective_entitlement_v2(
  p_account_id uuid,
  p_capability text,
  p_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_count bigint;
  v_max_sequence bigint;
  v_root_count bigint;
  v_effect text;
  v_valid_until timestamptz;
BEGIN
  IF p_account_id IS NULL OR p_capability NOT IN ('premium', 'admin') OR p_at IS NULL THEN
    RETURN false;
  END IF;

  SELECT pg_catalog.count(*), pg_catalog.max(a.lineage_sequence),
         pg_catalog.count(*) FILTER (
           WHERE a.lineage_sequence = 1 AND a.previous_attestation_id IS NULL
         )
    INTO v_count, v_max_sequence, v_root_count
    FROM potok_control.access_attestations a
   WHERE a.account_id = p_account_id AND a.capability = p_capability;

  IF v_count = 0 OR v_count <> v_max_sequence OR v_root_count <> 1 THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1
      FROM potok_control.access_attestations a
      LEFT JOIN potok_control.access_attestations predecessor
        ON predecessor.account_id = a.account_id
       AND predecessor.capability = a.capability
       AND predecessor.attestation_id = a.previous_attestation_id
     WHERE a.account_id = p_account_id
       AND a.capability = p_capability
       AND (
         (a.lineage_sequence = 1 AND a.previous_attestation_id IS NOT NULL)
         OR (a.lineage_sequence > 1 AND (
           predecessor.attestation_id IS NULL
           OR predecessor.lineage_sequence <> a.lineage_sequence - 1
           OR predecessor.issued_at > a.issued_at
         ))
       )
  ) THEN
    RETURN false;
  END IF;

  SELECT a.effect, a.valid_until
    INTO v_effect, v_valid_until
    FROM potok_control.access_attestations a
   WHERE a.account_id = p_account_id
     AND a.capability = p_capability
     AND a.issued_at <= p_at
   ORDER BY a.lineage_sequence DESC
   LIMIT 1;

  IF NOT FOUND OR v_effect <> 'GRANT' THEN
    RETURN false;
  END IF;
  RETURN v_valid_until IS NULL OR v_valid_until > p_at;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END
$function$;
CREATE FUNCTION public.has_verified_entitlement_v2(p_capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    ELSE potok_control.is_effective_entitlement_v2(
      auth.uid(), p_capability, pg_catalog.statement_timestamp()
    )
  END
$function$;
CREATE FUNCTION public.has_verified_entitlement_v1(p_capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT public.has_verified_entitlement_v2(p_capability)
$function$;
REVOKE ALL ON FUNCTION potok_control.is_effective_entitlement_v2(uuid,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.has_verified_entitlement_v1(text),public.has_verified_entitlement_v2(text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.has_verified_entitlement_v1(text),public.has_verified_entitlement_v2(text) TO authenticated;
COMMENT ON TABLE potok_control.access_attestations IS 'Existing trusted v2 append-only authority contract; id_user adapter has no legacy flag projections or payment source.';
DO $verify$
BEGIN
 IF EXISTS(SELECT FROM potok_control.access_attestations) THEN RAISE EXCEPTION 'Installer must not issue authority';END IF;
 IF EXISTS(SELECT FROM pg_roles r WHERE r.rolname IN('anon','authenticated','service_role') AND (has_schema_privilege(r.oid,'potok_control','USAGE,CREATE') OR has_schema_privilege(r.oid,'potok_nutrition','USAGE,CREATE') OR has_table_privilege(r.oid,'potok_control.access_attestations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR has_function_privilege(r.oid,'potok_control.grant_entitlement_v2(uuid,text,timestamptz,text,text)','EXECUTE') OR has_function_privilege(r.oid,'potok_control.revoke_entitlement_v2(uuid,text,text,text)','EXECUTE')))
  THEN RAISE EXCEPTION 'Private authority API boundary drift';END IF;
END
$verify$;
ROLLBACK;
