import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {calculatePreciseInputV3,readFoundationReviewEvidenceV1,mapFoundationOatsSourceV1,buildOwnedRecipeVariantV1,runFoundationVariantsReviewV1} from './foundation-variants-review-v1';
import type {BatchComponentV2} from './pilot-source-quantity-batch-v1';
import {calculateCompleteConditionalRecipeInputV1} from './recipe-recalculation-gate-v1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const canon=(v:unknown):string=>v!==null&&typeof v==='object'?(Array.isArray(v)?'['+v.map(canon).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon((v as Record<string,unknown>)[k])).join(',')+'}'):JSON.stringify(v);
const food=():BatchComponentV2=>({rowId:'synthetic',status:'DECLARED_SOURCE_INPUT_MODEL',componentKind:'FOOD',sourceRecord:'SYNTHETIC_PRECISE_SOURCE',
  vector:{calories:'378.866123',protein:'13.49645',fat:'5.89',carbs:'58.23755',fiber:'10.42'},quantityG:'100',quantityDecision:'DECLARED_GRAMS',optional:false});
test('V3 preserves source precision through summation and divides before rounding; V1 remains unchanged',()=>{
  const r=calculatePreciseInputV3([food()],2);
  assert.deepEqual(r.wholeInput,{calories:'378.86612300',protein:'13.49645000',fat:'5.89000000',carbs:'58.23755000',fiber:'10.42000000'});
  assert.equal(r.perDeclaredServing?.calories,'189.43306150');assert.equal(r.perDeclaredServing?.protein,'6.74822500');
  assert.throws(()=>calculateCompleteConditionalRecipeInputV1([{rowId:'old',optional:false,sourceBinding:'source',quantityBasis:'RECORDED_EDIBLE_G_CONDITIONAL',grams:'100',completeSourceCandidatePer100G:food().vector,blockers:[]}],2));
  const tiny={...food(),quantityG:'1',vector:{calories:'0.00000051',protein:'0',fat:'0',carbs:'0',fiber:'0'}};
  assert.equal(calculatePreciseInputV3([tiny],1).wholeInput?.calories,'0.00000001');
  assert.equal(calculatePreciseInputV3([tiny],2).perDeclaredServing?.calories,'0.00000000');
});
test('unknown optional salt/servings and typed-water identity protections survive V3',()=>{
  const salt={...food(),rowId:'salt',optional:true,componentKind:'TABLE_SALT' as const,quantityG:null};
  assert.equal(calculatePreciseInputV3([food(),salt],1).wholeInput,null);assert.equal(calculatePreciseInputV3([food()],null).perDeclaredServing,null);
  const water:BatchComponentV2={...food(),rowId:'water',componentKind:'POTABLE_WATER',sourceRecord:'SR28:14411',quantityG:null,
    quantityDecision:'TYPED_WATER_ZERO_NO_GRAM_CONVERSION',vector:{calories:'0',protein:'0',fat:'0',carbs:'0',fiber:'0'}};
  assert.deepEqual(calculatePreciseInputV3([food(),water],1).wholeInput,calculatePreciseInputV3([food()],1).wholeInput);
  assert.throws(()=>calculatePreciseInputV3([food(),{...water,sourceRecord:'MILK'}],1));
  assert.throws(()=>calculatePreciseInputV3([food(),{...water,quantityG:'100'}],1));
  assert.throws(()=>calculatePreciseInputV3([{...food(),vector:{...food().vector!,fiber:'0.000000001'}}],1));
  assert.throws(()=>calculatePreciseInputV3([food(),food()],1));
});
test('oat policy explicitly selects source-specific kcal and same-source AOAC total fiber, preserving alternate energy',()=>{
  const o=mapFoundationOatsSourceV1(readFoundationReviewEvidenceV1());
  assert.equal(o.vector.calories,'378.866123');assert.equal(o.vector.protein,'13.49645');assert.equal(o.vector.carbs,'58.23755000');
  assert.equal(o.vector.fiber,'10.42');assert.equal(o.selectedEnergyNutrientId,2048);assert.equal(o.alternateEnergy.value,'381.626');
  assert.equal(o.sourceApproved,false);assert.equal(o.runtimePublishable,false);
});
test('policy cannot widen to potatoes, forge owner responses, alter units, replace fiber or omit byte bindings',()=>{
  for(const mutate of [
    (p:Record<string,unknown>)=>{p.fdcId=2346401;},(p:Record<string,unknown>)=>{p.fiberNutrientId=1079;},
    (p:Record<string,unknown>)=>{p.selectedEnergyNutrientId=2047;},(p:Record<string,unknown>)=>{p.sourceApproved=true;},
    (p:Record<string,unknown>)=>{p.materials=[];},(p:Record<string,unknown>)=>{p.unansweredOwnerChoices={porridgeSalt:'APPROVED'};}
  ]){const e=readFoundationReviewEvidenceV1(),p=JSON.parse(e.policyRaw);mutate(p);e.policyRaw=JSON.stringify(p);assert.throws(()=>mapFoundationOatsSourceV1(e));}
  const path='docs/premium/retained-sources/pilot-19-source-quantity-20261105/fdc-2346396-selected-fields-v1.json';
  for(const change of ['UNIT','NULL','IDENTITY']){
    const e=readFoundationReviewEvidenceV1(),c=JSON.parse(e.materials[path]),p=JSON.parse(e.policyRaw);
    if(change==='UNIT')c.foodNutrients.find((n:{nutrient:{id:number}})=>n.nutrient.id===2033).nutrient.unitName='mg';
    if(change==='NULL')c.foodNutrients.find((n:{nutrient:{id:number}})=>n.nutrient.id===2033).amount=null;
    if(change==='IDENTITY')c.description='Potatoes, raw';
    e.materials[path]=JSON.stringify(c);p.materials.find((m:{path:string})=>m.path===path).sha256=hash(e.materials[path]);e.policyRaw=JSON.stringify(p);
    assert.throws(()=>mapFoundationOatsSourceV1(e));
  }
});
function recipeFixture(){
  const recipe={recipeId:'synthetic_recipe',sourceRecipe:{owner_notes:'SYNTHETIC_PRIVATE_NOTE'},ingredients:[{ingredient_row_id:'milk',ingredient_name_ru:'Молоко 2%',unit:'ML',amount:100,weight_g:null}],
    steps:[{step_id:'s1',instruction_ru:'Добавить 100 мл молока и 50 мл воды.'}]};
  const revision={recipeId:'synthetic_recipe',ingredientRowId:'milk',sourceAuthoringRowSha256:hash(canon(recipe.ingredients[0])),
    recipeContextSha256:hash(canon({sourceRecipe:recipe.sourceRecipe,steps:recipe.steps})),newDeclaredGrams:125};
  return {recipe,revision};
}
test('milk instruction variant uses independently declared grams and leaves original milk/water instructions intact',()=>{
  const f=recipeFixture(),before=JSON.stringify(f),v=buildOwnedRecipeVariantV1(f.recipe,[f.revision],[]);
  assert.equal(v.plannedIngredients[0].amount,125);assert.equal(v.plannedIngredients[0].unit,'G');
  assert.equal(v.plannedSteps[0].instruction_ru,'Добавить 125 г молока и 50 мл воды.');assert.equal(v.measuredMass,false);assert.equal(v.appliedToOriginal,false);
  assert.equal(JSON.stringify(f),before);assert.equal(v.runtimePublishable,false);
});
test('stale owner context or unhandled milk-volume text rejects rather than silently converting it',()=>{
  const f=recipeFixture();assert.throws(()=>buildOwnedRecipeVariantV1(f.recipe,[{...f.revision,recipeContextSha256:'a'.repeat(64)}],[]));
  f.recipe.steps[0].instruction_ru='Добавить 120 мл молока.';
  f.revision.recipeContextSha256=hash(canon({sourceRecipe:f.recipe.sourceRecipe,steps:f.recipe.steps}));
  assert.throws(()=>buildOwnedRecipeVariantV1(f.recipe,[f.revision],[]));
  f.recipe.steps[0].instruction_ru='Добавить 1100 мл молока.';
  f.revision.recipeContextSha256=hash(canon({sourceRecipe:f.recipe.sourceRecipe,steps:f.recipe.steps}));
  assert.throws(()=>buildOwnedRecipeVariantV1(f.recipe,[f.revision],[]));
});
test('owned potato/groat descriptions become consistent variant views without peel-yield factors or original mutation',()=>{
  const r={recipeId:'synthetic',sourceRecipe:{},ingredients:[{ingredient_row_id:'potato',ingredient_name_ru:'Potato',amount:100,unit:'G',weight_g:100},
    {ingredient_row_id:'groat',ingredient_name_ru:'Groat',amount:100,unit:'G',weight_g:100}],steps:[{step_id:'s',instruction_ru:'SYNTHETIC_PRIVATE_STEP'}]};
  const context=hash(canon({sourceRecipe:r.sourceRecipe,steps:r.steps})),before=JSON.stringify(r);
  const states=r.ingredients.map((i,n)=>({recipeId:r.recipeId,ingredientRowId:i.ingredient_row_id,sourceAuthoringRowSha256:hash(canon(i)),
    recipeContextSha256:context,intendedState:n===0?'NON_YOUNG_PEELED':'ROASTED_BROWN_GROATS'}));
  const v=buildOwnedRecipeVariantV1(r,[],states);
  assert.equal(v.plannedIngredients[0].declaredGrams,100);assert.equal(v.plannedIngredients[1].declaredGrams,100);
  assert.match(String(v.plannedIngredients[0].name),/очищенный/);assert.match(String(v.plannedIngredients[1].name),/обжаренная/);
  assert.match(String(v.plannedSteps[0].instruction_ru),/перед взвешиванием/);assert.equal(JSON.stringify(r),before);
});
test('precise arithmetic and method policy cannot pass the real runtime publication decoder',async()=>{
  const o=mapFoundationOatsSourceV1(readFoundationReviewEvidenceV1()),r=calculatePreciseInputV3([food()],2);
  for(const v of [o,r,{...r,sourceApproved:true,runtimePublishable:true,mayActivate:true}]){const raw=JSON.stringify(v);await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw));}
  assert.throws(()=>runFoundationVariantsReviewV1('{}','{}'));
});
