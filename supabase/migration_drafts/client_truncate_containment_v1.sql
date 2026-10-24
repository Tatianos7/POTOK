-- REVIEW CANDIDATE ONLY. Never run automatically against a hosted project.
-- Atomic containment for existing public tables and postgres/public defaults.
-- Does NOT change supabase_admin defaults; see the accompanying runbook.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $preflight$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Expected effective role postgres';
  END IF;
  IF to_regnamespace('public') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'Required schema or client roles missing';
  END IF;
  IF has_schema_privilege('anon', 'public', 'CREATE')
     OR has_schema_privilege('authenticated', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'Client schema CREATE requires separate containment';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')) THEN
    RAISE EXCEPTION 'No public tables; wrong or incomplete target';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
               AND c.relowner <> 'postgres'::regrole) THEN
    RAISE EXCEPTION 'Unexpected public table owner; review before applying';
  END IF;
  -- Per-schema REVOKE cannot subtract a global default grant. Do not silently
  -- broaden this public-only patch to other schemas.
  IF EXISTS (
    SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 0
      AND d.defaclobjtype = 'r' AND a.privilege_type = 'TRUNCATE'
      AND CASE WHEN a.grantee = 0 THEN true ELSE
        pg_has_role('anon', a.grantee, 'USAGE')
        OR pg_has_role('authenticated', a.grantee, 'USAGE') END
  ) THEN
    RAISE EXCEPTION 'Unsafe global default TRUNCATE requires separate review';
  END IF;
END
$preflight$;

DO $revoke$
DECLARE t record;
BEGIN
  FOR t IN SELECT n.nspname, c.relname FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
           ORDER BY c.oid
  LOOP
    EXECUTE format('REVOKE TRUNCATE ON TABLE %I.%I FROM PUBLIC, anon, authenticated',
                   t.nspname, t.relname);
  END LOOP;
END
$revoke$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE ON TABLES FROM PUBLIC, anon, authenticated;

DO $verify$
DECLARE residual bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND (has_table_privilege('anon', c.oid, 'TRUNCATE')
           OR has_table_privilege('authenticated', c.oid, 'TRUNCATE'))
  ) THEN
    RAISE EXCEPTION 'Effective client TRUNCATE remains; transaction will roll back';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE d.defaclrole = 'postgres'::regrole
      AND d.defaclnamespace IN (0, 'public'::regnamespace)
      AND d.defaclobjtype = 'r' AND a.privilege_type = 'TRUNCATE'
      AND CASE WHEN a.grantee = 0 THEN true ELSE
        pg_has_role('anon', a.grantee, 'USAGE')
        OR pg_has_role('authenticated', a.grantee, 'USAGE') END
  ) THEN
    RAISE EXCEPTION 'Effective postgres default TRUNCATE remains; transaction will roll back';
  END IF;
  SELECT count(*) INTO residual
  FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  WHERE d.defaclrole <> 'postgres'::regrole
    AND d.defaclnamespace IN (0, 'public'::regnamespace)
    AND d.defaclobjtype = 'r' AND a.privilege_type = 'TRUNCATE'
    AND CASE WHEN a.grantee = 0 THEN true ELSE
      pg_has_role('anon', a.grantee, 'USAGE')
      OR pg_has_role('authenticated', a.grantee, 'USAGE') END;
  RAISE NOTICE 'Remaining other-owner default client TRUNCATE entries: %. Separate platform/owner remediation required.', residual;
END
$verify$;
COMMIT;
