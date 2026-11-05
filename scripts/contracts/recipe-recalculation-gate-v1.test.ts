import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {calculateCompleteConditionalRecipeInputV1,evaluateRecipeRecalculationV1,readDairyPrimaryRawV1,validateDairyPrimaryV1,type ConditionalRecipeInputV1} from './recipe-recalculation-gate-v1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
const root='docs/premium/retained-sources/dairy-primary-recheck-20261105/';
const row=(id='synthetic'):ConditionalRecipeInputV1=>({rowId:id,optional:false,sourceBinding:'SYNTHETIC_ONLY:PER_100_G_EDIBLE',
  quantityBasis:'RECORDED_EDIBLE_G_CONDITIONAL',grams:'50',blockers:[],
  completeSourceCandidatePer100G:{calories:'35',protein:'0.43',fat:'0.11',carbs:'7.030',fiber:'2.1'}});

test('stage evaluation rejects unbound catalogs/scenarios before trusting any review data',()=>{
  assert.throws(()=>evaluateRecipeRecalculationV1('{"runtimePublishable":true}','{}'),/INVALID_RECIPE_RECALCULATION_INPUT/);
  assert.throws(()=>evaluateRecipeRecalculationV1('{"contract":1,"contract":2}','{}'));
});

test('complete input arithmetic sums five axes before division and preserves source energy',()=>{
  const rows=[row('a'),{...row('b'),grams:'75'}],before=JSON.stringify(rows);
  const result=calculateCompleteConditionalRecipeInputV1(rows,2);
  assert.equal(result.status,'COMPLETE_CONDITIONAL_INGREDIENT_INPUT_ONLY');
  assert.deepEqual(result.wholeInput,{calories:'43.75000000',protein:'0.53750000',fat:'0.13750000',carbs:'8.78750000',fiber:'2.62500000'});
  assert.deepEqual(result.perDeclaredServing,{calories:'21.87500000',protein:'0.26875000',fat:'0.06875000',carbs:'4.39375000',fiber:'1.31250000'});
  assert.equal(JSON.stringify(rows),before);
});
test('rounding occurs once after summing, servings are declared rather than measured',()=>{
  const r=calculateCompleteConditionalRecipeInputV1([{...row(),grams:'1',completeSourceCandidatePer100G:{calories:'1',protein:'0',fat:'0',carbs:'0',fiber:'0'}}],3);
  assert.equal(r.wholeInput?.calories,'0.01000000');assert.equal(r.perDeclaredServing?.calories,'0.00333333');
  assert.equal(calculateCompleteConditionalRecipeInputV1([row()],null).perDeclaredServing,null);
  assert.equal(calculateCompleteConditionalRecipeInputV1([row()],0).perDeclaredServing,null);
});
test('a single missing source, fiber or unresolved class prevents a full total; optional does not mean omitted',()=>{
  for(const partial of [{sourceBinding:null},{completeSourceCandidatePer100G:null},{blockers:['UNKNOWN_DAIRY_CLASS']},{grams:null}]){
    const result=calculateCompleteConditionalRecipeInputV1([row('good'),{...row('bad'),optional:true,...partial}],2);
    assert.equal(result.wholeInput,null);assert.equal(result.perDeclaredServing,null);assert.deepEqual(result.blockedRowIds,['bad']);
  }
  const r=row();Object.assign(r.completeSourceCandidatePer100G!,{fiber:null});
  assert.throws(()=>calculateCompleteConditionalRecipeInputV1([r],1));
});
test('copied milk grams and egg/bread reference weights do not establish volume/discrete basis',()=>{
  for(const quantityBasis of ['UNREVIEWED_VOLUME','UNREVIEWED_DISCRETE','UNKNOWN'] as const){
    assert.equal(calculateCompleteConditionalRecipeInputV1([{...row(),grams:'100',quantityBasis}],1).wholeInput,null);
  }
});
test('missing vectors cannot be replaced by original per-serving references or zero',()=>{
  const r=row();Object.assign(r,{completeSourceCandidatePer100G:null,originalReference:{calories:500}});
  assert.equal(calculateCompleteConditionalRecipeInputV1([r],1).wholeInput,null);
  const zero={...row(),grams:'0'};assert.throws(()=>calculateCompleteConditionalRecipeInputV1([zero],1));
});
test('invalid precision, negative nutrients, duplicate identities and empty recipes fail',()=>{
  for(const value of ['-1','NaN','1e3','0.0001','1000000']){
    const r=row();r.completeSourceCandidatePer100G!.fiber=value;assert.throws(()=>calculateCompleteConditionalRecipeInputV1([r],1));
  }
  assert.throws(()=>calculateCompleteConditionalRecipeInputV1([row(),row()],1));
  assert.throws(()=>calculateCompleteConditionalRecipeInputV1([],1));
});
test('exact primary dairy identities expose the wrong milk identifier and retain distinct yogurt classes',()=>{
  const records=validateDairyPrimaryV1(readDairyPrimaryRawV1()),byId=new Map(records.map(r=>[r.fdcId,r]));
  assert.equal(records.length,4);
  assert.equal(byId.get(171265)?.description,'Milk, whole, 3.25% milkfat, with added vitamin D');
  assert.equal(byId.get(171265)?.factsPer100GEdible.fat,'3.25');
  assert.equal(byId.get(172205)?.ndb,'01174');assert.equal(byId.get(172205)?.factsPer100GEdible.fat,'1.98');
  assert.equal(byId.get(170886)?.ndb,'01117');assert.equal(byId.get(170886)?.factsPer100GEdible.protein,'5.25');
  assert.equal(byId.get(170903)?.ndb,'01287');assert.equal(byId.get(170903)?.factsPer100GEdible.protein,'9.95');
});
test('stale bytes, incorrect units, missing fiber and substituted primary identifier are rejected',()=>{
  const path=root+'fdc-170903-primary-response.json';
  const stale=readDairyPrimaryRawV1();stale[path]+=' ';assert.throws(()=>validateDairyPrimaryV1(stale));
  for(const mutation of ['UNIT','MISSING','IDENTITY']){
    const files=readDairyPrimaryRawV1(),api=JSON.parse(files[path]);
    if(mutation==='UNIT')api.foodNutrients.find((n:{nutrient:{number:string}})=>n.nutrient.number==='291').nutrient.unitName='mg';
    if(mutation==='MISSING')api.foodNutrients=api.foodNutrients.filter((n:{nutrient:{number:string}})=>n.nutrient.number!=='291');
    if(mutation==='IDENTITY')api.fdcId=170886;
    files[path]=JSON.stringify(api);
    const manifest=JSON.parse(files[root+'source-recheck-v1.json']);manifest.records.find((r:{fdcId:number})=>r.fdcId===170903).sha256=createHash('sha256').update(files[path]).digest('hex');
    files[root+'source-recheck-v1.json']=JSON.stringify(manifest);
    assert.throws(()=>validateDairyPrimaryV1(files));
  }
});
test('public captures and conditional calculator cannot enter real runtime publication, even with forged flags',async()=>{
  const calculation=calculateCompleteConditionalRecipeInputV1([row()],2);
  const manifest=JSON.parse(readDairyPrimaryRawV1()[root+'source-recheck-v1.json']);
  for(const value of [calculation,manifest,{...calculation,sourceApproved:true,runtimePublishable:true,mayActivate:true}]){
    const raw=JSON.stringify(value);await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw),/REVIEWED_PUBLICATION_FIELDS_INVALID/);
  }
});
