-- GENERATED INACTIVE STAGING PACKAGE. No live application is authorized.
-- One transaction; no intermediate component commit or client-opening window.
-- Source base: 5062132a78b863d2630533e6d3a86526680a539b. Reviewed Auth inventory must be supplied independently.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
DO $bundle$
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN
  RAISE EXCEPTION 'EVIDENCE_BUNDLE_SQL_OWNER_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF current_setting('potok_evidence.bundle_target',true) IS DISTINCT FROM 'staging:ozidryfvhkcbtpnulakq' THEN
  RAISE EXCEPTION 'EVIDENCE_BUNDLE_STAGING_TARGET_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF coalesce(current_setting('potok_closure.reviewed_auth_triggers_sha256',true),'') !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'EVIDENCE_BUNDLE_REVIEWED_AUTH_INVENTORY_REQUIRED' USING ERRCODE='42501';
 END IF;
END $bundle$;
SET LOCAL potok_food_evidence.admission_columns_target='staging:ozidryfvhkcbtpnulakq';
SET LOCAL potok_food_evidence.rollout_target='staging:ozidryfvhkcbtpnulakq';
SET LOCAL potok_nonfood.rollout_target='staging:ozidryfvhkcbtpnulakq';
SET LOCAL potok_closure.rollout_target='staging:ozidryfvhkcbtpnulakq';
SET LOCAL potok_closure.registration_rollout_target='staging:ozidryfvhkcbtpnulakq';
-- BEGIN PINNED COMPONENT supabase/migration_drafts/food_evidence_admission_columns_v1.sql SHA256 624b60b133ee2b22ff3535bb312df6a1df3affc39c739eb1980154559a96bb60
-- INACTIVE STAGING DRAFT. Schema support only, not catalog approval/publication.
-- NULL means unreviewed/unknown. No default, backfill, grant or policy change.
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
DO $preflight$
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN
  RAISE EXCEPTION 'FOOD_ADMISSION_SQL_OWNER_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF current_setting('potok_food_evidence.admission_columns_target',true)
    IS DISTINCT FROM 'staging:ozidryfvhkcbtpnulakq' THEN
  RAISE EXCEPTION 'FOOD_ADMISSION_STAGING_TARGET_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF to_regclass('public.foods') IS NULL THEN
  RAISE EXCEPTION 'FOOD_ADMISSION_BASE_SCHEMA_REQUIRED';
 END IF;
 -- Serialize metadata review and both additions; concurrent drift cannot be skipped.
 LOCK TABLE public.foods IN ACCESS EXCLUSIVE MODE;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.foods'::regclass
   AND relkind='r' AND pg_get_userbyid(relowner)=current_user) THEN
  RAISE EXCEPTION 'FOOD_ADMISSION_BASE_OWNER_REQUIRED';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.foods'::regclass
   AND attnum>0 AND NOT attisdropped AND attname IN('is_searchable','needs_review')) THEN
  RAISE EXCEPTION 'FOOD_ADMISSION_EXISTING_COLUMNS_REQUIRE_REVIEW';
 END IF;
 IF (SELECT count(*) FROM pg_attribute WHERE attrelid='public.foods'::regclass
   AND attnum>0 AND NOT attisdropped AND attname IN('id','canonical_food_id','stable_food_id',
    'source','created_by_user_id','name','name_original','normalized_name','brand',
    'normalized_brand','barcode','aliases'))<>12 THEN
  RAISE EXCEPTION 'FOOD_ADMISSION_BASE_SCHEMA_REQUIRED';
 END IF;
END $preflight$;
ALTER TABLE public.foods ADD COLUMN is_searchable boolean, ADD COLUMN needs_review boolean;
-- END PINNED COMPONENT supabase/migration_drafts/food_evidence_admission_columns_v1.sql

