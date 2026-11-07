import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyFrozen19OriginalIngredientRowsV1 as verify } from './pilot-frozen19-original-row-recheck-v1';

test('exact frozen19 original row checker fails closed on absent, fake and duplicate-key input',()=>{
 assert.throws(()=>verify('{}'),/PILOT_ORIGINAL_ROW_RECHECK_FAILED/);
 assert.throws(()=>verify(JSON.stringify({originalAuthoringCatalog:{recipes:[]}})),/PILOT_ORIGINAL_ROW_RECHECK_FAILED/);
 assert.throws(()=>verify('{"originalAuthoringCatalog":{},"originalAuthoringCatalog":{}}'));
});
test('no original input can be promoted into review approval by forged flags',()=>{
 const forged={originalAuthoringCatalog:{recipes:[]},sourceApproved:true,runtimePublishable:true};
 assert.throws(()=>verify(JSON.stringify(forged)),/PILOT_ORIGINAL_ROW_RECHECK_FAILED/);
});
