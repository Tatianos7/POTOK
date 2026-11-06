/** Unmounted backend read model. Retained proposals never become active plans or diary facts. */
import type {ExactPlanAdmissionResultV3} from './exactPlanAdmissionV3';
import type {ExactGeneratedWeekProposalV3} from './exactWeekOptimizationV3';
import {parseExactValidationJsonRawV3 as parse} from './exactWeekNutritionValidationV3';
import {canonicalJsonV1} from '../utils/adaptiveNutritionWireV1';
export const exactPlanPreviewTitlesContractV3='potok-exact-plan-preview-titles-v3' as const;
export interface ExactPlanPreviewDependenciesV3 {
 /** Server-authenticated principal, never a client-provided account ID. */
 authenticatedAccountId():Promise<string|null>;
 /** Must be the currentness-checking admission service, not a raw stored-row reader. */
 open(operation:string):Promise<ExactPlanAdmissionResultV3>;
 /** Trusted visible-catalog reader; names confer no publication/review authority. */
 loadTitlesRaw(operation:string,accountId:string,graphDigest:string):Promise<string|null>;
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function record(v:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.prototype.hasOwnProperty.call(v,k)))throw Error();
 return v as Record<string,unknown>;
}
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
const unavailable=(reason:string)=>Object.freeze({status:'UNAVAILABLE' as const,reason,planActivated:false as const,factsWritten:false as const});
/** Two fresh admission reads fence catalog I/O. Default disabled; creates no endpoint or connection. */
export function createExactPlanPreviewV3(deps:ExactPlanPreviewDependenciesV3,enabled:()=>boolean=()=>false){
 return Object.freeze({async open(operation:string){
  try{
   if(enabled()!==true)return unavailable('PREVIEW_DISABLED');
   if(typeof operation!=='string'||!uuid.test(operation))return unavailable('INVALID_REQUEST');
   const account=await deps.authenticatedAccountId();if(!account||!uuid.test(account)||enabled()!==true)return unavailable('AUTH_REQUIRED');
   const first=await deps.open(operation);
   if(first.status!=='SNAPSHOT_VERIFIED')return unavailable('CURRENT_PROPOSAL_UNAVAILABLE');
   if(first.snapshot.accountId!==account||first.snapshot.requestOperationId!==operation)return unavailable('ACCOUNT_BINDING_MISMATCH');
   const graph=(parse(first.snapshot.proposalCanonicalRaw,2_097_152,28) as unknown as ExactGeneratedWeekProposalV3).graph;
   const raw=await deps.loadTitlesRaw(operation,account,graph.digest);if(raw===null)return unavailable('CATALOG_TITLES_UNAVAILABLE');
   const source=record(parse(raw,65536,6),['contract','requestOperationId','accountId','graphDigest','entries']);
   if(source.contract!==exactPlanPreviewTitlesContractV3||source.requestOperationId!==operation||source.accountId!==account||source.graphDigest!==graph.digest||!Array.isArray(source.entries)||source.entries.length>128)throw Error();
   const titles=new Map<string,string>();
   for(const value of source.entries){
    const row=record(value,['recipeId','publicationRevision','title']);
    if(typeof row.recipeId!=='string'||!uuid.test(row.recipeId)||typeof row.publicationRevision!=='string'||!uuid.test(row.publicationRevision)
     ||typeof row.title!=='string'||row.title!==row.title.trim()||row.title.length<1||row.title.length>200
     ||[...row.title].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)||/[<>\u202a-\u202e\u2066-\u2069]/u.test(row.title))throw Error();
    const key=row.recipeId+':'+row.publicationRevision;if(titles.has(key))throw Error();titles.set(key,row.title);
   }
   const used=new Set<string>();
   const days=graph.days.map(day=>({date:day.date,nutrition:day.nutrition,inputMass:day.inputMass,
    meals:day.slots.map(slot=>({slotId:slot.slotId,mealType:slot.exactMeal.mealType,nutrition:slot.exactMeal.nutrition,inputMass:slot.exactMeal.inputMass,
     warnings:slot.warnings.map(w=>({code:w.code,severity:w.severity})),components:slot.exactMeal.components.map(component=>{
      const binding=slot.publicationBindings.find(b=>b.componentKey===component.componentKey);if(!binding)throw Error();
      const key=binding.recipeId+':'+binding.activePublicationRevision,title=titles.get(key);if(!title)throw Error();used.add(key);
      return {componentKey:component.componentKey,recipeId:binding.recipeId,publicationRevision:binding.activePublicationRevision,title,
       wholeRecipeMultiplier:component.wholeRecipeMultiplier,nutrition:component.nutrition,inputMass:component.inputMass};
     })}))}));
   if(used.size!==titles.size)throw Error();
   // Revalidate entitlement, revisions and exact retained bytes after the independent catalog await.
   const second=await deps.open(operation);
   if(second.status!=='SNAPSHOT_VERIFIED'||canonicalJsonV1(second.snapshot)!==canonicalJsonV1(first.snapshot))return unavailable('PROPOSAL_CHANGED_OR_NO_LONGER_CURRENT');
   if(await deps.authenticatedAccountId()!==account||enabled()!==true)return unavailable('SESSION_CHANGED_OR_DISABLED');
   return freeze({status:'PROPOSAL_PREVIEW' as const,contract:'potok-exact-plan-preview-v3' as const,purpose:'RETAINED_PROPOSAL_NOT_ACTIVE_PLAN' as const,
    requestOperationId:operation,accountId:account,graphDigest:graph.digest,retainedSnapshotDigest:first.snapshot.digest,
    weekStartLocal:graph.input.weekStartLocal,timezone:graph.input.timezone,days,nutrition:graph.nutrition,inputMass:graph.inputMass,
    planActivated:false as const,factsWritten:false as const});
  }catch{return unavailable('PREVIEW_SOURCE_INVALID_OR_UNAVAILABLE');}
 }});
}