-- BEGIN PINNED COMPONENT supabase/migration_drafts/food_reviewed_evidence_v1_phase2b.sql SHA256 0ac2a0de2f118cd111c1518d5180eb6f6c9313eff522591014a63552287f9d82
-- STAGING-FIRST REVIEW DRAFT. NOT APPLIED. No runtime/production activation.
-- Supabase CLI is unavailable in Cloud: package this reviewed draft with
-- `supabase migration new ...` only in the separately approved rollout workspace.
-- Requires deployed trusted entitlement v2/v2.1/v2.2, not legacy is_admin.
-- The owner must verify the project ref and explicitly acknowledge this target
-- in THIS migration session. This marker is not an authorization mechanism.

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
        'is_searchable','needs_review','name','name_original','normalized_name','brand','normalized_brand','barcode','aliases');
  IF v_count<>14 THEN RAISE EXCEPTION 'EXISTING_CANONICAL_FOOD_SCHEMA_REQUIRED'; END IF;
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
  SELECT to_jsonb(f) INTO result FROM public.foods f WHERE f.id=food_id FOR SHARE;
  IF result IS NULL OR result->>'canonical_food_id' IS DISTINCT FROM food_id::text
    OR result->>'source' IS NULL OR result->>'source' NOT IN ('core','brand') OR result->'created_by_user_id' IS DISTINCT FROM 'null'::jsonb
    OR result->'is_searchable' IS DISTINCT FROM 'true'::jsonb OR result->'needs_review' IS DISTINCT FROM 'false'::jsonb
    OR coalesce(result->>'stable_food_id','') !~ '^[a-z0-9][a-z0-9_-]{0,127}$' THEN
    RAISE EXCEPTION 'SHARED_CANONICAL_ROOT_REQUIRED' USING ERRCODE='42501'; END IF;
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
  PERFORM pg_advisory_xact_lock(hashtextextended('potok-food-evidence-v1:'||p_canonical_food_id::text,0));
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
    c_usable:=c_severity IS NULL AND c->'identitySnapshot'=potok_food_evidence.identity_v1(food)
      AND c->'foodStableId'=food->'stable_food_id' AND c->'source'=food->'source';
  END IF;
  IF n IS NOT NULL THEN
    n:=potok_food_evidence.revision_v1(n);
    IF n->>'foodState' IS DISTINCT FROM p_food_state THEN RAISE EXCEPTION 'CURRENT_HEAD_INTEGRITY_FAILURE'; END IF;
    n_severity:=potok_food_evidence.invalidated_v1('NUTRITION_REVIEWED_REVISION',(n->>'revisionId')::uuid);
    n_usable:=c_usable AND n_severity IS NULL AND n->'canonicalRevisionId'=c->'revisionId' AND n->'canonicalRevisionDigest'=c->'digest';
  END IF;
  RETURN jsonb_build_object('contract','potok-food-evidence-current-state-v1','canonicalRevision',c,'nutritionRevision',n,
    'canonicalInvalidation',c_severity,'nutritionInvalidation',n_severity,'canonicalUsable',c_usable,'nutritionUsable',n_usable);
