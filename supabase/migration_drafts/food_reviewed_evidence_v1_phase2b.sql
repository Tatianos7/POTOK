-- STAGING-FIRST REVIEW DRAFT. NOT APPLIED. No runtime/production activation.
-- Supabase CLI is unavailable in Cloud: package this reviewed draft with
-- `supabase migration new ...` only in the separately approved rollout workspace.
-- Requires deployed trusted entitlement v2/v2.1/v2.2, not legacy is_admin.
-- The owner must verify the project ref and explicitly acknowledge this target
-- in THIS migration session. This marker is not an authorization mechanism.
BEGIN;

DO $preflight$
DECLARE v_count integer;
BEGIN
  IF current_user <> 'postgres' OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'POSTGRES_OWNER_SESSION_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='postgres' AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'REVIEWED_FORCE_RLS_OWNER_REQUIRED';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated','service_role'))<>3
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated')
      AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication))
    OR pg_catalog.pg_has_role('anon','postgres','MEMBER')
    OR pg_catalog.pg_has_role('authenticated','postgres','MEMBER')
    OR pg_catalog.pg_has_role('service_role','postgres','MEMBER') THEN
    RAISE EXCEPTION 'REVIEWED_CLIENT_ROLE_ISOLATION_REQUIRED';
  END IF;
  IF pg_catalog.to_regnamespace('potok_food_evidence') IS NOT NULL THEN
    RAISE EXCEPTION 'FOOD_EVIDENCE_ALREADY_EXISTS_REVIEW_DEPLOYED_STATE';
  END IF;
  IF pg_catalog.to_regclass('potok_control.access_attestations') IS NULL
     OR pg_catalog.to_regprocedure('potok_control.is_effective_entitlement_v2(uuid,text,timestamp with time zone)') IS NULL
     OR pg_catalog.to_regprocedure('auth.uid()') IS NULL OR pg_catalog.to_regprocedure('auth.jwt()') IS NULL
     OR pg_catalog.to_regprocedure('extensions.digest(bytea,text)') IS NULL
     OR pg_catalog.to_regprocedure('potok_nutrition.json_has_duplicate_keys_v1(json)') IS NULL
     OR pg_catalog.to_regprocedure('potok_nutrition.canonical_jsonb_text_v1(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'STAGING_TRUSTED_INFRASTRUCTURE_REQUIRED_NO_MAIN_FALLBACK';
  END IF;
  SELECT count(*) INTO v_count FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_profiles'
      AND column_name IN ('user_id','admin_provenance_id','admin_valid_until');
  IF v_count<>3 THEN RAISE EXCEPTION 'STAGING_PROFILE_CONTRACT_REQUIRED_NO_MAIN_FALLBACK'; END IF;
  SELECT count(*) INTO v_count FROM information_schema.columns
    WHERE table_schema='public' AND table_name='foods'
      AND column_name IN ('id','canonical_food_id','stable_food_id','source','created_by_user_id',
        'name','name_original','normalized_name','brand','normalized_brand','barcode','aliases');
  IF v_count<>12 THEN RAISE EXCEPTION 'EXISTING_CANONICAL_FOOD_SCHEMA_REQUIRED'; END IF;
  SELECT count(*) INTO v_count FROM information_schema.columns
    WHERE table_schema='auth' AND ((table_name='sessions' AND column_name IN ('id','user_id','not_after'))
      OR (table_name='users' AND column_name IN ('id','is_anonymous')));
  IF v_count<>5 THEN RAISE EXCEPTION 'REVIEWED_AUTH_SESSION_SCHEMA_REQUIRED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class
      WHERE oid='potok_control.access_attestations'::regclass AND relrowsecurity AND relforcerowsecurity)
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role')
       AND (pg_catalog.has_table_privilege(r.oid,'potok_control.access_attestations','INSERT')
         OR pg_catalog.has_table_privilege(r.oid,'potok_control.access_attestations','UPDATE')
         OR pg_catalog.has_table_privilege(r.oid,'potok_control.access_attestations','DELETE')
         OR pg_catalog.has_table_privilege(r.oid,'potok_control.access_attestations','TRUNCATE')
         OR pg_catalog.has_any_column_privilege(r.oid,'potok_control.access_attestations','INSERT')
         OR pg_catalog.has_any_column_privilege(r.oid,'potok_control.access_attestations','UPDATE'))) THEN
    RAISE EXCEPTION 'TRUSTED_ATTESTATION_ACL_REQUIRED';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid IN (
      'potok_control.is_effective_entitlement_v2(uuid,text,timestamp with time zone)'::regprocedure,
      'potok_nutrition.json_has_duplicate_keys_v1(json)'::regprocedure,
      'potok_nutrition.canonical_jsonb_text_v1(jsonb)'::regprocedure)
      AND (pg_catalog.pg_get_userbyid(p.proowner)<>'postgres'
        OR NOT coalesce('search_path=pg_catalog'=ANY(p.proconfig),false))) THEN
    RAISE EXCEPTION 'REVIEWED_PREREQUISITE_FUNCTION_SECURITY_REQUIRED';
  END IF;
  IF current_setting('potok_food_evidence.rollout_target',true) IS DISTINCT FROM 'staging:ozidryfvhkcbtpnulakq' THEN
    RAISE EXCEPTION 'EXPLICIT_STAGING_ROLLOUT_TARGET_REQUIRED';
  END IF;
