import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {readBreakfastMainEvidenceV1,validateBreakfastMainBindingsV1,mapBreakfastMainSourcesV1,modelPinnedMainV1,prepareBreakfastProposalV1} from './breakfast-main-capacity-v1';
import {readPilotBatchEvidenceV1,validatePilotBatchSourcesV1} from './pilot-source-quantity-batch-v1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
const base='docs/premium/retained-sources/breakfast-main-capacity-20261105/';
const h=(s:string)=>createHash('sha256').update(s).digest('hex');
const canon=(v:unknown):string=>v!==null&&typeof v==='object'?(Array.isArray(v)?'['+v.map(canon).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon((v as Record<string,unknown>)[k])).join(',')+'}'):JSON.stringify(v);
const sources=()=>mapBreakfastMainSourcesV1(readBreakfastMainEvidenceV1()),existing=()=>validatePilotBatchSourcesV1(readPilotBatchEvidenceV1()).sources;
function fixture(){const e=readBreakfastMainEvidenceV1(),p=JSON.parse(e.bindingsRaw),recipes=p.rows.map((b:{recipeId:string})=>({recipeId:b.recipeId,ingredients:[],steps:[],synthetic:true})),raw=JSON.stringify({originalAuthoringCatalog:{recipes}});p.candidateBytesSha256=h(raw);p.rows.forEach((b:{recipeSha256:string},i:number)=>{b.recipeSha256=h(canon(recipes[i]));});e.bindingsRaw=JSON.stringify(p);return {e,p,raw};}
test('five exact bindings preserve three-main/two-unselected-proposal scope',()=>{const {e,raw}=fixture();assert.equal(validateBreakfastMainBindingsV1(raw,e).recipes.length,5);});
test('stale or duplicate recipes, inferred owner replies and changed oat scope reject',()=>{
 for(const mode of ['STALE','DUPLICATE','REPLY','OAT_SCOPE','APPROVE']){const {e,p,raw}=fixture();if(mode==='STALE')p.rows[0].recipeSha256='0'.repeat(64);if(mode==='DUPLICATE')p.rows[1]=p.rows[0];if(mode==='REPLY')p.unansweredOwnerChoices.applePeel='WITH_SKIN';if(mode==='OAT_SCOPE')p.oatProposalPolicy.scope='GLOBAL';if(mode==='APPROVE')p.sourceApproved=true;e.bindingsRaw=JSON.stringify(p);assert.throws(()=>validateBreakfastMainBindingsV1(raw,e));}
});
test('missing material, byte drift and duplicate JSON keys reject',()=>{
 const a=fixture();a.p.materials.pop();a.e.bindingsRaw=JSON.stringify(a.p);assert.throws(()=>validateBreakfastMainBindingsV1(a.raw,a.e));
 const b=fixture();b.e.materials[base+'fdc-169986-selected-fields-v1.json']+=' ';assert.throws(()=>validateBreakfastMainBindingsV1(b.raw,b.e));
 const c=fixture();c.e.bindingsRaw=c.e.bindingsRaw.replace('{','{"scope":"FORGED",');assert.throws(()=>validateBreakfastMainBindingsV1(c.raw,c.e));
});
test('raw source identities and same-record fiber preserve source energy',()=>{
 const s=sources();assert.equal(s.cauliflower.calories,'25');assert.equal(s.cauliflower.carbs,'2.97000000');assert.equal(s.pumpkin.carbs,'6.00000000');assert.equal(s.trout.calories,'119');assert.equal(s.beans.fiber,'2.7');assert.equal(s.oatProposalOnly.calories,'378.866123');
});
test('farmed trout substitution, missing fiber, wrong units and negative available carbohydrate reject',()=>{
 for(const mode of ['IDENTITY','FIBER','UNIT','NEGATIVE']){const e=readBreakfastMainEvidenceV1(),path=base+'fdc-175154-selected-fields-v1.json',c=JSON.parse(e.materials[path]);if(mode==='IDENTITY')c.description='Fish, trout, rainbow, farmed, raw';if(mode==='FIBER')c.foodNutrients=c.foodNutrients.filter((n:{nutrient:{id:number}})=>n.nutrient.id!==1079);if(mode==='UNIT')c.foodNutrients[0].nutrient.unitName='kJ';if(mode==='NEGATIVE')c.foodNutrients.find((n:{nutrient:{id:number}})=>n.nutrient.id===1079).amount=10;e.materials[path]=JSON.stringify(c);assert.throws(()=>mapBreakfastMainSourcesV1(e));}
});
function main(){const id='chicken_breast_cauliflower';return {recipeId:id,declaredServings:2,ingredients:['chicken_breast_skinless','cauliflower','onion','olive_oil','water','salt'].map((name,i)=>({ingredient_row_id:id+'_ing_0'+(i+1),ingredient_name_en:name,amount:[300,500,100,10,100,2][i],weight_g:[300,500,100,10,100,2][i],unit:i===4?'ML':'G',optional:false}))};}
test('main ingredient input sum preserves salt and ignores invented water gram references',()=>{
 const r=main(),before=JSON.stringify(r),s=modelPinnedMainV1(r,sources(),existing());assert.equal(s.calculation.perDeclaredServing?.calories,'306.70000000');assert.equal(s.rows[5].component.quantityG,'2');assert.equal(s.rows[4].component.quantityG,null);assert.equal(JSON.stringify(r),before);
 r.ingredients[4].weight_g=99999;assert.deepEqual(modelPinnedMainV1(r,sources(),existing()).calculation,s.calculation);
 r.ingredients[0].unit='PCS';assert.equal(modelPinnedMainV1(r,sources(),existing()).calculation.perDeclaredServing,null);
});
function breakfast(){const id='oatmeal_apple_cinnamon';return {recipeId:id,declaredServings:2,ingredients:['Овсяные хлопья','Молоко 2%','Вода','Яблоко','Корица молотая','Соль'].map((name,i)=>({ingredient_row_id:id+'_ing_0'+(i+1),ingredient_name_ru:name,amount:[100,300,200,180,2,null][i],weight_g:[100,null,null,180,2,null][i],unit:[1,2].includes(i)?'ML':'G',optional:i===5}))};}
test('breakfast proposal is explicitly unselected and does not change original milk/salt/apple states',()=>{
 const r=breakfast(),before=JSON.stringify(r),p=prepareBreakfastProposalV1(r,sources(),existing());assert.equal(p.selectionStatus,'UNSELECTED_NO_OWNER_REPLY');assert.equal(p.excludedFromSearch,true);assert.equal(p.calculation.perDeclaredServing?.calories,'313.70306150');assert.equal(p.assumptions.notVolumeToMassConversion,true);assert.equal(JSON.stringify(r),before);assert.equal(r.ingredients.length,6);assert.equal(r.ingredients[1].unit,'ML');
 r.ingredients[5].optional=false;assert.throws(()=>prepareBreakfastProposalV1(r,sources(),existing()));
});
test('unexpected ingredient states and wrong recipe scope cannot enter main model',()=>{
 const r=main();r.ingredients[1].ingredient_name_en='frozen_cauliflower';assert.throws(()=>modelPinnedMainV1(r,sources(),existing()));assert.throws(()=>modelPinnedMainV1({...r,recipeId:'other'},sources(),existing()));
});
test('new models, proposals and forged approval flags fail real runtime publication decoding',async()=>{
 const s=modelPinnedMainV1(main(),sources(),existing()),p=prepareBreakfastProposalV1(breakfast(),sources(),existing());for(const v of [s,p,{...s,sourceApproved:true,runtimePublishable:true,mayActivate:true}]){const raw=JSON.stringify(v);await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw));}
});
