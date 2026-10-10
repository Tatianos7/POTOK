-- DISPOSABLE ONLY: no Supabase apply authorization. Typed boundaries, not arbitrary SQL.
BEGIN;
DO $$ BEGIN
 IF current_setting('potok_shared_food_eligibility.test_target',true) IS DISTINCT FROM 'disposable-postgresql-only'
    OR to_regprocedure('potok_food_evidence.catalog_gate_v1()') IS NULL THEN
  RAISE EXCEPTION 'DISPOSABLE_STAGE_C_PREREQUISITES_REQUIRED'; END IF;
END $$;
CREATE SCHEMA potok_catalog_writer;
REVOKE ALL ON SCHEMA potok_catalog_writer FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION potok_catalog_writer.session_v1() RETURNS uuid
LANGUAGE plpgsql VOLATILE SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); claims jsonb:=auth.jwt(); anonymous boolean; expiry timestamptz;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'READ_COMMITTED_TRANSACTION_REQUIRED' USING ERRCODE='25000'; END IF;
 IF actor IS NULL OR claims->>'role' IS DISTINCT FROM 'authenticated' OR claims->>'sub' IS DISTINCT FROM actor::text THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
 SELECT is_anonymous INTO anonymous FROM auth.users WHERE id=actor FOR SHARE;
 IF NOT FOUND OR anonymous IS DISTINCT FROM false THEN RAISE EXCEPTION 'LIVE_AUTH_SESSION_REQUIRED' USING ERRCODE='42501'; END IF;
 SELECT not_after INTO expiry FROM auth.sessions WHERE id=potok_food_evidence.uuid_v1(claims->'session_id') AND user_id=actor FOR SHARE;
 IF NOT FOUND OR (expiry IS NOT NULL AND expiry<=clock_timestamp()) THEN RAISE EXCEPTION 'LIVE_AUTH_SESSION_REQUIRED' USING ERRCODE='42501'; END IF;
 IF coalesce(claims->>'exp','') !~ '^[0-9]{1,12}$' OR (claims->>'exp')::numeric<=extract(epoch FROM clock_timestamp()) THEN RAISE EXCEPTION 'JWT_EXPIRED' USING ERRCODE='42501'; END IF;
 RETURN actor;
END $$;
CREATE FUNCTION potok_catalog_writer.payload_v1(v jsonb) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE k text;
BEGIN
 PERFORM potok_food_evidence.exact_keys_v1(v,ARRAY['name','normalizedName','brand','normalizedBrand','calories','protein','fat','carbs','fiber']);
 PERFORM potok_food_evidence.text_v1(v->'name'); PERFORM potok_food_evidence.text_v1(v->'normalizedName');
 FOREACH k IN ARRAY ARRAY['brand','normalizedBrand'] LOOP
  IF v->k<>'null'::jsonb AND jsonb_typeof(v->k)<>'string' THEN RAISE EXCEPTION 'STRING_REQUIRED' USING ERRCODE='22023'; END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['calories','protein','fat','carbs','fiber'] LOOP
  IF jsonb_typeof(v->k)<>'string' OR v->>k !~ '^(0|[1-9][0-9]{0,5})\.[0-9]{2}$' THEN RAISE EXCEPTION 'OPERATIONAL_DECIMAL_INVALID' USING ERRCODE='22023'; END IF;
 END LOOP;
