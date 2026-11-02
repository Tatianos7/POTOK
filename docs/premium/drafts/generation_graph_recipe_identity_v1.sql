-- UNAPPLIED REVIEW CANDIDATE. Graph V2 component identity is recipe.recipeId.
-- Requires fresh hosted inventory and separate approval before installation.
BEGIN;
SET LOCAL search_path=pg_catalog;
DO $patch$
DECLARE expected record; before_row record; after_row record; definition text; corrected text;
 old_expression constant text := '(c.component ->> ''recipeId'')::uuid';
 new_expression constant text := '(c.component #>> ''{recipe,recipeId}'')::uuid';
BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' THEN
  RAISE EXCEPTION 'GENERATION_GRAPH_IDENTITY_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
 FOR expected IN SELECT * FROM (VALUES
  ('potok_nutrition.record_generated_week_v2(uuid,uuid,uuid,bytea,bytea)','4003e0d14be85823416df7f13434578e','98b5935bf836a156c238d4d33c4bfc9c'),
  ('potok_nutrition.activate_generated_week_v2(uuid,uuid,uuid)','ab2c111ce26a57c96cdd92902d578632','d129cca519547879f971e6b35e4250d2')
 ) e(signature,old_md5,new_md5) LOOP
  SELECT oid,proowner,proacl,prosecdef,provolatile,proconfig,prosrc,prorettype,proargtypes
    INTO before_row FROM pg_proc WHERE oid=to_regprocedure(expected.signature);
  IF NOT FOUND OR md5(before_row.prosrc)<>expected.old_md5 OR before_row.prosecdef
    OR before_row.provolatile<>'v' OR pg_get_userbyid(before_row.proowner)<>'postgres'
    OR before_row.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog'] THEN
   RAISE EXCEPTION 'GENERATION_GRAPH_IDENTITY_PREREQUISITE_DRIFT'; END IF;
  definition:=pg_get_functiondef(before_row.oid);
  IF (length(definition)-length(replace(definition,old_expression,'')))/length(old_expression)<>1 THEN
   RAISE EXCEPTION 'GENERATION_GRAPH_IDENTITY_REPLACEMENT_DRIFT'; END IF;
  corrected:=replace(definition,old_expression,new_expression);
  EXECUTE corrected;
  SELECT oid,proowner,proacl,prosecdef,provolatile,proconfig,prosrc,prorettype,proargtypes
    INTO after_row FROM pg_proc WHERE oid=to_regprocedure(expected.signature);
  IF md5(after_row.prosrc)<>expected.new_md5
    OR ROW(after_row.oid,after_row.proowner,after_row.proacl,after_row.prosecdef,after_row.provolatile,
      after_row.proconfig,after_row.prorettype,after_row.proargtypes)
      IS DISTINCT FROM ROW(before_row.oid,before_row.proowner,before_row.proacl,before_row.prosecdef,before_row.provolatile,
      before_row.proconfig,before_row.prorettype,before_row.proargtypes) THEN
   RAISE EXCEPTION 'GENERATION_GRAPH_IDENTITY_POSTCHECK_FAILED'; END IF;
 END LOOP;
END $patch$;
COMMIT;
