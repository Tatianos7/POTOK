// Offline generator only. No Docker, network, database connection or apply/commit capability.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const roles=['anon','authenticated','service_role'];
const privileges=['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'];
const key=r=>JSON.stringify([r.table_name,r.role,r.privilege]);
const ignored=r=>r.privilege==='TRUNCATE'&&r.role!=='service_role';
const quote=s=>'"'+s.replace(/"/g,'""')+'"';
const literal=s=>"'"+s.replace(/'/g,"''")+"'";
const hash=s=>createHash('sha256').update(s).digest('hex');
const aclQuery=`SELECT encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_array(c.relname,pg_get_userbyid(c.relowner),c.relrowsecurity,c.relacl::text) ORDER BY c.relname),'[]'::jsonb)::text,'UTF8')),'hex') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p')`;
export const captureSQL=`-- Metadata only; independently capture from the fixed restored container and exact hosted project.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='2s';
WITH tables AS (
 SELECT c.oid,c.relname,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'
), rights AS (
 SELECT c.relname AS table_name,r.rolname AS role,p.privilege,has_table_privilege(r.rolname,c.oid,p.privilege) AS allowed,
 EXISTS(SELECT FROM aclexplode(c.relacl) x WHERE x.grantee=r.oid AND pg_get_userbyid(x.grantor)='postgres' AND x.privilege_type=p.privilege) AS direct_owner_grant
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r CROSS JOIN (VALUES ${privileges.map(p=>'('+literal(p)+')').join(',')}) p(privilege)
 WHERE n.nspname='public' AND c.relkind='r' AND r.rolname IN('anon','authenticated','service_role')
)
SELECT jsonb_build_object('protocol','potok-rights-parity-capture-v1','observedAt',transaction_timestamp(),'actor',current_user,'readOnly',current_setting('transaction_read_only'),'isolation',current_setting('transaction_isolation'),'version',current_setting('server_version_num')::integer,'replicationRole',current_setting('session_replication_role'),
 'candidateNamespaces',(SELECT count(*) FROM pg_namespace WHERE nspname IN('potok_control','potok_nutrition','potok_delivery')),
 'actorSuper',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),
 'clientRoles',(SELECT jsonb_agg(jsonb_build_array(rolname,rolsuper,rolbypassrls) ORDER BY rolname) FROM pg_roles WHERE rolname IN('anon','authenticated')),
 'tables',(SELECT jsonb_agg(jsonb_build_array(relname,owner,relrowsecurity) ORDER BY relname) FROM tables),
 'aclSha256',(${aclQuery}),
 'rights',(SELECT jsonb_agg(to_jsonb(r) ORDER BY table_name,role,privilege) FROM rights r)) AS evidence;
ROLLBACK;
`;
function validate(r,names,now){
 assert.equal(r.protocol,'potok-rights-parity-capture-v1');assert.equal(r.actor,'postgres');assert.equal(r.actorSuper,false);
 assert.equal(r.readOnly,'on');assert.equal(r.isolation,'repeatable read');assert.equal(r.replicationRole,'origin');assert.equal(r.candidateNamespaces,0);
 assert(Number.isInteger(r.version)&&r.version>=170000&&r.version<180000);
 const age=now-Date.parse(r.observedAt);assert(Number.isFinite(age)&&age>=-60000&&age<=900000,'Fresh capture required');
 assert.deepEqual(r.clientRoles,[['anon',false,false],['authenticated',false,false]]);
 assert.deepEqual(r.tables.map(t=>t[0]).sort(),[...names].sort());assert(r.tables.every(t=>t.length===3&&t[1]==='postgres'&&t[2]===true));
 assert.match(r.aclSha256,/^[a-f0-9]{64}$/);
 const expected=names.flatMap(table_name=>roles.flatMap(role=>privileges.map(privilege=>key({table_name,role,privilege}))));
 assert.equal(new Set(r.rights.map(key)).size,expected.length);assert.deepEqual(r.rights.map(key).sort(),expected.sort());
 for(const v of r.rights){assert.equal(typeof v.allowed,'boolean');assert.equal(typeof v.direct_owner_grant,'boolean');}
 return new Map(r.rights.map(v=>[key(v),v]));
}
export function buildRehearsal(local,target,names,{now=Date.now()}={}){
 assert(names.length===81&&new Set(names).size===81&&names.every(n=>/^[a-z_][a-z0-9_]*$/.test(n)));
 assert.notEqual(local.observedAt,target.observedAt);
 const a=validate(local,names,now),b=validate(target,names,now),diff=[];
 for(const [k,x] of a){const y=b.get(k);if(ignored(x)){assert.equal(x.allowed,false,'Containment must remain');continue;}if(x.allowed===y.allowed)continue;
  assert(x.allowed&&!y.allowed,'Missing local right requires separate review');assert(['anon','authenticated'].includes(x.role)&&x.privilege!=='TRUNCATE');assert(x.direct_owner_grant,'Owner grant provenance required');diff.push(x);
 }
 assert.equal(diff.length,213,'Changed difference set requires review');
 const expected=target.rights.map(r=>({table_name:r.table_name,role:r.role,privilege:r.privilege,allowed:ignored(r)?false:r.allowed}));
 const allLocal=local.rights.map(({table_name,role,privilege,allowed})=>({table_name,role,privilege,allowed}));
 const checkMatrix=rows=>`FOR r IN SELECT * FROM jsonb_to_recordset(${literal(JSON.stringify(rows))}::jsonb) AS x(table_name text,role text,privilege text,allowed boolean) LOOP
 IF has_table_privilege(r.role,to_regclass(format('public.%I',r.table_name)),r.privilege) IS DISTINCT FROM r.allowed THEN RAISE EXCEPTION 'RIGHTS_MATRIX_STOP'; END IF;
 END LOOP;`;
 const sql=`-- LOCAL restored container only. Temporary privilege changes, always ROLLBACK. No application acceptance.
SET search_path=pg_catalog,pg_temp;
SET statement_timeout='30s';
SET lock_timeout='2s';
CREATE TEMP TABLE _potok_rights_before AS ${aclQuery};
BEGIN;
DO $check$ DECLARE r record; BEGIN
 IF current_user<>'postgres' OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) OR current_setting('session_replication_role')<>'origin' THEN RAISE EXCEPTION 'ACTOR_STOP'; END IF;
 IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999 OR EXISTS(SELECT FROM pg_roles WHERE rolname IN('anon','authenticated') AND (rolsuper OR rolbypassrls)) THEN RAISE EXCEPTION 'ROLE_OR_VERSION_STOP'; END IF;
 IF (SELECT count(*) FROM pg_namespace WHERE nspname IN('potok_control','potok_nutrition','potok_delivery'))<>0 THEN RAISE EXCEPTION 'WRONG_COPY_STOP'; END IF;
 IF extract(epoch FROM (clock_timestamp()-${literal(target.observedAt)}::timestamptz)) NOT BETWEEN -60 AND 900 OR extract(epoch FROM (clock_timestamp()-${literal(local.observedAt)}::timestamptz)) NOT BETWEEN -60 AND 900 THEN RAISE EXCEPTION 'FRESHNESS_STOP'; END IF;
 IF (${aclQuery})<>${literal(local.aclSha256)} THEN RAISE EXCEPTION 'BASELINE_DRIFT_STOP'; END IF;
 ${checkMatrix(allLocal)}
END $check$;
${diff.map(r=>'REVOKE '+r.privilege+' ON TABLE public.'+quote(r.table_name)+' FROM '+quote(r.role)+';').join('\n')}
DO $check$ DECLARE r record; BEGIN
 ${checkMatrix(expected)}
 RAISE NOTICE 'LOCAL_RIGHTS_PARITY_TEMPORARY_OK: 213 exact grants narrowed; selected matrix matches; ROLLBACK follows';
END $check$;
ROLLBACK;
DO $check$ DECLARE r record; BEGIN
 IF (${aclQuery}) IS DISTINCT FROM (SELECT * FROM pg_temp._potok_rights_before) THEN RAISE EXCEPTION 'ROLLBACK_ACL_STOP'; END IF;
 ${checkMatrix(allLocal)}
 RAISE NOTICE 'LOCAL_RIGHTS_PARITY_ROLLBACK_OK: original selected ACL restored; no committed repair or application acceptance';
END $check$;
DROP TABLE pg_temp._potok_rights_before;
`;
 return {sql,differences:diff.length,reviewedDiffKeys:diff.map(key).sort(),releaseReady:false,mayApply:false};
}
async function regular(file){const s=await fs.lstat(file);assert(s.isFile()&&!s.isSymbolicLink());}
async function parse(file){await regular(file);const value=JSON.parse(await fs.readFile(file,'utf8'));if(Array.isArray(value)){assert.equal(value.length,1);return typeof value[0].evidence==='string'?JSON.parse(value[0].evidence):value[0].evidence;}return value;}
async function sourceFiles(dir){await regular(path.join(dir,'SHA256SUMS.txt'));const text=await fs.readFile(path.join(dir,'SHA256SUMS.txt'),'utf8');const seen=new Set();for(const line of text.trim().split(/\r?\n/)){const m=line.match(/^([a-f0-9]{64})\s+\*?(roles\.sql|schema\.sql|data\.sql)$/);assert(m&&!seen.has(m[2]));seen.add(m[2]);await regular(path.join(dir,m[2]));assert.equal(hash(await fs.readFile(path.join(dir,m[2]))),m[1]);}assert.equal(seen.size,3);}
export async function privateRollbackPlan(directory,localFile,targetFile){
  const dir=await fs.realpath(directory);await sourceFiles(path.dirname(dir));await regular(path.join(dir,'capture.sql'));assert.equal(await fs.readFile(path.join(dir,'capture.sql'),'utf8'),captureSQL);
  assert.notEqual(await fs.realpath(localFile),await fs.realpath(targetFile));
  const inventory=JSON.parse(await fs.readFile(new URL('inventory-20261027.json',import.meta.url),'utf8'));
  const names=inventory.tables.filter(t=>t.schema==='public').map(t=>t.name);
  const result=buildRehearsal(await parse(localFile),await parse(targetFile),names);
  const base=path.dirname(dir),previous=(await fs.readdir(base)).filter(n=>n.startsWith('table-rights-details.'));
  const candidates=await Promise.all(previous.map(async name=>({name,time:(await fs.stat(path.join(base,name))).mtimeMs})));candidates.sort((a,b)=>b.time-a.time);assert(candidates.length>0);
  const file=path.join(base,candidates[0].name,'differences.json');await regular(file);const old=JSON.parse(await fs.readFile(file,'utf8'));assert(Array.isArray(old)&&old.length===213&&old.every(r=>r.direction==='extra_on_restored'));
  assert.deepEqual(old.map(r=>key({table_name:r.table,role:r.role,privilege:r.privilege})).sort(),result.reviewedDiffKeys,'Changed exact difference set');
  return {result,dir,names};
}
export async function main(args){
 if(args.length===2&&args[0]==='--prepare-private'){
  const base=await fs.realpath(args[1]);await sourceFiles(base);const dir=await fs.mkdtemp(path.join(base,'rights-parity-'));await fs.chmod(dir,0o700);
  await fs.writeFile(path.join(dir,'capture.sql'),captureSQL,{mode:0o600,flag:'wx'});console.log('RIGHTS_CAPTURE_PREPARED: '+dir);return;
 }
 if(args.length===4&&args[0]==='--plan-local-rollback'){
  const {result,dir}=await privateRollbackPlan(args[1],args[2],args[3]);
  const out=await fs.mkdtemp(path.join(dir,'rollback-plan-'));await fs.chmod(out,0o700);await fs.writeFile(path.join(out,'local-only.sql'),result.sql,{mode:0o600,flag:'wx'});
  console.log('LOCAL_ROLLBACK_PLAN_PREPARED: exactRevokes=213; not executed; releaseReady=false.');console.log('Private plan: '+path.join(out,'local-only.sql'));return;
 }
 throw Error('Offline capture preparation or fixed local rollback plan only');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('RIGHTS_PARITY_STOPPED: private input/context/scope/provenance changed; no SQL executed.');process.exitCode=1;});
