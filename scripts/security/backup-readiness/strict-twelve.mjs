// Public pinned source fetch + private file generation only. No DB, Docker or apply entry point.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {privateRollbackPlan} from './rights-rehearsal.mjs';
import {inputs,loadInputs} from '../accumulated/inputs.mjs';
import {parseCopyCounts} from '../accumulated/restored.mjs';
import {buildTwelve,loadFollowups,followupInputs} from '../accumulated/restored-twelve.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
function parts(sql){
 assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1);assert.equal((sql.match(/^ROLLBACK;$/gm)||[]).length,1);
 assert(!/^\s*COMMIT\b/im.test(sql));assert(!/^\s*\\/m.test(sql));
 const begin='\nBEGIN;\n',end='\nROLLBACK;\n',a=sql.indexOf(begin),b=sql.indexOf(end);assert(a>=0&&b>a);
 return {before:sql.slice(0,a),body:sql.slice(a+begin.length,b),after:sql.slice(b+end.length)};
}
export function combineStrictTwelve(rightsSQL,twelveSQL){
 const r=parts(rightsSQL),t=parts(twelveSQL);
 assert.equal((r.body.match(/^REVOKE /gm)||[]).length,213);
 for(const marker of ['BASELINE_DRIFT_STOP','LOCAL_RIGHTS_PARITY_TEMPORARY_OK'])assert(r.body.includes(marker));
 assert(r.after.includes('LOCAL_RIGHTS_PARITY_ROLLBACK_OK'));
 assert(t.body.includes('TWELVE_CHECKS_OK')&&t.after.includes('TWELVE_ROLLBACK_OK'));
 const result=`-- LOCAL restored copy only: narrow exact permissions BEFORE all twelve pinned candidates.
-- One transaction; no hosted apply or application acceptance. Always ROLLBACK.
${r.before}
${t.before}
BEGIN;
${r.body}
-- Strict selected rights have matched the independent target here; candidates follow unchanged.
${t.body}
ROLLBACK;
${t.after}
${r.after}
DO $strict_done$ BEGIN RAISE NOTICE 'STRICT_TWELVE_ROLLBACK_OK: twelve candidates checked after exact permission narrowing; original metadata/content/ACL restored; application acceptance remains separate';END $strict_done$;
`;
 parts(result);return result;
}
async function verifyModules(){
 for(const [name,expected] of [['inputs.mjs','16c171d0f2d94ca6d85307ca3a446e4a0c4db708f66fb3d76c05958ad396c2e2'],['checks.mjs','19680d53a99060839188854cc49ec5b72003a71bd1e71b06a0919aaba44bc4ee'],['restored.mjs','8b7936a4fbaed205fbdae20184e22ffa7c22a168ec25ff187524ee04cd752f42'],['restored-twelve.mjs','8d73465bb8f4d0a6e73e6c8f1dbc3f2bca2ee7e821b0504e34cdce4a5cf9c3a9']])assert.equal(sha(await fs.readFile(new URL('../accumulated/'+name,import.meta.url))),expected);
}
export async function main(args){
 assert(args.length===4&&args[0]==='--plan-strict-local','Fixed private planning only');
 await verifyModules();
 const {result,dir,names}=await privateRollbackPlan(args[1],args[2],args[3]);
 const tables=parseCopyCounts(await fs.readFile(path.join(path.dirname(dir),'data.sql'),'utf8'));
 assert.equal(tables.length,112);assert.equal(tables.reduce((n,t)=>n+t.rows,0),14888);
 assert.deepEqual(tables.filter(t=>t.schema==='public').map(t=>t.name).sort(),[...names].sort());
 const [sources,followups]=await Promise.all([loadInputs({remoteAll:true}),loadFollowups({remote:true})]);
 const sql=combineStrictTwelve(result.sql,buildTwelve(sources,followups,tables));
 const output=await fs.mkdtemp(path.join(dir,'strict-twelve-plan-'));await fs.chmod(output,0o700);
 await fs.writeFile(path.join(output,'local-only.sql'),sql,{mode:0o600,flag:'wx'});
 await fs.writeFile(path.join(output,'sources.json'),JSON.stringify({protocol:'potok-strict-twelve-plan-v1',inputs:[...inputs,...followupInputs],sqlSha256:sha(sql),permissionsSha256:sha(result.sql),tables:112,rows:14888,exactRevokes:213,mayApply:false,releaseReady:false},null,2),{mode:0o600,flag:'wx'});
 console.log('STRICT_TWELVE_PLAN_PREPARED: 213 exact revokes before 12 pinned candidates; one ROLLBACK; not executed.');
 console.log('Private plan: '+path.join(output,'local-only.sql'));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('STRICT_TWELVE_PLAN_STOPPED: private evidence/source/scope check failed; no SQL executed.');process.exitCode=1;});
