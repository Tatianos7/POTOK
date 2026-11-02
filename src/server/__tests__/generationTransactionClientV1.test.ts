import assert from 'node:assert/strict';
import test from 'node:test';
import {createGenerationTransactionClientV1} from '../generationTransactionClientV1';

function fixture(fail?:string){
  const calls:string[]=[];const releases:boolean[]=[];
  const connection={
    async query(sql:string,parameters:readonly string[]){
      calls.push(sql);
      if(sql===fail)throw Error('private SQL/credential detail');
      return {rows:sql==='SELECT fixed($1)'?[{source_raw:parameters[0]}]:[]};
    },
    async release(discard:boolean){releases.push(discard);if(fail==='release')throw Error('private close detail');},
  };
  const pool={async acquire(){calls.push('acquire');if(fail==='acquire')throw Error('private connection detail');return connection;}};
  return {calls,releases,pool,connection};
}
test('default-disabled client never acquires a session',async()=>{
  const f=fixture();
  await assert.rejects(createGenerationTransactionClientV1(f.pool).query('SELECT fixed($1)',['x']),/GENERATION_SQL_DISABLED/);
  assert.deepEqual(f.calls,[]);
});
test('success commits before returning and releases the exclusive session once',async()=>{
  const f=fixture();
  assert.deepEqual(await createGenerationTransactionClientV1(f.pool,()=>true).query('SELECT fixed($1)',['x']),{rows:[{source_raw:'x'}]});
  assert.deepEqual(f.calls,['acquire','BEGIN','SELECT fixed($1)','COMMIT']);
  assert.deepEqual(f.releases,[false]);
});
test('query failure rolls back and discards; rollback failure still releases once',async()=>{
  for(const rollbackFails of [false,true]){
    const f=fixture('SELECT fixed($1)');
    const original=f.connection.query;
    f.connection.query=async(sql,p)=>{if(rollbackFails&&sql==='ROLLBACK'){f.calls.push(sql);throw Error('private rollback detail');}return original(sql,p);};
    await assert.rejects(createGenerationTransactionClientV1(f.pool,()=>true).query('SELECT fixed($1)',['x']),/^Error: GENERATION_SQL_UNAVAILABLE$/);
    assert.deepEqual(f.calls,['acquire','BEGIN','SELECT fixed($1)','ROLLBACK']);
    assert.deepEqual(f.releases,[true]);
  }
});
test('lost COMMIT reply is unknown; never retry or issue a misleading rollback',async()=>{
  const f=fixture('COMMIT');
  await assert.rejects(createGenerationTransactionClientV1(f.pool,()=>true).query('SELECT fixed($1)',['x']),/^Error: GENERATION_SQL_COMMIT_UNKNOWN$/);
  assert.deepEqual(f.calls,['acquire','BEGIN','SELECT fixed($1)','COMMIT']);
  assert.deepEqual(f.releases,[true]);
});
test('acquisition and BEGIN failures never issue a data query or leak driver errors',async()=>{
  for(const stage of ['acquire','BEGIN']){
    const f=fixture(stage);
    await assert.rejects(createGenerationTransactionClientV1(f.pool,()=>true).query('SELECT fixed($1)',['x']),/^Error: GENERATION_SQL_UNAVAILABLE$/);
    assert.deepEqual(f.calls,stage==='acquire'?['acquire']:['acquire','BEGIN']);
    assert.deepEqual(f.releases,stage==='acquire'?[]:[true]);
  }
});
test('closing gate during acquire or data query releases without starting/committing work',async()=>{
  for(const stage of ['acquire','query']){
    let on=true;const f=fixture();
    if(stage==='acquire'){const original=f.pool.acquire;f.pool.acquire=async()=>{const c=await original();on=false;return c;};}
    else{const original=f.connection.query;f.connection.query=async(sql,p)=>{const r=await original(sql,p);if(sql==='SELECT fixed($1)')on=false;return r;};}
    await assert.rejects(createGenerationTransactionClientV1(f.pool,()=>on).query('SELECT fixed($1)',['x']),/^Error: GENERATION_SQL_UNAVAILABLE$/);
    assert.deepEqual(f.calls,stage==='acquire'?['acquire']:['acquire','BEGIN','SELECT fixed($1)','ROLLBACK']);
    assert.deepEqual(f.releases,[true]);
  }
});
test('release failure after COMMIT reports committed outcome; never repeats a statement',async()=>{
  const f=fixture('release');
  await assert.rejects(createGenerationTransactionClientV1(f.pool,()=>true).query('SELECT fixed($1)',['x']),/^Error: GENERATION_SQL_COMMITTED_RELEASE_FAILED$/);
  assert.deepEqual(f.calls,['acquire','BEGIN','SELECT fixed($1)','COMMIT']);
  assert.deepEqual(f.releases,[false]);
});
test('parameters are pinned before acquire and closing gate during release hides late result',async()=>{
  const f=fixture();const parameters=['original'];let on=true;
  const original=f.pool.acquire;f.pool.acquire=async()=>{parameters[0]='changed';return original();};
  const client=createGenerationTransactionClientV1(f.pool,()=>on);
  assert.deepEqual(await client.query('SELECT fixed($1)',parameters),{rows:[{source_raw:'original'}]});
  const release=f.connection.release;f.connection.release=async discard=>{await release(discard);on=false;};
  await assert.rejects(client.query('SELECT fixed($1)',['x']),/GENERATION_SQL_DISABLED/);
  assert.equal(f.calls.filter(x=>x==='COMMIT').length,2);
});
