import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn,spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createGenerationTransactionClientV1,type GenerationTransactionConnectionV1} from '../../src/server/generationTransactionClientV1';

const native=process.env.POTOK_GENERATION_STORE_NATIVE==='1';
const database='potok_generation_store_disposable';
const base=['-X','-w','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','5432','-d',database];
const literal=(s:string)=>"'"+s.replaceAll("'","''")+"'";
function owner(sql:string){
  const r=spawnSync('psql',[...base,'-U','postgres'],{input:sql,encoding:'utf8',timeout:10000,
    env:{...process.env,PGSSLMODE:'disable',PGCONNECT_TIMEOUT:'5'}});
  assert.equal(r.status,0,'disposable owner SQL failed');return r.stdout.trim();
}
const insert="INSERT INTO lifecycle_fixture.events(value) VALUES ($1::text) RETURNING json_build_object('value',value,'pid',pg_backend_pid())";
type Row={value:string;pid:number};
/** Persistent psql subprocesses are a loopback-only test harness, NOT the
 * production driver. Fixed statements use fixture-only literal substitution.
 * TLS is intentionally off; fixture grants do not model source admission.
 */
function pool(options:{lost?:string;afterQuery?:()=>void}={}){
  const calls:string[]=[];const releases:boolean[]=[];let acquired=0;
  return {calls,releases,get acquired(){return acquired;},async acquire():Promise<GenerationTransactionConnectionV1<Row>>{
    acquired++;
    const child=spawn('psql',[...base,'-U','lifecycle_fixture_login'],{
      env:{...process.env,PGPASSWORD:'lifecycle-disposable-only',PGSSLMODE:'disable',
        PGCONNECT_TIMEOUT:'5',PGAPPNAME:'potok-lifecycle-fixture'},
      stdio:['pipe','pipe','pipe'],
    });
    let buffer='',closed=false;
    let pending:{marker:string;rows:Row[];resolve:(rows:Row[])=>void;reject:()=>void}|undefined;
    const done=new Promise<void>(resolve=>{child.once('close',()=>{closed=true;pending?.reject();pending=undefined;resolve();});});
    child.on('error',()=>{pending?.reject();pending=undefined;});
    child.stderr.on('data',()=>{/* Never expose driver SQL/connection details. */});
    child.stdout.setEncoding('utf8');
    child.stdout.on('data',(part:string)=>{
      buffer+=part;
      let newline:number;
      while((newline=buffer.indexOf('\n'))>=0){
        const line=buffer.slice(0,newline).trim();buffer=buffer.slice(newline+1);
        if(!pending||!line)continue;
        if(line===pending.marker){const p=pending;pending=undefined;p.resolve(p.rows);}
        else{try{pending.rows.push(JSON.parse(line));}catch{pending.reject();pending=undefined;}}
      }
    });
    return {
      async query(statement,parameters){
        assert.ok(['BEGIN','COMMIT','ROLLBACK',insert,'SELECT 1/0'].includes(statement));
        assert.equal(parameters.length,statement===insert?1:0);
        assert.equal(pending,undefined);
        calls.push(statement);
        const marker='POTOK_END_'+randomUUID().replaceAll('-','');
        const sql=statement===insert?statement.replace('$1',literal(parameters[0])):statement;
        const rows=await new Promise<Row[]>((resolve,reject)=>{
          if(closed){reject(Error('DISPOSABLE_SESSION_CLOSED'));return;}
          const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('DISPOSABLE_QUERY_TIMEOUT'));},5000);
          pending={marker,rows:[],resolve:rows=>{clearTimeout(timer);resolve(rows);},
            reject:()=>{clearTimeout(timer);reject(Error('DISPOSABLE_QUERY_FAILED'));}};
          child.stdin.write(sql+';\n\\echo '+marker+'\n');
        });
        if(statement===insert)options.afterQuery?.();
        if(statement===options.lost)throw Error('DISPOSABLE_REPLY_DROPPED_AFTER_EXECUTION');
        return {rows};
      },
      async release(discard){
        releases.push(discard);
        if(!closed){if(discard)child.kill('SIGKILL');else child.stdin.end('\\q\n');}
        const timer=setTimeout(()=>child.kill('SIGKILL'),5000);
        try{await done;}finally{clearTimeout(timer);}
      },
    };
  }};
}
test('actual PostgreSQL transaction lifecycle on disposable exclusive sessions',{skip:!native},async t=>{
  assert.equal(owner('SELECT current_database();'),database);
  owner("CREATE SCHEMA lifecycle_fixture;CREATE TABLE lifecycle_fixture.events(value text PRIMARY KEY);"+
    "CREATE ROLE lifecycle_fixture_login LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS PASSWORD 'lifecycle-disposable-only';"+
    "GRANT USAGE ON SCHEMA lifecycle_fixture TO lifecycle_fixture_login;"+
    "GRANT SELECT,INSERT ON lifecycle_fixture.events TO lifecycle_fixture_login;");
  await t.test('COMMIT persists once and closes the real session',async()=>{
    const p=pool();const r=await createGenerationTransactionClientV1(p,()=>true).query(insert,['success']);
    assert.equal(r.rows[0].value,'success');assert.equal(owner("SELECT count(*) FROM lifecycle_fixture.events WHERE value='success';"),'1');
    assert.deepEqual(p.calls,['BEGIN',insert,'COMMIT']);assert.deepEqual(p.releases,[false]);
  });
  await t.test('lost data reply rolls the executed INSERT back',async()=>{
    const p=pool({lost:insert});
    await assert.rejects(createGenerationTransactionClientV1(p,()=>true).query(insert,['rolled-back']),/GENERATION_SQL_UNAVAILABLE/);
    assert.equal(owner("SELECT count(*) FROM lifecycle_fixture.events WHERE value='rolled-back';"),'0');
    assert.deepEqual(p.calls,['BEGIN',insert,'ROLLBACK']);assert.deepEqual(p.releases,[true]);
  });
  await t.test('lost COMMIT reply stays unknown but the real write is committed exactly once',async()=>{
    const p=pool({lost:'COMMIT'});
    await assert.rejects(createGenerationTransactionClientV1(p,()=>true).query(insert,['committed-unknown']),/GENERATION_SQL_COMMIT_UNKNOWN/);
    assert.equal(owner("SELECT count(*) FROM lifecycle_fixture.events WHERE value='committed-unknown';"),'1');
    assert.deepEqual(p.calls,['BEGIN',insert,'COMMIT']);assert.equal(p.acquired,1);assert.deepEqual(p.releases,[true]);
  });
  await t.test('gate closing after a real INSERT prevents commit and leaves no row',async()=>{
    let on=true;const p=pool({afterQuery:()=>{on=false;}});
    await assert.rejects(createGenerationTransactionClientV1(p,()=>on).query(insert,['gate-closed']),/GENERATION_SQL_UNAVAILABLE/);
    assert.equal(owner("SELECT count(*) FROM lifecycle_fixture.events WHERE value='gate-closed';"),'0');
    assert.deepEqual(p.calls,['BEGIN',insert,'ROLLBACK']);assert.deepEqual(p.releases,[true]);
  });
  await t.test('SQL error terminates psql and cleanup remains bounded',async()=>{
    const p=pool();
    await assert.rejects(createGenerationTransactionClientV1(p,()=>true).query('SELECT 1/0',[]),/GENERATION_SQL_UNAVAILABLE/);
    assert.deepEqual(p.releases,[true]);
  });
  await t.test('parallel calls use distinct PostgreSQL backends and release both leases',async()=>{
    const p=pool();const c=createGenerationTransactionClientV1(p,()=>true);
    const [a,b]=await Promise.all([c.query(insert,['parallel-a']),c.query(insert,['parallel-b'])]);
    assert.notEqual(a.rows[0].pid,b.rows[0].pid);assert.equal(p.acquired,2);assert.deepEqual(p.releases,[false,false]);
    assert.equal(owner("SELECT count(*) FROM lifecycle_fixture.events WHERE value IN('parallel-a','parallel-b');"),'2');
  });
  assert.equal(owner("SELECT count(*) FROM pg_stat_activity WHERE application_name='potok-lifecycle-fixture';"),'0');
});
