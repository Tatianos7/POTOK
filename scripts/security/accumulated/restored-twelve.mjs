import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdtemp,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {inputs,loadInputs,body} from './inputs.mjs';
import {buildRehearsal,parseCopyCounts} from './restored.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const literal=s=>"'"+String(s).replace(/'/g,"''")+"'";
// Authored public candidates: #209 tree plus the narrow day_date compatibility follow-up.
export const followupInputs=[
 ['paywall','scripts/security/server-premium/paywall-review.sql','eec945610cdd3e3e94fe57b1c974f537ac01fc4b7ba78f14ba05158c6b92a07c'],
 ['programRead','scripts/security/program-reads/review.sql','b6f3780740bf02267d34f58172115be005e829a3f6ff1b8244005fd6521162f0'],
 ['history','scripts/security/program-history/review.sql','d27309df8b5612566ab7156ad31b90113a27ca485af7c64267304d336efb446a'],
 ['quarantine','scripts/security/legacy-plan-quarantine/review.sql','c4d14fdd05df0453a993662108035234b3818ba792b443fd3bb8ee238ae63fbc'],
].map(([key,path,sha256])=>({key,path,sha256,ref:key==='quarantine'?'90571af942a98b3822ed175ec1483a65adb5d8d7':'2e84692a3b86315b4824ba176ec48b6d808266f6'}));
export async function loadFollowups({remote=false}={}){
 const result={};for(const item of followupInputs){let bytes;
  if(remote){const r=await fetch(`https://raw.githubusercontent.com/Tatianos7/POTOK/${item.ref}/${item.path}`,{redirect:'error',signal:AbortSignal.timeout(30000)});assert(r.ok,'Pinned follow-up unavailable: '+item.key);bytes=Buffer.from(await r.arrayBuffer());}
  else bytes=await readFile(new URL('../../../'+item.path,import.meta.url));
  assert.equal(hash(bytes),item.sha256,'Pinned follow-up changed: '+item.key);result[item.key]=body(bytes.toString('utf8'),'ROLLBACK');
 }return result;
}
async function verifyRunnerInputs(){
 for(const [file,sha] of [
 ['restored.mjs','8b7936a4fbaed205fbdae20184e22ffa7c22a168ec25ff187524ee04cd752f42'],
 ['inputs.mjs','16c171d0f2d94ca6d85307ca3a446e4a0c4db708f66fb3d76c05958ad396c2e2'],
 ['checks.mjs','19680d53a99060839188854cc49ec5b72003a71bd1e71b06a0919aaba44bc4ee']])assert.equal(hash(await readFile(new URL(file,import.meta.url))),sha,'Original eight runner changed: '+file);
}
export function buildTwelve(sources,followups,tables){
 assert.deepEqual(Object.keys(followups),followupInputs.map(i=>i.key));
 let sql=buildRehearsal(sources,tables);
 // Exact source transformation, guarded by occurrence count: old business columns are
 // hashed unchanged; the sole new nullable annotation is separately required to be NULL.
 const rowHash="encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex')";
 const query=`SELECT count(*),encode(sha256(convert_to(coalesce(string_agg(${rowHash},'' ORDER BY ${rowHash}),''),'UTF8')),'hex') FROM %I.%I t`;
 const oldCall=`EXECUTE format(${literal(query)},r.schema_name,r.table_name) INTO n,digest;`;
 assert.equal(sql.split(oldCall).length-1,3,'Original content protocol changed');
 const newCall=`EXECUTE format(replace(${literal(query)},'to_jsonb(t)',CASE WHEN r.schema_name='public' AND r.table_name='program_sessions' THEN '(to_jsonb(t)-''execution_reason'')' ELSE 'to_jsonb(t)' END),r.schema_name,r.table_name) INTO n,digest;`;
 sql=sql.replaceAll(oldCall,newCall);
 // Include the additional private projection namespace in both metadata snapshots.
 assert(sql.includes("'potok_control','potok_nutrition'"));
 sql=sql.replaceAll("'potok_control','potok_nutrition'","'potok_control','potok_nutrition','potok_delivery'");
 const anchor='DO $permissions$';assert.equal(sql.split(anchor).length-1,1);
 const extra=followupInputs.map(i=>'-- Reviewed follow-up: '+i.key+'\n'+followups[i.key]).join('\n');
 const annotation=`DO $annotation$ BEGIN
 IF EXISTS(SELECT FROM public.program_sessions WHERE execution_reason IS NOT NULL)
 OR (SELECT md5(prosrc)<>'31b744a14d51ce1c5016ea442aa9edd9' OR prosecdef OR proconfig IS DISTINCT FROM ARRAY['search_path=""'] FROM pg_proc WHERE oid='public.get_paywall_state(text,uuid)'::regprocedure)
 THEN RAISE EXCEPTION 'Unexpected annotation data or paywall source';END IF;
 END $annotation$;`;
 sql=sql.replace(anchor,()=>extra+'\n'+annotation+'\n'+followupFinalSQL+'\n'+anchor).replaceAll('EIGHT_','TWELVE_');
 assert.equal((sql.match(/^BEGIN;$/gm)??[]).length,1);assert.equal((sql.match(/^ROLLBACK;$/gm)??[]).length,1);assert(!/^COMMIT;$/m.test(sql));return sql;
}
async function backup(){
 const manifest=await readFile('SHA256SUMS.txt','utf8'),seen=new Set();
 for(const line of manifest.trim().split(/\r?\n/)){const m=line.match(/^([a-f0-9]{64})\s+\*?(roles\.sql|schema\.sql|data\.sql)$/);assert(m&&!seen.has(m[2]),'Unexpected backup manifest');seen.add(m[2]);assert.equal(hash(await readFile(m[2])),m[1],'Backup checksum mismatch');}
 assert.equal(seen.size,3);return manifest;
}
export async function main(){
 assert.deepEqual(process.argv.slice(2),['--run-restored-local'],'Explicit local rehearsal flag required');
 assert.equal(path.basename(process.cwd()),'POTOK_BACKUP_2026-10-24','Use the original restored backup folder');
 const localEndpoint=s=>typeof s==='string'&&(s.startsWith('unix:///')||/^npipe:\/{2,}\.\/pipe\//.test(s));
 assert(!process.env.DOCKER_HOST||localEndpoint(process.env.DOCKER_HOST),'Remote Docker endpoints are prohibited');
 const context=spawnSync('docker',['context','inspect','--format','{{json .Endpoints.docker.Host}}'],{encoding:'utf8',timeout:10000});assert.equal(context.status,0);assert(localEndpoint(JSON.parse(context.stdout)),'Use a local Docker engine');
 await verifyRunnerInputs();
 const manifest=await backup(),tables=parseCopyCounts(await readFile('data.sql','utf8'));
 assert.equal(tables.length,112);assert.equal(tables.reduce((n,t)=>n+t.rows,0),14888);const distribution=tables.reduce((a,t)=>(a[t.schema]=(a[t.schema]??0)+1,a),{});assert.deepEqual(distribution,{auth:26,public:81,storage:5});
 const name='supabase_db_POTOK_BACKUP_2026-10-24';
 const inspect=spawnSync('docker',['inspect','--type','container','--format','{"id":{{json .Id}},"name":{{json .Name}},"running":{{json .State.Running}},"health":{{json .State.Health.Status}},"image":{{json .Config.Image}}}',name],{encoding:'utf8',timeout:10000});assert.equal(inspect.status,0,'Restored container unavailable');
 const target=JSON.parse(inspect.stdout);assert.equal(target.name,'/'+name);assert(target.running&&target.health==='healthy');assert.match(target.id,/^[a-f0-9]{64}$/);assert.match(target.image,/(?:^|\/)supabase\/postgres:17\./);
 const sources=await loadInputs({remoteAll:true}),followups=await loadFollowups({remote:true}),sql=buildTwelve(sources,followups,tables);
 const directory=await mkdtemp(path.join(process.cwd(),'twelve-rehearsal-'));await writeFile(path.join(directory,'rehearsal.sql'),sql,{mode:0o600});
 await writeFile(path.join(directory,'public-inputs.json'),JSON.stringify([...inputs,...followupInputs],null,2),{mode:0o600});
 console.log('Backup hashes and pinned public inputs verified; local twelve-candidate rollback rehearsal starting.');
 const result=spawnSync('docker',['exec','-i',target.id,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -w -h /run/postgresql -U postgres -d postgres --set ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:300000,maxBuffer:8*1024*1024});
 if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
 assert.equal(result.status,0,'Rehearsal failed; no success claim');assert(result.stderr.includes('TWELVE_CHECKS_OK')&&result.stderr.includes('TWELVE_ROLLBACK_OK'),'Missing rollback proof');
 assert.equal(await backup(),manifest,'Backup manifest changed');console.log('TWELVE_RESTORED_REHEARSAL_OK: 112 tables / 14888 rows; database rollback verified. No release approval or full application acceptance.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error('Local twelve-candidate rehearsal stopped: '+e.message);process.exitCode=1;});

// Final effective permissions and exact projection source contracts from the public #207–209 acceptance fixtures.
export const followupFinalSQL="DO $history_final$\nBEGIN\n IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) role_name,\n unnest(ARRAY['program_versions','program_adaptations','program_explainability','program_guard_events']) table_name,\n unnest(ARRAY['UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) privilege\n WHERE has_table_privilege(role_name,'public.'||table_name,privilege))\n OR EXISTS(SELECT FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid,\n unnest(ARRAY['anon','authenticated']) role_name,unnest(ARRAY['UPDATE','REFERENCES']) privilege\n WHERE c.oid IN('public.program_versions'::regclass,'public.program_adaptations'::regclass,'public.program_explainability'::regclass,'public.program_guard_events'::regclass) AND a.attnum>0 AND NOT a.attisdropped\n AND has_column_privilege(role_name,c.oid,a.attnum,privilege))\n THEN RAISE EXCEPTION 'History final effective mutation boundary failed';END IF;\nEND $history_final$;DO $final$ BEGIN\n IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) r(role_name),\n unnest(ARRAY['nutrition_programs','training_programs','program_phases','program_blocks','program_days','program_sessions','program_generation_jobs','program_versions','program_adaptations']) t(name)\n WHERE has_table_privilege(r.role_name,'public.'||t.name,'INSERT'))\n OR EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) r(role_name),\n unnest(ARRAY['nutrition_programs','training_programs','program_phases','program_blocks','program_days','program_sessions','program_generation_jobs']) t(name)\n WHERE has_table_privilege(r.role_name,'public.'||t.name,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'))\n OR EXISTS(SELECT FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid,unnest(ARRAY['anon','authenticated']) r(role_name)\n WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY(ARRAY['nutrition_programs','training_programs','program_phases','program_blocks','program_days','program_sessions','program_generation_jobs','program_versions','program_adaptations']) AND a.attnum>0 AND NOT a.attisdropped\n AND (has_column_privilege(r.role_name,c.oid,a.attnum,'INSERT') OR\n (c.relname=ANY(ARRAY['nutrition_programs','training_programs','program_phases','program_blocks','program_days','program_sessions','program_generation_jobs']) AND (has_column_privilege(r.role_name,c.oid,a.attnum,'REFERENCES') OR\n (has_column_privilege(r.role_name,c.oid,a.attnum,'UPDATE') AND NOT(r.role_name='authenticated' AND\n ((c.relname IN('nutrition_programs','training_programs') AND a.attname='status') OR (c.relname='program_sessions' AND a.attname IN('status','execution_reason')))))))))\n OR NOT has_column_privilege('authenticated','public.nutrition_programs','status','UPDATE')\n OR NOT has_column_privilege('authenticated','public.training_programs','status','UPDATE')\n OR NOT has_column_privilege('authenticated','public.program_sessions','status','UPDATE')\n OR NOT has_column_privilege('authenticated','public.program_sessions','execution_reason','UPDATE')\n THEN RAISE EXCEPTION 'Legacy plan quarantine final permissions mismatch';END IF;\n END $final$;DO $final$ DECLARE r record;p pg_proc;BEGIN\n FOR r IN SELECT * FROM (VALUES ('potok_delivery.program_scope_v1(uuid)','b05c7dd8e77f3c5cba77fd73236e01af',true),('potok_delivery.read_program_explainability_v1(uuid,integer)','a5d9b147eb16c0b22dfcb320b21ccfea',true),('public.get_program_explainability(uuid,integer)','14dac242eb7fec9531805407f42371b1',false),('public.get_program_days(uuid)','ad6ab3fd77eaeae87f93400a838bb9f1',false),('public.get_program_day_details(uuid,date)','e6058cd9aeea79c5b9b91c191a995b8d',false)) v(sig,hash,definer) LOOP\n SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(r.sig);\n IF NOT FOUND OR md5(p.prosrc)<>r.hash OR p.prosecdef<>r.definer OR pg_get_userbyid(p.proowner)<>'postgres' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=\"\"']\n OR NOT has_function_privilege('authenticated',r.sig,'EXECUTE')\n OR has_function_privilege('anon',r.sig,'EXECUTE') OR has_function_privilege('service_role',r.sig,'EXECUTE')\n THEN RAISE EXCEPTION 'Program read final source contract mismatch';END IF;END LOOP;\n IF EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) role_name,unnest(ARRAY['knowledge_refs','confidence','guard_notes']) col WHERE has_column_privilege(role_name,'public.program_explainability',col,'SELECT'))\n OR NOT has_schema_privilege('authenticated','potok_delivery','USAGE') OR has_schema_privilege('authenticated','potok_delivery','CREATE')\n OR has_schema_privilege('anon','potok_delivery','USAGE,CREATE') OR has_schema_privilege('service_role','potok_delivery','USAGE,CREATE')\n THEN RAISE EXCEPTION 'Program read final permissions mismatch';END IF;END $final$;";