END $preflight$;

CREATE SCHEMA potok_food_evidence;
REVOKE ALL ON SCHEMA potok_food_evidence FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA potok_food_evidence REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA potok_food_evidence REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION potok_food_evidence.exact_keys_v1(v jsonb, keys text[]) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
BEGIN
  IF jsonb_typeof(v) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'EXACT_FIELDS_REQUIRED' USING ERRCODE='22023'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(v))<>cardinality(keys)
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(v) k WHERE NOT k=ANY(keys)) THEN
    RAISE EXCEPTION 'EXACT_FIELDS_REQUIRED' USING ERRCODE='22023';
  END IF;
END $$;

CREATE FUNCTION potok_food_evidence.text_v1(v jsonb, nullable boolean DEFAULT false) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE result text; spaces text:=E' \t\n\r\f\v'||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)
  ||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279);
BEGIN
  IF nullable AND v='null'::jsonb THEN RETURN NULL; END IF;
  IF jsonb_typeof(v) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'STRING_REQUIRED' USING ERRCODE='22023'; END IF;
  result:=v#>>'{}';
  IF length(btrim(result,spaces))=0 THEN RAISE EXCEPTION 'TEXT_REQUIRED' USING ERRCODE='22023'; END IF;
  RETURN result;
END $$;

CREATE FUNCTION potok_food_evidence.uuid_v1(v jsonb) RETURNS uuid
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE result text:=potok_food_evidence.text_v1(v);
BEGIN
  IF result !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' THEN
    RAISE EXCEPTION 'UUID_INVALID' USING ERRCODE='22023'; END IF;
  RETURN result::uuid;
END $$;

