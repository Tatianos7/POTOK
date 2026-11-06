/** Versioned mixed recipe preparation, not Graph/publication or an authenticated store. */
import { canonicalJsonV1,adaptiveNutritionSha256HexV1 } from '../utils/adaptiveNutritionWireV1';
import { parseFoodNutritionSourceBindingJsonRawV2 as parse } from '../utils/foodNutritionSourceBindingV2';
import { decodeExactRecipeNutritionRequestRawV2,type ExactRecipeNutritionRequestV2 } from '../utils/exactRecipeNutritionV2';
import { exactNutritionInputDigestV2,createExactNutritionValuesV2,exactNutritionFromDecimalTextV2,scaleExactNutritionValuesV2,
  sumExactNutritionValuesV2,addExactScalarsV2,type ExactScalarV2,type ExactNutritionValuesV2 } from '../utils/exactNutritionValuesV2';
import { resolveExactFoodNutritionReviewedSnapshotV2,type ExactFoodNutritionReviewedSnapshotV2 } from './exactFoodNutritionReviewedAdapterV2';
import type { FoodEvidenceReviewEventV1 } from '../utils/foodReviewedEvidenceV1';
import type { ExactFoodNutritionReviewEventV2 } from '../utils/exactFoodNutritionEvidenceV2';
import type { ReviewedEvidenceAuthorityV1 } from './nutritionIntegrityReviewedEvidenceAdapterV1';
import { ownNonFoodReviewedSnapshotV1,resolveNonFoodReviewedSnapshotV1,type NonFoodReviewedSnapshotV1,
  type NonFoodReviewEventV1,type NonFoodRecipeBindingV1 } from './nonFoodReviewedSnapshotV1';
export const exactTypedRecipeRequestContractV3='potok-exact-typed-recipe-preparation-request-v3' as const;
export const exactTypedRecipeSnapshotContractV3='potok-exact-typed-recipe-input-snapshot-v3' as const;
export const exactTypedRecipeEncodingV3='potok-exact-typed-recipe-input-json-v3' as const;
export interface ExactTypedRecipeRequestV3{
  readonly contract:typeof exactTypedRecipeRequestContractV3;readonly encoding:typeof exactTypedRecipeEncodingV3;
  readonly authoring:ExactRecipeNutritionRequestV2;readonly nonFoodBindings:readonly NonFoodRecipeBindingV1[];
}
export type ExactTypedRecipeContextV3=
  |{readonly rowId:string;readonly kind:'FOOD';readonly snapshot:ExactFoodNutritionReviewedSnapshotV2}
  |{readonly rowId:string;readonly kind:'NONFOOD_V1';readonly snapshot:NonFoodReviewedSnapshotV1};
export type ExactTypedRecipeAuthorityV3=ReviewedEvidenceAuthorityV1<FoodEvidenceReviewEventV1|ExactFoodNutritionReviewEventV2|NonFoodReviewEventV1>;
export interface ExactTypedRecipeSnapshotV3{
  readonly contract:typeof exactTypedRecipeSnapshotContractV3;readonly encoding:typeof exactTypedRecipeEncodingV3;
  readonly authority:'NONE';readonly calculationBasis:'INPUT_COMPONENTS_NO_COOKING_RETENTION_CLAIM';
  readonly request:ExactTypedRecipeRequestV3;readonly requestDigest:string;
  readonly components:readonly {readonly rowId:string;readonly inputKind:'FOOD'|'POTABLE_WATER'|'SALT';
    readonly recordedAmount:ExactScalarV2;readonly recordedUnit:'g'|'ml';readonly massGrams:ExactScalarV2|null;
    readonly basis:'PER_100_G_FOOD'|'PER_100_G_EDIBLE';readonly sourceBinding:Readonly<Record<string,string>>;readonly values:ExactNutritionValuesV2}[];
  readonly knownInputMassGrams:ExactScalarV2;readonly inputMassGrams:ExactScalarV2|null;readonly unknownMassRowIds:readonly string[];
  readonly whole:ExactNutritionValuesV2;readonly perDeclaredServing:ExactNutritionValuesV2|null;readonly cookedYieldGrams:null;readonly digest:string;
}
export type ExactTypedRecipeResultV3={readonly kind:'PREPARED_EXACT_TYPED_INPUTS_V3';readonly snapshot:ExactTypedRecipeSnapshotV3}
  |{readonly kind:'BLOCKED';readonly reason:'REQUEST_INVALID_OR_CHANGED'|'EVIDENCE_UNAVAILABLE_OR_MISMATCHED'};
