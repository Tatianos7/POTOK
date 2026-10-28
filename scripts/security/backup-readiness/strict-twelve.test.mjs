import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {combineStrictTwelve} from './strict-twelve.mjs';
import {loadInputs} from '../accumulated/inputs.mjs';
import {loadFollowups,buildTwelve} from '../accumulated/restored-twelve.mjs';
const rights=`CREATE TEMP TABLE before_acl(x text);
BEGIN;
DO $guard$ BEGIN RAISE NOTICE 'BASELINE_DRIFT_STOP';END $guard$;
${Array.from({length:213},(_,i)=>'REVOKE SELECT ON public.fixture_'+i+' FROM anon;').join('\n')}
DO $ok$ BEGIN RAISE NOTICE 'LOCAL_RIGHTS_PARITY_TEMPORARY_OK';END $ok$;
ROLLBACK;
DO $ok$ BEGIN RAISE NOTICE 'LOCAL_RIGHTS_PARITY_ROLLBACK_OK';END $ok$;
`;
const twelve=`CREATE TEMP TABLE before_content(x text);
BEGIN;
-- twelve exact candidate bodies placeholder
DO $ok$ BEGIN RAISE NOTICE 'TWELVE_CHECKS_OK';END $ok$;
ROLLBACK;
DO $ok$ BEGIN RAISE NOTICE 'TWELVE_ROLLBACK_OK';END $ok$;
`;
test('rights must narrow and validate before candidate bodies; both rollback verifiers remain',()=>{
 const sql=combineStrictTwelve(rights,twelve);
 assert(sql.indexOf('LOCAL_RIGHTS_PARITY_TEMPORARY_OK')<sql.indexOf('-- twelve exact candidate bodies'));
 assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1);assert.equal((sql.match(/^ROLLBACK;$/gm)||[]).length,1);
 assert(sql.indexOf('TWELVE_ROLLBACK_OK')<sql.indexOf('LOCAL_RIGHTS_PARITY_ROLLBACK_OK'));
 assert(sql.includes('STRICT_TWELVE_ROLLBACK_OK'));
});
test('missing/duplicate transaction boundaries, commit, psql commands and incomplete parity stop',()=>{
 for(const changed of [rights.replace('ROLLBACK;','COMMIT;'),rights+'\nBEGIN;\n',rights.replace('REVOKE SELECT ON public.fixture_0 FROM anon;',''),rights.replace('BASELINE_DRIFT_STOP','changed'),rights+'\n\\connect hosted\n'])assert.throws(()=>combineStrictTwelve(changed,twelve));
 assert.throws(()=>combineStrictTwelve(rights,twelve.replace('TWELVE_ROLLBACK_OK','missing')));
});
test('actual twelve public pinned candidate bodies are preserved exactly after strict parity',async()=>{
 const [sources,followups]=await Promise.all([loadInputs({remoteAll:true}),loadFollowups({remote:true})]);
 const original=buildTwelve(sources,followups,[{schema:'public',name:'user_profiles',rows:2}]);
 const result=combineStrictTwelve(rights,original);
 for(const body of [...Object.values(sources),...Object.values(followups)])assert(result.includes(body));
 const originalTransaction=original.split('\nBEGIN;\n')[1].split('\nROLLBACK;\n')[0];assert(result.includes(originalTransaction));
 assert(result.indexOf('LOCAL_RIGHTS_PARITY_TEMPORARY_OK')<result.indexOf('-- Reviewed candidate: truncate'));
});
test('unsupported apply/runtime/URL flags stop without SQL execution or private exception echo',()=>{
 const r=spawnSync(process.execPath,['scripts/security/backup-readiness/strict-twelve.mjs','--apply','private_marker_never_echo'],{encoding:'utf8'});
 assert.equal(r.status,1);assert(r.stderr.includes('STRICT_TWELVE_PLAN_STOPPED'));assert(!r.stderr.includes('private_marker_never_echo'));
});
