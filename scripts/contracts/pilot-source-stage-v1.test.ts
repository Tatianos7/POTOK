import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';

const root=new URL('../../',import.meta.url),prefix='docs/premium/retained-sources/pilot-source-stage-20261104/';
const read=(path:string)=>readFileSync(new URL(path,root),'utf8');
const hash=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const load=(name:string)=>JSON.parse(read(prefix+name));
const capture=load('sr28-ascii-capture-v1.json'),audit=load('remaining-42-review-v1.json'),ledger=load('120-row-review-v1.json'),milk=load('milk-volume-review-v1.json');
const old=JSON.parse(read(audit.baselineLedgerPath));
const field=(line:string)=>line.split('^').map(v=>v.startsWith('~')&&v.endsWith('~')?v.slice(1,-1):v);
const axes:Record<string,string>={'203':'protein','204':'fat','205':'totalCarbohydrate','208':'calories','291':'fiber'};
function verifyCapture(c:typeof capture){
  assert.equal(c.records.length,27);assert.equal(new Set(c.records.map((r:{ndb:string})=>r.ndb)).size,27);
  for(const r of c.records){
    assert.match(r.ndb,/^\d{5}$/);const food=field(r.foodRecord.text);assert.equal(food[0],r.ndb);assert.equal(food[2],r.description);
    const seen=new Set<string>();
    for(const n of r.nutrientRecords){const fields=field(n.text);assert.equal(fields[0],r.ndb);assert.equal(fields[1],n.nutrientCode);
      assert.ok(axes[fields[1]]);assert.ok(!seen.has(fields[1]));seen.add(fields[1]);
      assert.equal(r.factsPer100GEdible[axes[fields[1]]],fields[2]);assert.match(fields[2],/^\d+(?:\.\d+)?$/);
      assert.ok(n.lineNumber>0);assert.equal(n.file,'NUT_DATA.txt');
      // Original sample/source/derivation columns remain in the retained record.
      assert.ok(fields.length>=8);assert.ok(fields[5].length>0);
    }
    for(const [code,axis] of Object.entries(axes))if(!seen.has(code)){
      assert.equal(r.factsPer100GEdible[axis],null);assert.ok(r.missingNutrientCodes.includes(code));}
    assert.equal(r.fdcCrosswalkVerified,false);assert.equal(r.usedForRecipeRecalculation,false);
  }
}
function verifyInventory(l:typeof ledger){
  assert.equal(l.rows.length,120);const ids=l.rows.map((r:{ingredientRowId:string})=>r.ingredientRowId);
  assert.equal(new Set(ids).size,120);assert.deepEqual(ids,[...ids].sort());
  assert.equal(hash(JSON.stringify(ids)),'e9ac8a2c7202a74bc19a5cd91aaef64fd27a72315c55e19e055d265481e94adc');
  assert.equal(l.ingredientInventorySha256,hash(JSON.stringify(ids)));
  assert.equal(new Set(l.rows.map((r:{recipeId:string})=>r.recipeId)).size,24);
  assert.equal(l.rows.filter((r:{reviewOrigin:string})=>r.reviewOrigin==='PRIOR_PREPARATION').length,78);
  assert.equal(l.rows.filter((r:{reviewOrigin:string})=>r.reviewOrigin==='THIS_STAGE_REVIEW').length,42);
  for(const r of l.rows){assert.equal(r.canonicalStatus,'UNRESOLVED');assert.equal(r.stableFoodId,null);assert.equal(r.runtimePublishable,false);}
}
test('historical archive records keep original field values, provenance columns, units and missing nutrient rows',()=>{
  verifyCapture(capture);assert.equal(capture.archiveSha256,'8308fd1d224ef1e5331093748007180da01a7ac713cbac6a1f5bc2a03e1ee70a');
  assert.equal(capture.foodRecordCount,8789);assert.equal(capture.patchOrOtherDatasetApplied,false);
  assert.equal(capture.recordTextEncoding,'ISO_8859_1_WITH_LINE_TERMINATORS_EXCLUDED');
  for(const n of capture.nutrientDefinitions){const f=field(n.text);assert.equal(f[1],f[0]==='208'?'kcal':'g');assert.ok(axes[f[0]]);}
  const changed=structuredClone(capture);changed.records[0].factsPer100GEdible.protein='0';assert.throws(()=>verifyCapture(changed));
  const invented=structuredClone(capture);invented.records.find((r:{ndb:string})=>r.ndb==='09083').factsPer100GEdible.fiber='4.3';assert.throws(()=>verifyCapture(invented));
});
test('42 reviewed rows reconcile exactly to the old outstanding set, split 27 plus 15 with specific evidence needs',()=>{
  assert.equal(hash(read(audit.baselineLedgerPath)),audit.baselineLedgerSha256);
  assert.equal(hash(read(audit.asciiCapturePath)),audit.asciiCaptureSha256);
  assert.equal(hash(read(audit.previousTvorogDecisionPath)),audit.previousTvorogDecisionSha256);
  const expected=old.rows.filter((r:{route:string})=>r.route==='SOURCE_PREPARATION_OUTSTANDING').map((r:{ingredientRowId:string})=>r.ingredientRowId).sort();
  const actual=audit.cases.flatMap((c:{rowIds:string[]})=>c.rowIds).sort();assert.deepEqual(actual,expected);assert.equal(new Set(actual).size,42);
  const dairy=audit.cases.filter((c:{caseId:string})=>c.caseId.startsWith('DAIRY_'));
  assert.equal(dairy.flatMap((c:{rowIds:string[]})=>c.rowIds).length,15);assert.equal(audit.otherWorkstreamRows,27);
  assert.equal(dairy.find((c:{caseId:string})=>c.caseId==='DAIRY_TVOROG').rowIds.length,6);
  for(const c of audit.cases){assert.ok(c.finding.length>30);assert.ok(c.requiredEvidence.length>30);assert.equal(c.nutritionApproved,false);assert.equal(c.runtimePublishable,false);
    for(const ndb of c.sourceRecordIds)assert.ok(capture.records.some((r:{ndb:string})=>r.ndb===ndb));}
});
test('120-row coverage is complete and exclusive, pinned to unchanged private inputs and every provenance file',()=>{
  verifyInventory(ledger);assert.equal(ledger.privatePilotPacketSha256,'e7ad3b7161156a444f7e2c24226226aff58fee9659dba55d1ec09546e4eae723');
  assert.equal(ledger.authoringCatalogSha256,'517386c0ec6d5bc3a4ff28a33b702f046b1862a16c342f52255789f3a3fb90b0');
  assert.equal(hash(read(ledger.priorLedgerPath)),ledger.priorLedgerSha256);
  for(const r of ledger.rows){assert.equal(hash(read(r.provenancePath)),r.provenanceSha256);assert.match(r.sourceAuthoringRowSha256,/^[a-f0-9]{64}$/);}
  const cases=new Map(audit.cases.flatMap((c:{caseId:string;rowIds:string[]})=>c.rowIds.map(id=>[id,c.caseId])));
  for(const r of ledger.rows.filter((r:{reviewOrigin:string})=>r.reviewOrigin==='THIS_STAGE_REVIEW'))assert.equal(r.openFinding,cases.get(r.ingredientRowId));
  const duplicate=structuredClone(ledger);duplicate.rows[0]=duplicate.rows[1];assert.throws(()=>verifyInventory(duplicate));
  const missing=structuredClone(ledger);missing.rows.pop();assert.throws(()=>verifyInventory(missing));
});
test('four milk volumes keep absent or copied mass separate from measurement and reviewed conversion',()=>{
  assert.equal(milk.rows.length,4);assert.deepEqual(milk.rows.map((r:{recordedVolumeMl:number})=>r.recordedVolumeMl).sort((a:number,b:number)=>a-b),[100,150,300,400]);
  assert.equal(milk.rows.filter((r:{recordedGramReference:number|null})=>r.recordedGramReference===null).length,2);
  for(const r of milk.rows){assert.equal(r.measuredMassG,null);assert.equal(r.reviewedConversion,null);assert.equal(r.recordedReferenceIsNotEvidenceOfMeasurement,true);}
  assert.equal(milk.universalDensityAssumed,false);assert.equal(milk.massFilledOrReinterpreted,false);
});
test('raw and frozen berry findings retain conflicting values and unknown fiber; equal energy cannot choose turkey identity',()=>{
  const facts=(id:string)=>capture.records.find((r:{ndb:string})=>r.ndb===id).factsPer100GEdible;
  assert.deepEqual([facts('09316').calories,facts('09316').fiber],['32','2.0']);
  assert.deepEqual([facts('09318').calories,facts('09318').fiber],['35','2.1']);assert.equal(facts('09083').fiber,null);
  assert.equal(facts('05219').calories,facts('05710').calories);assert.notEqual(facts('05219').fat,facts('05710').fat);
  assert.notEqual(facts('19165').fiber,facts('19166').fiber);
  assert.equal(audit.cases.find((c:{caseId:string})=>c.caseId==='FROZEN_CURRANT').status,'MISSING_FIBER_AND_FROZEN_SOURCE');
});
test('all stage packets stay outside the actual trusted publication boundary, including forged approval flags',async()=>{
  for(const p of [capture,audit,ledger,milk]){
    assert.equal(p.runtimePublishable,false);assert.equal(p.mayActivate,false);
    await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(JSON.stringify(p),JSON.stringify(p)),/REVIEWED_PUBLICATION_FIELDS_INVALID/);
    const forged={...p,runtimePublishable:true,mayActivate:true};
    await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(JSON.stringify(forged),JSON.stringify(forged)),/REVIEWED_PUBLICATION_FIELDS_INVALID/);
  }
  assert.equal(audit.canonicalIdsIssued,0);assert.equal(audit.reviewReceiptsIssued,0);
  assert.equal(ledger.databaseModified,false);assert.equal(ledger.sourceWorkbookModified,false);assert.equal(ledger.recipeTotalsRecomputed,false);assert.equal(ledger.factsCreated,0);
  assert.equal(ledger.physicalCookingBlocksDevelopment,false);
});
