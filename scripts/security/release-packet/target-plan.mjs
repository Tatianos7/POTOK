// Pure preparation for one named target. No connection, credentials or apply entry point.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {beforeRowsSQL,afterRowsSQL} from './row-guard.mjs';
import {classifyPreflight,recoveryDecision} from './state.mjs';
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
export const target='dtsdnhbcwpbfrhcazqkb';
const quote=x=>'"'+x.replace(/"/g,'""')+'"';
export function tableScope(tables){
 assert(Array.isArray(tables)&&tables.length===116);const names=new Set(),counts={auth:0,public:0,storage:0};
 for(const t of tables){assert(Object.hasOwn(counts,t.schema));assert.match(t.name,/^[a-z_][a-z0-9_]*$/);assert.equal(t.kind,'r');assert.equal(t.owner,{auth:'supabase_auth_admin',public:'postgres',storage:'supabase_storage_admin'}[t.schema]);const key=t.schema+'.'+t.name;assert(!names.has(key));names.add(key);counts[t.schema]++;}
 assert.deepEqual(counts,{auth:27,public:81,storage:8});return [...tables].sort((a,b)=>(a.schema+'.'+a.name).localeCompare(b.schema+'.'+b.name,'en'));
}
export function prepareTargetPlan(observation,manifest){
 assert.equal(observation.protocol,'potok-release-target-observation-v1');assert.equal(observation.projectRef,target);assert.equal(observation.readOnly,true);assert.equal(observation.containsUserRows,false);assert.equal(observation.mayApply,false);
 const f=observation.preflight;assert.equal(classifyPreflight(f).state,'BASELINE_OBSERVED');assert.equal(f.public_tables,81);assert.equal(f.client_truncate_tables,63);assert.equal(f.protected_profile_write_columns,4);assert.deepEqual(f.candidate_namespaces,[]);assert.equal(f.execution_reason_present,false);
 assert.equal(hash(manifest),'1d046e2c87bb23fa96e15af89c6ddedbcc59b58b44bbb743bf9fa548b47de31c','Exact reviewed manifest changed');
 assert.equal(manifest.protocol,'potok-release-review-packet-v1');assert.equal(manifest.clientCommit,'996a81c30906000b9cb6ffe88456a98b55cb692f');assert.equal(manifest.sqlInputs.length,12);assert.equal(manifest.mayApply,false);assert.equal(manifest.releaseReady,false);assert.equal(manifest.includesHostedMigration,false);
 assert.equal(new Set(manifest.sqlInputs.map(t=>t.key)).size,12);for(const [i,s] of manifest.sqlInputs.entries()){assert.equal(s.order,i+1);for(const k of ['ref','sourceSha256','normalizedBodySha256'])assert.match(s[k],k==='ref'?/^[a-f0-9]{40}$/:/^[a-f0-9]{64}$/);}
 const tables=tableScope(observation.lockScope.tables);assert.equal(observation.lockScope.protocol,'potok-release-lock-scope-v1');assert.equal(observation.lockScope.readOnly,'on');assert.deepEqual(observation.lockScope.extension,{name:'pg_trgm',owner:'supabase_admin',schema:'public',members:47,version:'1.6'});
 const clientNode=manifest.clientFiles.find(t=>t.path==='.node-version');assert(clientNode);assert.equal(manifest.clientFiles.length,4);
 return {protocol:'potok-target-release-plan-v1',projectRef:target,observedAt:f.observed_at,sourceObservationSha256:hash(observation),reviewManifestSha256:hash(manifest),baselineMetadataSha256:f.public_metadata_sha256,
  acceptedPrivatePackageCommit:'8706594ef46968ae36647f7306262fa481cb3472',acceptedPrivateEvidence:'program-ui-izBBNW',clientCommit:manifest.clientCommit,clientFiles:manifest.clientFiles,
  sqlInputs:manifest.sqlInputs,lockScope:tables,lockMode:'SHARE ROW EXCLUSIVE',lockTimeout:'3s',statementTimeout:'120s',rowPreservation:'all old columns; sorted SHA256 of every row; counts; no data exported',
  guards:{actor:'postgres',actorSuper:false,actorBypass:true,postgresMajor:17,replicationRole:'origin',scopeMustMatch:true,metadataMustMatch:true,authorityMustRemainEmpty:true,generatorEnabled:false,paymentVerificationEnabled:false},
  requiredBeforeApproval:['fresh_private_backup_and_full_scope_recovery','managed_pg_trgm_rehearsal_and_extra_search_path','reserved_default_boundary_decision','client_update_window_and_exact_deployed_commit','fresh_target_metadata_and_source_recheck','owner_exact_forward_hash_target_and_recovery_approval'],
  recovery:Object.fromEntries(['not_started','rolled_back','unknown_commit','committed'].map(outcome=>[outcome,recoveryDecision({outcome})])),
  mayApply:false,releaseReady:false,includesHostedRunner:false,terminalActionRequiredNow:false};
}
// This preview is deliberately blocked before locks or reads of application rows.
// It specifies the future transaction envelope, not an executable release.
export function lockEnvelope(plan){
 assert.equal(plan.projectRef,target);assert.equal(plan.mayApply,false);assert.equal(plan.releaseReady,false);const tables=tableScope(plan.lockScope);
 return `-- TARGET-BOUND ENVELOPE REVIEW ONLY. NOT AN APPLY/RESTORE COMMAND.
-- Target ${target}; accepted private package ${plan.acceptedPrivatePackageCommit}.
-- Current metadata ${plan.baselineMetadataSha256}; recheck inside future locks.
-- Client ${plan.clientCommit}; twelve SQL bodies stay pinned in manifest.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='120s';
SET LOCAL idle_in_transaction_session_timeout='120s';
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL timezone='UTC';
SET LOCAL datestyle='ISO,YMD';
SET LOCAL extra_float_digits=3;
DO $release_guard$ BEGIN RAISE EXCEPTION 'TARGET_RELEASE_NOT_APPROVED'; END $release_guard$;
-- Future runner must bind the actual connection to the named project. An
-- ordinary custom GUC or current_database() is NOT proof of project identity.
LOCK TABLE ${tables.map(t=>quote(t.schema)+'.'+quote(t.name)).join(',\n ')} IN SHARE ROW EXCLUSIVE MODE;
-- Recheck EXACT table inventory/owners/shapes, actor/version and fresh public
-- metadata AFTER acquiring all locks. Drift/unknown connection => stop.
-- Capture row-guard.sql BEFORE block, exact twelve pinned bodies, final source/
-- effective rights/empty authority/extension checks, row-guard.sql AFTER block.
-- Pre-commit no writes from active clients/jobs in the approved window.
-- A separately reviewed final forward hash and independent post-commit script
-- are still required. Never remove this guard to deploy this envelope.
ROLLBACK;
`;
}
export async function main(args){assert.equal(args.length,1);assert(['--write-review','--verify'].includes(args[0]));const read=async n=>JSON.parse(await readFile(new URL(n,import.meta.url),'utf8'));
 const observation=await read('target-observation-20261029.json'),manifest=await read('manifest.json');const plan=prepareTargetPlan(observation,manifest);
 const artifacts={'target-plan-20261029.json':JSON.stringify(plan,null,2)+'\n','target-envelope.review.sql':lockEnvelope(plan),'target-rows.before.review.sql':beforeRowsSQL(plan.lockScope),'target-rows.after.review.sql':afterRowsSQL(plan.lockScope)};
 artifacts['target-package-manifest-20261029.json']=JSON.stringify({protocol:'potok-target-preparation-bundle-v1',projectRef:target,mayApply:false,releaseReady:false,artifacts:Object.entries(artifacts).map(([path,content])=>({path,sha256:hash(content)}))},null,2)+'\n';
 for(const [name,content] of Object.entries(artifacts)){if(args[0]==='--write-review')await writeFile(new URL(name,import.meta.url),content);else assert.equal(await readFile(new URL(name,import.meta.url),'utf8'),content);}
 console.log('TARGET_RELEASE_PREPARATION_OK: fixed target; 12 pinned inputs; 116-table lock envelope; no apply capability; current backup/managed/window/approval evidence required.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main(process.argv.slice(2)).catch(()=>{console.error('TARGET_RELEASE_PREPARATION_STOPPED');process.exitCode=1;});