CREATE FUNCTION potok_food_evidence.hash_v1(v jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE result text:=potok_food_evidence.text_v1(v);
BEGIN
  IF result !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'DIGEST_INVALID' USING ERRCODE='22023'; END IF;
  RETURN result;
END $$;

CREATE FUNCTION potok_food_evidence.applicability_v1(v jsonb, state text) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
BEGIN
  PERFORM potok_food_evidence.exact_keys_v1(v,ARRAY['kind','foodState']);
  IF state NOT IN ('raw','dry','frozen','cooked','as-sold') OR state IS NULL
    OR v->>'kind' IS DISTINCT FROM 'EXACT_FOOD_STATE' OR v->>'foodState' IS DISTINCT FROM state THEN
    RAISE EXCEPTION 'APPLICABILITY_INVALID' USING ERRCODE='22023'; END IF;
END $$;

-- Before jsonb can erase literal -0. Other numbers are admitted only as validated source byteLength.
CREATE FUNCTION potok_food_evidence.reject_negative_zero_v1(v json) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE child json;
BEGIN
  IF json_typeof(v)='number' AND v::text LIKE '-%' AND (v::text)::numeric=0 THEN
    RAISE EXCEPTION 'NEGATIVE_ZERO_FORBIDDEN' USING ERRCODE='22023';
  ELSIF json_typeof(v)='object' THEN
    FOR child IN SELECT value FROM json_each(v) LOOP PERFORM potok_food_evidence.reject_negative_zero_v1(child); END LOOP;
  ELSIF json_typeof(v)='array' THEN
    FOR child IN SELECT value FROM json_array_elements(v) LOOP PERFORM potok_food_evidence.reject_negative_zero_v1(child); END LOOP;
  END IF;
END $$;

-- Food-only integer policy. Keep the deployed Adaptive Nutrition serializer unchanged.
-- Strip numeric scale only after proving the value is a nonnegative safe integer.
CREATE FUNCTION potok_food_evidence.integer_values_v1(v jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
  CASE jsonb_typeof(v)
    WHEN 'number' THEN
      IF (v#>>'{}')::numeric<0 OR (v#>>'{}')::numeric>9007199254740991
        OR trunc((v#>>'{}')::numeric)<>(v#>>'{}')::numeric THEN
        RAISE EXCEPTION 'SAFE_INTEGER_REQUIRED' USING ERRCODE='22023'; END IF;
      RETURN to_jsonb(((v#>>'{}')::numeric)::bigint);
    WHEN 'object' THEN
      SELECT coalesce(jsonb_object_agg(key,potok_food_evidence.integer_values_v1(value)),'{}'::jsonb) INTO result FROM jsonb_each(v);
    WHEN 'array' THEN
      SELECT coalesce(jsonb_agg(potok_food_evidence.integer_values_v1(value) ORDER BY ordinality),'[]'::jsonb) INTO result
        FROM jsonb_array_elements(v) WITH ORDINALITY;
    ELSE RETURN v;
  END CASE;
  RETURN result;
END $$;
CREATE FUNCTION potok_food_evidence.canonical_json_v1(v jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
  SELECT potok_nutrition.canonical_jsonb_text_v1(potok_food_evidence.integer_values_v1(v))
$$;

CREATE FUNCTION potok_food_evidence.digest_v1(domain text, payload jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
  SELECT encode(extensions.digest(convert_to(potok_food_evidence.canonical_json_v1(
    jsonb_build_object('domain',domain,'payload',payload)),'UTF8'),'sha256'),'hex')
$$;
CREATE FUNCTION potok_food_evidence.artifact_v1(domain text, payload jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
  SELECT payload||jsonb_build_object('digest',potok_food_evidence.digest_v1(domain,payload))
$$;

CREATE FUNCTION potok_food_evidence.proposal_v1(v jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE identity jsonb; item jsonb; field text; result text;
BEGIN
  PERFORM potok_food_evidence.uuid_v1(v->'canonicalFoodId');
  PERFORM potok_food_evidence.applicability_v1(v->'applicability',v->>'foodState');
  IF v->>'contract'='potok-canonical-food-review-proposal-v1' THEN
    PERFORM potok_food_evidence.exact_keys_v1(v,ARRAY['contract','canonicalFoodId','foodStableId','identitySnapshot','source','foodState','applicability','sharedCatalogAccessible']);
    IF potok_food_evidence.text_v1(v->'foodStableId') !~ '^[a-z0-9][a-z0-9_-]{0,127}$'
      OR v->>'source' IS NULL OR v->>'source' NOT IN ('core','brand') OR v->'sharedCatalogAccessible' IS DISTINCT FROM 'true'::jsonb THEN
      RAISE EXCEPTION 'CANONICAL_ROOT_REQUIRED' USING ERRCODE='22023'; END IF;
    identity:=v->'identitySnapshot';
    PERFORM potok_food_evidence.exact_keys_v1(identity,ARRAY['name','nameOriginal','normalizedName','brand','normalizedBrand','barcode','aliases']);
    PERFORM potok_food_evidence.text_v1(identity->'name');
    PERFORM potok_food_evidence.text_v1(identity->'normalizedName');
    FOREACH field IN ARRAY ARRAY['nameOriginal','brand','normalizedBrand','barcode'] LOOP
      PERFORM potok_food_evidence.text_v1(identity->field,true);
    END LOOP;
    IF jsonb_typeof(identity->'aliases') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'ALIASES_REQUIRED' USING ERRCODE='22023'; END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(identity->'aliases') LOOP PERFORM potok_food_evidence.text_v1(item); END LOOP;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(identity->'aliases') GROUP BY value HAVING count(*)>1) THEN
      RAISE EXCEPTION 'DUPLICATE_ALIAS' USING ERRCODE='22023'; END IF;
    result:='CANONICAL_REVIEWED_REVISION';
  ELSIF v->>'contract'='potok-nutrition-review-proposal-v1' THEN
    PERFORM potok_food_evidence.exact_keys_v1(v,ARRAY['contract','canonicalFoodId','canonicalRevisionId','canonicalRevisionDigest','nutrition','basis','units','foodState','applicability']);
    PERFORM potok_food_evidence.uuid_v1(v->'canonicalRevisionId');
    PERFORM potok_food_evidence.hash_v1(v->'canonicalRevisionDigest');
    PERFORM potok_food_evidence.exact_keys_v1(v->'nutrition',ARRAY['calories','protein','fat','carbs','fiber']);
    PERFORM potok_food_evidence.exact_keys_v1(v->'units',ARRAY['calories','protein','fat','carbs','fiber']);
    IF v->>'basis' IS DISTINCT FROM 'PER_100_G_EDIBLE' THEN RAISE EXCEPTION 'BASIS_INVALID' USING ERRCODE='22023'; END IF;
    FOREACH field IN ARRAY ARRAY['calories','protein','fat','carbs','fiber'] LOOP
      IF potok_food_evidence.text_v1(v->'nutrition'->field) !~ '^(0|[1-9][0-9]{0,8})\.[0-9]{3}$'
        OR (v->'units'->>field) IS DISTINCT FROM (CASE WHEN field='calories' THEN 'kcal' ELSE 'g' END) THEN
        RAISE EXCEPTION 'DECIMAL_OR_UNITS_INVALID' USING ERRCODE='22023'; END IF;
    END LOOP;
    result:='NUTRITION_REVIEWED_REVISION';
  ELSE RAISE EXCEPTION 'PROPOSAL_CONTRACT_INVALID' USING ERRCODE='22023'; END IF;
  RETURN result;
END $$;

CREATE FUNCTION potok_food_evidence.source_v1(v jsonb, target_kind text, app jsonb) RETURNS bytea
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE result bytea; encoded text; captured text; mapping jsonb; expected text[];
BEGIN
  IF (v?'text')=(v?'bytesBase64') THEN RAISE EXCEPTION 'SOURCE_PAYLOAD_XOR' USING ERRCODE='22023'; END IF;
  PERFORM potok_food_evidence.exact_keys_v1(v,ARRAY['sourceArtifactId','providerIdentity','documentIdentity','sourceRevision','locator','capturedAt','mediaType',
    'byteLength','sourceBytesSha256','mappings',CASE WHEN v?'text' THEN 'text' ELSE 'bytesBase64' END]);
  PERFORM potok_food_evidence.uuid_v1(v->'sourceArtifactId');
  PERFORM potok_food_evidence.text_v1(v->'providerIdentity'); PERFORM potok_food_evidence.text_v1(v->'documentIdentity');
  PERFORM potok_food_evidence.text_v1(v->'sourceRevision',true); PERFORM potok_food_evidence.text_v1(v->'locator');
  PERFORM potok_food_evidence.text_v1(v->'mediaType');
  captured:=potok_food_evidence.text_v1(v->'capturedAt');
  IF captured !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
    OR to_char(captured::timestamptz AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>captured THEN
    RAISE EXCEPTION 'TIMESTAMP_INVALID' USING ERRCODE='22023'; END IF;
  IF v?'text' THEN
    IF jsonb_typeof(v->'text') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'STRING_REQUIRED' USING ERRCODE='22023'; END IF;
    result:=convert_to(v->>'text','UTF8');
  ELSE
    IF jsonb_typeof(v->'bytesBase64') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'STRING_REQUIRED' USING ERRCODE='22023'; END IF;
    encoded:=v->>'bytesBase64';
    IF encoded !~ '^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$' THEN RAISE EXCEPTION 'BASE64_INVALID' USING ERRCODE='22023'; END IF;
    result:=decode(encoded,'base64');
    IF replace(encode(result,'base64'),E'\n','')<>encoded THEN RAISE EXCEPTION 'BASE64_NONCANONICAL' USING ERRCODE='22023'; END IF;
  END IF;
  IF jsonb_typeof(v->'byteLength') IS DISTINCT FROM 'number' OR (v->>'byteLength')::numeric<0
    OR (v->>'byteLength')::numeric>9007199254740991 OR trunc((v->>'byteLength')::numeric)<>(v->>'byteLength')::numeric
    OR (v->>'byteLength')::numeric<>octet_length(result) THEN RAISE EXCEPTION 'SOURCE_BYTE_LENGTH_MISMATCH' USING ERRCODE='22023'; END IF;
  IF potok_food_evidence.hash_v1(v->'sourceBytesSha256')<>encode(extensions.digest(result,'sha256'),'hex') THEN
    RAISE EXCEPTION 'SOURCE_SHA256_MISMATCH' USING ERRCODE='22023'; END IF;
  expected:=CASE WHEN target_kind='CANONICAL_REVIEWED_REVISION' THEN ARRAY['identitySnapshot'] ELSE ARRAY['calories','protein','fat','carbs','fiber'] END;
  IF jsonb_typeof(v->'mappings') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'SOURCE_MAPPINGS_REQUIRED' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(v->'mappings')<>cardinality(expected) THEN RAISE EXCEPTION 'SOURCE_MAPPING_COVERAGE' USING ERRCODE='22023'; END IF;
  FOR mapping IN SELECT value FROM jsonb_array_elements(v->'mappings') LOOP
    PERFORM potok_food_evidence.exact_keys_v1(mapping,ARRAY['field','sourceField','applicability']);
    PERFORM potok_food_evidence.text_v1(mapping->'sourceField');
    IF NOT coalesce(mapping->>'field'=ANY(expected),false) OR mapping->'applicability' IS DISTINCT FROM app THEN
      RAISE EXCEPTION 'SOURCE_MAPPING_MISMATCH' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v->'mappings') m GROUP BY m->>'field' HAVING count(*)>1) THEN
    RAISE EXCEPTION 'SOURCE_MAPPING_DUPLICATE' USING ERRCODE='22023'; END IF;
  RETURN result;
END $$;

CREATE TABLE potok_food_evidence.retained_sources_v1 (
  source_artifact_id uuid PRIMARY KEY, snapshot jsonb NOT NULL, source_bytes bytea NOT NULL,
  CHECK ((snapshot->>'byteLength')::numeric=octet_length(source_bytes)),
  CHECK (snapshot->>'sourceBytesSha256'=encode(extensions.digest(source_bytes,'sha256'),'hex'))
);
CREATE TABLE potok_food_evidence.canonical_revisions_v1 (
  revision_id uuid PRIMARY KEY, canonical_food_id uuid NOT NULL REFERENCES public.foods(id) ON DELETE RESTRICT,
  food_state text NOT NULL, digest text NOT NULL CHECK (digest~'^[a-f0-9]{64}$'),
  supersedes_revision_id uuid REFERENCES potok_food_evidence.canonical_revisions_v1(revision_id) ON DELETE RESTRICT,
  review_event_id uuid NOT NULL UNIQUE, snapshot jsonb NOT NULL, canonical_bytes bytea NOT NULL,
  UNIQUE (revision_id,digest,canonical_food_id,food_state), CHECK (revision_id IS DISTINCT FROM supersedes_revision_id)
);
CREATE TABLE potok_food_evidence.nutrition_revisions_v1 (
  revision_id uuid PRIMARY KEY, canonical_food_id uuid NOT NULL REFERENCES public.foods(id) ON DELETE RESTRICT,
  food_state text NOT NULL, digest text NOT NULL CHECK (digest~'^[a-f0-9]{64}$'),
  canonical_revision_id uuid NOT NULL, canonical_revision_digest text NOT NULL,
  supersedes_revision_id uuid REFERENCES potok_food_evidence.nutrition_revisions_v1(revision_id) ON DELETE RESTRICT,
  review_event_id uuid NOT NULL UNIQUE, snapshot jsonb NOT NULL, canonical_bytes bytea NOT NULL,
  FOREIGN KEY (canonical_revision_id,canonical_revision_digest,canonical_food_id,food_state)
    REFERENCES potok_food_evidence.canonical_revisions_v1(revision_id,digest,canonical_food_id,food_state) ON DELETE RESTRICT,
  CHECK (revision_id IS DISTINCT FROM supersedes_revision_id)
);
CREATE TABLE potok_food_evidence.review_events_v1 (
  event_id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  idempotency_reference uuid NOT NULL, authority_attestation_id uuid NOT NULL,
  source_artifact_id uuid REFERENCES potok_food_evidence.retained_sources_v1(source_artifact_id) ON DELETE RESTRICT,
  target_kind text NOT NULL, target_revision_id uuid, canonical_food_id uuid NOT NULL REFERENCES public.foods(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('REVIEW_APPROVED','REVIEW_REJECTED','INVALIDATION')),
  severity text CHECK (severity IN ('CORRECTION','SAFETY_CRITICAL')),
  digest text NOT NULL CHECK (digest~'^[a-f0-9]{64}$'), snapshot jsonb NOT NULL, canonical_bytes bytea NOT NULL,
  UNIQUE (actor_id,idempotency_reference),
  FOREIGN KEY (actor_id,authority_attestation_id) REFERENCES potok_control.access_attestations(account_id,attestation_id) ON DELETE RESTRICT,
  CHECK ((kind='REVIEW_REJECTED' AND target_revision_id IS NULL AND severity IS NULL)
    OR (kind='REVIEW_APPROVED' AND target_revision_id IS NOT NULL AND severity IS NULL AND source_artifact_id IS NOT NULL)
    OR (kind='INVALIDATION' AND target_revision_id IS NOT NULL AND severity IS NOT NULL AND source_artifact_id IS NOT NULL))
);
CREATE INDEX review_events_target_v1 ON potok_food_evidence.review_events_v1(target_kind,target_revision_id,kind);
CREATE TABLE potok_food_evidence.review_requests_v1 (
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, idempotency_reference uuid NOT NULL,
  request_digest text NOT NULL CHECK (request_digest~'^[a-f0-9]{64}$'), canonical_request bytea NOT NULL,
  original_proposal_bytes bytea, proposal_digest text, event_id uuid NOT NULL UNIQUE REFERENCES potok_food_evidence.review_events_v1(event_id) ON DELETE RESTRICT,
  receipt jsonb NOT NULL, PRIMARY KEY(actor_id,idempotency_reference)
);
ALTER TABLE potok_food_evidence.review_events_v1 ADD FOREIGN KEY(actor_id,idempotency_reference)
  REFERENCES potok_food_evidence.review_requests_v1(actor_id,idempotency_reference) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE potok_food_evidence.canonical_revisions_v1 ADD FOREIGN KEY(review_event_id)
  REFERENCES potok_food_evidence.review_events_v1(event_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE potok_food_evidence.nutrition_revisions_v1 ADD FOREIGN KEY(review_event_id)
  REFERENCES potok_food_evidence.review_events_v1(event_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE potok_food_evidence.current_heads_v1 (
  target_kind text NOT NULL CHECK(target_kind IN ('CANONICAL_REVIEWED_REVISION','NUTRITION_REVIEWED_REVISION')),
  canonical_food_id uuid NOT NULL REFERENCES public.foods(id) ON DELETE RESTRICT,
  food_state text NOT NULL CHECK(food_state IN ('raw','dry','frozen','cooked','as-sold')),
  revision_id uuid NOT NULL, digest text NOT NULL, last_event_id uuid NOT NULL REFERENCES potok_food_evidence.review_events_v1(event_id) ON DELETE RESTRICT,
  PRIMARY KEY(target_kind,canonical_food_id,food_state)
);

CREATE FUNCTION potok_food_evidence.reject_mutation_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_FOOD_EVIDENCE' USING ERRCODE='42501'; END $$;
DO $secure_tables$
DECLARE name text;
BEGIN
  FOREACH name IN ARRAY ARRAY['retained_sources_v1','canonical_revisions_v1','nutrition_revisions_v1','review_events_v1','review_requests_v1','current_heads_v1'] LOOP
    EXECUTE format('ALTER TABLE potok_food_evidence.%I ENABLE ROW LEVEL SECURITY',name);
    EXECUTE format('ALTER TABLE potok_food_evidence.%I FORCE ROW LEVEL SECURITY',name);
    EXECUTE format('REVOKE ALL ON potok_food_evidence.%I FROM PUBLIC,anon,authenticated,service_role',name);
    IF name<>'current_heads_v1' THEN
      EXECUTE format('CREATE TRIGGER immutable_v1 BEFORE UPDATE OR DELETE OR TRUNCATE ON potok_food_evidence.%I FOR EACH STATEMENT EXECUTE FUNCTION potok_food_evidence.reject_mutation_v1()',name);
    END IF;
  END LOOP;
END $secure_tables$;

-- This is a PostgREST JWT gateway boundary, NOT an arbitrary JSON/JWT decoder.
-- Supabase verifies the JWT cryptographically before setting these protected request claims.
CREATE FUNCTION potok_food_evidence.authority_v1() RETURNS uuid
LANGUAGE plpgsql VOLATILE SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); claims jsonb:=auth.jwt(); att potok_control.access_attestations%ROWTYPE; now_at timestamptz;
  anonymous_user boolean; session_not_after timestamptz;
BEGIN
  -- Exact replay/CAS reads after advisory waits require fresh statement snapshots.
  IF current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'READ_COMMITTED_TRANSACTION_REQUIRED' USING ERRCODE='25000'; END IF;
  IF actor IS NULL OR claims->>'role' IS DISTINCT FROM 'authenticated'
    OR claims->>'sub' IS DISTINCT FROM actor::text THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  -- Same gate as the existing entitlement grant/revoke writers; do not create another entitlement ledger.
  PERFORM pg_advisory_xact_lock(hashtextextended('potok-entitlement-v2:'||actor::text||':admin',0));
  SELECT is_anonymous INTO anonymous_user FROM auth.users WHERE id=actor FOR SHARE;
  IF NOT FOUND OR anonymous_user IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'LIVE_AUTH_SESSION_REQUIRED' USING ERRCODE='42501'; END IF;
  SELECT not_after INTO session_not_after FROM auth.sessions
    WHERE id=potok_food_evidence.uuid_v1(claims->'session_id') AND user_id=actor FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LIVE_AUTH_SESSION_REQUIRED' USING ERRCODE='42501'; END IF;
  -- Auth row locks can wait too. Never use a time captured before that wait.
  now_at:=clock_timestamp();
  IF coalesce(claims->>'exp','') !~ '^[0-9]{1,12}$'
    OR (claims->>'exp')::numeric<=extract(epoch FROM now_at) THEN RAISE EXCEPTION 'JWT_EXPIRED' USING ERRCODE='42501'; END IF;
  IF session_not_after IS NOT NULL AND session_not_after<=now_at THEN
    RAISE EXCEPTION 'LIVE_AUTH_SESSION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NOT potok_control.is_effective_entitlement_v2(actor,'admin',now_at) THEN RAISE EXCEPTION 'VERIFIED_ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;
  SELECT * INTO STRICT att FROM potok_control.access_attestations
    WHERE account_id=actor AND capability='admin' AND issued_at<=now_at ORDER BY lineage_sequence DESC LIMIT 1;
  IF att.effect<>'GRANT' OR (att.valid_until IS NOT NULL AND att.valid_until<=now_at)
    OR (SELECT count(*) FROM public.user_profiles WHERE user_id=actor AND admin_provenance_id=att.attestation_id
      AND admin_valid_until IS NOT DISTINCT FROM att.valid_until)<>1 THEN
    RAISE EXCEPTION 'ADMIN_PROVENANCE_MISMATCH' USING ERRCODE='42501'; END IF;
  RETURN att.attestation_id;
END $$;

CREATE FUNCTION potok_food_evidence.shared_food_v1(food_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
  SELECT to_jsonb(f) INTO result FROM public.foods f WHERE f.id=food_id FOR UPDATE;
  IF result IS NULL THEN RAISE EXCEPTION 'FOOD_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  RETURN result;
END $$;
CREATE FUNCTION potok_food_evidence.identity_v1(food jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('name',food->'name','nameOriginal',food->'name_original','normalizedName',food->'normalized_name',
   'brand',food->'brand','normalizedBrand',food->'normalized_brand','barcode',food->'barcode','aliases',coalesce(nullif(food->'aliases','null'::jsonb),'[]'::jsonb))
$$;

CREATE FUNCTION potok_food_evidence.revision_v1(target jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
<<revision_scope>>
DECLARE result jsonb; revision_id uuid; stored_bytes bytea; stored_state text; domain text; expected_contract text; proposal jsonb;
BEGIN
  PERFORM potok_food_evidence.exact_keys_v1(target,ARRAY['kind','revisionId','digest','canonicalFoodId']);
  revision_id:=potok_food_evidence.uuid_v1(target->'revisionId');
  PERFORM potok_food_evidence.uuid_v1(target->'canonicalFoodId'); PERFORM potok_food_evidence.hash_v1(target->'digest');
  IF target->>'kind'='CANONICAL_REVIEWED_REVISION' THEN
    SELECT snapshot,canonical_bytes,food_state INTO result,stored_bytes,stored_state
      FROM potok_food_evidence.canonical_revisions_v1 WHERE canonical_revisions_v1.revision_id=revision_scope.revision_id;
    domain:='potok-canonical-food-reviewed-revision-sha256-v1'; expected_contract:='potok-canonical-food-reviewed-revision-v1';
  ELSIF target->>'kind'='NUTRITION_REVIEWED_REVISION' THEN
    SELECT snapshot,canonical_bytes,food_state INTO result,stored_bytes,stored_state
      FROM potok_food_evidence.nutrition_revisions_v1 WHERE nutrition_revisions_v1.revision_id=revision_scope.revision_id;
    domain:='potok-nutrition-reviewed-revision-sha256-v1'; expected_contract:='potok-nutrition-reviewed-revision-v1';
  ELSE RAISE EXCEPTION 'TARGET_KIND_INVALID' USING ERRCODE='22023'; END IF;
  IF result IS NULL OR result->'revisionId' IS DISTINCT FROM target->'revisionId'
    OR result->'digest' IS DISTINCT FROM target->'digest' OR result->'canonicalFoodId' IS DISTINCT FROM target->'canonicalFoodId' THEN
    RAISE EXCEPTION 'EXACT_TARGET_REQUIRED' USING ERRCODE='40001'; END IF;
  IF result->>'contract' IS DISTINCT FROM expected_contract OR result->>'encoding' IS DISTINCT FROM 'potok-food-reviewed-evidence-canonical-json-v1'
    OR result->>'foodState' IS DISTINCT FROM stored_state
    OR stored_bytes IS DISTINCT FROM convert_to(potok_food_evidence.canonical_json_v1(result),'UTF8')
    OR result->>'digest' IS DISTINCT FROM potok_food_evidence.digest_v1(domain,result-'digest') THEN
    RAISE EXCEPTION 'STORED_REVISION_INTEGRITY_FAILURE' USING ERRCODE='40001'; END IF;
  PERFORM potok_food_evidence.uuid_v1(result->'reviewEventId');
  IF result->'supersedesRevisionId' IS DISTINCT FROM 'null'::jsonb THEN
    IF potok_food_evidence.uuid_v1(result->'supersedesRevisionId')=revision_id THEN RAISE EXCEPTION 'SELF_SUPERSESSION' USING ERRCODE='22023'; END IF;
  END IF;
  IF target->>'kind'='CANONICAL_REVIEWED_REVISION' THEN
    PERFORM potok_food_evidence.exact_keys_v1(result,ARRAY['contract','encoding','revisionId','supersedesRevisionId','reviewEventId','digest',
      'foodId','canonicalFoodId','foodStableId','identitySnapshot','source','foodState','applicability','sharedCatalogAccessible']);
    IF result->'foodId' IS DISTINCT FROM result->'canonicalFoodId' THEN RAISE EXCEPTION 'CANONICAL_ROOT_REQUIRED'; END IF;
    proposal:=(result-ARRAY['contract','encoding','revisionId','supersedesRevisionId','reviewEventId','digest','foodId'])
      ||jsonb_build_object('contract','potok-canonical-food-review-proposal-v1');
  ELSE
    PERFORM potok_food_evidence.exact_keys_v1(result,ARRAY['contract','encoding','revisionId','supersedesRevisionId','reviewEventId','digest',
      'canonicalRevisionId','canonicalRevisionDigest','canonicalFoodId','nutrition','basis','units','foodState','applicability']);
    proposal:=(result-ARRAY['contract','encoding','revisionId','supersedesRevisionId','reviewEventId','digest'])
      ||jsonb_build_object('contract','potok-nutrition-review-proposal-v1');
  END IF;
  PERFORM potok_food_evidence.proposal_v1(proposal);
  RETURN result;
END $$;
CREATE FUNCTION potok_food_evidence.invalidated_v1(target_kind text, revision_id uuid) RETURNS text
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT CASE WHEN bool_or(severity='SAFETY_CRITICAL') THEN 'SAFETY_CRITICAL'
             WHEN count(*)>0 THEN 'CORRECTION' ELSE NULL END
 FROM potok_food_evidence.review_events_v1 e
 WHERE e.target_kind=invalidated_v1.target_kind AND e.target_revision_id=invalidated_v1.revision_id AND e.kind='INVALIDATION'
$$;

CREATE FUNCTION public.food_evidence_review_v1(p_request_text text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
<<food_review_scope>>
DECLARE actor uuid:=auth.uid(); attestation uuid; raw json; request jsonb; canonical_request bytea; request_digest text;
  proposal jsonb; target jsonb; target_kind text; food_id uuid; food jsonb; state text; source jsonb; source_bytes bytea;
  app jsonb; head potok_food_evidence.current_heads_v1%ROWTYPE; previous uuid; event_id uuid; revision_id uuid;
  revision jsonb; canonical jsonb; event jsonb; receipt jsonb; existing potok_food_evidence.review_requests_v1%ROWTYPE;
  key uuid; prop_digest text; prop_domain text; timestamp_text text; proposal_bytes bytea;
BEGIN
  attestation:=potok_food_evidence.authority_v1();
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
  -- Common eligibility lock order: actor gate -> root row -> registry -> evidence head.
  food:=potok_food_evidence.shared_food_v1(food_id);
  attestation:=potok_food_evidence.authority_v1();
  IF request->>'kind'='REVIEW_REJECTED' AND (food->>'canonical_food_id' IS DISTINCT FROM food_id::text
    OR coalesce(food->>'source','') NOT IN ('core','brand') OR food->'created_by_user_id' IS DISTINCT FROM 'null'::jsonb
    OR coalesce(food->>'stable_food_id','') !~ '^[a-z0-9][a-z0-9_-]{0,127}$') THEN
    RAISE EXCEPTION 'SHARED_CANONICAL_ROOT_REQUIRED'; END IF;
  IF request->>'kind'='REVIEW_APPROVED' AND NOT potok_shared_food_eligibility.eligible_v1(food) THEN
    RAISE EXCEPTION 'EXPLICIT_SHARED_FOOD_ELIGIBILITY_REQUIRED' USING ERRCODE='42501'; END IF;
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
      IF NOT potok_shared_food_eligibility.evidence_bound_v1('CANONICAL_REVIEWED_REVISION',(canonical->>'revisionId')::uuid,food)
        OR canonical->'applicability' IS DISTINCT FROM app
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
    PERFORM potok_shared_food_eligibility.bind_evidence_v1(event_id,food);
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
ALTER FUNCTION public.food_evidence_review_v1(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.food_evidence_review_v1(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.food_evidence_review_v1(text) TO authenticated;

CREATE FUNCTION public.food_evidence_receipt_v1(p_idempotency_reference uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
  PERFORM potok_food_evidence.authority_v1();
  SELECT receipt INTO result FROM potok_food_evidence.review_requests_v1
    WHERE actor_id=auth.uid() AND idempotency_reference=p_idempotency_reference;
  IF result IS NULL THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  -- Recovery has the same six-field wire contract as an exact review retry.
  RETURN result||jsonb_build_object('replayed',true);
END $$;
REVOKE ALL ON FUNCTION public.food_evidence_receipt_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.food_evidence_receipt_v1(uuid) TO authenticated;

CREATE FUNCTION public.food_evidence_current_v1(p_canonical_food_id uuid,p_food_state text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE food jsonb; c jsonb; n jsonb; c_severity text; n_severity text; c_usable boolean:=false; n_usable boolean:=false;
BEGIN
  PERFORM potok_food_evidence.authority_v1();
  PERFORM potok_food_evidence.applicability_v1(jsonb_build_object('kind','EXACT_FOOD_STATE','foodState',p_food_state),p_food_state);
  food:=potok_food_evidence.shared_food_v1(p_canonical_food_id);
  -- Read authorization must also remain fresh after food/catalog lock waits.
  PERFORM potok_food_evidence.authority_v1();
  SELECT jsonb_build_object('kind',h.target_kind,'revisionId',h.revision_id,'digest',h.digest,'canonicalFoodId',h.canonical_food_id) INTO c FROM potok_food_evidence.current_heads_v1 h
    WHERE h.target_kind='CANONICAL_REVIEWED_REVISION' AND h.canonical_food_id=p_canonical_food_id AND h.food_state=p_food_state;
  SELECT jsonb_build_object('kind',h.target_kind,'revisionId',h.revision_id,'digest',h.digest,'canonicalFoodId',h.canonical_food_id) INTO n FROM potok_food_evidence.current_heads_v1 h
    WHERE h.target_kind='NUTRITION_REVIEWED_REVISION' AND h.canonical_food_id=p_canonical_food_id AND h.food_state=p_food_state;
  IF c IS NOT NULL THEN
    c:=potok_food_evidence.revision_v1(c);
    IF c->>'foodState' IS DISTINCT FROM p_food_state THEN RAISE EXCEPTION 'CURRENT_HEAD_INTEGRITY_FAILURE'; END IF;
    c_severity:=potok_food_evidence.invalidated_v1('CANONICAL_REVIEWED_REVISION',(c->>'revisionId')::uuid);
    c_usable:=potok_shared_food_eligibility.eligible_v1(food)
      AND potok_shared_food_eligibility.evidence_bound_v1('CANONICAL_REVIEWED_REVISION',(c->>'revisionId')::uuid,food) AND c_severity IS NULL AND c->'identitySnapshot'=potok_food_evidence.identity_v1(food)
      AND c->'foodStableId'=food->'stable_food_id' AND c->'source'=food->'source';
  END IF;
  IF n IS NOT NULL THEN
    n:=potok_food_evidence.revision_v1(n);
    IF n->>'foodState' IS DISTINCT FROM p_food_state THEN RAISE EXCEPTION 'CURRENT_HEAD_INTEGRITY_FAILURE'; END IF;
    n_severity:=potok_food_evidence.invalidated_v1('NUTRITION_REVIEWED_REVISION',(n->>'revisionId')::uuid);
    n_usable:=c_usable AND potok_shared_food_eligibility.evidence_bound_v1('NUTRITION_REVIEWED_REVISION',(n->>'revisionId')::uuid,food) AND n_severity IS NULL AND n->'canonicalRevisionId'=c->'revisionId' AND n->'canonicalRevisionDigest'=c->'digest';
  END IF;
  RETURN jsonb_build_object('contract','potok-food-evidence-current-state-v1','canonicalRevision',c,'nutritionRevision',n,
    'canonicalInvalidation',c_severity,'nutritionInvalidation',n_severity,'canonicalUsable',c_usable,'nutritionUsable',n_usable);
END $$;
REVOKE ALL ON FUNCTION public.food_evidence_current_v1(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.food_evidence_current_v1(uuid,text) TO authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA potok_food_evidence FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON FUNCTION public.food_evidence_review_v1(text) IS
  'Staging-first JWT/active-session/trusted-attestation atomic issuance; no food/catalog/diary writes. Inactive until separately approved migration apply.';
COMMIT;
