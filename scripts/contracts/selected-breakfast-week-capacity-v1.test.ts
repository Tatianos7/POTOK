import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {readSelectedBreakfastEvidenceV1,validateSelectedBreakfastEvidenceV1,selectBreakfastVariantV1} from './selected-breakfast-week-capacity-v1';
import {analyzeWeekInputCalorieCapacityV1} from './week-input-calorie-capacity-v1';
import {readBreakfastMainEvidenceV1,mapBreakfastMainSourcesV1} from './breakfast-main-capacity-v1';
import {readPilotBatchEvidenceV1,validatePilotBatchSourcesV1} from './pilot-source-quantity-batch-v1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
const h=(s:string)=>createHash('sha256').update(s).digest('hex');
const canon=(v:unknown):string=>v!==null&&typeof v==='object'?(Array.isArray(v)?'['+v.map(canon).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon((v as Record<string,unknown>)[k])).join(',')+'}'):JSON.stringify(v);
function bindingFixture(){const e=readSelectedBreakfastEvidenceV1(),p=JSON.parse(e.ownerRaw),recipes=p.rows.map((b:{recipeId:string})=>({recipeId:b.recipeId,synthetic:true})),raw=JSON.stringify({originalAuthoringCatalog:{recipes}});p.candidateBytesSha256=h(raw);p.rows.forEach((b:{recipeSha256:string},i:number)=>{b.recipeSha256=h(canon(recipes[i]));});e.ownerRaw=JSON.stringify(p);return {e,p,raw};}
test('explicit reply to two concrete proposals binds only those recipes and does not invent form replies',()=>{const {e,raw}=bindingFixture(),r=validateSelectedBreakfastEvidenceV1(raw,e);assert.equal(r.recipes.length,2);assert.equal(r.policy.sourceApproved,false);});
test('stale recipes, widened scope, missing materials, different milk amounts and inferred yogurt choices reject',()=>{
 for(const mode of ['STALE','SCOPE','MATERIAL','MILK','REPLY','APPROVE']){const {e,p,raw}=bindingFixture();if(mode==='STALE')p.rows[0].recipeSha256='0'.repeat(64);if(mode==='SCOPE')p.scope='ALL_PORRIDGES';if(mode==='MATERIAL')p.materials.pop();if(mode==='MILK')p.decisions.newMilkGramsEachRecipe=400;if(mode==='REPLY')p.unansweredOwnerChoices.cocoaType='NATURAL';if(mode==='APPROVE')p.sourceApproved=true;e.ownerRaw=JSON.stringify(p);assert.throws(()=>validateSelectedBreakfastEvidenceV1(raw,e));}
});
test('byte drift and duplicate decision keys reject',()=>{const a=bindingFixture();a.e.materials[Object.keys(a.e.materials)[0]]+=' ';assert.throws(()=>validateSelectedBreakfastEvidenceV1(a.raw,a.e));const b=bindingFixture();b.e.ownerRaw=b.e.ownerRaw.replace('{','{"scope":"FORGED",');assert.throws(()=>validateSelectedBreakfastEvidenceV1(b.raw,b.e));});
function recipe(){const id='oatmeal_apple_cinnamon';return {recipeId:id,declaredServings:2,ingredients:['Овсяные хлопья','Молоко 2%','Вода','Яблоко','Корица молотая','Соль'].map((name,i)=>({ingredient_row_id:id+'_ing_0'+(i+1),ingredient_name_ru:name,amount:[100,300,200,180,2,null][i],weight_g:[100,null,null,180,2,null][i],unit:[1,2].includes(i)?'ML':'G',optional:i===5})),steps:[{step_id:id+'_step_01',instruction_ru:'Синтетический первый шаг.'},{step_id:id+'_step_04',instruction_ru:'Снять с огня, при необходимости посолить и разделить на 2 порции.'}]};}
const selected=()=>selectBreakfastVariantV1(recipe(),mapBreakfastMainSourcesV1(readBreakfastMainEvidenceV1()),validatePilotBatchSourcesV1(readPilotBatchEvidenceV1()).sources);
test('selected view reconciles grams, salt-free steps and edible apple state while keeping originals immutable',()=>{
 const raw=recipe(),before=JSON.stringify(raw),r=selectBreakfastVariantV1(raw,mapBreakfastMainSourcesV1(readBreakfastMainEvidenceV1()),validatePilotBatchSourcesV1(readPilotBatchEvidenceV1()).sources);assert.equal(r.calculation.perDeclaredServing?.calories,'313.70306150');assert.equal(r.plannedIngredients[1].unit,'G');assert.equal(r.plannedIngredients[1].declaredGrams,300);assert.equal(r.rows[2].component.quantityG,null);assert.match(String(r.plannedIngredients[3].name),/с кожурой/);assert.equal(r.plannedIngredients.length,5);assert.doesNotMatch(String(r.plannedSteps[1].instruction_ru),/посолить/);assert.equal(JSON.stringify(raw),before);assert.equal(r.appliedToOriginal,false);
});
test('unhandled salt/milk instructions, optional foods and unknown water cannot silently enter selected variant',()=>{
 for(const mode of ['STEP','OPTIONAL','WATER']){const r=recipe();if(mode==='STEP')r.steps[0].instruction_ru='Добавить соль и 300 мл молока.';if(mode==='OPTIONAL')r.ingredients[0].optional=true;if(mode==='WATER')r.ingredients[2].amount=null;assert.throws(()=>selectBreakfastVariantV1(r,mapBreakfastMainSourcesV1(readBreakfastMainEvidenceV1()),validatePilotBatchSourcesV1(readPilotBatchEvidenceV1()).sources));}
});
const scenario={dailyCalorieTarget:100,tolerancePercent:0,maxRecipeUses:2,slots:[{label:'meal',sourceCategories:['A']}]};
const pool=(kcal:string)=>Array.from({length:4},(_,i)=>({recipeId:'r'+i,sourceCategory:'A',caloriesPerDeclaredServing:kcal}));
test('weekly optimistic calorie bound proves a deficit and never calls a passing bound feasible',()=>{
 const fail=analyzeWeekInputCalorieCapacityV1(pool('90'),scenario);assert.equal(fail.status,'PROVEN_INSUFFICIENT_WEEK_CALORIES');assert.equal(fail.optimisticMaximumWeekKcal,'630.000');assert.equal(fail.provenWeeklyShortfallKcal,'70.000');
 const pass=analyzeWeekInputCalorieCapacityV1(pool('100'),scenario);assert.equal(pass.status,'NECESSARY_CALORIE_BOUND_PASSED_NOT_FEASIBILITY');assert.equal(pass.fullWeekFeasibilityProven,false);
});
test('calorie bound keeps category capacity separate and selects the highest permitted uses',()=>{
 assert.equal(analyzeWeekInputCalorieCapacityV1(pool('100').slice(0,3),scenario).status,'INSUFFICIENT_RECIPE_REPEAT_CAPACITY');
 const p=pool('10');p[0].caloriesPerDeclaredServing='100';p[1].caloriesPerDeclaredServing='90';p[2].caloriesPerDeclaredServing='80';p[3].caloriesPerDeclaredServing='70';const r=analyzeWeekInputCalorieCapacityV1(p,scenario);assert.equal(r.optimisticMaximumWeekKcal,'610.000');assert.deepEqual(r.certificate[0].optimisticAllocation.map(x=>x.uses),[2,2,2,1]);
});
test('overlapping category groups yield an optimistic bound, not a false feasibility claim',()=>{
 const s={...scenario,maxRecipeUses:7,slots:[{label:'one',sourceCategories:['A']},{label:'two',sourceCategories:['A','B']}]};const r=analyzeWeekInputCalorieCapacityV1([{recipeId:'one',sourceCategory:'A',caloriesPerDeclaredServing:'100'}],s);assert.equal(r.optimisticMaximumWeekKcal,'1400.000');assert.equal(r.fullWeekFeasibilityProven,false);assert.equal(r.assumptions.crossGroupCompetitionIgnoredForUpperBound,true);
});
test('bound uses exactly the existing numeric rounding boundary and rejects invalid inputs',()=>{
 const p=pool('1.2345'),r=analyzeWeekInputCalorieCapacityV1(p,{...scenario,dailyCalorieTarget:1});assert.equal(r.certificate[0].optimisticAllocation[0].caloriesPerServing,(Math.round(Number('1.2345')*1000)/1000).toFixed(3));
 assert.throws(()=>analyzeWeekInputCalorieCapacityV1([p[0],p[0]],scenario));assert.throws(()=>analyzeWeekInputCalorieCapacityV1(pool('-1'),scenario));assert.throws(()=>analyzeWeekInputCalorieCapacityV1(p,{...scenario,maxRecipeUses:0}));assert.throws(()=>analyzeWeekInputCalorieCapacityV1(p,{...scenario,slots:[{label:'x',sourceCategories:['A','A']}]}));
});
test('optimistic bound dominates exhaustive finite weekly assignments in a small synthetic domain',()=>{
 const p=['100','90','80','70'].map((caloriesPerDeclaredServing,i)=>({recipeId:'r'+i,sourceCategory:'A',caloriesPerDeclaredServing})),r=analyzeWeekInputCalorieCapacityV1(p,scenario);let max=0;for(let code=0;code<4**7;code++){let n=code,total=0;const uses=[0,0,0,0];for(let day=0;day<7;day++){const choice=n%4;n=Math.floor(n/4);uses[choice]++;total+=Number(p[choice].caloriesPerDeclaredServing);}if(uses.every(u=>u<=2))max=Math.max(max,total);}assert.equal(r.optimisticMaximumWeekKcal,max.toFixed(3));
});
test('selected variants, diagnostic certificates and forged approvals cannot pass runtime publication decoding',async()=>{
 const a=selected(),b=analyzeWeekInputCalorieCapacityV1(pool('90'),scenario);for(const v of [a,b,{...a,sourceApproved:true,runtimePublishable:true,mayActivate:true}]){const raw=JSON.stringify(v);await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw));}
});
