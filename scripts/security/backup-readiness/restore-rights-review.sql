-- Read-only diagnostic against a dated metadata reference, not release approval.
-- Effective table rights cover anon/authenticated/service_role and all eight PG17 privileges.
-- Only anon/authenticated TRUNCATE and the precise postgres/public client TRUNCATE defaults
-- are reviewed separately because the first candidate was already committed locally.
BEGIN READ ONLY;
SET LOCAL lock_timeout='2s';
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL statement_timeout='15s';
WITH table_rights AS (
 SELECT c.relname AS table_name,r.rolname AS role,p.privilege,has_table_privilege(r.rolname,c.oid,p.privilege) AS allowed
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) r(rolname)
 CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(privilege)
 WHERE n.nspname='public' AND c.relkind IN('r','p')
 AND NOT(p.privilege='TRUNCATE' AND r.rolname IN('anon','authenticated'))
), defaults AS (
 SELECT pg_get_userbyid(d.defaclrole) AS owner,coalesce(n.nspname,'GLOBAL') AS scope,d.defaclobjtype::text AS kind,
 CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END AS recipient,
 pg_get_userbyid(x.grantor) AS grantor,x.privilege_type,x.is_grantable
 FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace CROSS JOIN LATERAL aclexplode(d.defaclacl) x
 WHERE d.defaclnamespace=0 OR n.nspname IN('public','extensions')
), reviewed_defaults AS (
 SELECT * FROM defaults WHERE NOT(owner='postgres' AND scope='public' AND recipient IN('anon','authenticated') AND privilege_type='TRUNCATE')
)
SELECT jsonb_build_object(
 'protocol','potok-restored-rights-review-v1',
 'targetReferenceObservedAt','2026-10-27T18:32:35.544585+00:00',
 'observedAt',transaction_timestamp(),
 'publicTables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p')),
 'reviewedTableRightsMatch',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) ORDER BY table_name,role,privilege),'[]'::jsonb)::text,'UTF8')),'hex')='82f72417bb873ba135a0d3ca9546d4a569fc841a66e6305e000d6bb107af5980' FROM table_rights t),
 'reviewedDefaultsMatch',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(d) ORDER BY owner,scope,kind,recipient,grantor,privilege_type,is_grantable),'[]'::jsonb)::text,'UTF8')),'hex')='3988f2c6d0a51d270def7f2252fddbb018a57b592ff7cbca3f70c3585d816b83' FROM reviewed_defaults d),
 'clientTruncateTables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p') AND (has_table_privilege('anon',c.oid,'TRUNCATE') OR has_table_privilege('authenticated',c.oid,'TRUNCATE'))),
 'releaseReady',false,'mayApply',false
) AS evidence;
ROLLBACK;

