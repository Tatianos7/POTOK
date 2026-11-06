/** Serialized synthetic transaction only. No SQL, source/metric issuer, hosted storage or activation. */
import {optimizationFixtureV3,raw,sha,id,copy} from './exactWeekOptimizationFixturesV3';
import {canonicalJsonV1} from '../../utils/adaptiveNutritionWireV1';
import type {GenerationAuthorityRecheckV1} from '../../utils/adaptiveNutritionGraphV2';
import {createExactPlanAdmissionV3,exactPlanAdmissionSourceContractV3,type ExactPlanAdmissionSourceV3,type ExactPlanTransactionV3} from '../exactPlanAdmissionV3';
export {raw,sha,id,copy};
export async function admissionFixtureV3(freshOptimization=false){
 const f=await optimizationFixtureV3(),selection=await f.adapter.optimize(f.operation);if(selection.status!=='EXACT_WEEK_SELECTED_PENDING_STORAGE_ADMISSION')throw Error();
 const proposal=selection.proposal,proposalRaw=canonicalJsonV1(proposal,'SAFE_INTEGER'),i=f.input;
 const recheck:GenerationAuthorityRecheckV1={accountGateContract:i.accountGateContract,accountId:i.accountId,selectionId:i.selection.selectionId,weekStartLocal:i.weekStartLocal,timezone:i.timezone,entitlement:'verified',
  planSelectionRevision:i.selection.planSelectionRevision,expectedStatus:'pending_generation',expectedPlanRevision:null,goalRevision:i.goalNutritionTarget.goalRevision,targetPolicyRevision:i.goalNutritionTarget.targetPolicyRevision,
  preferenceRevision:i.preferenceRevision,safetyRevision:i.safetyRevision,entitlementEvidenceRevision:i.entitlementEvidenceRevision,candidateManifestRevision:i.candidateManifestRevision,candidateManifestDigest:i.candidateManifestDigest,
  compositionPolicyRevision:i.compositionPolicyRevision,validationPolicyRevision:i.validationPolicyRevision,optimizationPolicyRevision:i.optimizationPolicyRevision,generationPolicyRevision:i.generationPolicyRevision};
 let enabled=true,admission:ExactPlanAdmissionSourceV3={contract:exactPlanAdmissionSourceContractV3,requestOperationId:f.operation,actorAccountId:i.accountId,accountId:i.accountId,generationInputDigest:proposal.generationInputDigest,
  evaluatedProposalRawSha256:sha(proposalRaw),trustedGenerationInputRaw:f.numeric.trustedGenerationInputRaw,currentAuthority:recheck};
 let afterOptimize:(()=>void)|null=null;let mode='normal',reads=0,writes=0,optimizations=0,commits=0;const rows=new Map<string,string>();let tail=Promise.resolve();
 const store={async transaction<T>(op:string,work:(tx:ExactPlanTransactionV3)=>Promise<T>):Promise<T>{
  const previous=tail;let release!:()=>void;tail=new Promise<void>(resolve=>{release=resolve;});await previous;
  const before=new Map(rows);let committed=false;
  try{
   const tx:ExactPlanTransactionV3={loadLockedCurrentRequestRaw:async(operation,proposalHash)=>{reads++;if(operation!==f.operation||op!==operation||mode==='no-source')return null;return raw({...admission,evaluatedProposalRawSha256:proposalHash});},
    optimize:async()=>{optimizations++;const result=freshOptimization?await f.adapter.optimize(f.operation):selection;afterOptimize?.();return result;},
    readRetainedSnapshotRaw:async operation=>rows.get(operation)??null,
    insertSnapshotIfAbsentRaw:async(operation,account,inputDigest,recordRaw)=>{writes++;if(account!==i.accountId||inputDigest!==proposal.generationInputDigest)throw Error();
     if(mode==='insert-fail')throw Error('transport');if(mode==='disable-after-dispatch')enabled=false;
     if(!rows.has(operation))rows.set(operation,recordRaw);return mode==='bad-return'?'{}':rows.get(operation)!;}};
   const value=await work(tx);if(mode==='before-commit')throw Error('transport');committed=true;commits++;
   if(mode==='lost-commit-ack')throw Error('GENERATION_SQL_COMMIT_UNKNOWN');return value;
  }catch(error){if(!committed){rows.clear();for(const [k,v] of before)rows.set(k,v);}throw error;}finally{release();}
 }};
 const service=createExactPlanAdmissionV3(store,()=>enabled);
 return {...f,proposal,proposalRaw,service,store,rows,recheck,admission,setAdmission:(value:ExactPlanAdmissionSourceV3)=>{admission=value;},setMode:(value:string)=>{mode=value;},setEnabled:(v:boolean)=>{enabled=v;},setAfterOptimize:(fn:()=>void)=>{afterOptimize=fn;},counts:()=>({reads,writes,optimizations,commits})};
}
