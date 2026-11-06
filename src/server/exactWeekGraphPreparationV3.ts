/** Exact PLAN graph preparation only. No store, activation, final optimizer or FACT authority. */
import {canonicalJsonV1,adaptiveNutritionSha256HexV1} from '../utils/adaptiveNutritionWireV1';
import {decodeTrustedGenerationInputRawV1,trustedGenerationInputDigestV1,type TrustedGenerationInputV1} from '../utils/adaptiveNutritionGraphV2';
import {decodeBalancePolicySnapshotRawV2} from '../utils/trustedValidationPoliciesV1';
import {assessMealWarningSignalsV1,type MealValidationInputV1,type ValidatorReasonV1} from '../utils/adaptiveNutritionMealBalanceV1';
import {parseExactValidationJsonRawV3 as parse,decodeExactWeekNumericAuthorityRawV3} from './exactWeekNutritionValidationV3';
import {createExactMenuContentValidationAdapterV4,decodeExactPublicationBindingsRawV4,type ExactMenuContentResultV4} from './exactMenuContentValidationV4';
import type {ExactWeekNutritionSnapshotV3,ExactWeekMealSnapshotV3} from './exactWeekNutritionPreparationV3';
import type {ExactTypedRecipeAuthorityV3} from './exactTypedRecipePreparationV3';
import type {GenerationValidationAuthorityPortV1} from './generationValidationAdapterV1';
export const exactWeekGraphContractV3='adaptive_nutrition_graph_v3' as const;
export const exactWeekGraphSourceContractV3='potok-exact-week-graph-source-v3' as const;
export const exactWeekGraphEncodingV3='potok-exact-week-graph-canonical-json-v3' as const;
export const exactWeekGraphRemainingChecksV3=Object.freeze(['EXACT_OPTIMIZATION_AND_GENERATOR_DECISION',
 'AUTH_PREMIUM_CURRENTNESS_ISSUANCE_TRANSACTIONAL_STORAGE_AND_READBACK'] as const);
type Reviewed=ReturnType<typeof decodeExactPublicationBindingsRawV4>;
export interface ExactWeekGraphSourceV3 {
 contract:typeof exactWeekGraphSourceContractV3;requestOperationId:string;evaluatedSnapshotRawSha256:string;
 contentSourceRaw:string;ordinaryFallbackRaw:string;warningEvidenceRaw:string;
}
export interface ExactOrdinaryWeekWitnessV3 {
 contract:'potok-exact-ordinary-week-witness-v3';generationInputDigest:string;candidateManifestDigest:string;
 selectedSnapshotRawSha256:string;ordinarySnapshotRaw:string;ordinaryContentSourceRaw:string;
}
export interface ExactGraphWarningsV3 {
 contract:'potok-exact-graph-warning-evidence-v3';generationInputDigest:string;contentValidationDigest:string;
 validationPolicyRevision:string;entries:readonly {slotId:string;slotSubjectDigest:string;evidenceRevision:string;
  signals:MealValidationInputV1['warningSignals']}[];
}
export interface ExactGraphSlotV3 {
 readonly slotId:string;readonly civilDate:string;readonly sortOrder:number;readonly sourceKind:'COMPLETE_RECIPE'|'COMPOSED_MEAL';
 readonly exactMeal:ExactWeekMealSnapshotV3;readonly publicationBindings:Reviewed[number]['value'][];
 readonly subjectDigest:string;readonly warnings:readonly (ValidatorReasonV1&{slotId:string;warningEvidenceRevision:string})[];
 readonly digest:string;
}
export interface ExactWeekGraphV3 {
 readonly contract:typeof exactWeekGraphContractV3;readonly encoding:typeof exactWeekGraphEncodingV3;readonly contractVersion:3;
 readonly authority:'NONE';readonly purpose:'CONDITIONAL_VALIDATED_PLAN_GRAPH';readonly accepted:false;readonly canRecord:false;readonly canActivate:false;
 readonly input:TrustedGenerationInputV1;readonly generationInputDigest:string;readonly evaluatedSnapshotRawSha256:string;
 readonly exactSnapshotDigest:string;readonly contentValidationDigest:string;readonly sourcePackageRawSha256:string;
 readonly ordinaryWitness:{readonly ordinarySnapshotDigest:string;readonly contentValidationDigest:string;readonly witnessRawSha256:string};
 readonly warningEvidenceRawSha256:string;readonly days:readonly {date:string;dayIndex:number;slots:readonly ExactGraphSlotV3[];
  nutrition:ExactWeekNutritionSnapshotV3['nutrition'];inputMass:ExactWeekNutritionSnapshotV3['inputMass'];digest:string}[];
 readonly nutrition:ExactWeekNutritionSnapshotV3['nutrition'];readonly inputMass:ExactWeekNutritionSnapshotV3['inputMass'];
 readonly facts:readonly [];readonly remainingChecks:typeof exactWeekGraphRemainingChecksV3;readonly digest:string;
}
export type ExactWeekGraphResultV3={readonly status:'EXACT_GRAPH_PREPARED_PENDING_OPTIMIZATION';readonly graph:ExactWeekGraphV3}
 |{readonly status:'BLOCKED'|'REJECTED';readonly reason:string;readonly accepted:false;readonly canRecord:false;readonly canActivate:false};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,hash=/^[a-f0-9]{64}$/;
