-- Read-only public application-schema boundary check. Never an apply script.
-- A SQL pass is not evidence about HTTP exposed schemas, full app behavior or hosted release.
BEGIN READ ONLY;
WITH app_defaults AS (
 SELECT count(*)::integer AS own_client_truncate_defaults
 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
 WHERE d.defaclrole='postgres'::regrole AND d.defaclobjtype='r'
 AND d.defaclnamespace IN(0,'public'::regnamespace) AND a.privilege_type='TRUNCATE'
 AND CASE WHEN a.grantee=0 THEN true ELSE
  pg_has_role('anon',a.grantee,'USAGE') OR pg_has_role('authenticated',a.grantee,'USAGE') END
), platform_defaults AS (
 SELECT count(*)::integer AS platform_public_truncate_defaults
 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
 WHERE d.defaclrole='supabase_admin'::regrole AND d.defaclobjtype='r'
 AND d.defaclnamespace='public'::regnamespace AND a.privilege_type='TRUNCATE'
 AND a.grantee IN('anon'::regrole,'authenticated'::regrole)
), objects AS (
 SELECT 'pg_class'::regclass AS classid,c.oid AS objid
 FROM pg_class c WHERE c.relnamespace='public'::regnamespace
 AND c.relowner='supabase_admin'::regrole AND c.relkind IN('r','p','v','m','f','S')
 UNION ALL
 SELECT 'pg_proc'::regclass,p.oid FROM pg_proc p
 WHERE p.pronamespace='public'::regnamespace AND p.proowner='supabase_admin'::regrole
), boundary AS (
 SELECT app_defaults.*,platform_defaults.*,
 (SELECT count(*)::integer FROM pg_class c WHERE c.relnamespace='public'::regnamespace
  AND c.relkind IN('r','p') AND (has_table_privilege('anon',c.oid,'TRUNCATE')
  OR has_table_privilege('authenticated',c.oid,'TRUNCATE'))) AS existing_client_truncate_tables,
 (SELECT count(*)::integer FROM pg_extension WHERE extnamespace='public'::regnamespace) AS extensions_in_public,
 (SELECT count(*)::integer FROM objects) AS platform_public_objects,
 (SELECT count(*)::integer FROM objects o WHERE NOT EXISTS(
  SELECT FROM pg_depend d WHERE d.classid=o.classid AND d.objid=o.objid
  AND d.refclassid='pg_extension'::regclass AND d.deptype='e')) AS platform_objects_without_extension,
 has_schema_privilege('anon','public','CREATE') OR has_schema_privilege('authenticated','public','CREATE')
  OR has_schema_privilege('anon','extensions','CREATE') OR has_schema_privilege('authenticated','extensions','CREATE') AS client_schema_create
 FROM app_defaults CROSS JOIN platform_defaults
)
SELECT CASE WHEN own_client_truncate_defaults=0 AND existing_client_truncate_tables=0
 AND extensions_in_public=0 AND platform_public_objects=0 AND NOT client_schema_create
 THEN 'SQL_BOUNDARY_VERIFIED' ELSE 'NEEDS_REVIEW' END AS verdict,boundary.*
FROM boundary;
ROLLBACK;
