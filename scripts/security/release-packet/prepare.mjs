// Public source packaging only. No DB client, Docker, credentials or apply mode.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {inputs,loadInputs,combined} from '../accumulated/inputs.mjs';
import {followupInputs,loadFollowups,followupFinalSQL} from '../accumulated/restored-twelve.mjs';
import {permissionQuery} from '../accumulated/checks.mjs';
import {boundaryQuery} from '../accumulated/private-candidate.mjs';
export const clientCommit='996a81c30906000b9cb6ffe88456a98b55cb692f';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const here=new URL('./',import.meta.url);
export function assertReviewOnly(sql) {
  assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1);
  assert.equal((sql.match(/^ROLLBACK;$/gm)||[]).length,1);
  assert(!/^\s*COMMIT\b/im.test(sql));assert(!/^\s*\\/m.test(sql));
  const guard=sql.indexOf("RAISE EXCEPTION 'REVIEW_ONLY_NO_TARGET_APPROVAL'");
  assert(guard>=0&&guard<sql.indexOf('-- Reviewed candidate:'));
}
async function artifacts() {
  const sources=await loadInputs({remoteAll:true}),followups=await loadFollowups({remote:true});
  assert.deepEqual(Object.keys(sources),inputs.map(i=>i.key));assert.deepEqual(Object.keys(followups),followupInputs.map(i=>i.key));
  const boundaryBytes=await readFile(new URL('../platform-defaults/check.sql',here));
  const boundary=boundaryQuery(boundaryBytes.toString('utf8')).trim().replace(/;$/,'');
  const sql=`-- SOURCE REVIEW ONLY. NOT A MIGRATION, REHEARSAL OR HOSTED APPLY SCRIPT.
-- Unconditional stop before any candidate; removing it or changing ROLLBACK is not a release procedure.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='120s';
DO $review_guard$ BEGIN RAISE EXCEPTION 'REVIEW_ONLY_NO_TARGET_APPROVAL'; END $review_guard$;
${combined(sources)}
${followupInputs.map(i=>'-- Reviewed follow-up: '+i.key+'\n'+followups[i.key]).join('\n')}
${followupFinalSQL}
DO $review_final$ DECLARE checks jsonb;verdict text;BEGIN
 SELECT to_jsonb(q) INTO checks FROM (${permissionQuery()}) q;
 IF EXISTS(SELECT FROM jsonb_each(checks) e WHERE e.value IS DISTINCT FROM 'true'::jsonb)
 THEN RAISE EXCEPTION 'Final effective permission review failed';END IF;
 IF EXISTS(SELECT FROM potok_control.access_attestations)
 THEN RAISE EXCEPTION 'Authority must remain empty';END IF;
 SELECT q.verdict INTO verdict FROM (${boundary}) q;
 IF verdict IS DISTINCT FROM 'SQL_BOUNDARY_VERIFIED'
 THEN RAISE EXCEPTION 'SQL boundary review failed';END IF;
END $review_final$;
ROLLBACK;
`;
  assertReviewOnly(sql);
  const records=[...inputs.map(i=>({...i,body:sources[i.key]})),...followupInputs.map(i=>({...i,terminator:'ROLLBACK',body:followups[i.key]}))]
    .map((i,index)=>({order:index+1,key:i.key,ref:i.ref,path:i.path,sourceSha256:i.sha256,wrapperTerminator:i.terminator,normalizedBodySha256:sha(i.body)}));
  const files=['src/services/programDeliveryService.ts','src/services/programExecutionService.ts','src/services/uiRuntimeAdapter.ts','.node-version'];
  const clientFiles=[];for(const file of files){
    const bytes=await readFile(new URL('../../../'+file,here));
    const pinned=execFileSync('git',['show',clientCommit+':'+file],{maxBuffer:2*1024*1024});
    assert.equal(sha(bytes),sha(pinned),'Client source no longer matches exact reviewed commit: '+file);
    clientFiles.push({path:file,sha256:sha(bytes)});
  }
  const manifest={protocol:'potok-release-review-packet-v1',clientCommit,clientFiles,sqlInputs:records,
    boundaryPolicy:{path:'scripts/security/platform-defaults/check.sql',sha256:sha(boundaryBytes)},
    artifacts:[{path:'forward.review.sql',sha256:sha(sql)},{path:'preflight.sql',sha256:sha(await readFile(new URL('preflight.sql',here)))},{path:'state.mjs',sha256:sha(await readFile(new URL('state.mjs',here)))}],
    mayApply:false,releaseReady:false,includesHostedMigration:false,includesAutomaticRecovery:false,
    requiredNextEvidence:['fresh_target_backup_recovery','complete_table_and_storage_scope','approved_managed_extension_rehearsal','target_drift_and_effective_source_checks','http_exposure_and_client_window','owner_exact_batch_approval']};
  return {sql,manifest:JSON.stringify(manifest,null,2)+'\n'};
}
export async function main(args) {
  assert(args.length===1&&['--write-review','--verify'].includes(args[0]),'Only --write-review or --verify; no apply, target, URL or recovery flags');
  const output=await artifacts();
  for(const [file,bytes] of [['forward.review.sql',output.sql],['manifest.json',output.manifest]]) {
    if(args[0]==='--write-review')await writeFile(new URL(file,here),bytes);
    else assert.equal(await readFile(new URL(file,here),'utf8'),bytes,'Review artifact drift: '+file);
  }
  console.log('RELEASE_REVIEW_PACKET_OK: 12 pinned sources; guarded review SQL; no deployment capability');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('RELEASE_REVIEW_PACKET_STOPPED: no apply capability or success claim');process.exitCode=1;});
