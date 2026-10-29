// Builds one exact owner-reviewable ROLLBACK batch. No DB client or apply mode.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {beforeRowsSQL,afterRowsSQL} from './row-guard.mjs';
import {assessLocks} from './lock-admission.mjs';
import {target,tableScope} from './target-plan.mjs';
export const sha=x=>createHash('sha256').update(x).digest('hex');
const literal=x=>"'"+String(x).replace(/'/g,"''")+"'";
const quote=x=>'"'+x.replace(/"/g,'""')+'"';
export function contextSQL(){return `DO $context$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR (SELECT rolsuper OR NOT rolbypassrls FROM pg_roles WHERE rolname=current_user)
 OR current_setting('server_version_num')::integer<>170006
 OR current_setting('session_replication_role')<>'origin'
 OR current_setting('transaction_isolation')<>'read committed'
 OR EXISTS(SELECT FROM pg_roles WHERE rolname IN('anon','authenticated') AND (rolsuper OR rolbypassrls))
 OR EXISTS(SELECT FROM pg_namespace WHERE nspname IN('potok_control','potok_nutrition','potok_delivery'))
 THEN RAISE EXCEPTION 'TARGET_REHEARSAL_CONTEXT_STOPPED'; END IF;
END $context$;\n`;}

export function lockPrivilegeSQL(locks){
  assert(Array.isArray(locks)&&locks.length===116);
  const expected=locks.map(t=>({schema:t.schema,name:t.name,all_modes:t.blocksConcurrentWrites}));
  return `DO $privileges$ BEGIN
 IF EXISTS(SELECT FROM jsonb_to_recordset(${literal(JSON.stringify(expected))}::jsonb) e(schema text,name text,all_modes boolean)
 LEFT JOIN pg_namespace n ON n.nspname=e.schema LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=e.name
 WHERE c.oid IS NULL OR NOT has_table_privilege(current_user,c.oid,'SELECT')
 OR has_table_privilege(current_user,c.oid,'MAINTAIN,UPDATE,DELETE,TRUNCATE') IS DISTINCT FROM e.all_modes)
 THEN RAISE EXCEPTION 'TARGET_REHEARSAL_LOCK_PRIVILEGES_STOPPED';END IF;
 END $privileges$;\n`;
}

export function canonicalCTE(preflight){
  assert.equal(sha(preflight),'f4ed00929a3256682924f996dd72dd61a10734888d97cbc74b4e3fd2c9eabc3d');
  const anchor="\nSELECT jsonb_build_object(\n 'protocol'";
  const start=preflight.indexOf('WITH relation_state AS ('),end=preflight.indexOf(anchor);
  assert(start>0&&end>start&&preflight.indexOf(anchor,end+1)<0);
  return preflight.slice(start,end);
}
export function metadataSQL(cte,digest){
  assert.match(digest,/^[a-f0-9]{64}$/);
  return `DO $metadata$ DECLARE actual text; BEGIN
 ${cte}
 SELECT encode(sha256(convert_to(document::text,'UTF8')),'hex') INTO actual FROM canonical_metadata;
 IF actual IS DISTINCT FROM ${literal(digest)} THEN RAISE EXCEPTION 'TARGET_REHEARSAL_METADATA_STOPPED';END IF;
END $metadata$;\n`;
}
export function scopeSQL(tables,{after=false,owners}={}){
  assert(Array.isArray(tables)&&tables.length>0&&tables.length<=116);
  const seen=new Set();
  const expected=tables.map(t=>{
    assert(['auth','public','storage'].includes(t.schema));assert.match(t.name,/^[a-z_][a-z0-9_]*$/);
    assert(!seen.has(t.schema+'.'+t.name));seen.add(t.schema+'.'+t.name);
    assert.equal(t.kind,'r');assert.equal(t.partition,false);assert(Array.isArray(t.columns)&&t.columns.length>0);
    for(const c of t.columns){assert.equal(typeof c.name,'string');assert.equal(typeof c.type,'string');assert.equal(typeof c.generated,'string');}
    const columns=t.columns.map(c=>({name:c.name,type:c.type,generated:c.generated}));
    if(after&&t.schema==='public'&&t.name==='program_sessions')columns.push({name:'execution_reason',type:'text',generated:''});
    return {schema:t.schema,name:t.name,kind:'r',partition:false,columns};
  }).sort((a,b)=>(a.schema+'.'+a.name)<(b.schema+'.'+b.name)?-1:(a.schema+'.'+a.name)>(b.schema+'.'+b.name)?1:0);
  const ownerClause=owners?` OR EXISTS(SELECT FROM jsonb_to_recordset(${literal(JSON.stringify(owners))}::jsonb) e(schema text,name text,owner text)
 LEFT JOIN pg_namespace n ON n.nspname=e.schema LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=e.name
 WHERE c.oid IS NULL OR pg_get_userbyid(c.relowner) IS DISTINCT FROM e.owner)` : '';
  return `DO $scope$ DECLARE actual jsonb; BEGIN
 SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'partition',c.relispartition,
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'generated',a.attgenerated) ORDER BY a.attnum)
 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)) ORDER BY n.nspname COLLATE "C",c.relname COLLATE "C")
 INTO actual FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN('auth','public','storage') AND c.relkind IN('r','p');
 IF actual IS DISTINCT FROM ${literal(JSON.stringify(expected))}::jsonb${ownerClause}
 THEN RAISE EXCEPTION 'TARGET_REHEARSAL_SCOPE_STOPPED';END IF;
END $scope$;\n`;
}
export function sequenceSQL(after=false){
  const state=`SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.seqrelid),'[]'::jsonb) FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('auth','public','storage')`;
  if(!after)return `CREATE TEMP TABLE potok_release_sequence_v1(schema_name text,sequence_name text,value bigint,called boolean,PRIMARY KEY(schema_name,sequence_name)) ON COMMIT DROP;
 CREATE TEMP TABLE potok_release_sequence_catalog_v1 ON COMMIT DROP AS ${state};
 DO $sequence_before$ DECLARE r record;v bigint;b boolean;BEGIN
 FOR r IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('auth','public','storage') AND c.relkind='S' ORDER BY n.nspname,c.relname LOOP
 EXECUTE format('SELECT last_value,is_called FROM %I.%I',r.nspname,r.relname) INTO v,b;
 INSERT INTO pg_temp.potok_release_sequence_v1 VALUES(r.nspname,r.relname,v,b);
 END LOOP;END $sequence_before$;\n`;
  return `DO $sequence_after$ DECLARE r record;v bigint;b boolean;actual jsonb;BEGIN
 ${state} INTO actual;
 IF actual IS DISTINCT FROM (SELECT * FROM pg_temp.potok_release_sequence_catalog_v1)
 THEN RAISE EXCEPTION 'TARGET_REHEARSAL_SEQUENCE_CATALOG_STOPPED';END IF;
 FOR r IN SELECT * FROM pg_temp.potok_release_sequence_v1 ORDER BY schema_name,sequence_name LOOP
 EXECUTE format('SELECT last_value,is_called FROM %I.%I',r.schema_name,r.sequence_name) INTO v,b;
 IF v IS DISTINCT FROM r.value OR b IS DISTINCT FROM r.called THEN RAISE EXCEPTION 'TARGET_REHEARSAL_SEQUENCE_VALUE_STOPPED';END IF;
 END LOOP;RAISE NOTICE 'TARGET_SEQUENCES_PRESERVED_OK';END $sequence_after$;\n`;
}
export function reviewedBody(sql,manifest){
  assert.equal(sha(JSON.stringify(manifest)),'1d046e2c87bb23fa96e15af89c6ddedbcc59b58b44bbb743bf9fa548b47de31c');
  assert.equal(sha(sql),manifest.artifacts.find(x=>x.path==='forward.review.sql').sha256);
  const start=sql.indexOf('-- Reviewed candidate: truncate\n'),end=sql.lastIndexOf('\nROLLBACK;');
  assert(start>0&&end>start&&/^\nROLLBACK;\s*$/.test(sql.slice(end)));
  const body=sql.slice(start,end);
  assert.equal((body.match(/^-- Reviewed candidate: /gm)||[]).length,8);
  assert.equal((body.match(/^-- Reviewed follow-up: /gm)||[]).length,4);
  assert(!/^(BEGIN|COMMIT|ROLLBACK);|^\s*\\/m.test(body));
  return body;
}
export async function buildArtifacts(){
  const read=async p=>readFile(new URL(p,import.meta.url),'utf8');
  const manifest=JSON.parse(await read('manifest.json')),observation=JSON.parse(await read('target-observation-20261029.json'));
  const lock=assessLocks(JSON.parse(await read('lock-observation-20261029.json')));
  const inventory=JSON.parse(await read('../backup-readiness/inventory-20261027.json'));
  assert.equal(inventory.projectRef,target);assert.equal(inventory.tables.length,116);
  const tables=tableScope(observation.lockScope.tables),owners=tables.map(({schema,name,owner})=>({schema,name,owner}));
  assert.deepEqual(lock.locks.map(t=>t.schema+'.'+t.name),tables.map(t=>t.schema+'.'+t.name));
  const preflight=await read('preflight.sql'),cte=canonicalCTE(preflight),body=reviewedBody(await read('forward.review.sql'),manifest);
  const locks=lock.locks.map(t=>`LOCK TABLE ${quote(t.schema)}.${quote(t.name)} IN ${t.mode} MODE;`).join('\n');
  const sql=`-- PENDING EXACT OWNER APPROVAL: managed POTOK rollback rehearsal only.
-- Execute only through the reviewed connector call project_id=${target}.
-- SQL metadata is NOT cryptographic project/connection identity.
-- Four managed ACCESS SHARE locks do not freeze provider writes. Any observed
-- concurrent scope/content/sequence change stops. Do not run during maintenance.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL timezone='UTC';SET LOCAL datestyle='ISO,YMD';SET LOCAL extra_float_digits=3;
SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='120s';
SET LOCAL idle_in_transaction_session_timeout='120s';
${contextSQL()}
${lockPrivilegeSQL(lock.locks)}
${locks}
${metadataSQL(cte,observation.preflight.public_metadata_sha256)}
${scopeSQL(inventory.tables,{owners})}
${sequenceSQL()}
${beforeRowsSQL(tables)}
${body}
${scopeSQL(inventory.tables,{after:true,owners})}
${afterRowsSQL(tables)}
${sequenceSQL(true)}
DO $annotation$ BEGIN
 IF EXISTS(SELECT FROM public.program_sessions WHERE execution_reason IS NOT NULL)
 THEN RAISE EXCEPTION 'TARGET_REHEARSAL_NEW_ANNOTATION_STOPPED';END IF;
END $annotation$;
DO $done$ BEGIN RAISE NOTICE 'TARGET_TWELVE_REHEARSAL_CHECKS_OK';END $done$;
ROLLBACK;
`;
  assert.equal((sql.match(/^BEGIN ISOLATION LEVEL READ COMMITTED;$/gm)||[]).length,1);
  assert.equal((sql.match(/^ROLLBACK;$/gm)||[]).length,1);assert(!/^COMMIT\b|^\s*\\/m.test(sql));
  // Independently submitted over a new connection after the batch, including errors.
  const after=`BEGIN READ ONLY;\nSET LOCAL search_path=pg_catalog,pg_temp;SET LOCAL timezone='UTC';SET LOCAL statement_timeout='15s';\n${contextSQL().replace(" OR current_setting('transaction_isolation')<>'read committed'",'')}\n${metadataSQL(cte,observation.preflight.public_metadata_sha256)}\n${scopeSQL(inventory.tables,{owners})}\nDO $rolled_back$ BEGIN
 IF EXISTS(SELECT FROM pg_namespace WHERE nspname IN('potok_control','potok_nutrition','potok_delivery'))
 THEN RAISE EXCEPTION 'TARGET_REHEARSAL_ROLLBACK_STOPPED';END IF;
 RAISE NOTICE 'TARGET_TWELVE_REHEARSAL_ROLLBACK_OK';END $rolled_back$;
ROLLBACK;\n`;
  const files={'target-twelve-rehearsal.pending-approval.sql':sql,'target-twelve-after.readonly.sql':after};
  files['target-twelve-rehearsal-manifest.json']=JSON.stringify({protocol:'potok-target-twelve-rehearsal-v1',projectRef:target,
    status:'PENDING_EXACT_OWNER_APPROVAL',connectorBinding:{tool:'supabase.execute_sql',project_id:target},
    sqlInputs:manifest.sqlInputs,clientCommit:manifest.clientCommit,
    baselineMetadataSha256:observation.preflight.public_metadata_sha256,
    lockCounts:{writeBlocking:112,accessShareOnly:4},oldRowsChecked:116,sequenceCheck:'before/after values and catalog; no reset',
    terminalAction:'ROLLBACK',hostedExecuted:false,mayDeploy:false,releaseReady:false,
    requirements:['exact owner approval of project and this SQL hash','fresh target preflight','no provider maintenance in the rehearsal window','independent after-check even after an error; never auto-replay'],
    limitations:['No permanent forward COMMIT or client publication','Four managed tables are not write-frozen','Storage binaries and provider configuration are not changed or recovered','Sequence increments are not transactional; divergence stops but is never reset'],
    artifacts:Object.entries(files).map(([path,text])=>({path,sha256:sha(text)}))},null,2)+'\n';
  return files;
}
export async function main(args){
  assert(args.length===1&&['--write-review','--verify'].includes(args[0]));
  for(const [name,text] of Object.entries(await buildArtifacts())){
    if(args[0]==='--write-review')await writeFile(new URL(name,import.meta.url),text);
    else assert.equal(await readFile(new URL(name,import.meta.url),'utf8'),text);
  }
  console.log('TARGET_TWELVE_REHEARSAL_PACKAGE_OK: exact 12 bodies; baseline/schema/rows/sequences/final rights; ROLLBACK only; not executed');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main(process.argv.slice(2)).catch(()=>{console.error('TARGET_TWELVE_REHEARSAL_PACKAGE_STOPPED');process.exitCode=1;});
