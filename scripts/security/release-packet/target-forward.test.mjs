import assert from 'node:assert/strict';
import test from 'node:test';
import {buildArtifacts,main,finalChecks} from './target-forward.mjs';
import {buildArtifacts as rehearsalArtifacts,sha} from './target-rehearsal.mjs';
test('permanent review changes only wrapper/header of the exact rehearsed batch; all guards precede the one COMMIT',async()=>{
  const files=await buildArtifacts(),sql=files['target-twelve-forward.pending-approval.sql'];
  const trial=(await rehearsalArtifacts())['target-twelve-rehearsal.pending-approval.sql'];
  const start=s=>s.slice(s.indexOf('BEGIN ISOLATION LEVEL READ COMMITTED;'),s.lastIndexOf('DO $done$'));
  assert.equal(start(sql),start(trial));
  assert.equal(sha(trial),'96aa896dbd00855ecd3750e0ef2fd57ab50eeb6aa74579f737a5247e1d627592');
  assert.equal((sql.match(/^COMMIT;$/gm)||[]).length,1);assert(sql.endsWith('COMMIT;\n'));
  assert.doesNotMatch(sql,/^ROLLBACK;|^\s*\\/m);
  for(const marker of ['TARGET_REHEARSAL_CONTEXT_STOPPED','TARGET_REHEARSAL_METADATA_STOPPED','TARGET_REHEARSAL_LOCK_PRIVILEGES_STOPPED','TARGET_ROWS_PRESERVED_OK','TARGET_SEQUENCES_PRESERVED_OK','TARGET_REHEARSAL_NEW_ANNOTATION_STOPPED'])assert(sql.indexOf(marker)<sql.lastIndexOf('COMMIT;'));
  const manifest=JSON.parse(files['target-twelve-forward-manifest.json']);
  assert.equal(manifest.sqlInputs.length,12);assert.equal(manifest.hostedExecuted,false);
  assert.equal(manifest.clientPublished,false);assert.equal(manifest.releaseReady,false);
  for(const a of manifest.artifacts)assert.equal(sha(files[a.path]),a.sha256);
});
test('independent postcommit file uses readonly guards and explicit JSON with no dependence on apply temp tables',async()=>{
  const sql=(await buildArtifacts())['target-twelve-postcommit.readonly.sql'];
  assert(sql.includes('BEGIN READ ONLY;'));assert(sql.endsWith('ROLLBACK;\n'));
  assert.match(sql,/TARGET_TWELVE_COMMITTED_CONTRACTS_OK/);
  assert.match(sql,/Authority must remain empty/);assert.match(sql,/Final effective permission review failed/);
  assert.match(sql,/Program read final source contract mismatch/);assert.match(sql,/SQL boundary review failed/);
  assert.match(sql,/NOT attnotnull AND atttypid='text'::regtype/);
  assert.match(sql,/'releaseReady',false/);
  assert.doesNotMatch(sql,/CREATE TEMP|LOCK TABLE|^COMMIT;|^ALTER |^REVOKE |^GRANT |legacy_plan_keep_|potok_release_rows_v1/m);
  assert(!sql.includes("OR EXISTS(SELECT FROM pg_namespace WHERE nspname IN('potok_control'"));
  assert.match(sql,/nspowner='postgres'::regrole/);
});
test('no alternate SQL input or apply mode can bypass the reviewed package',async()=>{
  for(const args of [[],['--apply'],['--write-review','postgres://other']])await assert.rejects(()=>main(args));
  assert.throws(()=>finalChecks('DO $history_final$ BEGIN END $history_final$;'));
});