function fail():never{throw Error('EXACT_TYPED_RECIPE_INVALID_REQUEST');}
function fields(v:unknown,keys:readonly string[]):Record<string,unknown>{
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.prototype.hasOwnProperty.call(v,k)))fail();return v as Record<string,unknown>;
}
function token(v:unknown):string{if(typeof v!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(v))fail();return v;}
function uuid(v:unknown):string{if(typeof v!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v))fail();return v;}
function hash(v:unknown):string{if(typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))fail();return v;}
async function digest(domain:string,payload:unknown):Promise<string>{return adaptiveNutritionSha256HexV1(new TextEncoder().encode(canonicalJsonV1({domain,payload})));}
export function decodeExactTypedRecipeRequestRawV3(raw:string):ExactTypedRecipeRequestV3{
  const r=fields(parse(raw),['contract','encoding','authoring','nonFoodBindings']);
  if(r.contract!==exactTypedRecipeRequestContractV3||r.encoding!==exactTypedRecipeEncodingV3||!Array.isArray(r.nonFoodBindings)||r.nonFoodBindings.length>128)fail();
  const authoring=decodeExactRecipeNutritionRequestRawV2(JSON.stringify(r.authoring));
  const bindings=r.nonFoodBindings.map((value:unknown):NonFoodRecipeBindingV1=>{
    const b=fields(value,['rowId','definitionId','stableKey','definitionRevisionId','definitionDigest','nutritionRevisionId','nutritionDigest','foodState']);
    if(typeof b.foodState!=='string'||!['raw','dry','frozen','cooked','as-sold'].includes(b.foodState))fail();
    return Object.freeze({rowId:token(b.rowId),definitionId:uuid(b.definitionId),stableKey:token(b.stableKey),definitionRevisionId:uuid(b.definitionRevisionId),
      definitionDigest:hash(b.definitionDigest),nutritionRevisionId:uuid(b.nutritionRevisionId),nutritionDigest:hash(b.nutritionDigest),foodState:b.foodState as NonFoodRecipeBindingV1['foodState']});
  });
  const nonfood=authoring.components.filter(c=>c.inputKind!=='FOOD');
  if(bindings.length!==nonfood.length||new Set(bindings.map(b=>b.rowId)).size!==bindings.length
    ||nonfood.some(c=>!bindings.some(b=>b.rowId===c.rowId)))fail();
  return Object.freeze({contract:exactTypedRecipeRequestContractV3,encoding:exactTypedRecipeEncodingV3,authoring,nonFoodBindings:Object.freeze(bindings)});
}
export async function exactTypedRecipeRequestDigestRawV3(raw:string):Promise<string>{
  return digest('potok-exact-typed-recipe-request-sha256-v3',decodeExactTypedRecipeRequestRawV3(raw));
}
export function ownExactTypedRecipeContextsV3(rows:readonly ExactTypedRecipeContextV3[]):ExactTypedRecipeContextV3[]{
  if(!Array.isArray(rows)||!rows.length||rows.length>128||new Set(rows.map(r=>r.rowId)).size!==rows.length)fail();
  return rows.map(row=>{
    if(row.kind==='NONFOOD_V1')return {rowId:row.rowId,kind:row.kind,snapshot:ownNonFoodReviewedSnapshotV1(row.snapshot)};
    if(row.kind!=='FOOD'||!Array.isArray(row.snapshot.relevantEventRaws)||row.snapshot.relevantEventRaws.length>128)fail();
    const history:string[]=[];
    for(let i=0;i<row.snapshot.relevantEventRaws.length;i++){
      const d=Object.getOwnPropertyDescriptor(row.snapshot.relevantEventRaws,String(i));if(!d||!('value'in d)||typeof d.value!=='string')fail();history.push(d.value);
    }
    return {rowId:row.rowId,kind:row.kind,snapshot:{...row.snapshot,relevantEventRaws:history}};
  });
}
/** Contexts and request pin must be independent complete atomic server-owned reads.
 * A successful calculation confers no recipe/publication/Graph authority. */
