// Execute the exact review-only table grants SQL against disposable local Supabase.
// Never accepts a remote host or cloud connection string.
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const file='supabase/migration_drafts/public_api_privileges_hardening_review_20261021.sql';
const original=readFileSync(file,'utf8');
assert(/^BEGIN;\s*$/m.test(original) && /^ROLLBACK;\s*$/m.test(original),
 'Review SQL must retain explicit BEGIN/ROLLBACK');
const statements=original.replace(/^BEGIN;\s*$/m,'').replace(/^ROLLBACK;\s*$/m,'');
const sql='BEGIN;\n'+statements+'\nCOMMIT;\n';
const args=['-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'];
const run=spawnSync('psql',args,{input:sql,encoding:'utf8',
 env:{...process.env,PGPASSWORD:'postgres'},maxBuffer:4*1024*1024});
if(run.stdout) process.stdout.write(run.stdout);
if(run.stderr) process.stderr.write(run.stderr);
assert.equal(run.status,0,'Disposable grant SQL replay failed');
const assertions=spawnSync('psql',[...args,'-f','scripts/contracts/supabase-local-grants-assertions.sql'],{
 encoding:'utf8',env:{...process.env,PGPASSWORD:'postgres'},maxBuffer:4*1024*1024});
if(assertions.stdout) process.stdout.write(assertions.stdout);
if(assertions.stderr) process.stderr.write(assertions.stderr);
assert.equal(assertions.status,0,'Effective grant assertions failed');
console.log('PASS: exact table-grant review SQL replay and effective privilege assertions');

// Replay the exact Premium RPC review draft ONLY in disposable local PostgreSQL.
// This tests function authorization; it never contacts a payment provider,
 // creates a paid subscription, or invokes any cloud project.
const rpcFile='supabase/migration_drafts/premium_rpc_authority_hardening_review_20261021.sql';
const rpcOriginal=readFileSync(rpcFile,'utf8');
assert(/^BEGIN;\s*$/m.test(rpcOriginal) && /^ROLLBACK;\s*$/m.test(rpcOriginal),
 'Premium RPC review SQL must retain BEGIN/ROLLBACK');
const rpcSql=rpcOriginal.replace(/^ROLLBACK;\s*$/m,'COMMIT;');
const rpcReplay=spawnSync('psql',args,{input:rpcSql,encoding:'utf8',
 env:{...process.env,PGPASSWORD:'postgres'},maxBuffer:4*1024*1024});
if(rpcReplay.stdout) process.stdout.write(rpcReplay.stdout);
if(rpcReplay.stderr) process.stderr.write(rpcReplay.stderr);
assert.equal(rpcReplay.status,0,'Exact Premium RPC review SQL replay failed');
console.log('PASS: exact Premium RPC review SQL replay in disposable local Supabase');

// Replay the isolated entitlement patch after the broader review draft. The
// following real Auth/PostgREST acceptance therefore exercises this exact file.
const isolatedEntitlementFile='supabase/migration_drafts/entitlement_rpc_isolated_review_20261023.sql';
const isolatedEntitlementOriginal=readFileSync(isolatedEntitlementFile,'utf8');
assert(/^BEGIN;\s*$/m.test(isolatedEntitlementOriginal) && /^ROLLBACK;\s*$/m.test(isolatedEntitlementOriginal),
 'Isolated entitlement review must retain BEGIN/ROLLBACK');
assert(!/\b(?:CREATE\s+OR\s+REPLACE\s+FUNCTION|GRANT\s+EXECUTE\s+ON\s+FUNCTION|REVOKE\s+ALL\s+ON\s+FUNCTION)\s+public\.(?!get_entitlements\b)/i.test(isolatedEntitlementOriginal),
 'Isolated entitlement patch must not modify other RPCs');
