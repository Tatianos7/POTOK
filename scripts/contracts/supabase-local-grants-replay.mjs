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

// Execute the exact pause review draft only in disposable localhost PostgreSQL.
const pauseOriginal=readFileSync('supabase/migration_drafts/program_pause_atomic_review_20261022.sql','utf8');
assert(/^BEGIN;\\s*$/m.test(pauseOriginal) && /^ROLLBACK;\\s*$/m.test(pauseOriginal),'Pause draft must remain rollback guarded');
const pauseRun=spawnSync('psql',args,{input:pauseOriginal.replace(/^ROLLBACK;\\s*$/m,'COMMIT;'),encoding:'utf8',env:{...process.env,PGPASSWORD:'postgres'},maxBuffer:4*1024*1024});
if(pauseRun.stdout)process.stdout.write(pauseRun.stdout);
if(pauseRun.stderr)process.stderr.write(pauseRun.stderr);
assert.equal(pauseRun.status,0,'Exact atomic pause review SQL replay failed');
