import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {buildArtifacts,reviewedBody,canonicalCTE,scopeSQL,sequenceSQL,sha,main} from './target-rehearsal.mjs';
const read=n=>fs.readFileSync(new URL(n,import.meta.url),'utf8');
test('complete fixed-target rehearsal includes real guards, exact bodies and one rollback, never COMMIT',async()=>{
  const files=await buildArtifacts(),sql=files['target-twelve-rehearsal.pending-approval.sql'];
  const manifest=JSON.parse(files['target-twelve-rehearsal-manifest.json']);
  assert.equal(manifest.sqlInputs.length,12);assert.equal(manifest.oldRowsChecked,116);
  assert.equal(manifest.status,'PENDING_EXACT_OWNER_APPROVAL');assert.equal(manifest.hostedExecuted,false);
  assert.equal(manifest.connectorBinding.project_id,'dtsdnhbcwpbfrhcazqkb');assert.equal(manifest.releaseReady,false);
  for(const marker of ['TARGET_REHEARSAL_CONTEXT_STOPPED','TARGET_REHEARSAL_METADATA_STOPPED','TARGET_REHEARSAL_SCOPE_STOPPED','TARGET_SEQUENCES_PRESERVED_OK','TARGET_ROWS_PRESERVED_OK','TARGET_TWELVE_REHEARSAL_CHECKS_OK','Authority must remain empty','Final effective permission review failed'])assert(sql.includes(marker),marker);
  assert.equal((sql.match(/^ROLLBACK;$/gm)||[]).length,1);assert.doesNotMatch(sql,/^COMMIT\b|^\s*\\/m);
  assert(sql.indexOf('TARGET_REHEARSAL_METADATA_STOPPED')<sql.indexOf('-- Reviewed candidate: truncate'));
  assert(sql.indexOf('CREATE TEMP TABLE potok_release_rows_v1')<sql.indexOf('-- Reviewed candidate: truncate'));
  assert.equal((sql.match(/^LOCK TABLE/gm)||[]).length,116);
  assert.equal((sql.match(/ IN ACCESS SHARE MODE;/g)||[]).length,4);
  assert(sql.endsWith('ROLLBACK;\n'));
  for(const artifact of manifest.artifacts)assert.equal(sha(files[artifact.path]),artifact.sha256);
});
test('independent postcheck is a fresh read-only transaction with no reused temp evidence or candidate SQL',async()=>{
  const sql=(await buildArtifacts())['target-twelve-after.readonly.sql'];
  assert(sql.startsWith('BEGIN READ ONLY;'));assert.match(sql,/SET LOCAL search_path=pg_catalog,pg_temp/);
  assert.match(sql,/TARGET_REHEARSAL_METADATA_STOPPED/);assert.match(sql,/TARGET_REHEARSAL_SCOPE_STOPPED/);
  assert.match(sql,/TARGET_TWELVE_REHEARSAL_ROLLBACK_OK/);
  assert.doesNotMatch(sql,/LOCK TABLE|ALTER |CREATE |REVOKE |GRANT |potok_release_rows_v1|COMMIT;/);
});
test('source or manifest tampering and changed canonical metadata definitions are rejected before packaging',()=>{
  const sql=read('forward.review.sql'),manifest=JSON.parse(read('manifest.json'));
  assert.throws(()=>reviewedBody(sql.replace('REVOKE TRUNCATE','GRANT TRUNCATE'),manifest));
  const changed=structuredClone(manifest);changed.sqlInputs.reverse();assert.throws(()=>reviewedBody(sql,changed));
  assert.throws(()=>canonicalCTE(read('preflight.sql')+'\n-- drift'));
  assert.throws(()=>scopeSQL([{schema:'vault',name:'secrets',kind:'r',partition:false,columns:[]}]))
});
test('sequence checks never call nextval, setval or reset; divergence is a stop',()=>{
  const sql=sequenceSQL()+sequenceSQL(true);
  assert.match(sql,/last_value,is_called/);assert.match(sql,/TARGET_REHEARSAL_SEQUENCE_VALUE_STOPPED/);
  assert.match(sql,/TARGET_REHEARSAL_SEQUENCE_CATALOG_STOPPED/);assert.doesNotMatch(sql,/nextval|setval|ALTER SEQUENCE/i);
});
test('no execution, connection string or arbitrary input flags exist',async()=>{
  for(const args of [[],['--apply'],['--verify','postgres://other']])await assert.rejects(()=>main(args));
});