const isolatedEntitlementRun=spawnSync('psql',args,{
 input:isolatedEntitlementOriginal.replace(/^ROLLBACK;\s*$/m,'COMMIT;'),
 encoding:'utf8',env:{...process.env,PGPASSWORD:'postgres'},maxBuffer:4*1024*1024
});
if(isolatedEntitlementRun.stdout)process.stdout.write(isolatedEntitlementRun.stdout);
if(isolatedEntitlementRun.stderr)process.stderr.write(isolatedEntitlementRun.stderr);
assert.equal(isolatedEntitlementRun.status,0,'Exact isolated entitlement review SQL replay failed');
console.log('PASS: exact isolated entitlement review SQL replay in disposable local Supabase');

// Exercise exact forward -> rollback -> forward candidate SQL on localhost only.
// Final forward replay restores the guarded behavior for Auth/PostgREST tests.
const entitlementCandidates=[
 'supabase/migration_drafts/entitlement_rpc_forward_candidate_review_20261023.sql',
 'supabase/migration_drafts/entitlement_rpc_rollback_candidate_review_20261023.sql',
 'supabase/migration_drafts/entitlement_rpc_forward_candidate_review_20261023.sql'
];
for(const candidate of entitlementCandidates){
 const source=readFileSync(candidate,'utf8');
 assert(/^BEGIN;\s*$/m.test(source) && /^ROLLBACK;\s*$/m.test(source),
  'Entitlement candidate must retain review transaction guard');
 const executed=spawnSync('psql',args,{
  input:source.replace(/^ROLLBACK;\s*$/m,'COMMIT;'),
  encoding:'utf8',env:{...process.env,PGPASSWORD:'postgres'},maxBuffer:4*1024*1024
 });
 if(executed.stdout)process.stdout.write(executed.stdout);
 if(executed.stderr)process.stderr.write(executed.stderr);
 assert.equal(executed.status,0,'Entitlement candidate failed: '+candidate);
 console.log('PASS: disposable candidate replay '+candidate);
}

// Assert final candidate grants match the owner-approved authenticated-only policy.
const entitlementPrivilegeSql=`DO $potok_entitlement_privileges$
BEGIN
 IF NOT has_function_privilege('authenticated','public.get_entitlements(uuid)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.get_paywall_state(text,uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'authenticated entitlement execute missing';
 END IF;
 IF has_function_privilege('anon','public.get_entitlements(uuid)','EXECUTE')
    OR has_function_privilege('service_role','public.get_entitlements(uuid)','EXECUTE')
 OR has_function_privilege('anon','public.get_paywall_state(text,uuid)','EXECUTE')
 OR has_function_privilege('service_role','public.get_paywall_state(text,uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'anon or service_role entitlement execute unexpectedly granted';
 END IF;
END $potok_entitlement_privileges$;`;
const entitlementPrivileges=spawnSync('psql',args,{
 input:entitlementPrivilegeSql,encoding:'utf8',
 env:{...process.env,PGPASSWORD:'postgres'},maxBuffer:4*1024*1024
});
if(entitlementPrivileges.stdout)process.stdout.write(entitlementPrivileges.stdout);
if(entitlementPrivileges.stderr)process.stderr.write(entitlementPrivileges.stderr);
assert.equal(entitlementPrivileges.status,0,'Approved entitlement RPC privilege assertions failed');
console.log('PASS: entitlement RPC authenticated-only effective grants; anon and service_role denied');

// Security-preserving recovery: deny everyone, then reapply guarded forward.
const safeRecoveryFile='supabase/migration_drafts/entitlement_rpc_safe_recovery_review_20261023.sql';
const safeRecoverySource=readFileSync(safeRecoveryFile,'utf8');
assert(/^BEGIN;\s*$/m.test(safeRecoverySource) && /^ROLLBACK;\s*$/m.test(safeRecoverySource),
 'Safe recovery must remain rollback-guarded');