export async function prepareExactTypedRecipeRawV3(requestRaw:string,expectedRequestDigest:string,
  contexts:readonly ExactTypedRecipeContextV3[],authority:ExactTypedRecipeAuthorityV3):Promise<ExactTypedRecipeResultV3>{
  const blocked=(reason:'REQUEST_INVALID_OR_CHANGED'|'EVIDENCE_UNAVAILABLE_OR_MISMATCHED'):ExactTypedRecipeResultV3=>Object.freeze({kind:'BLOCKED',reason});
  let request:ExactTypedRecipeRequestV3,owned:ExactTypedRecipeContextV3[];
  try{request=decodeExactTypedRecipeRequestRawV3(requestRaw);}catch{return blocked('REQUEST_INVALID_OR_CHANGED');}
  try{owned=ownExactTypedRecipeContextsV3(contexts);if(owned.length!==request.authoring.components.length)throw Error();}catch{return blocked('EVIDENCE_UNAVAILABLE_OR_MISMATCHED');}
  const requestDigest=await digest('potok-exact-typed-recipe-request-sha256-v3',request);
  if(requestDigest!==expectedRequestDigest)return blocked('REQUEST_INVALID_OR_CHANGED');
  try{
    const components:ExactTypedRecipeSnapshotV3['components'][number][]=[],unknownMassRowIds:string[]=[];
    let knownInputMassGrams:ExactScalarV2=Object.freeze({numerator:'0',denominator:'1'});
    for(const row of request.authoring.components){
      const context=owned.find(r=>r.rowId===row.rowId);if(!context)return blocked('EVIDENCE_UNAVAILABLE_OR_MISMATCHED');
      let values:ExactNutritionValuesV2,basis:'PER_100_G_FOOD'|'PER_100_G_EDIBLE',sourceBinding:Readonly<Record<string,string>>;
      const recordedAmount=row.inputKind==='FOOD'?row.weightG:row.amount,recordedUnit=row.inputKind==='FOOD'?'g':row.unit;
      const massGrams=recordedUnit==='g'?recordedAmount:null;
      if(row.inputKind==='FOOD'){
        if(context.kind!=='FOOD'||context.snapshot.requestedFoodId!==row.foodId||context.snapshot.currentFoodState!==row.foodState)return blocked('EVIDENCE_UNAVAILABLE_OR_MISMATCHED');
        const evidence=await resolveExactFoodNutritionReviewedSnapshotV2(context.snapshot,authority);
        if(evidence.kind!=='REVIEWED_EXACT_V2'||evidence.foodId!==row.foodId||evidence.nutritionRevisionId!==row.nutritionRevisionId
          ||evidence.nutritionDigest!==row.nutritionDigest||evidence.sourceProposalDigest!==row.sourceProposalDigest
          ||evidence.numericInput.reference.basis!==row.basis||await exactNutritionInputDigestV2(evidence.numericInput)!==row.numericInputDigest)return blocked('EVIDENCE_UNAVAILABLE_OR_MISMATCHED');
        basis=row.basis;values=scaleExactNutritionValuesV2(createExactNutritionValuesV2(evidence.numericInput.values),recordedAmount,{numerator:'100',denominator:'1'});
        sourceBinding=Object.freeze({kind:'FOOD',foodId:row.foodId,canonicalRevisionId:evidence.canonicalRevisionId,canonicalDigest:evidence.canonicalRevisionDigest,
          nutritionRevisionId:evidence.nutritionRevisionId,nutritionDigest:evidence.nutritionDigest,sourceProposalDigest:evidence.sourceProposalDigest,numericInputDigest:row.numericInputDigest});
      }else{
        if(context.kind!=='NONFOOD_V1')return blocked('EVIDENCE_UNAVAILABLE_OR_MISMATCHED');
        const binding=request.nonFoodBindings.find(b=>b.rowId===row.rowId);if(!binding)return blocked('EVIDENCE_UNAVAILABLE_OR_MISMATCHED');
        const evidence=await resolveNonFoodReviewedSnapshotV1(context.snapshot,binding,authority);
        if(evidence.kind!=='REVIEWED_NONFOOD_V1')return blocked('EVIDENCE_UNAVAILABLE_OR_MISMATCHED');
        basis=evidence.basis;const zero=exactNutritionFromDecimalTextV2(evidence.nutrition);
        // Verified PR165 non-nutritive values only. No generic volume-to-gram conversion.
        if(Object.values(zero.values).some(v=>v.numerator!=='0'))return blocked('EVIDENCE_UNAVAILABLE_OR_MISMATCHED');
        values=recordedUnit==='ml'?zero:scaleExactNutritionValuesV2(zero,recordedAmount,{numerator:'100',denominator:'1'});
        sourceBinding=Object.freeze({kind:'NONFOOD_V1',definitionId:binding.definitionId,definitionRevisionId:binding.definitionRevisionId,
          definitionDigest:binding.definitionDigest,stableKey:binding.stableKey,nutritionRevisionId:binding.nutritionRevisionId,nutritionDigest:binding.nutritionDigest,
          definitionApprovalDigest:evidence.definitionApprovalDigest,nutritionApprovalDigest:evidence.nutritionApprovalDigest});
      }
      if(massGrams)knownInputMassGrams=addExactScalarsV2(knownInputMassGrams,massGrams);else unknownMassRowIds.push(row.rowId);
      components.push(Object.freeze({rowId:row.rowId,inputKind:row.inputKind,recordedAmount,recordedUnit,massGrams,basis,sourceBinding,values}));
    }
    const whole=sumExactNutritionValuesV2(components.map(c=>c.values));
    const perDeclaredServing=request.authoring.declaredServings===null?null:scaleExactNutritionValuesV2(whole,{numerator:'1',denominator:'1'},request.authoring.declaredServings);
    const payload={contract:exactTypedRecipeSnapshotContractV3,encoding:exactTypedRecipeEncodingV3,authority:'NONE' as const,
      calculationBasis:'INPUT_COMPONENTS_NO_COOKING_RETENTION_CLAIM' as const,request,requestDigest,components:Object.freeze(components),knownInputMassGrams,
      inputMassGrams:unknownMassRowIds.length?null:knownInputMassGrams,unknownMassRowIds:Object.freeze(unknownMassRowIds),whole,perDeclaredServing,cookedYieldGrams:null};
    const snapshot=Object.freeze({...payload,digest:await digest('potok-exact-typed-recipe-input-snapshot-sha256-v3',payload)});
    return Object.freeze({kind:'PREPARED_EXACT_TYPED_INPUTS_V3',snapshot});
  }catch{return blocked('EVIDENCE_UNAVAILABLE_OR_MISMATCHED');}
}
/** Revalidate receipts/authority and recompute, never authorize using only stored output hashes. */
export async function decodeExactTypedRecipeSnapshotRawV3(raw:string,expectedRequestDigest:string,contexts:readonly ExactTypedRecipeContextV3[],
  authority:ExactTypedRecipeAuthorityV3):Promise<ExactTypedRecipeSnapshotV3>{
  const candidate=parse(raw) as {request?:unknown};
  const result=await prepareExactTypedRecipeRawV3(JSON.stringify(candidate?.request),expectedRequestDigest,contexts,authority);
  if(result.kind!=='PREPARED_EXACT_TYPED_INPUTS_V3'||canonicalJsonV1(candidate)!==canonicalJsonV1(result.snapshot))throw Error('EXACT_TYPED_RECIPE_SNAPSHOT_REJECTED');
  return result.snapshot;
}
