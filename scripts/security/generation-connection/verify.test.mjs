import assert from 'node:assert/strict';
import test from 'node:test';
import {rootCertificates} from 'node:tls';
import {X509Certificate} from 'node:crypto';
import {classifyConnection,verifyGenerationConnections,validateGenerationCa,roles,stagingHost} from './verify.mjs';
const keys=['session_identity','role_attributes','memberships','function_allowlist','table_access','ownership','schema_access','tls','timeouts','read_only_probe'];
const observation=role=>({contract:'potok-generation-connection-observation-v1',role,checks:Object.fromEntries(keys.map(k=>[k,true])),connectionChecksPassed:true,mayActivate:false});
// Runtime's public trust roots supply an independent parseable CA fixture.
const root=rootCertificates.find(pem=>{const c=new X509Certificate(pem);return c.ca&&c.checkIssued(c)&&c.verify(c.publicKey);});
assert.ok(root);
const cert=new X509Certificate(root);
const validTime=Math.floor((Date.parse(cert.validFrom)+Date.parse(cert.validTo))/2);
const config={passfile:'/private/credentials.pgpass',ca:'/private/supabase-ca.crt',
  stat:()=>({isFile:()=>true,mode:0o100600,size:4096}),now:validTime,
  readCa:file=>{assert.equal(file,'/private/supabase-ca.crt');return root;}};
test('psql receives only fixed Staging targets, verify-full, password file selector and read-only SQL',()=>{
  const calls=[];const result=verifyGenerationConnections({...config,run:(command,args,opts)=>{
    calls.push({command,args,opts});return {status:0,stdout:JSON.stringify(observation(args[args.indexOf('-U')+1]))};}});
  assert.equal(result.length,2);for(const call of calls){assert.equal(call.command,'psql');assert.ok(call.args.includes(stagingHost));
    assert.equal(call.opts.env.PGSSLMODE,'verify-full');assert.equal(call.opts.env.PGOPTIONS,'-c default_transaction_read_only=on');
    assert.equal(call.opts.env.PGPASSWORD,undefined);assert.equal(call.opts.env.PGSERVICE,undefined);assert.equal(call.opts.env.PGUSER,undefined);
    assert.match(call.opts.input,/^-- Connection-only probe/);assert.doesNotMatch(call.opts.input,/ALTER ROLE|CREATE ROLE|SET ROLE/);
  }
});
test('missing, relative and broadly readable secret files stop before a process is launched',()=>{
  let calls=0;const run=()=>{calls++;throw Error('unexpected');};
  for(const change of [{passfile:null},{passfile:'relative'},{stat:()=>({isFile:()=>true,mode:0o100644})}])
    assert.throws(()=>verifyGenerationConnections({...config,...change,run}));
  assert.equal(calls,0);
});
test('missing TLS, wrong role, missing checks and contradictory success cannot produce readiness',()=>{
  for(const mutate of [x=>x.role='postgres',x=>delete x.checks.tls,x=>x.checks.tls=false,x=>x.mayActivate=true]){
    const x=observation(roles[0]);mutate(x);assert.throws(()=>classifyConnection(x,roles[0]));
  }
  const x=observation(roles[0]);x.checks.tls=false;x.connectionChecksPassed=false;
  assert.deepEqual(classifyConnection(x,roles[0]).failedChecks,['tls']);
});
test('driver errors never expose stderr or credentials through the public error',()=>{
  assert.throws(()=>verifyGenerationConnections({...config,run:()=>({status:2,stderr:'private credential/connection detail'})}),/^Error: GENERATION_CONNECTION_PROBE_FAILED$/);
});
test('public CA preflight rejects malformed, concatenated, oversized and invalid-signature roots',()=>{
  const bytes=Buffer.from(cert.raw);bytes[bytes.length-1]^=1;
  const badSignature='-----BEGIN CERTIFICATE-----\n'+bytes.toString('base64')+'\n-----END CERTIFICATE-----';
  for(const pem of ['not a certificate',root+root,'x'.repeat(65537),badSignature,
    root+'\n-----BEGIN PRIVATE KEY-----\nDO_NOT_READ\n-----END PRIVATE KEY-----']){
    assert.throws(()=>validateGenerationCa(pem,validTime),/^Error: GENERATION_CONNECTION_CA_INVALID$/);
  }
  assert.doesNotThrow(()=>validateGenerationCa(root,validTime));
});
test('not-yet-valid and expired roots stop before psql without reading the password file',()=>{
  let calls=0;
  for(const now of [Date.parse(cert.validFrom)-1,Date.parse(cert.validTo),NaN]){
    assert.throws(()=>verifyGenerationConnections({...config,now,run:()=>{calls++;}}),
      /^Error: GENERATION_CONNECTION_CA_NOT_CURRENT$/);
  }
  assert.equal(calls,0);
});
test('unreadable and oversized CA files stop locally and never expose filesystem errors',()=>{
  let calls=0;const run=()=>{calls++;};
  for(const change of [
    {readCa:()=>{throw Error('private path detail');}},
    {stat:()=>({isFile:()=>true,mode:0o100600,size:65537}),readCa:()=>{throw Error('must not read');}},
  ]){
    assert.throws(()=>verifyGenerationConnections({...config,...change,run}),
      /^Error: GENERATION_CONNECTION_CA_INVALID$/);
  }
  assert.equal(calls,0);
});
test('missing psql has a bounded actionable error with no raw driver details',()=>{
  assert.throws(()=>verifyGenerationConnections({...config,
    run:()=>({error:Object.assign(Error('private executable/path detail'),{code:'ENOENT'})})}),
    /^Error: GENERATION_CONNECTION_PSQL_NOT_FOUND$/);
});

