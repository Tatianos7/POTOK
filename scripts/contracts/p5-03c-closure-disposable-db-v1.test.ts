/** Real disposable PostgreSQL concurrency acceptance for the *prototype*, not Supabase.
 * No DB URL, secrets, external cluster, operational deletion, or runtime wiring.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = promisify(execFile);
const env = { PATH: process.env.PATH ?? '', LC_ALL: 'C.UTF-8' };
const required = ['initdb','pg_ctl','psql'];
const missing = required.filter(command => spawnSync(command,['--version'],{ env,stdio:'ignore' }).status!==0);
const skip = missing.length ? 'PostgreSQL binaries missing: '+missing.join(', ')
  : process.getuid?.()===0 ? 'initdb cannot run as root' : false;
const mustRun = process.env.POTOK_CLOSURE_REQUIRE_DB==='1';
const account='123e4567-e89b-42d3-a456-426614174000';
const other='123e4567-e89b-42d3-a456-426614174001';
const key='123e4567-e89b-42d3-a456-426614174010';
const otherKey='123e4567-e89b-42d3-a456-426614174011';
const q=(s:string)=>"'"+s.replace(/'/g,"''")+"'";
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

test('disposable PostgreSQL: account admission vs closure serialization', {
  skip: mustRun ? false : skip,timeout:180_000
},async t=>{
  if(skip) assert.fail(skip);
  const root=await mkdtemp(join(tmpdir(),'potok-closure-pg-'));
  const data=join(root,'data'),socket=join(root,'socket'),port='54331';
  await mkdir(socket,{mode:0o700});
  let started=false;
  const sql=(body:string,app='closure-check')=>run('psql',
    ['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',socket,'-p',port,'-U','postgres','-d','postgres',
      '-c',`SET application_name=${q(app)}; ${body}`],
    {env,timeout:25000,maxBuffer:1048576}).then(r=>r.stdout.trim());
  const query=(body:string)=>sql(body);
  const waitActive=async(app:string)=>{
    for(let i=0;i<100;i++){
      const v=await query(`SELECT count(*) FROM pg_stat_activity WHERE application_name=${q(app)}
        AND state='active' AND query LIKE '%pg_sleep%'`);
      if(v.split('\n').at(-1)==='1')return;
      await sleep(30);
    }
    assert.fail('first transaction did not reach sleep lock hold: '+app);
  };
  const row=()=>query(`SELECT state||':'||revision::text FROM potok_closure_disposable.accounts WHERE account_id=${q(account)}`);
  try {
    await run('initdb',['-D',data,'-U','postgres','--auth-local=trust','--auth-host=reject','--encoding=UTF8','--no-locale'],{env,timeout:30000});
    await run('pg_ctl',['-D',data,'-l',join(root,'pg.log'),'-o',`-k ${socket} -p ${port} -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start'],{env,timeout:30000});
    started=true;
    assert.ok(Number(await query('SHOW server_version_num'))>=170000);
    await t.test('unmarked script refuses to create schema',async()=>{
      const script=await readFile('scripts/contracts/p5-03c-closure-fence-disposable-prototype.sql','utf8');
      await assert.rejects(query(script),/POTOK_CLOSURE_DISPOSABLE_ONLY/);
      assert.equal((await query("SELECT to_regnamespace('potok_closure_disposable') IS NULL")).split('\n').at(-1),'t');
      await query("SET potok_closure.test_target='disposable-postgresql-only'; "+script);
    });
    await query(`INSERT INTO potok_closure_disposable.accounts(account_id,state) VALUES
      (${q(account)},'ACTIVE'),(${q(other)},'ACTIVE')`);
    await t.test('CLOSING first blocks a concurrent admission until commit, then denies',async()=>{
      const first=sql(`BEGIN; SELECT potok_closure_disposable.begin_closure(${q(account)},${q(key)});
        SELECT pg_sleep(1.2); COMMIT`,'holder-close');
      await waitActive('holder-close');
      const second=sql(`SELECT potok_closure_disposable.assert_active(${q(account)})`,'waiting-admission');
      const [closed,admitted]=await Promise.allSettled([first,second]);
      assert.equal(closed.status,'fulfilled');
      assert.equal(admitted.status,'rejected');
      assert.match(String((admitted as PromiseRejectedResult).reason),/ACCOUNT_NOT_ACTIVE/);
      assert.equal((await row()).split('\n').at(-1),'CLOSING:2');
    });
    await t.test('original closure key replays, different key conflicts, no resurrection',async()=>{
      assert.equal((await query(`SELECT potok_closure_disposable.begin_closure(${q(account)},${q(key)})`)).split('\n').at(-1),'2');
      await assert.rejects(query(`SELECT potok_closure_disposable.begin_closure(${q(account)},${q(otherKey)})`),/CLOSURE_CONFLICT/);
      await assert.rejects(query(`SELECT potok_closure_disposable.assert_active(${q(account)})`),/ACCOUNT_NOT_ACTIVE/);
    });
    await t.test('admission first commits before CLOSING transition; future admissions denied',async()=>{
      const first=sql(`BEGIN; SELECT potok_closure_disposable.assert_active(${q(other)});
        SELECT pg_sleep(1.2); COMMIT`,'holder-admit');
      await waitActive('holder-admit');
      const second=sql(`SELECT potok_closure_disposable.begin_closure(${q(other)},${q(otherKey)})`,'waiting-closure');
      const [admitted,closed]=await Promise.allSettled([first,second]);
      assert.equal(admitted.status,'fulfilled');
      assert.equal(closed.status,'fulfilled');
      assert.match((closed as PromiseFulfilledResult<string>).value,/2/);
      await assert.rejects(query(`SELECT potok_closure_disposable.assert_active(${q(other)})`),/ACCOUNT_NOT_ACTIVE/);
    });
    await t.test('unknown account does not gain admission or create a fake closure',async()=>{
      await assert.rejects(query(`SELECT potok_closure_disposable.assert_active('123e4567-e89b-42d3-a456-426614174099')`),/ACCOUNT_NOT_ACTIVE/);
      await assert.rejects(query(`SELECT potok_closure_disposable.begin_closure('123e4567-e89b-42d3-a456-426614174099',${q(key)})`),/ACCOUNT_UNVERIFIED/);
    });
  } finally {
    if(started) await run('pg_ctl',['-D',data,'-m','immediate','-w','stop'],{env,timeout:30000}).catch(()=>{});
    await rm(root,{recursive:true,force:true});
  }
});
