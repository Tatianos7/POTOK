import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {calculateBatchInputV2,resolveBatchQuantityV1,readPilotBatchEvidenceV1,validatePilotBatchSourcesV1,runPilotSourceQuantityBatchV1,type BatchComponentV2} from './pilot-source-quantity-batch-v1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
const base='docs/premium/retained-sources/pilot-19-source-quantity-20261105/';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const food=():BatchComponentV2=>({rowId:'synthetic_food',status:'DECLARED_SOURCE_INPUT_MODEL',componentKind:'FOOD',sourceRecord:'SR28:05062',
  vector:{calories:'120',protein:'22.5',fat:'2.62',carbs:'0',fiber:'0'},quantityG:'100',quantityDecision:'DECLARED_GRAMS',optional:false});
const water=():BatchComponentV2=>({rowId:'synthetic_water',status:'DECLARED_SOURCE_INPUT_MODEL',componentKind:'POTABLE_WATER',sourceRecord:'SR28:14411',
  vector:{calories:'0',protein:'0',fat:'0',carbs:'0',fiber:'0'},quantityG:null,quantityDecision:'TYPED_WATER_ZERO_NO_GRAM_CONVERSION',optional:false});
test('V2 source-zero water allows exact ingredient INPUT sum without making up grams, density or cooked yield',()=>{
  const rows=[food(),water()],before=JSON.stringify(rows),r=calculateBatchInputV2(rows,2);
  assert.deepEqual(r.wholeInput,{calories:'120.00000000',protein:'22.50000000',fat:'2.62000000',carbs:'0.00000000',fiber:'0.00000000'});
  assert.equal(r.perDeclaredServing?.calories,'60.00000000');assert.equal(rows[1].quantityG,null);assert.equal(JSON.stringify(rows),before);
});
test('water is not a zero-food bypass: wrong identity, nonzero nutrient, missing fiber or fake mass reject',()=>{
  for(const mutate of [
    (r:BatchComponentV2)=>{r.sourceRecord='SR28:04053';},(r:BatchComponentV2)=>{r.vector!.fat='1';},
    (r:BatchComponentV2)=>{Object.assign(r.vector!,{fiber:null});},(r:BatchComponentV2)=>{r.quantityG='100';},
    (r:BatchComponentV2)=>{r.componentKind='FOOD';r.quantityG='100';}
  ]){const r=water();mutate(r);assert.throws(()=>calculateBatchInputV2([food(),r],1));}
  assert.equal(calculateBatchInputV2([water()],1).status,'NO_FOOD_COMPONENT');
});
test('unknown optional salt, milk volume and egg reference mass remain blockers; salt sodium is not assessed',()=>{
  const salt:BatchComponentV2={...water(),rowId:'salt',componentKind:'TABLE_SALT',sourceRecord:'SR28:02047',quantityG:null,quantityDecision:'UNREVIEWED_DISCRETE',optional:true};
  assert.equal(calculateBatchInputV2([food(),salt],1).wholeInput,null);
  assert.equal(calculateBatchInputV2([food(),{...food(),rowId:'milk',quantityG:null}],1).wholeInput,null);
  const known={...salt,quantityG:'2',quantityDecision:'DECLARED_GRAMS'};assert.equal(calculateBatchInputV2([food(),known],1).wholeInput?.calories,'120.00000000');
  assert.throws(()=>calculateBatchInputV2([food(),{...known,sourceRecord:'OTHER_SALT'}],1));
  assert.throws(()=>calculateBatchInputV2([food(),{...known,vector:{...known.vector!,carbs:'1'}}],1));
});
test('bread uses explicit weighed gram authority and instructions, never universal grams per slice',()=>{
  const raw={unit:'PCS',amount:2,weight_g:100,notes:'DISCRETE presentation only',preparation_note:'nutrition authority — exact 100 г'};
  const steps=[{instruction_ru:'Взвесить ровно 100 г хлеба.'}];
  const q=resolveBatchQuantityV1(raw,'EXPLICIT_GRAMS_PIECES_PRESENTATION',steps);assert.equal(q.quantityG,'100');assert.equal(q.measuredMassG,null);
  assert.throws(()=>resolveBatchQuantityV1({...raw,weight_g:99},'EXPLICIT_GRAMS_PIECES_PRESENTATION',steps));
  assert.throws(()=>resolveBatchQuantityV1({...raw,preparation_note:'reference 50 g per slice'},'EXPLICIT_GRAMS_PIECES_PRESENTATION',steps));
  assert.throws(()=>resolveBatchQuantityV1(raw,'EXPLICIT_GRAMS_PIECES_PRESENTATION',[{instruction_ru:'Take two slices.'}]));
  assert.equal(resolveBatchQuantityV1({unit:'PCS',amount:1,weight_g:50},'UNREVIEWED_DISCRETE',[]).quantityG,null);
  assert.equal(resolveBatchQuantityV1({unit:'ML',amount:100,weight_g:100},'UNREVIEWED_VOLUME',[]).quantityG,null);
  assert.throws(()=>resolveBatchQuantityV1({unit:'ML',amount:100,ingredient_name_ru:'Молоко'},'TYPED_WATER_ZERO_NO_GRAM_CONVERSION',[]));
});
test('all-source arithmetic is complete-only; a blocked case never borrows old recipe totals or zero',()=>{
  const f=food();f.status='BLOCKED';assert.equal(calculateBatchInputV2([f,water()],1).wholeInput,null);
  assert.equal(calculateBatchInputV2([food()],null).perDeclaredServing,null);
  assert.throws(()=>calculateBatchInputV2([food(),food()],1));assert.throws(()=>calculateBatchInputV2([],1));
  assert.throws(()=>calculateBatchInputV2([{...food(),quantityG:'0'}],1));
});
test('primary records reproduce facts, roasted groats differ from old generic buckwheat, Foundation strawberry uses exact primary record',()=>{
  const p=validatePilotBatchSourcesV1(readPilotBatchEvidenceV1());
  assert.equal(p.sources.get('SR28:20009')?.calories,'346');assert.equal(p.sources.get('SR28:20009')?.carbs,'64.650');
  assert.equal(p.sources.get('SR28:14411')?.fiber,'0.0');
  assert.deepEqual(p.sources.get('FDC_PRIMARY:747448'),{calories:'31',protein:'0.64',fat:'0.22',carbs:'5.830',fiber:'1.8'});
  assert.equal(p.foundationFindings.length,3);assert.ok(p.foundationFindings.every(f=>f.status==='RETAINED_PRIMARY_LEAD_NOT_ELIGIBLE_OLD_POLICY_OR_GENERIC_CLASS_MAPPING'));
});
test('missing source fiber is not zero; changed facts/raw lines/units/stale bytes and approval claims reject',()=>{
  const reseal=(e:ReturnType<typeof readPilotBatchEvidenceV1>,path:string)=>{
    const r=JSON.parse(e.reviewRaw);r.materials.find((m:{path:string})=>m.path===path).sha256=hash(e.materials[path]);e.reviewRaw=JSON.stringify(r);
  };
  const path=base+'sr28-primary-subset-v1.json';const stale=readPilotBatchEvidenceV1();stale.materials[path]+=' ';assert.throws(()=>validatePilotBatchSourcesV1(stale));
  for(const mutation of ['MISSING','FACT','RAW','APPROVAL']){
    const e=readPilotBatchEvidenceV1(),j=JSON.parse(e.materials[path]);
    if(mutation==='MISSING')j.records[0].factsPer100GEdible.fiber=null;
    if(mutation==='FACT')j.records[0].factsPer100GEdible.fiber='999';
    if(mutation==='RAW')j.records[0].nutrientRecords[0].text='~wrong~^~203~^999';
    if(mutation==='APPROVAL')j.sourceApproved=true;
    e.materials[path]=JSON.stringify(j);reseal(e,path);assert.throws(()=>validatePilotBatchSourcesV1(e));
  }
  const e=readPilotBatchEvidenceV1(),apiPath=base+'fdc-747448-selected-fields-v1.json',j=JSON.parse(e.materials[apiPath]);
  j.foodNutrients.find((n:{nutrient:{number:string}})=>n.nutrient.number==='291').nutrient.unitName='mg';
  e.materials[apiPath]=JSON.stringify(j);reseal(e,apiPath);assert.throws(()=>validatePilotBatchSourcesV1(e));
});
test('all 88 reviews and five owner choices retain blocked sources, including ordinary versus Greek yogurt scope',()=>{
  const e=readPilotBatchEvidenceV1(),r=JSON.parse(e.reviewRaw),owner=JSON.parse(e.materials[base+'owner-states-v1.json']);
  assert.equal(r.rows.length,88);assert.equal(new Set(r.rows.map((r:{ingredientRowId:string})=>r.ingredientRowId)).size,88);
  assert.equal(r.rows.filter((r:{status:string})=>r.status==='DECLARED_SOURCE_INPUT_MODEL').length,65);
  assert.equal(r.rows.filter((r:{status:string})=>r.status==='BLOCKED').length,23);assert.equal(owner.rows.length,5);
  assert.equal(owner.rows.filter((r:{intendedState:string})=>r.intendedState==='ROASTED_BROWN_GROATS').length,3);
  assert.equal(owner.rows.filter((r:{intendedState:string})=>r.intendedState==='NON_YOUNG_PEELED').length,2);
  assert.ok(r.rows.filter((r:{finding:string})=>r.finding==='GENERIC_TVOROG_NO_GO_RETAINED').every((r:{status:string})=>r.status==='BLOCKED'));
  assert.ok(r.rows.filter((r:{finding:string})=>r.finding.startsWith('NATURAL_2_PERCENT')).every((r:{status:string})=>r.status==='BLOCKED'));
  const milk=JSON.parse(e.materials[base+'owner-milk-gram-inputs-v1.json']);assert.equal(milk.rows.length,3);
  assert.equal(milk.notVolumeToMassConversion,true);assert.equal(milk.originalInstructionsChanged,false);assert.equal(milk.measuredMass,false);
  assert.deepEqual(milk.rows.map((r:{newDeclaredGrams:number})=>r.newDeclaredGrams).sort((a:number,b:number)=>a-b),[150,300,400]);
});
test('source reviews and V2 arithmetic cannot enter real runtime publication, including forged flags',async()=>{
  const e=readPilotBatchEvidenceV1(),c=calculateBatchInputV2([food(),water()],2);
  for(const v of [JSON.parse(e.reviewRaw),c,{...c,sourceApproved:true,runtimePublishable:true,mayActivate:true}]){
    const raw=JSON.stringify(v);await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw));
  }
  assert.throws(()=>runPilotSourceQuantityBatchV1('{}','{}'));
});
