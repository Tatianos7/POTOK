import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFrozen19SourcePrecheckQueueV1 as build } from './pilot-frozen19-source-precheck-v1';

test('all 10 pinned/conditional pilot ingredient positions have source-specific fail-closed review tasks',()=>{
 const q=build();
 assert.equal(q.expectedRows,10);
 assert.equal(q.rowsWithOriginalDigest,7);
 assert.equal(q.rowsPendingOriginalDigest,3);
 assert.equal(q.items.length,10);
 assert.equal(q.groups.length,5);
 assert.deepEqual(q.groups.map(g=>g.count).sort((a,b)=>a-b),[1,2,2,2,3]);
 assert.equal(q.catalogWrites,0);
 assert.equal(q.sourceApprovals,0);
 assert.equal(q.canApply,false);
 assert.equal(q.mayActivate,false);
 assert.ok(q.items.every(i=>i.candidateFoodId===null && i.identityApproved===false && i.sourceApplicabilityApproved===false));
 assert.ok(q.items.every(i=>i.requiredChecks.includes('PRODUCT_IDENTITY') && i.reviewStatus==='BLOCKED_UNTIL_INDEPENDENT_EVIDENCE'));
 assert.ok(q.items.filter(i=>i.originalRowRecheckRequired).every(i=>i.originalRowSha256===null && i.requiredChecks.includes('ORIGINAL_ROW_SHA256')));
 assert.ok(q.items.filter(i=>!i.originalRowRecheckRequired).every(i=>typeof i.originalRowSha256==='string' && i.originalRowSha256.length===64));
});
test('spelt pasta and generic lentil cannot be interpreted as approved by the review queue',()=>{
 const q=build();
 const pasta=q.items.filter(i=>i.sourceRecord==='SR28:20124');
 const lentil=q.items.filter(i=>i.sourceRecord==='FDC_SR_LEGACY:172420:DRY_RAW:100G');
 assert.ok(pasta.length>0 && lentil.length>0);
 assert.ok(pasta.every(i=>i.requiredChecks.includes('COMMON_WHEAT_NOT_SPELT')));
 assert.ok(lentil.every(i=>i.requiredChecks.includes('BROWN_COLOR_NOT_PROVEN_BY_LEGACY_SOURCE')));
 assert.ok([...pasta,...lentil].every(i=>i.sourceApproved===false && i.canApply===false));
});
