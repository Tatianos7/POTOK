import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const target='supabase/migration_drafts/trusted_authority_id_user_review_v1.sql';
const base='docs/premium/drafts/';
function fn(source,name){const list=[...source.matchAll(/CREATE(?: OR REPLACE)? FUNCTION ([\w.]+)\([\s\S]*?AS \$function\$([\s\S]*?)\$function\$;/g)];const m=list.find(x=>x[1]===name);assert(m,'Missing source '+name);return m;}
export async function build(){
 const v2=await readFile(base+'20260921_trusted_entitlement_v2.sql','utf8');
 const graph=await readFile(base+'20260927_adaptive_nutrition_graph_v2_authorities_activation_v1.sql','utf8');
 const hashes={'potok_control.grant_entitlement_v2':'13144fe9c00e070d9f4fdacb893f82a1','potok_control.revoke_entitlement_v2':'d7b7ae496da1518dd7219c9cb5753430','potok_nutrition.acquire_shared_account_gate_v1':'0a7fc0c24f7bc22f6792781636ac2387'};
 for(const [name,hash] of Object.entries(hashes))assert.equal(createHash('md5').update(fn(graph,name)[2]).digest('hex'),hash,'Public source changed: '+name);
 const start=v2.indexOf('CREATE SCHEMA potok_control;'),end=v2.indexOf('ALTER TABLE public.user_profiles\n');assert(start>=0&&end>start);
 let sql=`-- REVIEW ONLY. Fresh id_user authority adaptation. Always ROLLBACK.
-- Derived from existing trusted v2 ledger/readers and later shared-account gate.
-- No profile mutation/projection/backfill, authority issuance, payments or activation.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';
DO $preflight$
DECLARE names text[]; p record;
BEGIN
 IF SESSION_USER<>'postgres' OR CURRENT_USER<>'postgres'
  OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
  OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname='postgres' AND NOT rolsuper AND rolbypassrls)
 THEN RAISE EXCEPTION 'Expected existing nonsuperuser postgres/BYPASSRLS owner SQL channel';END IF;
 IF to_regnamespace('potok_control') IS NOT NULL OR to_regnamespace('potok_nutrition') IS NOT NULL
  OR to_regprocedure('public.has_verified_entitlement_v1(text)') IS NOT NULL
  OR to_regprocedure('public.has_verified_entitlement_v2(text)') IS NOT NULL
 THEN RAISE EXCEPTION 'Fresh authority install only; existing infrastructure requires separate compatibility review';END IF;
 IF has_schema_privilege('anon','public','CREATE') OR has_schema_privilege('authenticated','public','CREATE')
  THEN RAISE EXCEPTION 'Client schema CREATE requires separate containment';END IF;
 IF NOT EXISTS(SELECT FROM pg_class WHERE oid=to_regclass('public.user_profiles') AND relkind='r' AND relowner='postgres'::regrole AND relrowsecurity)
  THEN RAISE EXCEPTION 'Profile ownership/RLS drift';END IF;
 SELECT array_agg(attname::text ORDER BY attname) INTO names FROM pg_attribute WHERE attrelid='public.user_profiles'::regclass AND attnum>0 AND NOT attisdropped;
 IF names IS DISTINCT FROM ARRAY['age','avatar_url','birth_date','coach_settings','created_at','email','first_name','goal','has_premium','height','id_user','is_admin','last_name','middle_name','phone','updated_at','voice_settings']::text[]
  THEN RAISE EXCEPTION 'Expected unchanged 17-column id_user profile contract';END IF;
 IF NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.user_profiles'::regclass AND attname='id_user' AND atttypid='uuid'::regtype AND attnotnull)
  OR NOT EXISTS(SELECT FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attname='id_user' WHERE i.indrelid='public.user_profiles'::regclass AND i.indisprimary AND i.indisvalid AND i.indnkeyatts=1 AND i.indkey[0]=a.attnum)
  THEN RAISE EXCEPTION 'Expected UUID profile primary key';END IF;
 IF (SELECT count(*) FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.user_profiles'::regclass AND a.attname IN('is_admin','has_premium') AND a.atttypid='boolean'::regtype AND a.attnotnull AND pg_get_expr(d.adbin,d.adrelid)='false')<>2
  THEN RAISE EXCEPTION 'Expected false protected defaults';END IF;
 IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) r(role),unnest(ARRAY['is_admin','has_premium','created_at','updated_at']) c(col) WHERE has_column_privilege(r.role,'public.user_profiles',c.col,'INSERT') OR has_column_privilege(r.role,'public.user_profiles',c.col,'UPDATE'))
  THEN RAISE EXCEPTION 'Apply reviewed profile column containment before authority installation';END IF;
 IF NOT has_table_privilege('authenticated','public.user_profiles','SELECT') OR EXISTS(SELECT FROM unnest(ARRAY['id_user','first_name','last_name','middle_name','birth_date','age','height','goal','email','phone','avatar_url','coach_settings','voice_settings']) c(col) WHERE NOT has_column_privilege('authenticated','public.user_profiles',c.col,'INSERT') OR NOT has_column_privilege('authenticated','public.user_profiles',c.col,'UPDATE'))
  THEN RAISE EXCEPTION 'Ordinary profile access drift';END IF;
 IF (SELECT count(*) FROM pg_policy WHERE polrelid='public.user_profiles'::regclass)<>3 THEN RAISE EXCEPTION 'Expected three profile ownership policies';END IF;
 FOR p IN SELECT *,regexp_replace(coalesce(pg_get_expr(polqual,polrelid),''),'[[:space:]()]','','g') q,regexp_replace(coalesce(pg_get_expr(polwithcheck,polrelid),''),'[[:space:]()]','','g') w FROM pg_policy WHERE polrelid='public.user_profiles'::regclass LOOP
  IF NOT p.polpermissive OR p.polroles<>ARRAY['authenticated'::regrole::oid] OR p.polcmd NOT IN('r','a','w')
   OR (p.polcmd IN('r','w') AND p.q<>'auth.uid=id_user') OR (p.polcmd IN('a','w') AND p.w<>'auth.uid=id_user')
   THEN RAISE EXCEPTION 'Profile ownership policy semantics drift';END IF;
 END LOOP;
 IF (SELECT count(DISTINCT polcmd) FROM pg_policy WHERE polrelid='public.user_profiles'::regclass)<>3 THEN RAISE EXCEPTION 'Missing profile command policy';END IF;
END
$preflight$;
`;
 sql+=v2.slice(start,end);
 sql+=`CREATE SCHEMA potok_nutrition;
REVOKE ALL ON SCHEMA potok_nutrition FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA potok_nutrition REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated,service_role;
`+fn(graph,'potok_nutrition.acquire_shared_account_gate_v1')[0]+`\nREVOKE ALL ON FUNCTION potok_nutrition.acquire_shared_account_gate_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;\n`;
 for(const action of ['grant','revoke']){
  let writer=fn(graph,'potok_control.'+action+'_entitlement_v2')[0].replace('CREATE OR REPLACE FUNCTION','CREATE FUNCTION').replace('  v_updated integer;\n','');
  writer=writer.replace("p_account_id IS NULL OR p_capability NOT IN", "p_account_id IS NULL OR p_capability IS NULL OR p_capability NOT IN");
  const projection=writer.indexOf("  IF p_capability = 'premium' THEN"),ret=writer.indexOf('  RETURN v_attestation_id;',projection);assert(projection>0&&ret>projection);
  writer=writer.slice(0,projection)+writer.slice(ret);
  const lock='  -- Preserve the capability lineage lock, now strictly secondary.';
  if(action==='grant')writer=writer.replace(lock,`  -- Require the existing profile without modifying its legacy fields.
  PERFORM 1 FROM public.user_profiles WHERE id_user=p_account_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'existing account profile required' USING ERRCODE='23503';END IF;
`+lock);
  assert(!writer.includes('UPDATE public.user_profiles'));sql+=writer+'\n';
 }
 sql+=`REVOKE ALL ON FUNCTION potok_control.grant_entitlement_v2(uuid,text,timestamptz,text,text),potok_control.revoke_entitlement_v2(uuid,text,text,text) FROM PUBLIC,anon,authenticated,service_role;\n`;
 for(const name of ['potok_control.is_effective_entitlement_v2','public.has_verified_entitlement_v2','public.has_verified_entitlement_v1'])sql+=fn(v2,name)[0]+'\n';
 sql+=`REVOKE ALL ON FUNCTION potok_control.is_effective_entitlement_v2(uuid,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.has_verified_entitlement_v1(text),public.has_verified_entitlement_v2(text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.has_verified_entitlement_v1(text),public.has_verified_entitlement_v2(text) TO authenticated;
COMMENT ON TABLE potok_control.access_attestations IS 'Existing trusted v2 append-only authority contract; id_user adapter has no legacy flag projections or payment source.';
DO $verify$
BEGIN
 IF EXISTS(SELECT FROM potok_control.access_attestations) THEN RAISE EXCEPTION 'Installer must not issue authority';END IF;
 IF EXISTS(SELECT FROM pg_roles r WHERE r.rolname IN('anon','authenticated','service_role') AND (has_schema_privilege(r.oid,'potok_control','USAGE,CREATE') OR has_schema_privilege(r.oid,'potok_nutrition','USAGE,CREATE') OR has_table_privilege(r.oid,'potok_control.access_attestations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR has_function_privilege(r.oid,'potok_control.grant_entitlement_v2(uuid,text,timestamptz,text,text)','EXECUTE') OR has_function_privilege(r.oid,'potok_control.revoke_entitlement_v2(uuid,text,text,text)','EXECUTE')))
  THEN RAISE EXCEPTION 'Private authority API boundary drift';END IF;
END
$verify$;
ROLLBACK;
`;
 return sql;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){assert.equal(process.argv[2],'--write-review');await writeFile(target,await build());console.log('Wrote review-only SQL; no database connection.');}
