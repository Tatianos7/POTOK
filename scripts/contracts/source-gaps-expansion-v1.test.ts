import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readSourceExpansionEvidenceV1,mapExpansionPrimarySourcesV1,reviewAdditionalRecipeV1,validateSourceExpansionBindingsV1} from './source-gaps-expansion-v1';
import {readPilotBatchEvidenceV1,validatePilotBatchSourcesV1} from './pilot-source-quantity-batch-v1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
const base='docs/premium/retained-sources/source-gaps-expansion-20261105/';
const h=(s:string)=>createHash('sha256').update(s).digest('hex');
const canon=(v:unknown):string=>v!==null&&typeof v==='object'?(Array.isArray(v)?'['+v.map(canon).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon((v as Record<string,unknown>)[k])).join(',')+'}'):JSON.stringify(v);
const sources=()=>mapExpansionPrimarySourcesV1(readSourceExpansionEvidenceV1());
const existing=()=>validatePilotBatchSourcesV1(readPilotBatchEvidenceV1()).sources;
function fixture(){
 const e=readSourceExpansionEvidenceV1(),p=JSON.parse(e.bindingsRaw),recipes=p.rows.map((b:{recipeId:string;ingredientRows:{ingredientRowId:string}[]})=>({recipeId:b.recipeId,ingredients:b.ingredientRows.map(i=>({ingredient_row_id:i.ingredientRowId,synthetic:true})),steps:[]}));
 const raw=JSON.stringify({originalAuthoringCatalog:{recipes}});p.candidateBytesSha256=h(raw);
 for(let i=0;i<p.rows.length;i++){p.rows[i].recipeSha256=h(canon(recipes[i]));for(let n=0;n<p.rows[i].ingredientRows.length;n++)p.rows[i].ingredientRows[n].sha256=h(canon(recipes[i].ingredients[n]));}
 e.bindingsRaw=JSON.stringify(p);return {e,p,raw};
}
test('four additional recipe bindings preserve scope, rows and unanswered owner choices',()=>{
 const {e,raw}=fixture();assert.equal(validateSourceExpansionBindingsV1(raw,e).recipes.length,4);
});
test('stale recipe, missing/duplicate binding, forged owner answer and permission flags fail closed',()=>{
 for(const mode of ['STALE','MISSING','DUPLICATE','REPLY','APPROVE']){const {e,p,raw}=fixture();
 if(mode==='STALE')p.rows[0].recipeSha256='0'.repeat(64);if(mode==='MISSING')p.rows[0].ingredientRows.pop();if(mode==='DUPLICATE')p.rows[1]=p.rows[0];
 if(mode==='REPLY')p.unansweredOwnerChoices.cocoaType='NATURAL_APPROVED';if(mode==='APPROVE')p.mayActivate=true;e.bindingsRaw=JSON.stringify(p);assert.throws(()=>validateSourceExpansionBindingsV1(raw,e));}
});
test('byte drift, missing material and duplicate raw JSON keys fail closed',()=>{
 const a=fixture();a.e.materials[base+'tuna-sodium-class-facts-v1.json']+=' ';assert.throws(()=>validateSourceExpansionBindingsV1(a.raw,a.e));
 const b=fixture();b.p.materials.pop();b.e.bindingsRaw=JSON.stringify(b.p);assert.throws(()=>validateSourceExpansionBindingsV1(b.raw,b.e));
 const c=fixture();c.e.bindingsRaw=c.e.bindingsRaw.replace('{','{"scope":"FORGED",');assert.throws(()=>validateSourceExpansionBindingsV1(c.raw,c.e));
});
test('raw almond source uses specific energy and same-record fiber; prepared edamame and raw lemon stay distinct',()=>{
 const s=sources();assert.equal(s.almond.calories,'583.597022');assert.equal(s.almond.carbs,'9.25462000');assert.equal(s.edamame.calories,'121');assert.equal(s.lemon.calories,'22');
 assert.equal(s.tuna.calories,'86');assert.equal(s.tunaConditions.ownJuiceEquivalent,false);assert.equal(s.rice.fiber,null);
});
test('source identity, energy units, missing fiber and alternate energy tampering reject',()=>{
 for(const mode of ['ID','UNIT','FIBER','ALT']){const e=readSourceExpansionEvidenceV1(),path=base+'fdc-2346393-selected-fields-v1.json',c=JSON.parse(e.materials[path]);
 if(mode==='ID')c.fdcId=170567;if(mode==='UNIT')c.foodNutrients.find((n:{nutrient:{id:number}})=>n.nutrient.id===2048).nutrient.unitName='kJ';
 if(mode==='FIBER')c.foodNutrients=c.foodNutrients.filter((n:{nutrient:{id:number}})=>n.nutrient.id!==1079);if(mode==='ALT')c.foodNutrients=c.foodNutrients.filter((n:{nutrient:{id:number}})=>n.nutrient.id!==2047);
 e.materials[path]=JSON.stringify(c);assert.throws(()=>mapExpansionPrimarySourcesV1(e));}
});
test('salted tuna needs exact NDB baseline linkage and does not acquire own-juice or brand equivalence',()=>{
 for(const mode of ['CODE','BASELINE','OWN_JUICE','APPROVED']){const e=readSourceExpansionEvidenceV1(),path=base+'tuna-sodium-class-facts-v1.json',c=JSON.parse(e.materials[path]);
 if(mode==='CODE')c.facts[1].ndb='15184';if(mode==='BASELINE')c.facts[1].baselineSodiumMgPer100G=195;if(mode==='OWN_JUICE')c.ownJuiceEquivalenceEstablished=true;if(mode==='APPROVED')c.sourceApproved=true;
 e.materials[path]=JSON.stringify(c);assert.throws(()=>mapExpansionPrimarySourcesV1(e));}
});
function snack(id:string){return {recipeId:id,declaredServings:1,ingredients:(id==='pear_almonds'?[['fresh_pear',180],['raw_unsalted_almonds',20]]:[['frozen_shelled_edamame_prepared',150],['fresh_lemon_juice',10]]).map(([name,g],i)=>({ingredient_row_id:id+'_ing_0'+(i+1),ingredient_name_en:name,amount:g,weight_g:g,unit:'G',optional:false}))};}
test('two existing snack recipes calculate without mass conversion or mutation',()=>{
 const a=snack('pear_almonds'),b=snack('lemon_shelled_edamame'),before=JSON.stringify([a,b]);
 assert.equal(reviewAdditionalRecipeV1(a,sources(),existing()).calculation.perDeclaredServing?.calories,'219.31940440');
 assert.equal(reviewAdditionalRecipeV1(b,sources(),existing()).calculation.perDeclaredServing?.calories,'183.70000000');assert.equal(JSON.stringify([a,b]),before);
 a.ingredients[1].ingredient_name_en='roasted_salted_almonds';assert.throws(()=>reviewAdditionalRecipeV1(a,sources(),existing()));
 b.ingredients[0].unit='PCS';assert.equal(reviewAdditionalRecipeV1(b,sources(),existing()).calculation.perDeclaredServing,null);
});
test('additional breakfasts do not inherit other recipe salt/milk/oat decisions or turn ML into grams',()=>{
 const id='oatmeal_apple_cinnamon',r={recipeId:id,declaredServings:2,ingredients:['Овсяные хлопья','Молоко 2%','Вода','Яблоко','Корица молотая','Соль'].map((name,i)=>({ingredient_row_id:id+'_ing_0'+(i+1),ingredient_name_ru:name,unit:[1,2].includes(i)?'ML':'G',amount:i===5?null:100,weight_g:[1,2,5].includes(i)?null:100,optional:i===5}))};
 const x=reviewAdditionalRecipeV1(r,sources(),existing());assert.equal(x.calculation.perDeclaredServing,null);assert.equal(x.rows[1].component.quantityG,null);assert.equal(x.rows[5].component.optional,true);assert.equal(x.rows.length,6);
 assert.equal(x.rows[2].component.quantityG,null);assert.equal(x.rows[2].component.componentKind,'POTABLE_WATER');assert.equal(x.rows[0].component.status,'BLOCKED');
});
test('new source models and forged approval flags cannot pass real runtime publication decoding',async()=>{
 const s=sources();for(const value of [s,{...s,sourceApproved:true,runtimePublishable:true,mayActivate:true}]){const raw=JSON.stringify(value);await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw));}
});
