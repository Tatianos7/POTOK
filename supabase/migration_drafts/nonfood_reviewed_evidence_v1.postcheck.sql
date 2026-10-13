-- Disposable ACL/FK/currentness boundary audit. No live data export.
DO $$ DECLARE r text;f text;t record;BEGIN
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='potok_nonfood' AND c.relkind='r')<>7 THEN RAISE EXCEPTION 'NONFOOD_TABLE_INVENTORY_DRIFT'; END IF;
 FOR t IN SELECT c.oid,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='potok_nonfood' AND c.relkind='r' LOOP
  IF NOT t.relrowsecurity OR NOT t.relforcerowsecurity THEN RAISE EXCEPTION 'FORCE_RLS_REQUIRED';END IF;
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF has_table_privilege(r,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') OR has_any_column_privilege(r,t.oid,'INSERT,UPDATE') THEN RAISE EXCEPTION 'TABLE_PRIVILEGE_FORBIDDEN'; END IF;
  END LOOP;
 END LOOP;
 FOREACH f IN ARRAY ARRAY['public.nonfood_evidence_review_v1(text)','public.nonfood_evidence_receipt_v1(uuid)','public.nonfood_evidence_current_v1(uuid)'] LOOP
  IF NOT has_function_privilege('authenticated',f,'EXECUTE') OR has_function_privilege('anon',f,'EXECUTE') OR has_function_privilege('service_role',f,'EXECUTE') THEN RAISE EXCEPTION 'RPC_ACL_DRIFT'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE connamespace='potok_nonfood'::regnamespace AND contype='f' AND confdeltype<>'r') THEN RAISE EXCEPTION 'RETENTION_RESTRICT_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE connamespace='potok_nonfood'::regnamespace AND contype='f' AND confrelid='public.foods'::regclass) THEN RAISE EXCEPTION 'FOOD_NAMESPACE_CONTAMINATION'; END IF;
END $$;
