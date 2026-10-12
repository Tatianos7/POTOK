-- DRAFT / DISPOSABLE P5-02 REPAIR ONLY.
-- Not an applied migration. Do not run against Staging or production.
-- It patches only the two effective definitions observed by SELECT-only inspection.

BEGIN;

DO $repair$
DECLARE
  v_mutate regprocedure := pg_catalog.to_regprocedure('public.adaptive_nutrition_mutate_v1(text)');
  v_commit regprocedure := pg_catalog.to_regprocedure(
    'potok_nutrition.commit_prevalidated_plan_transition_v1(uuid,uuid,text,text,text,bytea,text,bytea,uuid,uuid,uuid,uuid,uuid,uuid,jsonb,jsonb,text,bytea,jsonb)'
  );
  v_definition text;
  v_message text;
  v_old text;
  v_new text;
  v_count integer;
  v_conflict_detail constant text := 'POTOK_ADAPTIVE_NUTRITION_CONFLICT_V1';
  v_invariant_detail constant text := 'POTOK_ADAPTIVE_NUTRITION_INVARIANT_FAILURE_V1';
BEGIN
  IF v_mutate IS NULL OR v_commit IS NULL THEN
    RAISE EXCEPTION 'P5-02 effective function missing' USING ERRCODE = '55000';
  END IF;

  v_definition := pg_catalog.pg_get_functiondef(v_mutate);
  SELECT pg_catalog.count(*) INTO v_count
    FROM pg_catalog.regexp_matches(v_definition, 'ERRCODE\s*=\s*''40001''', 'gi');
  IF v_count <> 6 THEN
    RAISE EXCEPTION 'P5-02 mutate source drift: expected 6 application 40001 sites, found %', v_count
      USING ERRCODE = '55000';
  END IF;
  FOREACH v_message IN ARRAY ARRAY[
    'idempotency key payload mismatch',
    'expected graph revision unavailable',
    'dated slot snapshot is not in expected graph',
    'meal slot already has a live annotation',
    'live owned annotation required',
    'live validated replacement offer required'
  ] LOOP
    v_old := pg_catalog.format(
      'RAISE EXCEPTION %L USING ERRCODE = ''40001'';', v_message
    );
    v_new := pg_catalog.format(
      'RAISE SQLSTATE ''PT409'' USING MESSAGE = %L, DETAIL = %L;',
      v_message, v_conflict_detail
    );
    IF pg_catalog.strpos(v_definition, v_old) = 0 THEN
      RAISE EXCEPTION 'P5-02 mutate source drift at %', v_message USING ERRCODE = '55000';
    END IF;
    v_definition := pg_catalog.replace(v_definition, v_old, v_new);
  END LOOP;
  IF v_definition ~* 'ERRCODE\s*=\s*''40001''' THEN
    RAISE EXCEPTION 'P5-02 mutate repair left application 40001' USING ERRCODE = '55000';
  END IF;
  EXECUTE v_definition;

  v_definition := pg_catalog.pg_get_functiondef(v_commit);
  SELECT pg_catalog.count(*) INTO v_count
    FROM pg_catalog.regexp_matches(v_definition, 'ERRCODE\s*=\s*''40001''', 'gi');
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'P5-02 commit source drift: expected 5 application 40001 sites, found %', v_count
      USING ERRCODE = '55000';
  END IF;
  FOREACH v_message IN ARRAY ARRAY[
    'idempotency key payload mismatch',
    'stale adaptive plan revision',
    'annotation retraction must supersede its live owned annotation',
    'goal revision is no longer authoritative'
  ] LOOP
    v_old := pg_catalog.format(
      'RAISE EXCEPTION %L USING ERRCODE = ''40001'';', v_message
    );
    v_new := pg_catalog.format(
      'RAISE SQLSTATE ''PT409'' USING MESSAGE = %L, DETAIL = %L;',
      v_message, v_conflict_detail
    );
    IF pg_catalog.strpos(v_definition, v_old) = 0 THEN
      RAISE EXCEPTION 'P5-02 commit source drift at %', v_message USING ERRCODE = '55000';
    END IF;
    v_definition := pg_catalog.replace(v_definition, v_old, v_new);
  END LOOP;
  v_message := 'operation result is unresolved';
  v_old := pg_catalog.format(
    'RAISE EXCEPTION %L USING ERRCODE = ''40001'';', v_message
  );
  v_new := pg_catalog.format(
    'RAISE SQLSTATE ''PT500'' USING MESSAGE = %L, DETAIL = %L;',
    v_message, v_invariant_detail
  );
  IF pg_catalog.strpos(v_definition, v_old) = 0 THEN
    RAISE EXCEPTION 'P5-02 commit source drift at %', v_message USING ERRCODE = '55000';
  END IF;
  v_definition := pg_catalog.replace(v_definition, v_old, v_new);
  IF v_definition ~* 'ERRCODE\s*=\s*''40001''' THEN
    RAISE EXCEPTION 'P5-02 commit repair left application 40001' USING ERRCODE = '55000';
  END IF;
  EXECUTE v_definition;

  IF pg_catalog.strpos(pg_catalog.pg_get_functiondef(v_mutate), v_conflict_detail) = 0
     OR pg_catalog.strpos(pg_catalog.pg_get_functiondef(v_commit), v_conflict_detail) = 0
     OR pg_catalog.strpos(pg_catalog.pg_get_functiondef(v_commit), v_invariant_detail) = 0 THEN
    RAISE EXCEPTION 'P5-02 repaired contract postcheck failed' USING ERRCODE = '55000';
  END IF;
END
$repair$;

COMMIT;

-- Deliberately unchanged: grants, RLS, function ownership/security mode,
-- Graph v1 wire/receipt schema, runtime flags, generator and Edge execution.
