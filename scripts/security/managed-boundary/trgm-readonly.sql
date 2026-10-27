BEGIN READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL statement_timeout='15s';
DO $preflight$
DECLARE e record; f record; names text; has_path boolean; code text;
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
    -- Ignore only a simple, line-start RAISE message literal. Its '%' tokens
    -- are formatting placeholders. Keep the argument expressions unchanged:
    -- they may contain real extension calls/operators. Other string forms
    -- remain conservatively subject to review; this is not a PL/pgSQL parser.
    code := regexp_replace(f.prosrc,
      $raise$(^[[:blank:]]*RAISE[[:blank:]]+(DEBUG|LOG|INFO|NOTICE|WARNING|EXCEPTION)[[:blank:]]+)'([^']|'')*'$raise$,
      $message$\1'<message>'$message$, 'gin');
    IF code ~* ('\mpublic\s*\.\s*(' || names || ')\s*\(')
       OR code ~* 'OPERATOR\s*\(\s*public\s*\.' THEN
      RAISE EXCEPTION 'Explicit public extension reference requires review: %', f.oid::regprocedure;
    END IF;
    IF code ~* ('\m(' || names || ')\s*\(')
       OR code ~ '(^|[[:space:](])(%|<%|%>|<<%|%>>|<->|<<->|<->>)([[:space:](]|$)' THEN
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
SELECT 'TRGM_SOURCE_PREFLIGHT_READ_ONLY_OK' AS result;
ROLLBACK;
