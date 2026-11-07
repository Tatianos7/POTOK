import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverFrozen19RetainedReferencesV1 as recover } from './pilot-frozen19-retained-recovery-v1';
test('retained frozen19 review recovers five exact ingredient refs and two lentil recipe refs without pretending all ten are proven',()=>{
  const r=recover();
  assert.equal(r.recipeCount,19);
  assert.equal(r.exactRowReferences.length,5);
  assert.equal(r.recipeOnlyReferences.length,2);
  assert.equal(r.expectedUnresolvedIngredientRows,10);
  assert.equal(r.completeTenRowMapping,false);
  assert.equal(r.canApply,false);
  assert.equal(r.readyForServerSubmission,false);
  assert.ok(r.exactRowReferences.every(x=>x.originalRowSha256.length===64 && x.identityStatus==='NOT_VERIFIED'));
  assert.ok(r.recipeOnlyReferences.every(x=>x.rowId===null && x.sourceApproved===false));
  assert.deepEqual([...new Set(r.exactRowReferences.map(x=>x.sourceRecord))].sort(),['SR28:01174','SR28:01287','SR28:20124','FDC_SR_LEGACY:168411:PREPARED:100G'].sort());
});
