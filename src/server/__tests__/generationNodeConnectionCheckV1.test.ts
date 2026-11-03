import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkGenerationNodeConnectionsV1 as check,generationNodeConnectionConfigContractV1} from '../generationNodeConnectionCheckV1';
import {generationNodeConnectionProbeSqlV1 as sql} from '../generationNodeConnectionProbeSqlV1';
import {generationRootCertificateFixtureV1} from './generationRootCaFixturesV1';
type Factory=NonNullable<Parameters<typeof check>[1]>;
const labels=['session_identity','role_attributes','memberships','function_allowlist','table_access','ownership','schema_access','tls','timeouts','read_only_probe'];
const observation=(role:unknown)=>({contract:'potok-generation-connection-observation-v1',role,
  checks:Object.fromEntries(labels.map(k=>[k,true])),connectionChecksPassed:true,mayActivate:false});
async function fixture(fn:(path:string)=>Promise<void>){
  const dir=await mkdtemp(join(tmpdir(),'potok-node-connection-')),path=join(dir,'private.json');
  try{await writeFile(path,JSON.stringify({contract:generationNodeConnectionConfigContractV1,secrets:{
    ca:(await generationRootCertificateFixtureV1()).toString('pem'),readerPassword:'fixture-reader-private',gatewayPassword:'fixture-gateway-private'}}),{mode:0o600});await fn(path);}
  finally{await rm(dir,{recursive:true,force:true});}
}
test('Node metadata SQL is byte-identical to the existing reviewed read-only probe',async()=>{
  assert.equal(sql,await readFile(new URL('../../../scripts/security/generation-connection/probe.readonly.sql',import.meta.url),'utf8'));
});
test('connection checker defaults off without file or connection access',async()=>{
  const r=await check({configPath:'/missing',signal:new AbortController().signal},()=>{throw Error('MUST_NOT_CONNECT');});
  assert.equal(r.outcome,'DISABLED');assert.equal(r.mayActivate,false);assert.deepEqual(r.checks,[]);
});
test('same fixed worker TLS/roles execute only one read-only metadata transaction each, then close',async()=>fixture(async path=>{
  const queries:string[]=[],roles:string[]=[];let closes=0,releases=0;
  const factory:Factory=(config,enabled)=>{
    assert.equal(config.host,'db.ozidryfvhkcbtpnulakq.supabase.co');assert.equal(config.max,1);assert.equal(enabled(),true);
    assert.equal((config.ssl as {rejectUnauthorized:boolean}).rejectUnauthorized,true);
    assert.match(config.options!,/default_transaction_read_only=on/);roles.push(config.user!);
    return{async acquire(){return{async query(statement,parameters){queries.push(statement);assert.deepEqual(parameters,[]);
      return{rows:statement===sql?[{jsonb_build_object:observation(config.user)}]:[]};},async release(discard){assert.equal(discard,true);releases++;}};},async close(){closes++;}};
  };
  const r=await check({enabled:true,configPath:path,signal:new AbortController().signal},factory);
  assert.equal(r.outcome,'PASS');assert.equal(r.mayActivate,false);assert.equal(closes,2);assert.equal(releases,2);
  assert.deepEqual(roles,['potok_generation_reader_v1','potok_generation_gateway_v1']);
  assert.deepEqual(queries,['BEGIN READ ONLY',sql,'ROLLBACK','BEGIN READ ONLY',sql,'ROLLBACK']);
  assert.doesNotMatch(JSON.stringify(r),/fixture-reader-private|fixture-gateway-private|BEGIN|password/);
}));
test('foreign identity, malformed metadata and failed role checks cannot pass or reach a second role',async()=>fixture(async path=>{
  for(const mode of ['role','missing','boolean','failed','activation']){
    let opened=0,closed=0;
    const factory:Factory=config=>{opened++;return{async acquire(){return{async query(statement){const r=observation(config.user);
      if(mode==='role')r.role='postgres';if(mode==='missing')delete (r.checks as Record<string,unknown>).tls;
      if(mode==='boolean')(r.checks as Record<string,unknown>).tls='true';
      if(mode==='failed'){r.checks.role_attributes=false;r.connectionChecksPassed=false;}
      if(mode==='activation')r.mayActivate=true;
      return{rows:statement===sql?[{jsonb_build_object:r}]:[]};},async release(){}};},async close(){closed++;}};};
    const r=await check({enabled:true,configPath:path,signal:new AbortController().signal},factory);
    assert.equal(r.outcome,'FAILED');assert.equal(r.mayActivate,false);assert.equal(opened,1);assert.equal(closed,1);
  }
}));
test('wrong config contract, unknown target selector and invalid CA fail before connection',async()=>fixture(async path=>{
  const original=JSON.parse(await readFile(path,'utf8'));let opened=0;
  for(const c of [{...original,contract:'potok-staging-node-worker-config-v1'},{...original,host:'other'},
    {...original,secrets:{...original.secrets,ca:'broken'}}]){
    await writeFile(path,JSON.stringify(c));
    const r=await check({enabled:true,configPath:path,signal:new AbortController().signal},()=>{opened++;throw Error('MUST_NOT_CONNECT');});
    assert.equal(r.outcome,'FAILED');
  }
  assert.equal(opened,0);
}));
test('driver and cleanup errors are sanitized; metadata read never becomes a writer or retry',async()=>fixture(async path=>{
  for(const at of ['query','close']){
    let opened=0;
    const factory:Factory=config=>{opened++;return{async acquire(){return{async query(statement){if(at==='query')throw Error('fixture-reader-private');
      return{rows:statement===sql?[{jsonb_build_object:observation(config.user)}]:[]};},async release(){}};},async close(){if(at==='close')throw Error('fixture-gateway-private');}};};
    const r=await check({enabled:true,configPath:path,signal:new AbortController().signal},factory);
    assert.equal(r.outcome,'FAILED');assert.equal(opened,1);assert.doesNotMatch(JSON.stringify(r),/fixture-/);
  }
}));
test('abort during read suppresses success and never opens the next role',async()=>fixture(async path=>{
  const controller=new AbortController();let opened=0,closes=0;
  const factory:Factory=config=>{opened++;let closed=false;return{async acquire(){return{async query(statement){if(statement===sql)controller.abort();
    return{rows:statement===sql?[{jsonb_build_object:observation(config.user)}]:[]};},async release(){}};},async close(){if(!closed){closed=true;closes++;}}};};
  const r=await check({enabled:true,configPath:path,signal:controller.signal},factory);
  assert.equal(r.outcome,'STOPPED');assert.equal(opened,1);assert.equal(closes,1);assert.equal(r.mayActivate,false);
}));
