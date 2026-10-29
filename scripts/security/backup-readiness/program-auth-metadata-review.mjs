// Diagnose Auth metadata without browser, OTP, schema changes or baseline replacement.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual as equal} from 'node:util';
// Exact logical definition query from private-auth.mjs, SHA256 7b0cac6c...f78c8.
export const logicalAuthSQL="SELECT jsonb_build_object(\n 'relations',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relname,c.relkind,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity) ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='auth'::regnamespace),\n 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attrelid,a.attnum,a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE c.relnamespace='auth'::regnamespace AND a.attnum>0 AND NOT a.attisdropped),\n 'indexes',(SELECT jsonb_agg(jsonb_build_array(i.indexrelid,i.indisvalid,i.indisready,pg_get_indexdef(i.indexrelid)) ORDER BY i.indexrelid) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid WHERE c.relnamespace='auth'::regnamespace),\n 'constraints',(SELECT jsonb_agg(jsonb_build_array(oid,convalidated,pg_get_constraintdef(oid)) ORDER BY oid) FROM pg_constraint WHERE connamespace='auth'::regnamespace),\n 'functions',(SELECT jsonb_agg(jsonb_build_array(oid,proowner,proacl,proconfig,md5(prosrc),prosecdef,pg_get_function_arguments(oid),pg_get_function_result(oid)) ORDER BY oid) FROM pg_proc WHERE pronamespace='auth'::regnamespace),\n 'triggers',(SELECT jsonb_agg(jsonb_build_array(t.oid,t.tgenabled,pg_get_triggerdef(t.oid)) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='auth'::regnamespace)\n ) AS state";

