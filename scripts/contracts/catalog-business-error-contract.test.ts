import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {retryCatalogTransactionV1,retryableCatalogFailureV1} from './catalogTransactionRetryV1';

test('all 18 application conflict sites are explicitly classified; no application RAISE 40001 remains',async()=>{
 const counts=[['food_reviewed_evidence_v1_phase2b.sql',7,1],['shared_food_eligibility_v1.sql',4,0],['shared_food_stage_c_disposable_v1.sql',6,0]] as const;
 for(const [name,business,invariant] of counts){
  const sql=await readFile(join('supabase/migration_drafts',name),'utf8');
  const raises=[...sql.matchAll(/RAISE\s+EXCEPTION\s+'([^']+)'\s+USING\s+ERRCODE\s*=\s*'(PT409|PT500)'\s*,\s*DETAIL\s*=\s*'([^']+)'/gi)];
  assert.equal(raises.filter(r=>r[2]==='PT409').length,business);
  assert.equal(raises.filter(r=>r[2]==='PT500').length,invariant);
  for(const r of raises){assert.equal(r[3],r[2]==='PT409'?'POTOK_BUSINESS_CONFLICT_V1':'POTOK_INVARIANT_FAILURE_V1');
   if(r[2]==='PT500')assert.equal(r[1],'STORED_REVISION_INTEGRITY_FAILURE');}
 }
 // Scan tracked-source roots, including fixtures, not node_modules/.git or docs
 // discussing the old contract. Any hand-raised serialization_failure is unsafe.
 const walk=async(path:string):Promise<void>=>{
  for(const item of await readdir(path,{withFileTypes:true})){
   const file=join(path,item.name);if(item.isDirectory())await walk(file);
   else if(/\.(sql|ts|tsx)$/.test(file)){
    const s=await readFile(file,'utf8');
    assert.doesNotMatch(s,/RAISE\s+(?:EXCEPTION|SQLSTATE)[\s\S]{0,300}?ERRCODE\s*=\s*['"]40001['"]/i,file);
    assert.doesNotMatch(s,/RAISE\s+SQLSTATE\s+['"]40001['"]/i,file);
   }
  }
 };
 for(const root of ['supabase','scripts','src'])await walk(root);
});

test('native business and invariant failures never replay a transaction, including forged engine routine',async()=>{
 for(const code of ['PT409','PT500','42501','22023']){
  let attempts=0;const error={code,routine:'CheckForSerializableConflictOut',rollbackConfirmed:true};
  assert.equal(retryableCatalogFailureV1(error),false);
  await assert.rejects(retryCatalogTransactionV1(async()=>{attempts++;return {ok:false,error};}));assert.equal(attempts,1);
 }
});

test('genuine native engine 40001 retries only a fresh attempt after confirmed full rollback',async()=>{
 let attempts=0;const native={code:'40001',routine:'CheckForSerializableConflictOut',rollbackConfirmed:true};
 const value=await retryCatalogTransactionV1(async()=>++attempts===1?{ok:false,error:native}:{ok:true,value:'fresh committed result'},{sleep:async()=>{},random:()=>0});
 assert.equal(value,'fresh committed result');assert.equal(attempts,2);
 assert.equal(retryableCatalogFailureV1({...native,rollbackConfirmed:false}),false);
 assert.equal(retryableCatalogFailureV1({...native,routine:'exec_stmt_raise'}),false);
});
