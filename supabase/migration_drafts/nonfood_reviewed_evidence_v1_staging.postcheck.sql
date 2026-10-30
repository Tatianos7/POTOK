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