export const rawAuthSQL=`SELECT jsonb_build_object(
 'relations',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='auth'::regnamespace),
 'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='auth'::regnamespace),
 'routines',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace='auth'::regnamespace)
) AS doc`;
export const observationSQL=`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;SET LOCAL timezone='UTC';SET LOCAL datestyle='ISO,YMD';SET LOCAL extra_float_digits=3;SET LOCAL statement_timeout='60s';SET LOCAL lock_timeout='3s';
WITH raw AS (${rawAuthSQL}), logical AS (${logicalAuthSQL})
SELECT jsonb_build_object('actor',current_user,'readOnly',current_setting('transaction_read_only'),
 'actorSuper',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),
 'raw',doc,'rawHash',encode(sha256(convert_to(doc::text,'UTF8')),'hex'),
 'logical',(SELECT state FROM logical)) FROM raw;
ROLLBACK;`;
export function compareRows(before,after,identity){
 assert(Array.isArray(before)&&Array.isArray(after));
 const maps=[before,after].map(rows=>new Map(rows.map(r=>[identity(r),r])));
 assert.equal(maps[0].size,before.length);assert.equal(maps[1].size,after.length);
 const fields=new Set();let added=0,removed=0;
 for(const [key,b] of maps[0]){const a=maps[1].get(key);if(!a){removed++;continue;}
  for(const field of new Set([...Object.keys(b),...Object.keys(a)]))if(!equal(b[field],a[field]))fields.add(field);
 }
 for(const key of maps[1].keys())if(!maps[0].has(key))added++;
 return {changedFields:[...fields].sort(),addedObjects:added,removedObjects:removed};
}
const dbId='8ea4ab28ee60efd0c157ec0f6a9d1fa24f02ffd0c58b7a36c30a47a570785989';
const dbImage='sha256:40868dfbce8c3a901448991069b7bcabbe14e8f8105ef609af22afce79b2dc44';
export async function main(args){let stage='inputs';try{
 assert.equal(args.length,2);assert.equal(args[0],'--inspect-local-auth-metadata');
 const base=fs.realpathSync(args[1]);assert.equal(base,fs.realpathSync(path.join(process.env.HOME,'POTOK_BACKUP_2026-10-24')));
 const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
 const prior=read(path.join(base,'program-client-KTEgS1/after.json'));assert.match(prior.protected.authMetadata,/^[a-f0-9]{64}$/);
 const ab=read(path.join(base,'private-auth-ab-vDuXtY/state.json'));assert.equal(ab.dbId,dbId);assert.match(ab.authDirectory,/^private-auth-[A-Za-z0-9]+$/);
 const authDirectory=fs.realpathSync(path.join(base,ab.authDirectory));assert.equal(path.dirname(authDirectory),base);
 const logicalBaseline=read(path.join(authDirectory,'auth-metadata-before.json'));
 const categories=['relations','columns','indexes','constraints','functions','triggers'];assert.deepEqual(Object.keys(logicalBaseline).sort(),[...categories].sort());
 const options={encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:120000,maxBuffer:32*1024*1024};
 const endpoint=execFileSync('docker',['context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}'],options).trim();assert(endpoint.startsWith('unix:///'));
 const docker=args=>execFileSync('docker',['--host',endpoint,...args],options);
 const inspect=name=>JSON.parse(docker(['inspect',name]))[0];
 const candidate=inspect(dbId);assert.equal(candidate.Id,dbId);assert(candidate.State.Running);assert.equal(candidate.Image,dbImage);assert.equal(candidate.HostConfig.NetworkMode,'none');assert(candidate.Mounts.some(m=>m.Type==='volume'&&m.Name==='potok_security_candidate_2026-10-26'&&m.Destination==='/var/lib/postgresql/data'));
 const original=inspect('supabase_db_POTOK_BACKUP_2026-10-24');assert.equal(original.Name,'/supabase_db_POTOK_BACKUP_2026-10-24');assert.notEqual(original.Id,dbId);assert(original.State.Running);assert.equal(original.Image,dbImage);assert(original.Mounts.some(m=>m.Type==='volume'&&m.Name==='supabase_db_POTOK_BACKUP_2026-10-24'&&m.Destination==='/var/lib/postgresql/data'));
 const query=id=>{const r=JSON.parse(execFileSync('docker',['--host',endpoint,'exec','-i',id,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -w -qAt -h /tmp -U postgres -d postgres --set ON_ERROR_STOP=1'],{...options,input:observationSQL}));assert.equal(r.actor,'postgres');assert.equal(r.readOnly,'on');assert.equal(r.actorSuper,false);assert.match(r.rawHash,/^[a-f0-9]{64}$/);return r;};
 stage='candidate-read';const current=query(dbId);stage='original-read';const origin=query(original.Id);
 const out=fs.mkdtempSync(path.join(base,'auth-metadata-review-'));fs.chmodSync(out,0o700);
 for(const [name,value] of [['candidate.json',current],['original.json',origin]])fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2),{mode:0o600,flag:'wx'});
 fs.writeFileSync(path.join(out,'query.sql'),observationSQL,{mode:0o600,flag:'wx'});
 const summary={logicalCategoriesChangedVsAuthInstall:categories.filter(k=>!equal(logicalBaseline[k],current.logical[k])),
  originalRawMatchesClientReference:origin.rawHash===prior.protected.authMetadata,candidateRawMatchesClientReference:current.rawHash===prior.protected.authMetadata,
  rawCategoriesChangedVsOriginal:['relations','columns','routines'].filter(k=>!equal(origin.raw[k],current.raw[k])),
  relations:compareRows(origin.raw.relations,current.raw.relations,r=>String(r.oid)),
  columns:compareRows(origin.raw.columns,current.raw.columns,r=>r.attrelid+':'+r.attnum),
  routines:compareRows(origin.raw.routines,current.raw.routines,r=>String(r.oid)),readOnly:true,baselineReplaced:false,evidenceFolder:path.basename(out)};
 fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2),{mode:0o600,flag:'wx'});console.log(JSON.stringify(summary,null,2));
 }catch{console.error('AUTH_METADATA_REVIEW_STOPPED: '+stage);process.exitCode=1;}}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main(process.argv.slice(2));