END $$;
REVOKE ALL ON FUNCTION public.food_evidence_current_v1(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.food_evidence_current_v1(uuid,text) TO authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA potok_food_evidence FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON FUNCTION public.food_evidence_review_v1(text) IS
  'Staging-first JWT/active-session/trusted-attestation atomic issuance; no food/catalog/diary writes. Inactive until separately approved migration apply.';
-- END PINNED COMPONENT supabase/migration_drafts/food_reviewed_evidence_v1_phase2b.sql

-- BEGIN PINNED COMPONENT supabase/migration_drafts/nonfood_reviewed_evidence_v1_staging.sql SHA256 903aa7f30e9503d8b7de41071bca2e9e91f90f72e35f2c362d52c2c228a4ab36
-- INACTIVE STAGING INSTALL DRAFT. Closed RPCs; no evidence or client activation.
-- Original disposable package stays unchanged. No live target is authorized here.
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
DO $preflight$
DECLARE item record; p record;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN
  RAISE EXCEPTION 'NONFOOD_STAGING_SQL_OWNER_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF current_setting('potok_nonfood.rollout_target',true) IS DISTINCT FROM 'staging:ozidryfvhkcbtpnulakq' THEN
  RAISE EXCEPTION 'NONFOOD_STAGING_TARGET_REQUIRED' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('potok-nonfood-v1:install',0));
 IF to_regnamespace('potok_nonfood') IS NOT NULL OR
    to_regprocedure('public.nonfood_evidence_review_v1(text)') IS NOT NULL OR
    to_regprocedure('public.nonfood_evidence_receipt_v1(uuid)') IS NOT NULL OR
    to_regprocedure('public.nonfood_evidence_current_v1(uuid)') IS NOT NULL THEN
  RAISE EXCEPTION 'NONFOOD_STAGING_EXISTING_OBJECTS_REQUIRE_REVIEW';
 END IF;
 IF (SELECT count(*) FROM pg_roles WHERE rolname IN('anon','authenticated','service_role'))<>3
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('anon','authenticated')
  AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication))
 OR pg_has_role('anon','postgres','MEMBER') OR pg_has_role('authenticated','postgres','MEMBER')
 OR pg_has_role('service_role','postgres','MEMBER') THEN
  RAISE EXCEPTION 'NONFOOD_STAGING_CLIENT_ROLE_ISOLATION_REQUIRED';
 END IF;
 FOR item IN SELECT * FROM (VALUES
  ('potok_food_evidence.exact_keys_v1(jsonb,text[])','164dfeef27be7a000f571ff9466a3c589477d34b15d8e6012e95ec25a2f476b6'),
  ('potok_food_evidence.text_v1(jsonb,boolean)','dbc3c934017c9a78017727d46ebbb0c8d6d2e8d4b171314de5358e2bf0740167'),
  ('potok_food_evidence.uuid_v1(jsonb)','2abed90bb941279a8758fbdb8d082afe2278e18d5ba4b5d55cb429c150f5abc9'),
  ('potok_food_evidence.hash_v1(jsonb)','7a03850b2e2aa76f04da60521d139fec4a5df2795597e23ee621c48757363a3a'),
  ('potok_food_evidence.reject_negative_zero_v1(json)','c6c124d0d2675eb131441f37e0be08abdbf345416d69102579a02ed6cb443ae6'),
  ('potok_food_evidence.integer_values_v1(jsonb)','4a94470ae0f7b9e14e166a22edd4308902e492fde5cfb45d1cca6c6c36252573'),
  ('potok_food_evidence.canonical_json_v1(jsonb)','bca8d0e1a52cf2815ec0a6bf9050759f9db734aaef1fa79afde9e832558e65f1'),
  ('potok_food_evidence.digest_v1(text,jsonb)','ea017d8dc3781d4aebb2e7706f842a8a33e8b0479b3674b1b3652876c0862815'),
  ('potok_food_evidence.artifact_v1(text,jsonb)','bb0182e67723a4bdef3ee932b79f03e15185e8e8a918ca5e1f2f37cd963a2e79'),
  ('potok_food_evidence.applicability_v1(jsonb,text)','6346e4caa755c071a539aec89c1072751bcdcd667ec73e163d7ef4086ff4f530'),
  ('potok_food_evidence.source_v1(jsonb,text,jsonb)','c2230c1ff242fae308dccb7dca1606aac39457983a6679490cdca54c2b112059'),
  ('potok_food_evidence.authority_v1()','3b4245c422e32bf14b66cdcf7b2ba9d92feeda375fc3791fdaeefe90b44e76bd'),
  ('potok_food_evidence.reject_mutation_v1()','113a6c251372e8e3501096a9ff3c9a26e360e2b8b48ae039ae719053774f5f97')
 ) AS expected(signature,sha256) LOOP
  SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(item.signature);
  IF NOT FOUND THEN RAISE EXCEPTION 'NONFOOD_STAGING_DEPENDENCY_REQUIRED: %',item.signature; END IF;
  IF pg_get_userbyid(p.proowner)<>'postgres' OR p.prosecdef
   OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
   OR encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex')<>item.sha256 THEN
   RAISE EXCEPTION 'NONFOOD_STAGING_DEPENDENCY_DRIFT: %',item.signature;
  END IF;
 END LOOP;
