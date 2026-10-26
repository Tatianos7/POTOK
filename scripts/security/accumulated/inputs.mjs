import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

// Public reviewed sources only. This module has no database/deployment entry point.
export const inputs = [
  ['truncate','c175e74d7a7c1077e4e8d6d4d8f67c960b06d677','supabase/migration_drafts/client_truncate_containment_v1.sql','007b8a1545824fbc724ce313b3be7258fc7e26fb3e6894c9b7e95bd578b120ec','COMMIT',false],
  ['profile','7f4f7e24fec497a22dea29dd14f4546115439129','supabase/migration_drafts/profile_column_write_containment_v1.sql','b781e7754732d12359cfff990ca855f75115695c283b08f9f221f785f5d529ea','COMMIT',false],
  ['anonymous','47e2ff8bd4937469576f8cfaceecaaefca33548e','supabase/migration_drafts/anonymous_rpc_execute_containment_v1.sql','a86d36788d3df576e6eaeeea45ed824e57a363409f213317a52d0cbccc9d3368','COMMIT',false],
  ['photos','c02608a5bbc7c828ea2a05f206d010e48d0720b1','supabase/migration_drafts/measurement_photo_explicit_grants_review_v1.sql','6f06553f7897bd621c9186f38d9c154317b4f42193bc6888b795180bcb04814b','ROLLBACK',true],
  ['finance','0419b2ec21ec225206e9e0715b8dd24f54c590ff','supabase/migration_drafts/premium_finance_authority_review_v1.sql','8f41f0f4fbaa7fc044d22bbe1dd758ab2a48134c4704f12ff859daaac804f977','ROLLBACK',true],
  ['authority','f542e5433ca377186f0a9e3d0e89ccbf64d91bc0','supabase/migration_drafts/trusted_authority_id_user_review_v1.sql','8447c5553cd07644c2725e4cd1eee1bb4cdbf584d515eecb0d96f382b161eb70','ROLLBACK',true],
  ['catalog','a3386a629a0c6d3e69f5224cdf47c9bbe6db2f85','supabase/migration_drafts/catalog_authority_history_review_v1.sql','d159e92807a0d14633616a4d686aa96e770445a9279c9ae1c315e9865158b36b','ROLLBACK',true],
  ['trgm','a1b91d8bfbfba8135478803605512e1014dbafcc','scripts/security/pg-trgm/rehearsal.sql','a22d809784f341030029be46fe3975c3842813b41eb57414ee17ab6d9e1a52d7','ROLLBACK',false]
].map(([key,ref,path,sha256,terminator,local])=>({key,ref,path,sha256,terminator,local}));

export function body(sql,terminator){
  assert.equal((sql.match(/^BEGIN;$/gm)??[]).length,1,'Expected exactly one BEGIN');
  assert.equal((sql.match(/^(?:COMMIT|ROLLBACK);$/gm)??[]).length,1,'Expected exactly one terminator');
  assert(new RegExp('^'+terminator+';\\s*$','m').test(sql),'Unexpected terminator');
  assert(!/^\s*\\/m.test(sql),'psql metacommands prohibited');
  return sql.replace(/^BEGIN;\n/m,'').replace(new RegExp('^'+terminator+';\\s*$','m'),'');
}
export async function loadInputs({remoteAll=false}={}){
  const result={};
  for(const item of inputs){
    let bytes;
    if(item.local&&!remoteAll)bytes=await readFile(new URL('../../../'+item.path,import.meta.url));
    else if(process.env.ACCUMULATED_INPUT_DIR&&!remoteAll){
      const file=item.key==='anonymous'?'rpc':item.key;
      bytes=await readFile(process.env.ACCUMULATED_INPUT_DIR+'/'+file+'.sql');
    }else{
      const response=await fetch(`https://raw.githubusercontent.com/Tatianos7/POTOK/${item.ref}/${item.path}`,{redirect:'error',signal:AbortSignal.timeout(30000)});
      assert(response.ok,'Pinned public source unavailable: '+item.key);
      bytes=Buffer.from(await response.arrayBuffer());
    }
    assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256,'Pinned source changed: '+item.key);
    result[item.key]=body(bytes.toString('utf8'),item.terminator);
  }
  return result;
}
export const order=inputs.map(x=>x.key);
export function combined(sources,keys=order){
  assert.equal(new Set(keys).size,keys.length,'Duplicate candidate');
  assert(keys.every(k=>Object.hasOwn(sources,k)),'Unknown candidate');
  return keys.map(key=>'-- Reviewed candidate: '+key+'\n'+sources[key]).join('\n');
}