const recoveryRun=spawnSync('psql',args,{
 input:safeRecoverySource.replace(/^ROLLBACK;\s*$/m,'COMMIT;'),
 encoding:'utf8',env:{...process.env,PGPASSWORD:'postgres'},maxBuffer:4*1024*1024
});
if(recoveryRun.stderr)process.stderr.write(recoveryRun.stderr);
assert.equal(recoveryRun.status,0,'Fail-closed recovery replay failed');
const recoveryAssertions=spawnSync('psql',args,{
 input:`DO $potok_recovery$
BEGIN
 IF has_function_privilege('authenticated','public.get_entitlements(uuid)','EXECUTE')
 OR has_function_privilege('authenticated','public.get_paywall_state(text,uuid)','EXECUTE')
 OR has_function_privilege('anon','public.get_entitlements(uuid)','EXECUTE')
 OR has_function_privilege('service_role','public.get_entitlements(uuid)','EXECUTE')
 OR has_function_privilege('anon','public.get_paywall_state(text,uuid)','EXECUTE')
 OR has_function_privilege('service_role','public.get_paywall_state(text,uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'Fail-closed recovery did not revoke execute';
 END IF;
END $potok_recovery$;`,
 encoding:'utf8',env:{...process.env,PGPASSWORD:'postgres'},maxBuffer:4*1024*1024
});
if(recoveryAssertions.stderr)process.stderr.write(recoveryAssertions.stderr);
assert.equal(recoveryAssertions.status,0,'Fail-closed recovery grant assertions failed');
console.log('PASS: entitlement safe recovery denies all public RPC execution');
const recoveryForward=readFileSync(entitlementCandidates[0],'utf8');
const restoreRun=spawnSync('psql',args,{
 input:recoveryForward.replace(/^ROLLBACK;\s*$/m,'COMMIT;'),
 encoding:'utf8',env:{...process.env,PGPASSWORD:'postgres'},maxBuffer:4*1024*1024
});
if(restoreRun.stderr)process.stderr.write(restoreRun.stderr);
assert.equal(restoreRun.status,0,'Guarded forward restoration after recovery failed');
console.log('PASS: guarded entitlement forward restored after safe recovery');

// Execute the exact pause review draft only in disposable localhost PostgreSQL.
const pauseOriginal=readFileSync('supabase/migration_drafts/program_pause_atomic_review_20261022.sql','utf8');
assert(/^BEGIN;\s*$/m.test(pauseOriginal) && /^ROLLBACK;\s*$/m.test(pauseOriginal),'Pause draft must remain rollback guarded');
const pauseRun=spawnSync('psql',args,{input:pauseOriginal.replace(/^ROLLBACK;\s*$/m,'COMMIT;'),encoding:'utf8',env:{...process.env,PGPASSWORD:'postgres'},maxBuffer:4*1024*1024});
if(pauseRun.stdout)process.stdout.write(pauseRun.stdout);
if(pauseRun.stderr)process.stderr.write(pauseRun.stderr);
assert.equal(pauseRun.status,0,'Exact atomic pause review SQL replay failed');


// Exact day-RPC review draft, committed only inside disposable localhost Supabase.
const dayOriginal=readFileSync('supabase/migration_drafts/program_day_explainability_authority_review_20261022.sql','utf8');
assert(/^BEGIN;\s*$/m.test(dayOriginal) && /^ROLLBACK;\s*$/m.test(dayOriginal),'Day RPC draft must remain rollback guarded');
const dayRun=spawnSync('psql',args,{input:dayOriginal.replace(/^ROLLBACK;\s*$/m,'COMMIT;'),encoding:'utf8',env:{...process.env,PGPASSWORD:'postgres'},maxBuffer:4*1024*1024});
if(dayRun.stdout)process.stdout.write(dayRun.stdout);
if(dayRun.stderr)process.stderr.write(dayRun.stderr);
assert.equal(dayRun.status,0,'Exact day-RPC authority review SQL replay failed');
console.log('PASS: exact day-RPC review SQL replay in disposable local Supabase');

const adaptOriginal=readFileSync('supabase/migration_drafts/program_adaptation_authority_review_20261022.sql','utf8');
assert(/^BEGIN;\s*$/m.test(adaptOriginal) && /^ROLLBACK;\s*$/m.test(adaptOriginal),
 'Adaptation authority review SQL must remain rollback guarded');
