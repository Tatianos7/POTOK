-- Run after loading the two extracted effective definitions and applying repair.sql.
DO $postcheck$
DECLARE
  v_mutate regprocedure := 'public.adaptive_nutrition_mutate_v1(text)'::regprocedure;
  v_commit regprocedure :=
    'potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb)'::regprocedure;
  v_definition text;
  v_count integer;
BEGIN
  v_definition := pg_get_functiondef(v_mutate);
  SELECT count(*) INTO v_count FROM regexp_matches(
    v_definition, 'DETAIL\s*=\s*''POTOK_ADAPTIVE_NUTRITION_CONFLICT_V1''', 'g');
  IF v_count <> 6 OR v_definition ~ 'ERRCODE\s*=\s*''40001''' THEN
    RAISE EXCEPTION 'mutate replacement count mismatch: %', v_count;
  END IF;

  v_definition := pg_get_functiondef(v_commit);
  SELECT count(*) INTO v_count FROM regexp_matches(
    v_definition, 'DETAIL\s*=\s*''POTOK_ADAPTIVE_NUTRITION_CONFLICT_V1''', 'g');
  IF v_count <> 4 OR v_definition ~ 'ERRCODE\s*=\s*''40001'''
     OR v_definition !~ 'DETAIL\s*=\s*''POTOK_ADAPTIVE_NUTRITION_INVARIANT_FAILURE_V1''' THEN
    RAISE EXCEPTION 'commit replacement count mismatch: %', v_count;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.p5_02_function_metadata_before before
      JOIN pg_proc p ON p.oid::regprocedure::text = before.identity
     WHERE ROW(p.proowner, p.prosecdef, p.proconfig, p.proacl)
       IS DISTINCT FROM ROW(before.proowner, before.prosecdef, before.proconfig, before.proacl)
  ) OR (SELECT count(*) FROM public.p5_02_function_metadata_before) <> 2 THEN
    RAISE EXCEPTION 'owner/security/search_path/grants changed';
  END IF;
END
$postcheck$;
