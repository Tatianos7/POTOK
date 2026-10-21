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
