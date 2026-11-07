import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverFrozen19RetainedReferencesV1 as recover } from './pilot-frozen19-retained-recovery-v1';
test('retained frozen19 review recovers five exact ingredient refs and two lentil recipe refs without pretending all ten are proven',()=>{
  const r=recover();
  assert.equal(r.recipeCount,19);
  assert.equal(r.exactRowReferences.length,5);
  assert.equal(r.recipeOnlyReferences.length,2);
  assert.deepEqual(r.lentilModelPositionRefs.map(x=>x.rowId).sort(),[
    'brown_lentils_rice_carrot_ing_01',
    'whole_wheat_pasta_lentils_tomato_ing_02'
  ]);
  assert.ok(r.lentilModelPositionRefs.every(x=>x.originalRowSha256===null && x.requiresOriginalRowRecheck===true));
  assert.ok(r.lentilModelPositionRefs.every(x=>x.evidenceBasis==='MODEL_CONTRACT_POSITION_WITH_PINNED_RECIPE_DIGEST_ONLY'));

  assert.equal(r.expectedUnresolvedIngredientRows,10);
  assert.equal(r.completeTenRowMapping,false);
  assert.equal(r.canApply,false);
  assert.equal(r.readyForServerSubmission,false);
  assert.ok(r.exactRowReferences.every(x=>x.originalRowSha256.length===64 && x.identityStatus==='NOT_VERIFIED'));
  assert.ok(r.recipeOnlyReferences.every(x=>x.rowId===null && x.sourceApproved===false));
  assert.deepEqual([...new Set(r.exactRowReferences.map(x=>x.sourceRecord))].sort(),['SR28:01174','SR28:01287','SR28:20124','FDC_SR_LEGACY:168411:PREPARED:100G'].sort());
});
