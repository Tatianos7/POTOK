// Private candidate plan generation only. No database, Docker, network or runtime entry point.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {captureSQL as baseCapture} from './rights-rehearsal.mjs';
import {permissionQuery} from '../accumulated/checks.mjs';
import {followupFinalSQL} from '../accumulated/restored-twelve.mjs';
const roles=['anon','authenticated','service_role'];
const privileges=['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'];
const key=r=>JSON.stringify([r.table_name??r.table,r.role,r.privilege]);
const quote=s=>'"'+s.replace(/"/g,'""')+'"';
const literal=s=>"'"+s.replace(/'/g,"''")+"'";
const sha=b=>createHash('sha256').update(b).digest('hex');
const columnRows=`SELECT jsonb_build_array(c.relname,a.attnum,a.attname,a.attacl::text) AS value FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p') AND a.attnum>0 AND NOT a.attisdropped`;
const columnHash=`SELECT encode(sha256(convert_to(coalesce(jsonb_agg(value ORDER BY value::text),'[]'::jsonb)::text,'UTF8')),'hex') FROM (${columnRows}) q`;
const shapeQuery=`SELECT encode(sha256(convert_to(jsonb_build_object(
 'schemas',(SELECT jsonb_agg(jsonb_build_array(nspname,pg_get_userbyid(nspowner),nspacl::text) ORDER BY nspname) FROM pg_namespace WHERE nspname IN('public','potok_control','potok_nutrition','potok_delivery')),
 'tables',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,pg_get_userbyid(c.relowner),c.relrowsecurity,c.relforcerowsecurity) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','potok_control','potok_nutrition','potok_delivery') AND c.relkind IN('r','p')),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.conname,pg_get_constraintdef(c.oid),c.convalidated) ORDER BY n.nspname,c.conname,c.oid) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN('public','potok_control','potok_nutrition','potok_delivery')),
 'indexes',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,pg_get_indexdef(i.indexrelid),i.indisvalid,i.indisready,i.indislive) ORDER BY n.nspname,c.relname) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','potok_control','potok_nutrition','potok_delivery')),
 'columns',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) ORDER BY n.nspname,c.relname,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname IN('public','potok_control','potok_nutrition','potok_delivery') AND c.relkind IN('r','p') AND a.attnum>0 AND NOT a.attisdropped),
 'routines',(SELECT jsonb_agg(jsonb_build_array(n.nspname,p.oid::regprocedure::text,pg_get_userbyid(p.proowner),p.prosecdef,p.proconfig,p.proacl::text,md5(p.prosrc),pg_get_function_arguments(p.oid),pg_get_function_result(p.oid)) ORDER BY n.nspname,p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','potok_control','potok_nutrition','potok_delivery') AND p.prokind IN('f','p')),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p),
 'defaults',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.oid) FROM pg_default_acl d),
 'roles',(SELECT jsonb_agg(jsonb_build_array(rolname,rolsuper,rolbypassrls,rolinherit) ORDER BY rolname) FROM pg_roles),
 'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member,grantor) FROM pg_auth_members m),
 'extensions',(SELECT jsonb_agg(to_jsonb(e) ORDER BY extname) FROM pg_extension e),
 'eventTriggers',(SELECT jsonb_agg(to_jsonb(e) ORDER BY oid) FROM pg_event_trigger e)
 )::text,'UTF8')),'hex')`;
const tableHash=`SELECT encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_array(c.relname,pg_get_userbyid(c.relowner),c.relrowsecurity,c.relacl::text) ORDER BY c.relname),'[]'::jsonb)::text,'UTF8')),'hex') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p')`;
function contentQuery(tables){
 assert(tables.length===112&&new Set(tables.map(t=>JSON.stringify([t.schema,t.name]))).size===112);
 for(const t of tables)assert(['auth','public','storage'].includes(t.schema)&&/^[a-z_][a-z0-9_]*$/.test(t.name));
 return `SELECT jsonb_agg(to_jsonb(q) ORDER BY schema,name) FROM (${tables.map(t=>`SELECT ${literal(t.schema)}::text AS schema,${literal(t.name)}::text AS name,count(*)::text AS rows,encode(sha256(convert_to(coalesce(string_agg(digest,'' ORDER BY digest),''),'UTF8')),'hex') AS hash FROM (SELECT encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') AS digest FROM ${quote(t.schema)}.${quote(t.name)} t) h`).join('\nUNION ALL\n')}) q`;
}
const columnGrants=`SELECT coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'column',a.attname,'role',r.rolname,'privilege',x.privilege_type,'grantor',pg_get_userbyid(x.grantor),'grantable',x.is_grantable) ORDER BY c.relname,a.attnum,r.rolname,x.privilege_type),'[]'::jsonb) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(a.attacl) x JOIN pg_roles r ON r.oid=x.grantee WHERE n.nspname='public' AND c.relkind IN('r','p') AND a.attnum>0 AND NOT a.attisdropped AND r.rolname IN('anon','authenticated')`;
const positivePhoto=[...['SELECT','INSERT','UPDATE','DELETE'].map(privilege=>({table:'measurement_photo_assets',role:'authenticated',privilege})),...['SELECT','INSERT','DELETE'].map(privilege=>({table:'measurement_photo_deletions',role:'authenticated',privilege}))];
export function candidateCaptureSQL(tables){
 const anchor=" 'rights',(SELECT jsonb_agg";assert.equal(baseCapture.split(anchor).length-1,1);
 return baseCapture.replace("SET LOCAL search_path=pg_catalog,pg_temp;","SET LOCAL search_path=pg_catalog,pg_temp;SET LOCAL timezone='UTC';SET LOCAL datestyle='ISO,YMD';SET LOCAL extra_float_digits=3;").replace('potok-rights-parity-capture-v1','potok-candidate-acl-capture-v1').replace(anchor,` 'columnAcls',(${columnGrants}),'columnAclSha256',(${columnHash}),'shapeSha256',(${shapeQuery}),'content',(${contentQuery(tables)}),'authorityRows',(SELECT count(*) FROM potok_control.access_attestations),\n${anchor}`);
}
function matrixCheck(rights){return `FOR r IN SELECT * FROM jsonb_to_recordset(${literal(JSON.stringify(rights.map(({table_name,role,privilege,allowed})=>({table_name,role,privilege,allowed}))))}::jsonb) AS x(table_name text,role text,privilege text,allowed boolean) LOOP IF has_table_privilege(r.role,to_regclass(format('public.%I',r.table_name)),r.privilege) IS DISTINCT FROM r.allowed THEN RAISE EXCEPTION 'CANDIDATE_MATRIX_STOP';END IF;END LOOP;`;}
const contracts=`DO $contracts$ DECLARE checks jsonb;BEGIN
 SELECT to_jsonb(q) INTO checks FROM (${permissionQuery()}) q;
 IF EXISTS(SELECT FROM jsonb_each(checks) e WHERE e.value IS DISTINCT FROM 'true'::jsonb) OR EXISTS(SELECT FROM potok_control.access_attestations) THEN RAISE EXCEPTION 'CANDIDATE_CONTRACT_STOP';END IF;
END $contracts$;
${followupFinalSQL}`;
export function buildCandidatePlans(snapshot,original,remaining,{names,tables,now=Date.now()}){
 assert.equal(snapshot.protocol,'potok-candidate-acl-capture-v1');assert.equal(snapshot.actor,'postgres');assert.equal(snapshot.actorSuper,false);assert.equal(snapshot.readOnly,'on');assert.equal(snapshot.isolation,'repeatable read');assert.equal(snapshot.replicationRole,'origin');assert.equal(snapshot.candidateNamespaces,3);assert.equal(snapshot.authorityRows,0);
 assert(Number.isInteger(snapshot.version)&&snapshot.version>=170000&&snapshot.version<180000);
 const age=now-Date.parse(snapshot.observedAt);assert(Number.isFinite(age)&&age>=-60000&&age<=900000);
 assert.deepEqual(snapshot.clientRoles,[['anon',false,false],['authenticated',false,false]]);
 assert(names.length===81&&new Set(names).size===81);assert.deepEqual(snapshot.tables.map(t=>t[0]).sort(),[...names].sort());assert(snapshot.tables.every(t=>t[1]==='postgres'&&t[2]===true));
 const expected=names.flatMap(table_name=>roles.flatMap(role=>privileges.map(privilege=>key({table_name,role,privilege}))));
 assert.equal(new Set(snapshot.rights.map(key)).size,1944);assert.deepEqual(snapshot.rights.map(key).sort(),expected.sort());
 for(const r of snapshot.rights){assert.equal(typeof r.allowed,'boolean');assert.equal(typeof r.direct_owner_grant,'boolean');}
 for(const field of ['aclSha256','columnAclSha256','shapeSha256'])assert.match(snapshot[field],/^[a-f0-9]{64}$/);
 assert.equal(original.length,213);assert.equal(remaining.length,211);
 for(const list of [original,remaining]){assert.equal(new Set(list.map(key)).size,list.length);assert(list.every(r=>r.direction==='extra_on_restored'&&['anon','authenticated'].includes(r.role)&&privileges.includes(r.privilege)&&r.privilege!=='TRUNCATE'&&names.includes(r.table)));}
 const rights=new Map(snapshot.rights.map(r=>[key(r),r])),old=new Set(original.map(key));
 assert(remaining.every(r=>old.has(key(r))&&r.directOwnerGrant===true));
 const active=original.filter(r=>rights.get(key(r)).allowed);assert.deepEqual(active.map(key).sort(),remaining.map(key).sort());
 assert(remaining.every(r=>rights.get(key(r)).direct_owner_grant));
 const selected=new Set(remaining.map(key));assert(!snapshot.columnAcls.some(c=>selected.has(key(c))),'Column grants require separate preservation review');
 assert(!positivePhoto.some(c=>selected.has(key(c))));assert(positivePhoto.every(c=>rights.get(key(c))?.allowed));
 assert(snapshot.rights.filter(r=>r.privilege==='TRUNCATE'&&r.role!=='service_role').every(r=>!r.allowed));
 assert.equal(snapshot.content.length,112);assert.deepEqual(snapshot.content.map(t=>JSON.stringify([t.schema,t.name])).sort(),tables.map(t=>JSON.stringify([t.schema,t.name])).sort());
 for(const t of snapshot.content){assert.match(t.rows,/^\d+$/);assert.match(t.hash,/^[a-f0-9]{64}$/);}
 const stable=`IF (${columnHash})<>${literal(snapshot.columnAclSha256)} OR (${shapeQuery})<>${literal(snapshot.shapeSha256)} THEN RAISE EXCEPTION 'CANDIDATE_METADATA_STOP';END IF;
 IF (${contentQuery(tables)}) IS DISTINCT FROM ${literal(JSON.stringify(snapshot.content))}::jsonb THEN RAISE EXCEPTION 'CANDIDATE_CONTENT_STOP';END IF;`;
 const actor=`IF current_user<>'postgres' OR session_user<>'postgres' OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) OR current_setting('session_replication_role')<>'origin' OR (SELECT count(*) FROM pg_namespace WHERE nspname IN('potok_control','potok_nutrition','potok_delivery'))<>3 THEN RAISE EXCEPTION 'WRONG_CANDIDATE_STOP';END IF;
 IF current_setting('cron.launch_active_jobs',true) IS DISTINCT FROM 'off' OR current_setting('listen_addresses')<>'127.0.0.1' THEN RAISE EXCEPTION 'CANDIDATE_ISOLATION_STOP';END IF;`;
 const desired=snapshot.rights.map(r=>({...r,allowed:selected.has(key(r))?false:r.allowed}));
 const context=`SET search_path=pg_catalog,pg_temp;SET timezone='UTC';SET datestyle='ISO,YMD';SET extra_float_digits=3;SET statement_timeout='120s';SET lock_timeout='3s';\n`;
 // Capture uses UTC/datestyle/float format too, binding hash comparison to identical formatting.
 const body=`BEGIN;
${names.map(n=>'LOCK TABLE public.'+quote(n)+' IN SHARE ROW EXCLUSIVE MODE;').join('\n')}
DO $pre$ DECLARE r record;BEGIN
 ${actor}
 IF extract(epoch FROM(clock_timestamp()-${literal(snapshot.observedAt)}::timestamptz)) NOT BETWEEN -60 AND 900 THEN RAISE EXCEPTION 'CANDIDATE_FRESHNESS_STOP';END IF;
 IF (${tableHash})<>${literal(snapshot.aclSha256)} THEN RAISE EXCEPTION 'CANDIDATE_BASELINE_DRIFT_STOP';END IF;
 ${matrixCheck(snapshot.rights)}${stable}
END $pre$;
${contracts}
${remaining.map(r=>'REVOKE '+r.privilege+' ON TABLE public.'+quote(r.table)+' FROM '+quote(r.role)+';').join('\n')}
DO $after$ DECLARE r record;BEGIN ${matrixCheck(desired)}${stable} END $after$;
${contracts}
`;
 const verifyBody=`DO $verify$ DECLARE r record;BEGIN ${actor}${matrixCheck(desired)}${stable} END $verify$;\n${contracts}\n`;
 const rollback=context+body+`DO $ok$ BEGIN RAISE NOTICE 'CANDIDATE_ACL_TEMPORARY_OK: 211 exact grants removed; column grants/contracts/current content preserved';END $ok$;
ROLLBACK;
DO $restored$ DECLARE r record;BEGIN IF (${tableHash})<>${literal(snapshot.aclSha256)} THEN RAISE EXCEPTION 'CANDIDATE_ROLLBACK_ACL_STOP';END IF;${matrixCheck(snapshot.rights)}${stable} END $restored$;
DO $ok$ BEGIN RAISE NOTICE 'CANDIDATE_ACL_ROLLBACK_OK: original candidate ACL/current content restored';END $ok$;
`;
 const commit=context+body+`COMMIT;\n${verifyBody}DO $ok$ BEGIN RAISE NOTICE 'CANDIDATE_ACL_COMMIT_RETURNED: confirm using independent readonly verification; never replay automatically';END $ok$;\n`;
 const verify=context+`BEGIN READ ONLY;\n${verifyBody}SELECT 'CANDIDATE_ACL_COMMITTED_VERIFIED_OK' AS result;\nROLLBACK;\n`;
 const matrixMatches=rows=>`NOT EXISTS(SELECT FROM jsonb_to_recordset(${literal(JSON.stringify(rows.map(({table_name,role,privilege,allowed})=>({table_name,role,privilege,allowed}))))}::jsonb) AS x(table_name text,role text,privilege text,allowed boolean) WHERE has_table_privilege(x.role,to_regclass(format('public.%I',x.table_name)),x.privilege) IS DISTINCT FROM x.allowed)`;
 const reconcile=context+`BEGIN READ ONLY;
DO $actor$ BEGIN ${actor}END $actor$;
SELECT jsonb_build_object('protocol','potok-candidate-acl-reconcile-v1','originalAclMatches',(${tableHash})=${literal(snapshot.aclSha256)},'originalMatrixMatches',${matrixMatches(snapshot.rights)},'desiredMatrixMatches',${matrixMatches(desired)},'columnsMatch',(${columnHash})=${literal(snapshot.columnAclSha256)},'shapeMatch',(${shapeQuery})=${literal(snapshot.shapeSha256)},'contentMatches',(${contentQuery(tables)}) IS NOT DISTINCT FROM ${literal(JSON.stringify(snapshot.content))}::jsonb,'releaseReady',false) AS status;
ROLLBACK;
`;
 return {rollback,commit,verify,reconcile,revokes:211,releaseReady:false,hostedApplyAllowed:false};
}
async function regular(file){const s=await fs.lstat(file);assert(s.isFile()&&!s.isSymbolicLink());}
async function readJSON(file){await regular(file);return JSON.parse(await fs.readFile(file,'utf8'));}
async function backup(dir){const file=path.join(dir,'SHA256SUMS.txt');await regular(file);const lines=(await fs.readFile(file,'utf8')).trim().split(/\r?\n/),seen=new Set();for(const line of lines){const m=line.match(/^([a-f0-9]{64})\s+\*?(roles\.sql|schema\.sql|data\.sql)$/);assert(m&&!seen.has(m[2]));seen.add(m[2]);const f=path.join(dir,m[2]);await regular(f);assert.equal(sha(await fs.readFile(f)),m[1]);}assert.equal(seen.size,3);}
async function scope(){const v=await readJSON(new URL('inventory-20261027.json',import.meta.url));const skip=new Set(v.exclusions.map(t=>JSON.stringify([t.schema,t.name])));const tables=v.tables.filter(t=>!skip.has(JSON.stringify([t.schema,t.name]))).map(({schema,name})=>({schema,name}));return {tables,names:tables.filter(t=>t.schema==='public').map(t=>t.name)};}
export async function main(args){
 if(args.length===2&&args[0]==='--prepare-private'){
  const base=await fs.realpath(args[1]);await backup(base);const {tables}=await scope();const dir=await fs.mkdtemp(path.join(base,'candidate-acl-'));await fs.chmod(dir,0o700);
  await fs.writeFile(path.join(dir,'capture.sql'),candidateCaptureSQL(tables),{mode:0o600,flag:'wx'});console.log('CANDIDATE_CAPTURE_PREPARED: '+dir);return;
 }
 if(args.length===3&&args[0]==='--plan-candidate-local'){
  const dir=await fs.realpath(args[1]),base=path.dirname(dir);await backup(base);const {tables,names}=await scope();await regular(path.join(dir,'capture.sql'));assert.equal(await fs.readFile(path.join(dir,'capture.sql'),'utf8'),candidateCaptureSQL(tables));
  const latest=async prefix=>{const dirs=await Promise.all((await fs.readdir(base)).filter(n=>n.startsWith(prefix)).map(async n=>({n,time:(await fs.stat(path.join(base,n))).mtimeMs})));dirs.sort((a,b)=>b.time-a.time);assert(dirs.length);return path.join(base,dirs[0].n);};
  const original=await readJSON(path.join(await latest('table-rights-details.'),'differences.json'));
  const remaining=await readJSON(path.join(await latest('candidate-rights-audit.'),'remaining-original-extras.json'));
  const snapshot=await readJSON(args[2]),plans=buildCandidatePlans(snapshot,original,remaining,{names,tables});
  const out=await fs.mkdtemp(path.join(dir,'plans-'));await fs.chmod(out,0o700);const hashes={};
  for(const name of ['rollback','commit','verify','reconcile']){await fs.writeFile(path.join(out,name+'.sql'),plans[name],{mode:0o600,flag:'wx'});hashes[name+'.sql']=sha(plans[name]);}
  await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify({protocol:'potok-candidate-acl-plans-v1',candidateName:'potok_security_candidate_2026-10-26',revokes:211,hashes,releaseReady:false,hostedApplyAllowed:false},null,2),{mode:0o600,flag:'wx'});
  console.log('CANDIDATE_ACL_PLANS_PREPARED: exactRevokes=211; rollback/commit/independent-readonly-verify; not executed; hostedApplyAllowed=false.');console.log('Private plans: '+out);return;
 }
 throw Error('Private capture/plan generation only');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('CANDIDATE_ACL_PLAN_STOPPED: private snapshot/context/scope/column/positive-grant check failed; no SQL executed.');process.exitCode=1;});
