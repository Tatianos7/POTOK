import assert from 'node:assert/strict';
import test from 'node:test';
import { accountClosureFenceContractV1, assessAccountClosureAdmissionV1, readAccountClosureAdmissionV1 } from '../accountClosureFenceV1';
const accountA='123e4567-e89b-42d3-a456-426614174000';
const accountB='123e4567-e89b-42d3-a456-426614174001';
const revision='a'.repeat(64);
const observation=(state:string,accountId=accountA)=>({contract:accountClosureFenceContractV1,accountId,state,revision});

test('verified ACTIVE permits an observation only, with an exact revision',()=>{
  assert.deepEqual(assessAccountClosureAdmissionV1(accountA,observation('ACTIVE')),{kind:'ALLOW',revision});
});
test('CLOSING and CLOSED always deny new admissions',()=>{
  assert.deepEqual(assessAccountClosureAdmissionV1(accountA,observation('CLOSING')),{kind:'DENY',reason:'CLOSING'});
  assert.deepEqual(assessAccountClosureAdmissionV1(accountA,observation('CLOSED')),{kind:'DENY',reason:'CLOSED'});
});
test('foreign account, extra keys, invalid revision and unknown state fail closed',()=>{
  for(const row of [observation('ACTIVE',accountB),{...observation('ACTIVE'),admin:true},
    {...observation('ACTIVE'),revision:'1'},observation('DELETING'),null,undefined,42,{},[]]){
    assert.deepEqual(assessAccountClosureAdmissionV1(accountA,row),{kind:'DENY',reason:'UNVERIFIED'});
  }
  assert.deepEqual(assessAccountClosureAdmissionV1('invalid',observation('ACTIVE')),{kind:'DENY',reason:'UNVERIFIED'});
});
test('read failure denies and a trusted observation remains read-only',async()=>{
  assert.deepEqual(await readAccountClosureAdmissionV1({read:async()=>{throw new Error('database unavailable');}},accountA),
    {kind:'DENY',reason:'UNVERIFIED'});
  assert.deepEqual(await readAccountClosureAdmissionV1({read:async()=>observation('CLOSING')},accountA),
    {kind:'DENY',reason:'CLOSING'});
});
