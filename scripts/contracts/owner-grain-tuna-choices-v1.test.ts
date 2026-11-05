import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readOwnerGrainTunaEvidenceV1,inspectOwnerGrainTunaSourcesV1,selectOwnedRecipeChoiceViewV1,validateOwnerGrainTunaChoicesV1} from './owner-grain-tuna-choices-v1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const canon=(v:unknown):string=>v!==null&&typeof v==='object'?(Array.isArray(v)?'['+v.map(canon).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon((v as Record<string,unknown>)[k])).join(',')+'}'):JSON.stringify(v);
const base='docs/premium/retained-sources/owner-grain-tuna-20261105/';
function fixture(){
 const e=readOwnerGrainTunaEvidenceV1(),p=JSON.parse(e.ownerRaw);
 const recipes=['oatmeal_pear_walnut','rice_porridge_berries','tuna_tomato_pasta'].map(recipeId=>({recipeId,sourceRecipe:{synthetic:true},steps:[],ingredients:p.rows.filter((r:{recipeId:string})=>r.recipeId===recipeId).map((r:{ingredientRowId:string})=>({ingredient_row_id:r.ingredientRowId,synthetic:true}))}));
 const raw=JSON.stringify({originalAuthoringCatalog:{recipes}});p.candidateBytesSha256=hash(raw);
 for(const b of p.rows){const r=recipes.find(r=>r.recipeId===b.recipeId)!;b.sourceAuthoringRowSha256=hash(canon(r.ingredients.find((i:{ingredient_row_id:string})=>i.ingredient_row_id===b.ingredientRowId)));b.recipeContextSha256=hash(canon({sourceRecipe:r.sourceRecipe,steps:r.steps}));}
 e.ownerRaw=JSON.stringify(p);return {e,p,raw};
}
test('owner answers bind five exact rows/contexts and do not approve sources',()=>{
 const {e,raw}=fixture(),r=validateOwnerGrainTunaChoicesV1(raw,e);assert.equal(r.policy.sourceApproved,false);assert.equal(r.rawRecipes.length,3);
});
test('changed input/context, duplicate or missing binding, changed choice and permission flags fail closed',()=>{
 for(const change of ['HASH','CONTEXT','DUPLICATE','MISSING','CHOICE','PUBLISH']){
  const {e,p,raw}=fixture();if(change==='HASH')p.rows[0].sourceAuthoringRowSha256='0'.repeat(64);
  if(change==='CONTEXT')p.rows[0].recipeContextSha256='0'.repeat(64);if(change==='DUPLICATE')p.rows[1]=p.rows[0];if(change==='MISSING')p.rows.pop();
  if(change==='CHOICE')p.decisions.tunaSalt='WITHOUT_SALT';if(change==='PUBLISH')p.sourceApproved=true;e.ownerRaw=JSON.stringify(p);
  assert.throws(()=>validateOwnerGrainTunaChoicesV1(raw,e));
 }
});
test('material drift, omissions and duplicate JSON keys are rejected',()=>{
 const f=fixture();f.e.materials[base+'fdc-168931-selected-fields-v1.json']+=' ';assert.throws(()=>validateOwnerGrainTunaChoicesV1(f.raw,f.e));
 const g=fixture();g.p.materials.pop();g.e.ownerRaw=JSON.stringify(g.p);assert.throws(()=>validateOwnerGrainTunaChoicesV1(g.raw,g.e));
 const h=fixture();h.e.ownerRaw=h.e.ownerRaw.replace('{','{"contract":"forged",');assert.throws(()=>validateOwnerGrainTunaChoicesV1(h.raw,h.e));
});
test('unenriched pasta has same-source fiber subtraction; missing rice fiber stays unknown; tuna remains only a lead',()=>{
 const r=inspectOwnerGrainTunaSourcesV1(readOwnerGrainTunaEvidenceV1());assert.equal(r.pasta.vector?.carbs,'71.470');assert.equal(r.rice.vector,null);
 assert.equal(r.tuna.vector?.calories,'86');assert.equal(r.tuna.sodiumMgPer100G,247);assert.equal(r.tuna.sourceApproved,false);
});
test('identity substitution, wrong units and manufactured zero rice fiber reject',()=>{
 for(const mode of ['ID','UNIT','ZERO']){const e=readOwnerGrainTunaEvidenceV1(),path=base+'fdc-168931-selected-fields-v1.json',r=JSON.parse(e.materials[path]);
  if(mode==='ID')r.fdcId=168881;if(mode==='UNIT')r.foodNutrients[0].nutrient.unitName='kJ';
  if(mode==='ZERO')r.foodNutrients.push({sourceArrayIndex:100,nutrient:{id:1079,number:'291',unitName:'g'},amount:0});e.materials[path]=JSON.stringify(r);
  assert.throws(()=>inspectOwnerGrainTunaSourcesV1(e));
 }
});
test('salt-free rice selection removes only its optional salt and fixes the instruction without changing original',()=>{
 const r={recipeId:'rice_porridge_berries',ingredients:[{ingredient_row_id:'rice_porridge_berries_ing_01',ingredient_name_ru:'Рис',amount:120,unit:'G',weight_g:120},
 {ingredient_row_id:'rice_porridge_berries_ing_06',ingredient_name_ru:'Соль',optional:true}],steps:[{step_id:'rice_porridge_berries_step_03',instruction_ru:'Снять кашу с огня и при необходимости добавить соль.'}]};
 const before=JSON.stringify(r),v=selectOwnedRecipeChoiceViewV1(r,undefined);assert.equal(v.plannedIngredients.length,1);assert.equal(v.plannedSteps[0].instruction_ru,'Снять кашу с огня.');
 assert.equal(JSON.stringify(r),before);assert.equal(v.sourceApproved,false);assert.equal(v.runtimePublishable,false);
 r.ingredients[1].optional=false;assert.throws(()=>selectOwnedRecipeChoiceViewV1(r,undefined));
});
test('oat selection keeps earlier independently declared milk grams and rejects unhandled salt instructions',()=>{
 const r={recipeId:'oatmeal_pear_walnut',ingredients:[{ingredient_row_id:'oatmeal_pear_walnut_ing_07',ingredient_name_ru:'Соль',optional:true}],steps:[]};
 const prior={plannedIngredients:[{ingredientRowId:'milk',amount:300,unit:'G',declaredGrams:300},{ingredientRowId:'oatmeal_pear_walnut_ing_07'}],plannedSteps:[{instruction_ru:'Добавить молоко и воду.'}]};
 const before=JSON.stringify(prior),v=selectOwnedRecipeChoiceViewV1(r,prior);assert.equal(v.plannedIngredients[0].unit,'G');assert.equal(JSON.stringify(prior),before);
 prior.plannedSteps[0].instruction_ru='Посолить кашу.';assert.throws(()=>selectOwnedRecipeChoiceViewV1(r,prior));
});
test('tuna view requires draining and forbids oil/sauce in the can; olive oil in the recipe is preserved',()=>{
 const r={recipeId:'tuna_tomato_pasta',ingredients:[{ingredient_row_id:'tuna_tomato_pasta_ing_02',ingredient_name_ru:'Тунец',weight_g:240},{ingredient_row_id:'tuna_tomato_pasta_ing_04',ingredient_name_ru:'Масло оливковое',weight_g:10}],steps:[{step_id:'tuna_tomato_pasta_step_02',instruction_ru:'SYNTHETIC'}]};
 const v=selectOwnedRecipeChoiceViewV1(r,undefined);assert.match(String(v.plannedSteps[0].instruction_ru),/240 г рыбы/);assert.equal(v.plannedIngredients[1].declaredGrams,10);assert.equal(v.omittedIngredientRowIds.length,0);
});
test('owner selection and forged flags cannot become runtime publication evidence',async()=>{
 const e=readOwnerGrainTunaEvidenceV1(),r=inspectOwnerGrainTunaSourcesV1(e);
 for(const v of [JSON.parse(e.ownerRaw),r,{...r,sourceApproved:true,runtimePublishable:true}]){const raw=JSON.stringify(v);await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw));}
});
