-- LOCAL RESTORED DATABASE ONLY. Rehearses relocation and ALWAYS ROLLS BACK.
-- Not an apply migration. psql must use ON_ERROR_STOP=1.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = pg_catalog, pg_temp;

DO $preflight$
DECLARE e record; f record; names text; has_path boolean;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Expected effective role postgres'; END IF;
  SELECT x.*, n.nspname INTO e FROM pg_extension x
    JOIN pg_namespace n ON n.oid = x.extnamespace WHERE x.extname = 'pg_trgm';
  IF NOT FOUND OR NOT e.extrelocatable OR e.nspname NOT IN ('public', 'extensions') THEN
    RAISE EXCEPTION 'Expected relocatable pg_trgm in public or extensions';
  END IF;
  IF to_regnamespace('extensions') IS NULL THEN RAISE EXCEPTION 'Target schema missing'; END IF;
  IF has_schema_privilege('anon', 'extensions', 'CREATE')
     OR has_schema_privilege('authenticated', 'extensions', 'CREATE') THEN
    RAISE EXCEPTION 'Client CREATE on target schema requires separate review';
  END IF;
  IF NOT has_schema_privilege('postgres', 'extensions', 'USAGE')
     OR NOT has_schema_privilege('anon', 'extensions', 'USAGE')
     OR NOT has_schema_privilege('authenticated', 'extensions', 'USAGE') THEN
    RAISE EXCEPTION 'Target schema USAGE requires separate review';
  END IF;
  SELECT string_agg(p.proname, '|') INTO names FROM pg_proc p
    JOIN pg_depend d ON d.classid = 'pg_proc'::regclass AND d.objid = p.oid
      AND d.deptype = 'e' AND d.refobjid = e.oid;
  IF names IS NULL THEN RAISE EXCEPTION 'Extension routines missing'; END IF;
  -- Conservative source scan, not a complete SQL dependency parser. Dynamic
  -- and external callers still need the application-level rehearsal checklist.
  FOR f IN SELECT p.oid, p.prosrc, p.proconfig FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind IN ('f', 'p')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass
        AND d.objid = p.oid AND d.deptype = 'e')
  LOOP
    IF f.prosrc ~* ('\mpublic\s*\.\s*(' || names || ')\s*\(')
       OR f.prosrc ~* 'OPERATOR\s*\(\s*public\s*\.' THEN
      RAISE EXCEPTION 'Explicit public extension reference requires review: %', f.oid::regprocedure;
    END IF;
    IF f.prosrc ~* ('\m(' || names || ')\s*\(')
       OR f.prosrc ~ '(^|[[:space:](])(%|<%|%>|<<%|%>>|<->|<<->|<->>)([[:space:](]|$)' THEN
      SELECT EXISTS (SELECT 1 FROM unnest(f.proconfig) s
        WHERE s LIKE 'search_path=%'
          AND replace(s, '"', '') !~ '(^|[ ,=])extensions([ ,]|$)') INTO has_path;
      IF has_path THEN
        RAISE EXCEPTION 'Restricted search_path requires review: %', f.oid::regprocedure;
      END IF;
    END IF;
  END LOOP;
END
$preflight$;

CREATE TEMP TABLE potok_trgm_members ON COMMIT DROP AS
  SELECT d.classid, d.objid, d.objsubid FROM pg_depend d
  WHERE d.refobjid = (SELECT oid FROM pg_extension WHERE extname = 'pg_trgm') AND d.deptype = 'e';
CREATE TEMP TABLE potok_trgm_acl ON COMMIT DROP AS
  SELECT p.oid, p.proacl::text AS acl FROM pg_proc p JOIN potok_trgm_members m
  ON m.classid = 'pg_proc'::regclass AND m.objid = p.oid;
CREATE TEMP TABLE potok_trgm_indexes ON COMMIT DROP AS
  SELECT i.indexrelid, i.indrelid, i.indclass::text AS classes,
         i.indisvalid, i.indisready, pg_relation_filenode(i.indexrelid) AS filenode
  FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid
  WHERE c.relnamespace = 'public'::regnamespace;
CREATE TEMP TABLE potok_trgm_rows (relid oid PRIMARY KEY, rows bigint) ON COMMIT DROP;
DO $counts$
DECLARE t record; n bigint;
BEGIN
  FOR t IN SELECT c.oid FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('SELECT count(*) FROM %s', t.oid::regclass) INTO n;
    INSERT INTO potok_trgm_rows VALUES (t.oid, n);
  END LOOP;
END
$counts$;

ALTER EXTENSION pg_trgm SET SCHEMA extensions;

DO $verify$
DECLARE t record; n bigint;
BEGIN
  IF (SELECT extnamespace FROM pg_extension WHERE extname = 'pg_trgm') <> 'extensions'::regnamespace THEN
    RAISE EXCEPTION 'Extension did not move';
  END IF;
  IF EXISTS (
    (SELECT classid, objid, objsubid FROM potok_trgm_members EXCEPT
     SELECT classid, objid, objsubid FROM pg_depend WHERE deptype = 'e'
       AND refobjid = (SELECT oid FROM pg_extension WHERE extname = 'pg_trgm'))
    UNION ALL
    (SELECT classid, objid, objsubid FROM pg_depend WHERE deptype = 'e'
       AND refobjid = (SELECT oid FROM pg_extension WHERE extname = 'pg_trgm')
     EXCEPT SELECT classid, objid, objsubid FROM potok_trgm_members)
  ) THEN RAISE EXCEPTION 'Extension object identities changed'; END IF;
  IF EXISTS (SELECT 1 FROM potok_trgm_acl a LEFT JOIN pg_proc p ON p.oid = a.oid
             WHERE p.oid IS NULL OR p.proacl::text IS DISTINCT FROM a.acl) THEN
    RAISE EXCEPTION 'Extension routine grants changed';
  END IF;
  IF EXISTS (SELECT 1 FROM potok_trgm_indexes b LEFT JOIN pg_index i ON i.indexrelid = b.indexrelid
    WHERE i.indexrelid IS NULL OR i.indrelid <> b.indrelid
      OR i.indclass::text <> b.classes OR i.indisvalid <> b.indisvalid
      OR i.indisready <> b.indisready
      OR pg_relation_filenode(i.indexrelid) IS DISTINCT FROM b.filenode) THEN
    RAISE EXCEPTION 'Index identity or state changed';
  END IF;
  FOR t IN SELECT * FROM potok_trgm_rows LOOP
    EXECUTE format('SELECT count(*) FROM %s', t.relid::regclass) INTO n;
    IF n <> t.rows THEN RAISE EXCEPTION 'Row count changed for %', t.relid::regclass; END IF;
  END LOOP;
  IF extensions.similarity('apple', 'apple') <> 1 THEN RAISE EXCEPTION 'Search smoke failed'; END IF;
  RAISE NOTICE 'TRGM_REHEARSAL_OK: extension objects, grants, indexes and table counts preserved. ROLLBACK follows.';
END
$verify$;
ROLLBACK;