END $preflight$;
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
 occurred_at timestamptz NOT NULL,snapshot jsonb NOT NULL,bytes bytea NOT NULL,UNIQUE(actor_id,request_key),
 CONSTRAINT events_occurrence_snapshot_v1 CHECK(jsonb_typeof(snapshot->'occurredAt') IS NOT DISTINCT FROM 'string'
  AND snapshot->>'occurredAt'=to_char(occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
 FOREIGN KEY(actor_id,authority_id) REFERENCES potok_control.access_attestations(account_id,attestation_id) ON DELETE RESTRICT);
CREATE INDEX events_definition_chronology_v1 ON potok_nonfood.events_v1(definition_id,occurred_at,event_id);
CREATE TABLE potok_nonfood.definitions_v1(revision_id uuid PRIMARY KEY,definition_id uuid NOT NULL REFERENCES potok_nonfood.roots_v1 ON DELETE RESTRICT,
 digest text NOT NULL,supersedes uuid REFERENCES potok_nonfood.definitions_v1 ON DELETE RESTRICT,
 event_id uuid NOT NULL UNIQUE REFERENCES potok_nonfood.events_v1 ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
 snapshot jsonb NOT NULL,bytes bytea NOT NULL,UNIQUE(definition_id,revision_id,digest),
 CONSTRAINT definitions_no_self_supersession_v1 CHECK (revision_id IS DISTINCT FROM supersedes));
CREATE TABLE potok_nonfood.nutrition_v1(revision_id uuid PRIMARY KEY,definition_id uuid NOT NULL REFERENCES potok_nonfood.roots_v1 ON DELETE RESTRICT,
 definition_revision uuid NOT NULL,definition_digest text NOT NULL,digest text NOT NULL,
 supersedes uuid REFERENCES potok_nonfood.nutrition_v1 ON DELETE RESTRICT,
 event_id uuid NOT NULL UNIQUE REFERENCES potok_nonfood.events_v1 ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
 snapshot jsonb NOT NULL,bytes bytea NOT NULL,UNIQUE(definition_id,revision_id,digest),
 CONSTRAINT nutrition_no_self_supersession_v1 CHECK (revision_id IS DISTINCT FROM supersedes),
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
 k text;d uuid;rev jsonb;def jsonb;head jsonb;prev uuid;rid uuid;eid uuid;event_at timestamptz;ev jsonb;receipt jsonb;target jsonb;action text;
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
 SELECT coalesce(jsonb_agg(snapshot ORDER BY occurred_at,event_id),'[]'::jsonb) INTO events FROM potok_nonfood.events_v1 WHERE definition_id=p_definition_id;
 PERFORM potok_food_evidence.authority_v1();
 RETURN jsonb_build_object('contract','potok-nonfood-current-v1','definitionRevision',d,'nutritionRevision',n,'heads',potok_nonfood.heads_json_v1(p_definition_id),
 'definitionUsable',du,'nutritionUsable',coalesce(nu,false),'events',events);
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA potok_nonfood FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.nonfood_evidence_review_v1(text),public.nonfood_evidence_receipt_v1(uuid),public.nonfood_evidence_current_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
-- END PINNED COMPONENT supabase/migration_drafts/nonfood_reviewed_evidence_v1_staging.sql

-- BEGIN PINNED COMPONENT supabase/migration_drafts/nonfood_reviewed_evidence_v1_staging.postcheck.sql SHA256 751caa919ea29ed0eb1ab645864639b639dec36c12d23878d14ca9aa7a22b8d3
-- Closed Staging installation postcheck. SELECT/catalog checks only; no evidence readout.
DO $$ DECLARE r text;f text;t record;has_rows boolean;BEGIN
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='potok_nonfood' AND c.relkind='r')<>7 THEN RAISE EXCEPTION 'NONFOOD_TABLE_INVENTORY_DRIFT'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='potok_nonfood.events_v1'::regclass AND conname='events_occurrence_snapshot_v1' AND contype='c') THEN RAISE EXCEPTION 'EVENT_CHRONOLOGY_CONSTRAINT_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='potok_nonfood.definitions_v1'::regclass AND conname='definitions_no_self_supersession_v1' AND contype='c'
  AND pg_get_constraintdef(oid)='CHECK ((revision_id IS DISTINCT FROM supersedes))') THEN RAISE EXCEPTION 'DEFINITION_SELF_SUPERSESSION_CONSTRAINT_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='potok_nonfood.nutrition_v1'::regclass AND conname='nutrition_no_self_supersession_v1' AND contype='c'
  AND pg_get_constraintdef(oid)='CHECK ((revision_id IS DISTINCT FROM supersedes))') THEN RAISE EXCEPTION 'NUTRITION_SELF_SUPERSESSION_CONSTRAINT_REQUIRED'; END IF;
 FOR t IN SELECT c.oid,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='potok_nonfood' AND c.relkind='r' LOOP
  IF NOT t.relrowsecurity OR NOT t.relforcerowsecurity THEN RAISE EXCEPTION 'FORCE_RLS_REQUIRED';END IF;
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF has_table_privilege(r,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') OR has_any_column_privilege(r,t.oid,'INSERT,UPDATE') THEN RAISE EXCEPTION 'TABLE_PRIVILEGE_FORBIDDEN'; END IF;
  END LOOP;
   IF EXISTS(SELECT 1 FROM pg_class WHERE oid=t.oid AND pg_get_userbyid(relowner)<>'postgres') THEN RAISE EXCEPTION 'NONFOOD_STAGING_OWNER_DRIFT'; END IF;
 END LOOP;
 FOREACH f IN ARRAY ARRAY['public.nonfood_evidence_review_v1(text)','public.nonfood_evidence_receipt_v1(uuid)','public.nonfood_evidence_current_v1(uuid)'] LOOP
  IF has_function_privilege('authenticated',f,'EXECUTE') OR has_function_privilege('anon',f,'EXECUTE') OR has_function_privilege('service_role',f,'EXECUTE') THEN RAISE EXCEPTION 'RPC_ACL_DRIFT'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE connamespace='potok_nonfood'::regnamespace AND contype='f' AND confdeltype<>'r') THEN RAISE EXCEPTION 'RETENTION_RESTRICT_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE connamespace='potok_nonfood'::regnamespace AND contype='f' AND confrelid='public.foods'::regclass) THEN RAISE EXCEPTION 'FOOD_NAMESPACE_CONTAMINATION'; END IF;
 FOREACH r IN ARRAY ARRAY['roots_v1','sources_v1','events_v1','definitions_v1','nutrition_v1','heads_v1','receipts_v1'] LOOP
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM potok_nonfood.%I)',r) INTO has_rows;
  IF has_rows THEN RAISE EXCEPTION 'NONFOOD_STAGING_EMPTY_INSTALL_REQUIRED'; END IF;
 END LOOP;
