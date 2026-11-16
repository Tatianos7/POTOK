-- Review and apply through the Staging deployment process. Preserves the RPC ACL.
DO $patch$
DECLARE
  v_definition text := pg_catalog.pg_get_functiondef(
    'public.adaptive_nutrition_request_generation_v2(text,uuid)'::regprocedure);
  v_start text := '  SELECT * INTO STRICT v_manifest_head';
  v_end text := '  IF extensions.digest(v_manifest.canonical_bytes';
  v_position integer;
  v_length integer;
BEGIN
  v_position := strpos(v_definition, v_start);
  v_length := strpos(v_definition, v_end) - v_position;
  IF v_position = 0 OR v_length <= 0 OR substr(v_definition, v_position, v_length) <> $expected$  SELECT * INTO STRICT v_manifest_head
    FROM potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2 h
   WHERE h.singleton FOR SHARE;
  SELECT * INTO STRICT v_manifest
    FROM potok_nutrition.adaptive_nutrition_candidate_manifests_v2 m
   WHERE m.manifest_revision=v_manifest_head.current_manifest_revision
     AND m.publication_state='PUBLISHED' FOR SHARE;
$expected$ THEN
    RAISE EXCEPTION 'GENERATION_REQUEST_CATALOG_DEFINITION_CHANGED';
  END IF;
  EXECUTE overlay(v_definition placing
    E'  BEGIN\n' || substr(v_definition, v_position, v_length) ||
    E'  EXCEPTION WHEN NO_DATA_FOUND THEN\n    RAISE EXCEPTION USING ERRCODE = ''PT503'', MESSAGE = ''GENERATION_CATALOG_UNAVAILABLE'';\n  END;\n'
    from v_position for v_length);
END
$patch$;