function fail(reason='EXACT_GRAPH_SOURCE_INVALID'):never{throw Error(reason);}
function record(v:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.prototype.hasOwnProperty.call(v,k)))fail();return v as Record<string,unknown>;
}
function string(v:unknown):string{if(typeof v!=='string')fail();return v;}
function id(v:unknown):string{const s=string(v);if(!uuid.test(s))fail();return s;}
function digestText(v:unknown):string{const s=string(v);if(!hash.test(s))fail();return s;}
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
const canonical=(v:unknown)=>canonicalJsonV1(v,'SAFE_INTEGER');
const sha=(raw:string)=>adaptiveNutritionSha256HexV1(new TextEncoder().encode(raw));
const contentHash=(domain:string,payload:unknown)=>sha(canonical({domain,payload}));
function blocked(reason:string,status:'BLOCKED'|'REJECTED'='BLOCKED'):ExactWeekGraphResultV3{return freeze({status,reason,accepted:false,canRecord:false,canActivate:false});}
function checkedContent(result:ExactMenuContentResultV4):void{
 if(result.status!=='CONTENT_RULES_PASSED_PENDING_GRAPH')fail(result.status==='BLOCKED'?'EXACT_CONTENT_BLOCKED':'EXACT_CONTENT_REJECTED');
}
function sourceContext(raw:string){
 const source=record(parse(raw,16_777_216,24),['contract','requestOperationId','evaluatedSnapshotRawSha256','numericAuthorityRaw','preferenceRaw','safetyRaw','compositionPolicySnapshotRaw','bindingsRaw','mealModes']);
 const numeric=decodeExactWeekNumericAuthorityRawV3(string(source.numericAuthorityRaw));
 return {source,numeric,input:decodeTrustedGenerationInputRawV1(numeric.trustedGenerationInputRaw),bindings:decodeExactPublicationBindingsRawV4(string(source.bindingsRaw))};
}
/** Standalone slot subject for an independent warning assessor; does not grant review authority. */
export async function exactGraphSlotSubjectsRawV3(snapshotRaw:string,contentSourceRaw:string){
 const snapshot=parse(snapshotRaw,262144,12) as unknown as ExactWeekNutritionSnapshotV3,context=sourceContext(contentSourceRaw);
 if(!Array.isArray(snapshot.days)||!Array.isArray(context.source.mealModes))fail();
 let index=0;
 const subjects=[];
 for(const [dayIndex,day] of snapshot.days.entries())for(const [sortOrder,meal] of day.meals.entries()){
  const mode=record(context.source.mealModes[index++],['slotId','sourceKind']);if(mode.slotId!==meal.slotId||!['COMPLETE_RECIPE','COMPOSED_MEAL'].includes(string(mode.sourceKind)))fail();
  const publicationBindings=context.bindings.filter(b=>b.value.slotId===meal.slotId).map(b=>b.value);
  const payload={slotId:meal.slotId,civilDate:day.date,sortOrder,sourceKind:mode.sourceKind as ExactGraphSlotV3['sourceKind'],exactMeal:meal,publicationBindings};
  subjects.push({...payload,dayIndex,subjectDigest:await contentHash('potok-exact-graph-slot-subject-sha256-v3',payload)});
 }
 return freeze(subjects);
}
/** One trusted store read per complete graph attempt; no caller-supplied proof object or permissive issuer. */
export function createExactWeekGraphPreparationV3(port:GenerationValidationAuthorityPortV1,eventAuthority:ExactTypedRecipeAuthorityV3){
 async function prepare(operation:string,snapshotRaw:string):Promise<ExactWeekGraphResultV3>{
  try{
   id(operation);parse(snapshotRaw,262144,12);const snapshotHash=await sha(snapshotRaw);
   const sourceRaw=await port.loadForProposalRaw(operation,snapshotHash);if(sourceRaw===null)return blocked('GRAPH_SOURCE_UNAVAILABLE');
   const source=record(parse(sourceRaw,16_777_216,24),['contract','requestOperationId','evaluatedSnapshotRawSha256','contentSourceRaw','ordinaryFallbackRaw','warningEvidenceRaw']);
   if(source.contract!==exactWeekGraphSourceContractV3||source.requestOperationId!==operation||source.evaluatedSnapshotRawSha256!==snapshotHash)fail();
   const contentSourceRaw=string(source.contentSourceRaw),ordinaryRaw=string(source.ordinaryFallbackRaw),warningRaw=string(source.warningEvidenceRaw);
   const content=await createExactMenuContentValidationAdapterV4({loadForProposalRaw:async()=>contentSourceRaw},eventAuthority).validate(operation,snapshotRaw);checkedContent(content);
   const context=sourceContext(contentSourceRaw),input=context.input,inputDigest=await trustedGenerationInputDigestV1(input);
   const snapshot=parse(snapshotRaw,262144,12) as unknown as ExactWeekNutritionSnapshotV3;
   // Feasibility witness only. Absence never proves that no ordinary plan exists.
   const ordinary=record(parse(ordinaryRaw,16_777_216,24),['contract','generationInputDigest','candidateManifestDigest','selectedSnapshotRawSha256','ordinarySnapshotRaw','ordinaryContentSourceRaw']);
   if(ordinary.contract!=='potok-exact-ordinary-week-witness-v3'||ordinary.generationInputDigest!==inputDigest||ordinary.candidateManifestDigest!==input.candidateManifestDigest||ordinary.selectedSnapshotRawSha256!==snapshotHash)fail('ORDINARY_WITNESS_MISMATCH');
   const ordinarySnapshotRaw=string(ordinary.ordinarySnapshotRaw),ordinarySourceRaw=string(ordinary.ordinaryContentSourceRaw);
   const ordinaryResult=await createExactMenuContentValidationAdapterV4({loadForProposalRaw:async()=>ordinarySourceRaw},eventAuthority).validate(operation,ordinarySnapshotRaw);
   if(ordinaryResult.status!=='CONTENT_RULES_PASSED_PENDING_GRAPH')fail('ORDINARY_WITNESS_NOT_VALID');
   const ordinaryContext=sourceContext(ordinarySourceRaw);
   if(canonical(ordinaryContext.input)!==canonical(input)||ordinaryContext.bindings.some(b=>b.value.specialty||b.value.expensive))fail('ORDINARY_WITNESS_NOT_ORDINARY_OR_STALE');
   // The same immutable recipe/publication cannot become ordinary by changing its classification in the witness.
   const definition=(b:Reviewed[number])=>{
    const {mealComponentId,...review}=b.review;void mealComponentId;
    return canonical({...b.value,slotId:null,componentKey:null,recipeKey:null,reviewMetadataRaw:null,review});
   };
   const byRecipe=new Map<string,string>(),byRevision=new Map<string,string>();
   for(const b of [...context.bindings,...ordinaryContext.bindings]){
    const value=definition(b);
    if(byRecipe.has(b.value.recipeId)&&byRecipe.get(b.value.recipeId)!==value||byRevision.has(b.review.recipeRevision)&&byRevision.get(b.review.recipeRevision)!==value)fail('ORDINARY_WITNESS_CONFLICTING_RECIPE');
    byRecipe.set(b.value.recipeId,value);byRevision.set(b.review.recipeRevision,value);
   }
   for(const key of ['preferenceRaw','safetyRaw','compositionPolicySnapshotRaw'])if(ordinaryContext.source[key]!==context.source[key])fail('ORDINARY_WITNESS_CONTEXT_MISMATCH');
   for(const key of ['currentGoalTargetRaw','balancePolicySnapshotRaw','distributionPolicyRaw'] as const)if(ordinaryContext.numeric[key]!==context.numeric[key])fail('ORDINARY_WITNESS_POLICY_MISMATCH');
   const ordinarySnapshot=parse(ordinarySnapshotRaw,262144,12) as unknown as ExactWeekNutritionSnapshotV3;
   const subjects=await exactGraphSlotSubjectsRawV3(snapshotRaw,contentSourceRaw);
   const warnings=record(parse(warningRaw,262144,12),['contract','generationInputDigest','contentValidationDigest','validationPolicyRevision','entries']);
   if(warnings.contract!=='potok-exact-graph-warning-evidence-v3'||warnings.generationInputDigest!==inputDigest||warnings.contentValidationDigest!==content.digest||warnings.validationPolicyRevision!==input.validationPolicyRevision||!Array.isArray(warnings.entries)||warnings.entries.length!==subjects.length)fail('WARNING_COVERAGE_OR_BINDING_MISMATCH');
   const balance=(await decodeBalancePolicySnapshotRawV2(context.numeric.balancePolicySnapshotRaw,context.numeric.trustedGenerationInputRaw)).policy;
   const slots:ExactGraphSlotV3[]=[];
   for(const [i,subject] of subjects.entries()){
    const entry=record(warnings.entries[i],['slotId','slotSubjectDigest','evidenceRevision','signals']);
    if(entry.slotId!==subject.slotId||entry.slotSubjectDigest!==subject.subjectDigest)fail('WARNING_SLOT_SUBJECT_MISMATCH');
    const evidenceRevision=id(entry.evidenceRevision),signals=record(entry.signals,['softTargetFitDeviation','longPreparationBurden','shoppingListBurden','lowerConvenienceScore','repetitionApproachingLimit']);
    if(Object.values(signals).some(v=>typeof v!=='boolean'))fail('WARNING_SIGNAL_INVALID');
    const emitted=assessMealWarningSignalsV1(balance,signals as MealValidationInputV1['warningSignals']);
    // Independent cost classifications can both apply. Existing allowed warning codes control emission.
    for(const b of context.bindings.filter(b=>b.value.slotId===subject.slotId))for(const [enabled,code] of [[b.value.specialty,'OPTIONAL_SPECIALTY_USED'],[b.value.expensive,'OPTIONAL_EXPENSIVE_USED']] as const){
     if(enabled&&balance.allowedWarningCodes.includes(code))emitted.push({code,severity:'WARNING',path:'components.'+b.value.componentKey,evidenceRevision:b.review.publicationRevision});
    }
    const {dayIndex,...payload}=subject;void dayIndex;
    const slot={...payload,warnings:emitted.map(v=>({...v,slotId:subject.slotId,warningEvidenceRevision:evidenceRevision}))};
    slots.push({...slot,digest:await contentHash('potok-exact-graph-slot-sha256-v3',slot)});
   }
   const days=[];
   for(const [dayIndex,day] of snapshot.days.entries()){
    const value={date:day.date,dayIndex,slots:slots.filter(s=>s.civilDate===day.date),nutrition:day.nutrition,inputMass:day.inputMass};
    days.push({...value,digest:await contentHash('potok-exact-graph-day-sha256-v3',value)});
   }
   const payload={contract:exactWeekGraphContractV3,encoding:exactWeekGraphEncodingV3,contractVersion:3 as const,authority:'NONE' as const,purpose:'CONDITIONAL_VALIDATED_PLAN_GRAPH' as const,
    accepted:false as const,canRecord:false as const,canActivate:false as const,input,generationInputDigest:inputDigest,evaluatedSnapshotRawSha256:snapshotHash,
    exactSnapshotDigest:snapshot.digest,contentValidationDigest:content.digest,sourcePackageRawSha256:await sha(sourceRaw),
    ordinaryWitness:{ordinarySnapshotDigest:ordinarySnapshot.digest,contentValidationDigest:ordinaryResult.digest,witnessRawSha256:await sha(ordinaryRaw)},
    warningEvidenceRawSha256:await sha(warningRaw),days,nutrition:snapshot.nutrition,inputMass:snapshot.inputMass,facts:[] as [],remainingChecks:exactWeekGraphRemainingChecksV3};
   const graph=freeze({...payload,digest:await contentHash('potok-exact-week-graph-sha256-v3',payload)});
   if(new TextEncoder().encode(canonical(graph)).length>1_048_576)fail('GRAPH_OUTPUT_BUDGET_EXCEEDED');
   return freeze({status:'EXACT_GRAPH_PREPARED_PENDING_OPTIMIZATION',graph});
  }catch(error){return blocked(error instanceof Error&&/^(EXACT_CONTENT_|ORDINARY_|WARNING_|GRAPH_OUTPUT_)/.test(error.message)?error.message:'GRAPH_SOURCE_INVALID_OR_CHANGED',error instanceof Error&&error.message==='EXACT_CONTENT_REJECTED'?'REJECTED':'BLOCKED');}
 }
 async function readback(operation:string,snapshotRaw:string,graphRaw:string):Promise<ExactWeekGraphResultV3>{
  let value:unknown;try{value=parse(graphRaw,1_048_576,24);}catch{return blocked('GRAPH_READBACK_INVALID');}
  const result=await prepare(operation,snapshotRaw);
  if(result.status!=='EXACT_GRAPH_PREPARED_PENDING_OPTIMIZATION')return result;
  if(canonical(value)!==canonical(result.graph))return blocked('GRAPH_READBACK_MISMATCH');return result;
 }
 async function replace(operation:string,priorSnapshotRaw:string,priorGraphRaw:string,nextSnapshotRaw:string,changeRaw:string):Promise<ExactWeekGraphResultV3>{
  try{
   const change=record(parse(changeRaw,4096,4),['expectedGraphDigest','slotId','componentKey']);digestText(change.expectedGraphDigest);id(change.slotId);string(change.componentKey);
   const prior=await readback(operation,priorSnapshotRaw,priorGraphRaw);if(prior.status!=='EXACT_GRAPH_PREPARED_PENDING_OPTIMIZATION')return prior;
   if(prior.graph.digest!==change.expectedGraphDigest)return blocked('REPLACEMENT_STALE_GRAPH');
   const next=await prepare(operation,nextSnapshotRaw);if(next.status!=='EXACT_GRAPH_PREPARED_PENDING_OPTIMIZATION')return next;
   if(prior.graph.generationInputDigest!==next.graph.generationInputDigest)return blocked('REPLACEMENT_INPUT_CHANGED');
   const before=parse(priorSnapshotRaw,262144,12) as unknown as ExactWeekNutritionSnapshotV3,after=parse(nextSnapshotRaw,262144,12) as unknown as ExactWeekNutritionSnapshotV3;
   let removed=0;const strip=(s:ExactWeekNutritionSnapshotV3)=>{
    const {recipes,days,...header}=s.request;void recipes;
    return {header,days:days.map(d=>({...d,meals:d.meals.map(m=>({...m,components:m.components.map(c=>{if(m.slotId===change.slotId&&c.componentKey===change.componentKey){removed++;return {componentKey:c.componentKey,replacement:true};}return {component:c,reference:s.request.recipes.find(r=>r.recipeKey===c.recipeKey)};})}))}))};
   };
   if(canonical(strip(before))!==canonical(strip(after))||removed!==2)return blocked('REPLACEMENT_SCOPE_CHANGED');
   const graphScope=(g:ExactWeekGraphV3)=>g.days.map(d=>({date:d.date,dayIndex:d.dayIndex,slots:d.slots.map(s=>({
    slotId:s.slotId,civilDate:s.civilDate,sortOrder:s.sortOrder,sourceKind:s.sourceKind,mealType:s.exactMeal.mealType,
    components:s.exactMeal.components.map(c=>s.slotId===change.slotId&&c.componentKey===change.componentKey
     ?{componentKey:c.componentKey,replacement:true}
     :{component:c,publication:s.publicationBindings.find(b=>b.componentKey===c.componentKey)})}))}));
   if(canonical(graphScope(prior.graph))!==canonical(graphScope(next.graph)))return blocked('REPLACEMENT_SCOPE_CHANGED');
   if(canonical(before.request)===canonical(after.request))return blocked('REPLACEMENT_NO_CHANGE');
   return next;
  }catch{return blocked('REPLACEMENT_INVALID');}
 }
 return Object.freeze({prepare,readback,replace});
}
