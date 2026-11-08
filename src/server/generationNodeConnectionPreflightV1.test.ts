import test from 'node:test';
import assert from 'node:assert/strict';
import {runGenerationNodeConnectionPreflightV1,verifyGenerationConnectionProbeRowV1} from './generationNodeConnectionPreflightV1';
test('TLS role identity and read-only transaction are mandatory for both connections',()=>{
 const reader={role:'potok_generation_reader_v1',db:'postgres',tls:true,transaction_ro:'on'};
 const gateway={...reader,role:'potok_generation_gateway_v1'};
 assert.equal(verifyGenerationConnectionProbeRowV1(reader,'reader'),true);
 assert.equal(verifyGenerationConnectionProbeRowV1(gateway,'gateway'),true);
 assert.equal(verifyGenerationConnectionProbeRowV1(reader,'gateway'),false);
 for(const value of [{...reader,tls:false},{...reader,transaction_ro:'off'},
  {...reader,db:'template1'},{...reader,secret:'leak'},null]){
  assert.equal(verifyGenerationConnectionProbeRowV1(value,'reader'),false);
 }
});
test('connection probe remains fail-closed when disabled and does not read secrets or connect',async()=>{
 let calls=0;
 const r=await runGenerationNodeConnectionPreflightV1('/nonexistent/secret.json',{
  enabled:false,openPool:()=>{calls++;throw Error('MUST_NOT_CONNECT');}
 });
 assert.deepEqual(r,{contract:'potok-generation-staging-node-connection-probe-v1',
  status:'FAIL',readerVerified:false,gatewayVerified:false,workerEnabled:false,writes:0});
 assert.equal(calls,0);
});
test('enabling probe with absent protected config never creates pools or writes',async()=>{
 let calls=0;
 const r=await runGenerationNodeConnectionPreflightV1('/nonexistent/secret.json',{
  enabled:true,openPool:()=>{calls++;throw Error('MUST_NOT_CONNECT');}
 });
 assert.equal(r.status,'FAIL');
 assert.equal(calls,0);
 assert.equal(r.writes,0);
 assert.equal(r.workerEnabled,false);
});
