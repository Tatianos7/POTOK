/** Exact conditional PLAN input arithmetic. Unmounted; never Graph/publication/entitlement or FACT authority. */
import {canonicalJsonV1,adaptiveNutritionSha256HexV1} from '../utils/adaptiveNutritionWireV1';
import {parseFoodNutritionSourceBindingJsonRawV2 as parse} from '../utils/foodNutritionSourceBindingV2';
import {decodeExactScalarV2,divideExactScalarsV2,multiplyExactScalarsV2,addExactScalarsV2,
  scaleExactNutritionValuesV2,sumExactNutritionValuesV2,exactNutritionValuesCanonicalRawV2,
  type ExactScalarV2,type ExactNutritionValuesV2} from '../utils/exactNutritionValuesV2';
import {ownExactTypedRecipeContextsV3,prepareExactTypedRecipeRawV3,type ExactTypedRecipeContextV3,
  type ExactTypedRecipeAuthorityV3,type ExactTypedRecipeSnapshotV3} from './exactTypedRecipePreparationV3';
export const exactWeekNutritionRequestContractV3='potok-exact-week-input-nutrition-request-v3' as const;
export const exactWeekNutritionSnapshotContractV3='potok-exact-week-input-nutrition-snapshot-v3' as const;
export const exactWeekNutritionEncodingV3='potok-exact-week-input-nutrition-json-v3' as const;
export const exactWeekNutritionBudgetsV3=Object.freeze({recipes:64,days:7,mealsPerDay:8,componentsPerMeal:8,placements:128,ingredientPlacements:1024,rawBytes:262144});
type MealType='breakfast'|'lunch'|'dinner'|'snack';
export interface ExactWeekRecipeReferenceV3{readonly recipeKey:string;readonly requestDigest:string;readonly snapshotDigest:string}
export interface ExactWeekComponentRequestV3{
  readonly componentKey:string;readonly recipeKey:string;
  readonly portion:{readonly kind:'FRACTION_OF_WHOLE'|'DECLARED_SERVINGS';readonly amount:ExactScalarV2};
}
export interface ExactWeekMealRequestV3{readonly slotId:string;readonly mealType:MealType;readonly components:readonly ExactWeekComponentRequestV3[]}
export interface ExactWeekNutritionRequestV3{
  readonly contract:typeof exactWeekNutritionRequestContractV3;readonly encoding:typeof exactWeekNutritionEncodingV3;
  readonly accountId:string;readonly selectionId:string;readonly weekStartLocal:string;readonly timezone:string;
  readonly recipes:readonly ExactWeekRecipeReferenceV3[];readonly days:readonly {readonly date:string;readonly meals:readonly ExactWeekMealRequestV3[]}[];
}
export interface ExactWeekRecipeInputV3{readonly recipeKey:string;readonly requestRaw:string;readonly contexts:readonly ExactTypedRecipeContextV3[]}
interface UnknownMassItem{readonly slotId:string;readonly componentKey:string;readonly rowId:string}
interface InputMassSummary{readonly knownGrams:ExactScalarV2;readonly totalGrams:ExactScalarV2|null;readonly unknownItems:readonly UnknownMassItem[]}
export interface ExactWeekComponentSnapshotV3{
  readonly componentKey:string;readonly recipeKey:string;readonly recipeSnapshotDigest:string;readonly wholeRecipeMultiplier:ExactScalarV2;
  readonly ingredients:readonly {readonly rowId:string;readonly inputKind:'FOOD'|'POTABLE_WATER'|'SALT';readonly unit:'g'|'ml';
    readonly amount:ExactScalarV2;readonly massGrams:ExactScalarV2|null;readonly nutrition:ExactNutritionValuesV2}[];
  readonly nutrition:ExactNutritionValuesV2;readonly inputMass:InputMassSummary;
}
export interface ExactWeekMealSnapshotV3{readonly slotId:string;readonly mealType:MealType;readonly components:readonly ExactWeekComponentSnapshotV3[];readonly nutrition:ExactNutritionValuesV2;readonly inputMass:InputMassSummary}
export interface ExactWeekDaySnapshotV3{readonly date:string;readonly meals:readonly ExactWeekMealSnapshotV3[];readonly nutrition:ExactNutritionValuesV2;readonly inputMass:InputMassSummary}
export interface ExactWeekNutritionSnapshotV3{
  readonly contract:typeof exactWeekNutritionSnapshotContractV3;readonly encoding:typeof exactWeekNutritionEncodingV3;
  readonly authority:'NONE';readonly purpose:'CONDITIONAL_PLAN_INPUT_ARITHMETIC';readonly facts:readonly [];
  readonly request:ExactWeekNutritionRequestV3;readonly requestDigest:string;
  readonly sourceRecipes:readonly {readonly recipeKey:string;readonly requestDigest:string;readonly snapshotDigest:string;readonly authoringRecipeId:string;readonly authoringRevision:string}[];
  readonly days:readonly ExactWeekDaySnapshotV3[];readonly nutrition:ExactNutritionValuesV2;readonly inputMass:InputMassSummary;readonly digest:string;
}
export type ExactWeekNutritionResultV3={readonly kind:'PREPARED_EXACT_WEEK_INPUTS_V3';readonly snapshot:ExactWeekNutritionSnapshotV3}
 |{readonly kind:'BLOCKED';readonly reason:'REQUEST_INVALID_OR_CHANGED'|'RECIPE_EVIDENCE_UNAVAILABLE_OR_MISMATCHED'|'PORTION_UNAVAILABLE'|'CALCULATION_BUDGET_OR_INCONSISTENCY'};
