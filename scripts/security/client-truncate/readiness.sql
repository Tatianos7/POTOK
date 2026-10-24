-- Read-only, portable review output. Run before and after an approved apply.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
SELECT current_user, r.rolsuper, current_setting('server_version') AS server_version
FROM pg_roles r WHERE r.rolname = current_user;
SELECT r.rolname, has_schema_privilege(r.oid, 'public', 'CREATE') AS can_create_public
FROM pg_roles r WHERE r.rolname IN ('anon', 'authenticated');
SELECT pg_get_userbyid(c.relowner) AS owner, count(*) AS public_tables,
       count(*) FILTER (WHERE has_table_privilege('anon', c.oid, 'TRUNCATE')) AS anon_truncate,
       count(*) FILTER (WHERE has_table_privilege('authenticated', c.oid, 'TRUNCATE')) AS authenticated_truncate
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
GROUP BY c.relowner ORDER BY owner;
SELECT pg_get_userbyid(d.defaclrole) AS creator,
       CASE WHEN d.defaclnamespace = 0 THEN '(global)' ELSE n.nspname END AS scope,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS recipient,
       a.privilege_type
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
CROSS JOIN LATERAL aclexplode(d.defaclacl) a
WHERE d.defaclobjtype = 'r' AND d.defaclnamespace IN (0, 'public'::regnamespace)
  AND a.privilege_type = 'TRUNCATE'
  AND CASE WHEN a.grantee = 0 THEN true ELSE
    pg_has_role('anon', a.grantee, 'USAGE') OR pg_has_role('authenticated', a.grantee, 'USAGE') END
ORDER BY creator, scope, recipient;
ROLLBACK;