END $$;
-- END PINNED COMPONENT supabase/migration_drafts/nonfood_reviewed_evidence_v1_staging.postcheck.sql

-- BEGIN PINNED COMPONENT supabase/migration_drafts/account_closure_admission_v1.sql SHA256 b5f9064a5f00f9503b44761d1e09f1488d03b5379d798dbc8d2d8f5340cd291e
-- INACTIVE REVIEW DRAFT. No live apply/rollout is authorized by this file.
-- Admission + owner CLOSING request only. No deletion, CLOSED, backfill or activation.
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
-- END PINNED COMPONENT supabase/migration_drafts/account_closure_admission_v1.sql

-- BEGIN PINNED COMPONENT supabase/migration_drafts/account_state_registration_v1.sql SHA256 ad677a04a086ad03f2e59b01ac189651b93361aea69de6e3533d5ead09601765
-- INACTIVE REVIEW DRAFT. No live Auth trigger, backfill or rollout is authorized.
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
 SELECT encode(extensions.digest(convert_to(coalesce(string_agg(pg_get_triggerdef(t.oid)||':'||t.tgenabled::text||':'||pg_get_userbyid(p.proowner)::text||':'||p.prosecdef::text||':'||coalesce(array_to_string(p.proconfig,','),'')||':'||
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
-- END PINNED COMPONENT supabase/migration_drafts/account_state_registration_v1.sql

-- Close every application entry before this transaction can become visible.
REVOKE ALL ON FUNCTION public.food_evidence_review_v1(text),public.food_evidence_receipt_v1(uuid),public.food_evidence_current_v1(uuid,text),public.nonfood_evidence_review_v1(text),public.nonfood_evidence_receipt_v1(uuid),public.nonfood_evidence_current_v1(uuid),public.account_closure_begin_v1(text) FROM PUBLIC,anon,authenticated,service_role;
DO $closed$
DECLARE signature text; r text;
BEGIN
 FOREACH signature IN ARRAY ARRAY['public.food_evidence_review_v1(text)','public.food_evidence_receipt_v1(uuid)','public.food_evidence_current_v1(uuid,text)','public.nonfood_evidence_review_v1(text)','public.nonfood_evidence_receipt_v1(uuid)','public.nonfood_evidence_current_v1(uuid)','public.account_closure_begin_v1(text)'] LOOP
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF has_function_privilege(r,signature,'EXECUTE') THEN RAISE EXCEPTION 'EVIDENCE_BUNDLE_RPC_MUST_STAY_CLOSED'; END IF;
  END LOOP;
 END LOOP;
 IF EXISTS(SELECT 1 FROM potok_closure.accounts_v1) OR EXISTS(SELECT 1 FROM potok_closure.registration_records_v1)
 OR EXISTS(SELECT 1 FROM potok_closure.registration_permits_v1) THEN
  RAISE EXCEPTION 'EVIDENCE_BUNDLE_NO_EXISTING_ACCOUNT_BACKFILL';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass
  AND tgname='potok_closure_register_new_auth_v1' AND tgenabled='O' AND NOT tgisinternal) THEN
  RAISE EXCEPTION 'EVIDENCE_BUNDLE_REGISTRATION_HOOK_REQUIRED';
 END IF;
END $closed$;
COMMIT;