const adaptRun=spawnSync('psql',args,{input:adaptOriginal.replace(/^ROLLBACK;\s*$/m,'COMMIT;'),
 encoding:'utf8',env:{...process.env,PGPASSWORD:'postgres'},maxBuffer:4*1024*1024});
if(adaptRun.stdout)process.stdout.write(adaptRun.stdout);
if(adaptRun.stderr)process.stderr.write(adaptRun.stderr);
assert.equal(adaptRun.status,0,'Exact adaptation authority review SQL replay failed');
console.log('PASS: adaptation authority review SQL replay in disposable local Supabase');

const atomicOriginal=readFileSync('supabase/migration_drafts/program_adaptation_atomic_transition_review_20261022.sql','utf8');
assert(/^BEGIN;\s*$/m.test(atomicOriginal) && /^ROLLBACK;\s*$/m.test(atomicOriginal),
 'Atomic adaptation review must remain rollback guarded');
const atomicRun=spawnSync('psql',args,{input:atomicOriginal.replace(/^ROLLBACK;\s*$/m,'COMMIT;'),
 encoding:'utf8',env:{...process.env,PGPASSWORD:'postgres'},maxBuffer:4*1024*1024});
if(atomicRun.stdout)process.stdout.write(atomicRun.stdout);
if(atomicRun.stderr)process.stderr.write(atomicRun.stderr);
assert.equal(atomicRun.status,0,'Exact atomic adaptation review SQL replay failed');
console.log('PASS: atomic adaptation review SQL replay in disposable local Supabase');

const nutritionOriginal=readFileSync('supabase/migration_drafts/program_nutrition_adaptation_targets_review_20261022.sql','utf8');
assert(/^BEGIN;\s*$/m.test(nutritionOriginal) && /^ROLLBACK;\s*$/m.test(nutritionOriginal),
 'Nutrition targets draft must remain rollback guarded');
const nutritionSql=nutritionOriginal.replace(/^ROLLBACK;\s*$/m,`
DO $potok_test$
DECLARE result jsonb;
BEGIN
 result:=public.potok_nutrition_adaptation_targets_v1(2000,100,60,220,1,0.8,true);
 IF result <> '{"calories":1600,"protein":80,"fat":48,"carbs":194}'::jsonb THEN
   RAISE EXCEPTION 'Nutrition target regression: %',result;
 END IF;
 BEGIN
   PERFORM public.potok_nutrition_adaptation_targets_v1(2000,100,60,220,1,0.2,false);
   RAISE EXCEPTION 'Out-of-range factor accepted';
 EXCEPTION WHEN sqlstate '22023' THEN NULL;
 END;
END $potok_test$;
COMMIT;`);
const nutritionRun=spawnSync('psql',args,{input:nutritionSql,encoding:'utf8',
 env:{...process.env,PGPASSWORD:'postgres'},maxBuffer:4*1024*1024});
if(nutritionRun.stdout)process.stdout.write(nutritionRun.stdout);
if(nutritionRun.stderr)process.stderr.write(nutritionRun.stderr);
assert.equal(nutritionRun.status,0,'Server nutrition target contract replay failed');
console.log('PASS: server-only bounded nutrition target calculation');

const replanOriginal=readFileSync('supabase/migration_drafts/program_nutrition_atomic_replan_review_20261022.sql','utf8');
assert(/^BEGIN;\s*$/m.test(replanOriginal) && /^ROLLBACK;\s*$/m.test(replanOriginal),
 'Nutrition replan review must remain rollback guarded');
const replanRun=spawnSync('psql',args,{input:replanOriginal.replace(/^ROLLBACK;\s*$/m,'COMMIT;'),
 encoding:'utf8',env:{...process.env,PGPASSWORD:'postgres'},maxBuffer:4*1024*1024});
if(replanRun.stdout)process.stdout.write(replanRun.stdout);
if(replanRun.stderr)process.stderr.write(replanRun.stderr);
assert.equal(replanRun.status,0,'Nutrition atomic replan SQL replay failed');
console.log('PASS: nutrition atomic replan review SQL replay in disposable local Supabase');
