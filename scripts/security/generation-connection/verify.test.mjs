import assert from 'node:assert/strict';
import test from 'node:test';
import {classifyConnection,verifyGenerationConnections,roles,stagingHost} from './verify.mjs';
const keys=['session_identity','role_attributes','memberships','function_allowlist','table_access','ownership','schema_access','tls','timeouts','read_only_probe'];
const observation=role=>({contract:'potok-generation-connection-observation-v1',role,checks:Object.fromEntries(keys.map(k=>[k,true])),connectionChecksPassed:true,mayActivate:false});
const config={passfile:'/private/credentials.pgpass',ca:'/private/supabase-ca.crt',stat:()=>({isFile:()=>true,mode:0o100600})};
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