function fail():never{throw Error('EXACT_WEEK_NUTRITION_INVALID');}
function fields(v:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.prototype.hasOwnProperty.call(v,k)))fail();return v as Record<string,unknown>;
}
function token(v:unknown):string{if(typeof v!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(v))fail();return v;}
function uuid(v:unknown):string{if(typeof v!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v))fail();return v;}
function hash(v:unknown):string{if(typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))fail();return v;}
function list(v:unknown,max:number):unknown[]{if(!Array.isArray(v)||!v.length||v.length>max)fail();return v;}
function date(v:unknown):string{
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T00:00:00.000Z'))||new Date(v+'T00:00:00.000Z').toISOString().slice(0,10)!==v)fail();return v;
}
function offsetDate(start:string,offset:number):string{const d=new Date(start+'T00:00:00.000Z');d.setUTCDate(d.getUTCDate()+offset);return date(d.toISOString().slice(0,10));}
function timezone(v:unknown):string{if(typeof v!=='string'||v.length>64||!/^[A-Za-z0-9_+\-/]+$/.test(v))fail();new Intl.DateTimeFormat('en',{timeZone:v});return v;}
async function digest(domain:string,payload:unknown):Promise<string>{return adaptiveNutritionSha256HexV1(new TextEncoder().encode(canonicalJsonV1({domain,payload})));}
export function decodeExactWeekNutritionRequestRawV3(raw:string):ExactWeekNutritionRequestV3{
 const r=fields(parse(raw),['contract','encoding','accountId','selectionId','weekStartLocal','timezone','recipes','days']);
 if(r.contract!==exactWeekNutritionRequestContractV3||r.encoding!==exactWeekNutritionEncodingV3)fail();
 const weekStartLocal=date(r.weekStartLocal);if(new Date(weekStartLocal+'T00:00:00.000Z').getUTCDay()!==1)fail();
 const recipes=list(r.recipes,64).map(v=>{const b=fields(v,['recipeKey','requestDigest','snapshotDigest']);return Object.freeze({recipeKey:token(b.recipeKey),requestDigest:hash(b.requestDigest),snapshotDigest:hash(b.snapshotDigest)});});
 if(new Set(recipes.map(r=>r.recipeKey)).size!==recipes.length||new Set(recipes.map(r=>r.snapshotDigest)).size!==recipes.length||new Set(recipes.map(r=>r.requestDigest)).size!==recipes.length)fail();
 const daysRaw=list(r.days,7);if(daysRaw.length!==7)fail();const slots=new Set<string>(),used=new Set<string>();let placements=0;
 const days=daysRaw.map((v,index)=>{
  const d=fields(v,['date','meals']);if(date(d.date)!==offsetDate(weekStartLocal,index))fail();
  const meals=list(d.meals,8).map(v=>{
   const m=fields(v,['slotId','mealType','components']),slotId=uuid(m.slotId);if(slots.has(slotId))fail();slots.add(slotId);
   if(typeof m.mealType!=='string'||!['breakfast','lunch','dinner','snack'].includes(m.mealType))fail();const keys=new Set<string>();
   const components=list(m.components,8).map(v=>{
    if(++placements>128)fail();const c=fields(v,['componentKey','recipeKey','portion']),componentKey=token(c.componentKey),recipeKey=token(c.recipeKey);
    if(keys.has(componentKey)||!recipes.some(r=>r.recipeKey===recipeKey))fail();keys.add(componentKey);used.add(recipeKey);
    const p=fields(c.portion,['kind','amount']);if(p.kind!=='FRACTION_OF_WHOLE'&&p.kind!=='DECLARED_SERVINGS')fail();
    const amount=decodeExactScalarV2(p.amount);if(amount.numerator==='0')fail();
    return Object.freeze({componentKey,recipeKey,portion:Object.freeze({kind:p.kind,amount})});
   });
   return Object.freeze({slotId,mealType:m.mealType as MealType,components:Object.freeze(components)});
  });return Object.freeze({date:String(d.date),meals:Object.freeze(meals)});
 });
 if(used.size!==recipes.length)fail();
 return Object.freeze({contract:exactWeekNutritionRequestContractV3,encoding:exactWeekNutritionEncodingV3,accountId:uuid(r.accountId),selectionId:uuid(r.selectionId),
  weekStartLocal,timezone:timezone(r.timezone),recipes:Object.freeze(recipes),days:Object.freeze(days)});
}
export async function exactWeekNutritionRequestDigestRawV3(raw:string):Promise<string>{return digest('potok-exact-week-input-nutrition-request-sha256-v3',decodeExactWeekNutritionRequestRawV3(raw));}
function ownInputs(inputs:readonly ExactWeekRecipeInputV3[],request:ExactWeekNutritionRequestV3):ExactWeekRecipeInputV3[]{
 if(!Array.isArray(inputs)||inputs.length!==request.recipes.length||new Set(inputs.map(i=>i.recipeKey)).size!==inputs.length)fail();
 const result:ExactWeekRecipeInputV3[]=[];
 for(let i=0;i<inputs.length;i++){
  const d=Object.getOwnPropertyDescriptor(inputs,String(i));if(!d||!('value'in d))fail();const entry=d.value as ExactWeekRecipeInputV3;
  if(typeof entry.requestRaw!=='string'||!request.recipes.some(r=>r.recipeKey===entry.recipeKey))fail();
  result.push({recipeKey:entry.recipeKey,requestRaw:entry.requestRaw,contexts:ownExactTypedRecipeContextsV3(entry.contexts)});
 }return result;
}
function massSummary(parts:readonly InputMassSummary[]):InputMassSummary{
 const knownGrams=parts.reduce((sum,p)=>addExactScalarsV2(sum,p.knownGrams),{numerator:'0',denominator:'1'} as ExactScalarV2);
 const unknownItems=Object.freeze(parts.flatMap(p=>p.unknownItems));return Object.freeze({knownGrams,totalGrams:unknownItems.length?null:knownGrams,unknownItems});
}
/** Complete independently pinned request/source contexts only. No account entitlement or recipe publication claim. */
export async function prepareExactWeekNutritionRawV3(raw:string,expectedRequestDigest:string,inputs:readonly ExactWeekRecipeInputV3[],authority:ExactTypedRecipeAuthorityV3):Promise<ExactWeekNutritionResultV3>{
 const blocked=(reason:Extract<ExactWeekNutritionResultV3,{kind:'BLOCKED'}>['reason']):ExactWeekNutritionResultV3=>Object.freeze({kind:'BLOCKED',reason});
 let request:ExactWeekNutritionRequestV3,owned:ExactWeekRecipeInputV3[];
 try{request=decodeExactWeekNutritionRequestRawV3(raw);}catch{return blocked('REQUEST_INVALID_OR_CHANGED');}
 try{owned=ownInputs(inputs,request);}catch{return blocked('RECIPE_EVIDENCE_UNAVAILABLE_OR_MISMATCHED');}
 const requestDigest=await digest('potok-exact-week-input-nutrition-request-sha256-v3',request);
 if(requestDigest!==expectedRequestDigest)return blocked('REQUEST_INVALID_OR_CHANGED');
 try{
  // Invocation-only map: each selected source revalidated once per complete attempt, never cached across users/requests.
  const sources=new Map<string,ExactTypedRecipeSnapshotV3>();
  for(const ref of request.recipes){
   const input=owned.find(i=>i.recipeKey===ref.recipeKey);if(!input)return blocked('RECIPE_EVIDENCE_UNAVAILABLE_OR_MISMATCHED');
   const result=await prepareExactTypedRecipeRawV3(input.requestRaw,ref.requestDigest,input.contexts,authority);
   if(result.kind!=='PREPARED_EXACT_TYPED_INPUTS_V3'||result.snapshot.digest!==ref.snapshotDigest)return blocked('RECIPE_EVIDENCE_UNAVAILABLE_OR_MISMATCHED');
   sources.set(ref.recipeKey,result.snapshot);
  }
  let ingredientPlacements=0;const days:ExactWeekDaySnapshotV3[]=[];
  for(const day of request.days){
   const meals:ExactWeekMealSnapshotV3[]=[];
   for(const meal of day.meals){
    const components:ExactWeekComponentSnapshotV3[]=[];
    for(const selected of meal.components){
     const recipe=sources.get(selected.recipeKey)!;
     if(selected.portion.kind==='DECLARED_SERVINGS'&&recipe.request.authoring.declaredServings===null)return blocked('PORTION_UNAVAILABLE');
     const wholeRecipeMultiplier=selected.portion.kind==='FRACTION_OF_WHOLE'?selected.portion.amount:divideExactScalarsV2(selected.portion.amount,recipe.request.authoring.declaredServings!);
     const unknownItems:UnknownMassItem[]=[];let knownGrams:ExactScalarV2=Object.freeze({numerator:'0',denominator:'1'});
     const ingredients=recipe.components.map(row=>{
      if(++ingredientPlacements>1024)fail();const amount=multiplyExactScalarsV2(row.recordedAmount,wholeRecipeMultiplier);
      const massGrams=row.massGrams===null?null:multiplyExactScalarsV2(row.massGrams,wholeRecipeMultiplier);
      if(massGrams)knownGrams=addExactScalarsV2(knownGrams,massGrams);else unknownItems.push(Object.freeze({slotId:meal.slotId,componentKey:selected.componentKey,rowId:row.rowId}));
      return Object.freeze({rowId:row.rowId,inputKind:row.inputKind,unit:row.recordedUnit,amount,massGrams,
       nutrition:scaleExactNutritionValuesV2(row.values,wholeRecipeMultiplier,{numerator:'1',denominator:'1'})});
     });
     const nutrition=scaleExactNutritionValuesV2(recipe.whole,wholeRecipeMultiplier,{numerator:'1',denominator:'1'});
     if(exactNutritionValuesCanonicalRawV2(nutrition)!==exactNutritionValuesCanonicalRawV2(sumExactNutritionValuesV2(ingredients.map(i=>i.nutrition))))fail();
     const inputMass=Object.freeze({knownGrams,totalGrams:unknownItems.length?null:knownGrams,unknownItems:Object.freeze(unknownItems)});
     components.push(Object.freeze({componentKey:selected.componentKey,recipeKey:selected.recipeKey,recipeSnapshotDigest:recipe.digest,wholeRecipeMultiplier,
      ingredients:Object.freeze(ingredients),nutrition,inputMass}));
    }
    meals.push(Object.freeze({slotId:meal.slotId,mealType:meal.mealType,components:Object.freeze(components),nutrition:sumExactNutritionValuesV2(components.map(c=>c.nutrition)),inputMass:massSummary(components.map(c=>c.inputMass))}));
   }
   days.push(Object.freeze({date:day.date,meals:Object.freeze(meals),nutrition:sumExactNutritionValuesV2(meals.map(m=>m.nutrition)),inputMass:massSummary(meals.map(m=>m.inputMass))}));
  }
  const sourceRecipes=Object.freeze(request.recipes.map(ref=>{const recipe=sources.get(ref.recipeKey)!;return Object.freeze({...ref,
   authoringRecipeId:recipe.request.authoring.authoringRecipeId,authoringRevision:recipe.request.authoring.authoringRevision});}));
  const payload={contract:exactWeekNutritionSnapshotContractV3,encoding:exactWeekNutritionEncodingV3,authority:'NONE' as const,purpose:'CONDITIONAL_PLAN_INPUT_ARITHMETIC' as const,
   facts:Object.freeze([]) as readonly [],request,requestDigest,sourceRecipes,days:Object.freeze(days),nutrition:sumExactNutritionValuesV2(days.map(d=>d.nutrition)),inputMass:massSummary(days.map(d=>d.inputMass))};
  const snapshot=Object.freeze({...payload,digest:await digest('potok-exact-week-input-nutrition-snapshot-sha256-v3',payload)});
  if(new TextEncoder().encode(canonicalJsonV1(snapshot)).length>262144)fail();
  return Object.freeze({kind:'PREPARED_EXACT_WEEK_INPUTS_V3',snapshot});
 }catch{return blocked('CALCULATION_BUDGET_OR_INCONSISTENCY');}
}
export async function decodeExactWeekNutritionSnapshotRawV3(raw:string,expectedRequestDigest:string,inputs:readonly ExactWeekRecipeInputV3[],authority:ExactTypedRecipeAuthorityV3):Promise<ExactWeekNutritionSnapshotV3>{
 const candidate=parse(raw) as {request?:unknown};const result=await prepareExactWeekNutritionRawV3(JSON.stringify(candidate?.request),expectedRequestDigest,inputs,authority);
 if(result.kind!=='PREPARED_EXACT_WEEK_INPUTS_V3'||canonicalJsonV1(candidate)!==canonicalJsonV1(result.snapshot))throw Error('EXACT_WEEK_NUTRITION_SNAPSHOT_REJECTED');return result.snapshot;
}