END $$;
CREATE FUNCTION potok_catalog_writer.raw_v1(raw text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
BEGIN
 IF raw IS NULL OR octet_length(raw)>1048576 THEN RAISE EXCEPTION 'REQUEST_SIZE_INVALID' USING ERRCODE='22023'; END IF;
 IF potok_nutrition.json_has_duplicate_keys_v1(raw::json) THEN RAISE EXCEPTION 'DUPLICATE_JSON_KEY' USING ERRCODE='22023'; END IF;
 RETURN raw::jsonb;
END $$;
CREATE FUNCTION potok_catalog_writer.row_digest_v1(f jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT encode(extensions.digest(convert_to('potok-stage-c-operational-row-sha256-v1'||E'\n'||f::text,'UTF8'),'sha256'),'hex')
$$;
CREATE FUNCTION public.catalog_private_food_v1(p_request text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid; v jsonb; p jsonb; fid uuid; kind text; f jsonb;
BEGIN
 actor:=potok_catalog_writer.session_v1();v:=potok_catalog_writer.raw_v1(p_request);kind:=v->>'kind';
 IF v->>'contract' IS DISTINCT FROM 'potok-private-food-request-v1' THEN RAISE EXCEPTION 'CONTRACT_INVALID' USING ERRCODE='22023'; END IF;
 IF kind='CREATE' THEN PERFORM potok_food_evidence.exact_keys_v1(v,ARRAY['contract','kind','payload']);
 ELSIF kind='UPDATE' THEN PERFORM potok_food_evidence.exact_keys_v1(v,ARRAY['contract','kind','foodId','expectedDigest','payload']);
 ELSIF kind='DELETE' THEN PERFORM potok_food_evidence.exact_keys_v1(v,ARRAY['contract','kind','foodId','expectedDigest']);
 ELSE RAISE EXCEPTION 'VARIANT_INVALID' USING ERRCODE='22023'; END IF;
 IF kind<>'DELETE' THEN p:=v->'payload';PERFORM potok_catalog_writer.payload_v1(p);END IF;
 IF kind<>'CREATE' THEN fid:=potok_food_evidence.uuid_v1(v->'foodId');PERFORM potok_food_evidence.hash_v1(v->'expectedDigest');END IF;
 PERFORM potok_food_evidence.catalog_gate_v1();PERFORM potok_catalog_writer.session_v1();
 IF kind='CREATE' THEN
  fid:=gen_random_uuid();
  INSERT INTO public.foods(id,canonical_food_id,source,created_by_user_id,name,normalized_name,brand,normalized_brand,calories,protein,fat,carbs,fiber)
   VALUES(fid,fid,'user',actor,p->>'name',p->>'normalizedName',p->>'brand',p->>'normalizedBrand',(p->>'calories')::numeric,(p->>'protein')::numeric,(p->>'fat')::numeric,(p->>'carbs')::numeric,(p->>'fiber')::numeric);
 ELSE
  SELECT to_jsonb(x) INTO f FROM public.foods x WHERE x.id=fid AND x.source='user' AND x.created_by_user_id=actor FOR UPDATE;
  IF f IS NULL THEN RAISE EXCEPTION 'FOOD_CONFLICT' USING ERRCODE='40001',DETAIL='POTOK_BUSINESS_CONFLICT_V1';END IF;
  IF potok_catalog_writer.row_digest_v1(f)<>v->>'expectedDigest' THEN RAISE EXCEPTION 'FOOD_CONFLICT' USING ERRCODE='40001',DETAIL='POTOK_BUSINESS_CONFLICT_V1';END IF;
  IF kind='DELETE' THEN DELETE FROM public.foods WHERE id=fid AND source='user' AND created_by_user_id=actor;
  ELSE UPDATE public.foods SET name=p->>'name',normalized_name=p->>'normalizedName',brand=p->>'brand',normalized_brand=p->>'normalizedBrand',
   calories=(p->>'calories')::numeric,protein=(p->>'protein')::numeric,fat=(p->>'fat')::numeric,carbs=(p->>'carbs')::numeric,fiber=(p->>'fiber')::numeric
   WHERE id=fid AND source='user' AND created_by_user_id=actor; END IF;
 END IF;
 PERFORM potok_catalog_writer.session_v1();
 IF kind='DELETE' THEN RETURN jsonb_build_object('foodId',fid,'deleted',true);END IF;
 SELECT to_jsonb(x) INTO f FROM public.foods x WHERE x.id=fid AND x.source='user' AND x.created_by_user_id=actor;
 RETURN jsonb_build_object('food',f,'rowDigest',potok_catalog_writer.row_digest_v1(f));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'FOOD_CONFLICT' USING ERRCODE='40001',DETAIL='POTOK_BUSINESS_CONFLICT_V1';
END $$;
CREATE FUNCTION public.catalog_import_batch_v1(p_request text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v jsonb; r jsonb; p jsonb; fid uuid; existing jsonb; mode text; n integer:=0; targets jsonb:='[]'::jsonb;
BEGIN
 PERFORM potok_food_evidence.authority_v1();v:=potok_catalog_writer.raw_v1(p_request);
 PERFORM potok_food_evidence.exact_keys_v1(v,ARRAY['contract','mode','rows']);
 IF v->>'contract' IS DISTINCT FROM 'potok-catalog-batch-request-v1' THEN RAISE EXCEPTION 'CONTRACT_INVALID' USING ERRCODE='22023';END IF;
 mode:=v->>'mode';IF mode NOT IN ('INSERT','UPSERT_ID','UPSERT_NORMALIZED') OR mode IS NULL THEN RAISE EXCEPTION 'VARIANT_INVALID' USING ERRCODE='22023';END IF;
 IF jsonb_typeof(v->'rows')<>'array' OR jsonb_array_length(v->'rows') NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'BATCH_BOUND_INVALID' USING ERRCODE='22023';END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(v->'rows') LOOP
  PERFORM potok_food_evidence.exact_keys_v1(r,ARRAY['foodId','foodStableId','source','payload']);PERFORM potok_food_evidence.uuid_v1(r->'foodId');
  IF r->>'source' NOT IN ('core','brand') OR r->>'source' IS NULL THEN RAISE EXCEPTION 'SHARED_SOURCE_REQUIRED' USING ERRCODE='22023';END IF;
  IF r->'foodStableId'<>'null'::jsonb AND (jsonb_typeof(r->'foodStableId')<>'string' OR r->>'foodStableId' !~ '^[a-z0-9][a-z0-9_-]{0,127}$') THEN RAISE EXCEPTION 'STABLE_KEY_INVALID' USING ERRCODE='22023';END IF;
  PERFORM potok_catalog_writer.payload_v1(r->'payload');
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(v->'rows') x GROUP BY x->>'foodId' HAVING count(*)>1)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(v->'rows') x GROUP BY x->'payload'->>'normalizedName',coalesce(x->'payload'->>'normalizedBrand','') HAVING count(*)>1) THEN RAISE EXCEPTION 'DUPLICATE_BATCH_TARGET' USING ERRCODE='22023';END IF;
 PERFORM potok_food_evidence.catalog_gate_v1();PERFORM potok_food_evidence.authority_v1();
 FOR r IN SELECT value FROM jsonb_array_elements(v->'rows') ORDER BY value->>'foodId' LOOP
  fid:=(r->>'foodId')::uuid;p:=r->'payload';existing:=NULL;
  IF mode='UPSERT_NORMALIZED' THEN
   SELECT to_jsonb(x) INTO existing FROM public.foods x WHERE x.normalized_name=p->>'normalizedName' AND coalesce(x.normalized_brand,'')=coalesce(p->>'normalizedBrand','') FOR UPDATE;
   IF existing IS NOT NULL THEN fid:=(existing->>'id')::uuid;END IF;
  END IF;
  IF existing IS NULL THEN SELECT to_jsonb(x) INTO existing FROM public.foods x WHERE x.id=fid FOR UPDATE;END IF;
  IF existing IS NOT NULL THEN
   IF mode='INSERT' OR existing->>'source' NOT IN ('core','brand') OR existing->'created_by_user_id'<>'null'::jsonb
      OR existing->>'canonical_food_id' IS DISTINCT FROM fid::text THEN RAISE EXCEPTION 'FOOD_CONFLICT' USING ERRCODE='40001',DETAIL='POTOK_BUSINESS_CONFLICT_V1';END IF;
   -- Normalized upsert may update content, NEVER substitute a conflicting root's identity/key.
   IF existing->'stable_food_id' IS DISTINCT FROM r->'foodStableId' OR existing->'source' IS DISTINCT FROM r->'source' THEN RAISE EXCEPTION 'FOOD_CONFLICT' USING ERRCODE='40001',DETAIL='POTOK_BUSINESS_CONFLICT_V1';END IF;
   UPDATE public.foods SET name=p->>'name',normalized_name=p->>'normalizedName',brand=p->>'brand',normalized_brand=p->>'normalizedBrand',
    calories=(p->>'calories')::numeric,protein=(p->>'protein')::numeric,fat=(p->>'fat')::numeric,carbs=(p->>'carbs')::numeric,fiber=(p->>'fiber')::numeric WHERE id=fid;
  ELSE
   INSERT INTO public.foods(id,canonical_food_id,stable_food_id,source,created_by_user_id,name,normalized_name,brand,normalized_brand,calories,protein,fat,carbs,fiber)
    VALUES(fid,fid,r->>'foodStableId',r->>'source',NULL,p->>'name',p->>'normalizedName',p->>'brand',p->>'normalizedBrand',(p->>'calories')::numeric,(p->>'protein')::numeric,(p->>'fat')::numeric,(p->>'carbs')::numeric,(p->>'fiber')::numeric);
  END IF;
  targets:=targets||jsonb_build_array(jsonb_build_object('requestedFoodId',r->'foodId','foodId',fid));
  n:=n+1;
 END LOOP;
 PERFORM potok_food_evidence.authority_v1();RETURN jsonb_build_object('rowsApplied',n,'targets',targets);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'FOOD_CONFLICT' USING ERRCODE='40001',DETAIL='POTOK_BUSINESS_CONFLICT_V1';
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA potok_catalog_writer FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.catalog_private_food_v1(text),public.catalog_import_batch_v1(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.catalog_private_food_v1(text),public.catalog_import_batch_v1(text) TO authenticated;
-- Disposable prospective cutover. Keep SELECT/RLS; no current Supabase grant changes.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.foods FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE c record;r text;BEGIN
 FOR c IN SELECT attname FROM pg_attribute WHERE attrelid='public.foods'::regclass AND attnum>0 AND NOT attisdropped LOOP
  FOREACH r IN ARRAY ARRAY['PUBLIC','anon','authenticated','service_role'] LOOP
   EXECUTE format('REVOKE INSERT (%I), UPDATE (%I), REFERENCES (%I) ON public.foods FROM %s',c.attname,c.attname,c.attname,r);
  END LOOP;
 END LOOP;
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF has_table_privilege(r,'public.foods','INSERT,UPDATE,DELETE,TRUNCATE') OR has_any_column_privilege(r,'public.foods','INSERT,UPDATE') THEN RAISE EXCEPTION 'INHERITED_DIRECT_WRITE_CUTOVER_INCOMPLETE';END IF;
 END LOOP;
END $$;
COMMIT;
