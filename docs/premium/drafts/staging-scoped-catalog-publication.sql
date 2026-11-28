DO $migration$
DECLARE original text := pg_get_functiondef('potok_nutrition.publish_candidate_manifest_v2(bytea,uuid,uuid,uuid)'::regprocedure);
BEGIN
  IF (SELECT system_identifier FROM pg_catalog.pg_control_system()) <> 7642734024280108049 OR md5(original) <> 'e7dd4404c3b5f37874b0df832c8257c5' THEN
    RAISE EXCEPTION 'Unexpected Staging cluster or publication function';
  END IF;
  EXECUTE replace(original,$old$OR NOT potok_nutrition.jsonb_has_exact_keys_v1(v_entry, ARRAY[$old$,$new$OR (v_entry ? 'audience' AND (
         v_entry->>'audience' IS DISTINCT FROM 'STAGING_UNRESTRICTED_ONLY'
         OR (SELECT system_identifier FROM pg_catalog.pg_control_system()) <> 7642734024280108049
         OR md5(pg_get_functiondef('public.adaptive_nutrition_request_generation_v2(text,uuid)'::regprocedure)) <> 'a75102ee9331dabcff785ea068f9381f'
         OR md5(pg_get_functiondef('public.adaptive_nutrition_read_graph_v2(uuid,uuid,text)'::regprocedure)) <> 'aae80b14dcc065e07e701e07662fc15f'))
       OR NOT potok_nutrition.jsonb_has_exact_keys_v1(v_entry - 'audience', ARRAY[$new$);
END
$migration$;
