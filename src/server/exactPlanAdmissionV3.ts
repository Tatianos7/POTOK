/** Inactive transactional protocol for retaining exact PLAN proposals. No activation, SQL implementation or FACT write. */
import {canonicalJsonV1,adaptiveNutritionSha256HexV1} from '../utils/adaptiveNutritionWireV1';
import {decodeTrustedGenerationInputRawV1,trustedGenerationInputDigestV1,assessGenerationAuthorityRecheckV1,type GenerationAuthorityRecheckV1} from '../utils/adaptiveNutritionGraphV2';
import {parseExactValidationJsonRawV3 as parse} from './exactWeekNutritionValidationV3';
import type {ExactWeekOptimizationResultV3,ExactGeneratedWeekProposalV3} from './exactWeekOptimizationV3';
export const exactPlanAdmissionSourceContractV3='potok-exact-plan-locked-admission-source-v3' as const;
export const exactRetainedPlanContractV3='potok-exact-retained-plan-proposal-v3' as const;
export interface ExactPlanAdmissionSourceV3 {
 contract:typeof exactPlanAdmissionSourceContractV3;requestOperationId:string;actorAccountId:string;accountId:string;
 generationInputDigest:string;evaluatedProposalRawSha256:string|null;trustedGenerationInputRaw:string;currentAuthority:GenerationAuthorityRecheckV1;
}
export interface ExactRetainedPlanV3 {
 readonly contract:typeof exactRetainedPlanContractV3;readonly purpose:'RETAINED_PROPOSAL_NOT_ACTIVE_PLAN';
 readonly requestOperationId:string;readonly accountId:string;readonly generationInputDigest:string;readonly proposedPlanRevision:string;
 readonly proposalCanonicalRaw:string;readonly proposalRawSha256:string;readonly proposalDigest:string;readonly graphDigest:string;readonly optimizationResultDigest:string;
 readonly admissionSourceRawSha256:string;readonly facts:readonly [];readonly digest:string;
}
/** Trusted backend transaction dependency. Implement with one exclusive authenticated connection,
 * existing account/request/currentness locks, private immutable storage and unique request identity.
 * All optimizer source/metric reads must use this same transaction and held locks. No public callback.
 * transaction() resolves only after COMMIT acknowledgement; uncertain COMMIT must throw.
 */
export interface ExactPlanTransactionV3 {
 loadLockedCurrentRequestRaw(operation:string,canonicalProposalRawSha256:string|null):Promise<string|null>;
 optimize(operation:string):Promise<ExactWeekOptimizationResultV3>;
 readRetainedSnapshotRaw(operation:string):Promise<string|null>;
 insertSnapshotIfAbsentRaw(operation:string,accountId:string,generationInputDigest:string,canonicalSnapshotRaw:string):Promise<string>;
}
export interface ExactPlanTransactionalStoreV3 {
 transaction<T>(operation:string,work:(tx:ExactPlanTransactionV3)=>Promise<T>):Promise<T>;
}
export type ExactPlanAdmissionResultV3={readonly status:'SNAPSHOT_RECORDED'|'SNAPSHOT_REPLAY'|'SNAPSHOT_VERIFIED';readonly snapshot:ExactRetainedPlanV3;readonly planActivated:false;readonly factsWritten:false}
 |{readonly status:'BLOCKED'|'CONFLICT'|'ENTITLEMENT_DENIED'|'UNKNOWN_RETRYABLE'|'RECOVERY_UNRESOLVED';readonly reason:string;readonly planActivated:false;readonly factsWritten:false};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,hex=/^[a-f0-9]{64}$/;
const canonical=(v:unknown)=>canonicalJsonV1(v,'SAFE_INTEGER');
const sha=(raw:string)=>adaptiveNutritionSha256HexV1(new TextEncoder().encode(raw));
const hash=(payload:unknown)=>sha(canonical({domain:'potok-exact-retained-plan-proposal-sha256-v3',payload}));
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
function fail(code:string,status:'BLOCKED'|'CONFLICT'|'ENTITLEMENT_DENIED'='BLOCKED'):never{throw new AdmissionFailure(status,code);}
class AdmissionFailure extends Error{constructor(readonly status:'BLOCKED'|'CONFLICT'|'ENTITLEMENT_DENIED',message:string){super(message);}}
function record(v:unknown,keys:readonly string[]):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.prototype.hasOwnProperty.call(v,k)))fail('INVALID_ADMISSION_FIELDS');return v as Record<string,unknown>;}
function text(v:unknown):string{if(typeof v!=='string')fail('INVALID_ADMISSION_STRING');return v;}
function id(v:unknown):string{const s=text(v);if(!uuid.test(s))fail('INVALID_ADMISSION_UUID');return s;}
function digest(v:unknown):string{const s=text(v);if(!hex.test(s))fail('INVALID_ADMISSION_DIGEST');return s;}
const authorityKeys=['accountGateContract','accountId','selectionId','weekStartLocal','timezone','entitlement','planSelectionRevision','expectedStatus','expectedPlanRevision',
 'goalRevision','targetPolicyRevision','preferenceRevision','safetyRevision','entitlementEvidenceRevision','candidateManifestRevision','candidateManifestDigest','compositionPolicyRevision','validationPolicyRevision','optimizationPolicyRevision','generationPolicyRevision'] as const;
function authority(value:unknown):GenerationAuthorityRecheckV1{
 const r=record(value,authorityKeys);for(const key of authorityKeys){if(key==='expectedPlanRevision'){if(r[key]!==null)id(r[key]);}else if(key==='entitlement'){if(!['verified','revoked','expired'].includes(text(r[key])))fail('INVALID_ENTITLEMENT_STATE');}
  else if(key==='candidateManifestDigest')digest(r[key]);else if(['accountGateContract','weekStartLocal','timezone','expectedStatus'].includes(key)){if(text(r[key]).length>128)fail('INVALID_AUTHORITY_TEXT');}else id(r[key]);}
 return r as unknown as GenerationAuthorityRecheckV1;
}
async function current(tx:ExactPlanTransactionV3,operation:string,proposalHash:string|null){
 const raw=await tx.loadLockedCurrentRequestRaw(operation,proposalHash);if(raw===null)fail('CURRENT_REQUEST_UNAVAILABLE');
 const r=record(parse(raw,262144,12),['contract','requestOperationId','actorAccountId','accountId','generationInputDigest','evaluatedProposalRawSha256','trustedGenerationInputRaw','currentAuthority']);
 if(r.contract!==exactPlanAdmissionSourceContractV3||r.requestOperationId!==operation||r.evaluatedProposalRawSha256!==proposalHash)fail('CURRENT_REQUEST_BINDING_MISMATCH');
 const input=decodeTrustedGenerationInputRawV1(text(r.trustedGenerationInputRaw));
 if(input.operation.requestId!==operation||id(r.actorAccountId)!==input.accountId||id(r.accountId)!==input.accountId||digest(r.generationInputDigest)!==await trustedGenerationInputDigestV1(input))fail('AUTHENTICATED_ACCOUNT_OR_INPUT_MISMATCH');
 const checked=assessGenerationAuthorityRecheckV1(input,authority(r.currentAuthority));
 if(checked.status!=='GENERATION_VALID')fail(checked.reason,checked.status==='GENERATION_ENTITLEMENT_DENIED'?'ENTITLEMENT_DENIED':'CONFLICT');
 return {input,inputDigest:r.generationInputDigest as string,sourceHash:await sha(raw)};
}
async function decodeSnapshot(raw:string,operation:string,accountId:string,inputDigest:string,proposal:ExactGeneratedWeekProposalV3):Promise<ExactRetainedPlanV3>{
 const r=record(parse(raw,4_194_304,30),['contract','purpose','requestOperationId','accountId','generationInputDigest','proposedPlanRevision','proposalCanonicalRaw','proposalRawSha256','proposalDigest','graphDigest','optimizationResultDigest','admissionSourceRawSha256','facts','digest']);
 if(r.contract!==exactRetainedPlanContractV3||r.purpose!=='RETAINED_PROPOSAL_NOT_ACTIVE_PLAN'||r.requestOperationId!==operation||r.accountId!==accountId||r.generationInputDigest!==inputDigest||r.proposedPlanRevision!==proposal.graph.input.selection.proposedPlanRevision
  ||r.proposalCanonicalRaw!==canonical(proposal)||r.proposalRawSha256!==await sha(canonical(proposal))||r.proposalDigest!==proposal.digest||r.graphDigest!==proposal.graph.digest||r.optimizationResultDigest!==proposal.optimizationResultDigest||!Array.isArray(r.facts)||r.facts.length)fail('RETAINED_SNAPSHOT_BINDING_MISMATCH','CONFLICT');
 digest(r.admissionSourceRawSha256);const {digest:expected,...payload}=r;if(digest(expected)!==await hash(payload)||canonical(r)!==raw)fail('RETAINED_SNAPSHOT_BYTES_OR_DIGEST_CHANGED','CONFLICT');return freeze(r as unknown as ExactRetainedPlanV3);
}
/** No connection or enabled runtime is created. Backend composition must provide a real fenced transaction. */
export function createExactPlanAdmissionV3(store:ExactPlanTransactionalStoreV3,enabled:()=>boolean=()=>false){
 const assertEnabled=()=>{if(enabled()!==true)fail('EXACT_PLAN_ADMISSION_DISABLED');};
 async function run(operation:string,proposedRaw:string|null,recovery:boolean):Promise<ExactPlanAdmissionResultV3>{
  let dispatched=false;
  try{
   assertEnabled();id(operation);let canonicalProposal:string|null=null;
   if(proposedRaw!==null)canonicalProposal=canonical(parse(proposedRaw,2_097_152,28));
   const proposalHash=canonicalProposal===null?null:await sha(canonicalProposal);
   const result=await store.transaction(operation,async tx=>{
    assertEnabled();const admitted=await current(tx,operation,proposalHash);assertEnabled();
    const checked=await tx.optimize(operation);assertEnabled();if(checked.status!=='EXACT_WEEK_SELECTED_PENDING_STORAGE_ADMISSION')fail('EXACT_SELECTION_NO_LONGER_VALID');
    const proposal=checked.proposal,proposalRaw=canonical(proposal);
    if(proposal.requestOperationId!==operation||proposal.generationInputDigest!==admitted.inputDigest||canonical(proposal.graph.input)!==canonical(admitted.input))fail('EXACT_SELECTION_INPUT_MISMATCH');
    if(canonicalProposal!==null&&proposalRaw!==canonicalProposal)fail('PROPOSAL_CHANGED_SINCE_PREPARATION','CONFLICT');
    const fresh=await current(tx,operation,proposalHash);assertEnabled();if(fresh.sourceHash!==admitted.sourceHash)fail('CURRENT_ADMISSION_CHANGED_DURING_PREPARATION','CONFLICT');
    const existing=await tx.readRetainedSnapshotRaw(operation);assertEnabled();
    if(existing!==null){const snapshot=await decodeSnapshot(existing,operation,admitted.input.accountId,admitted.inputDigest,proposal);return freeze({status:proposedRaw===null?'SNAPSHOT_VERIFIED' as const:'SNAPSHOT_REPLAY' as const,snapshot,planActivated:false as const,factsWritten:false as const});}
    if(proposedRaw===null)return freeze({status:recovery?'RECOVERY_UNRESOLVED' as const:'BLOCKED' as const,reason:'NO_RETAINED_SNAPSHOT_VISIBLE',planActivated:false as const,factsWritten:false as const});
    const payload={contract:exactRetainedPlanContractV3,purpose:'RETAINED_PROPOSAL_NOT_ACTIVE_PLAN' as const,requestOperationId:operation,accountId:admitted.input.accountId,generationInputDigest:admitted.inputDigest,
     proposedPlanRevision:admitted.input.selection.proposedPlanRevision,proposalCanonicalRaw:proposalRaw,proposalRawSha256:await sha(proposalRaw),proposalDigest:proposal.digest,graphDigest:proposal.graph.digest,
     optimizationResultDigest:proposal.optimizationResultDigest,admissionSourceRawSha256:admitted.sourceHash,facts:[] as []};
    const expected=freeze({...payload,digest:await hash(payload)}),expectedRaw=canonical(expected);if(new TextEncoder().encode(expectedRaw).length>4_194_304)fail('RETAINED_SNAPSHOT_OUTPUT_BUDGET');assertEnabled();
    // Mark dispatch before awaiting: an error can occur after a successful COMMIT or lost acknowledgement.
    dispatched=true;const returned=await tx.insertSnapshotIfAbsentRaw(operation,admitted.input.accountId,admitted.inputDigest,expectedRaw);assertEnabled();
    const snapshot=await decodeSnapshot(returned,operation,admitted.input.accountId,admitted.inputDigest,proposal);
    return freeze({status:'SNAPSHOT_RECORDED' as const,snapshot,planActivated:false as const,factsWritten:false as const});
   });
   // Successful transaction callback alone is not a successful COMMIT; only store resolution reaches here.
   assertEnabled();return result;
  }catch(error){
   const uncertain=dispatched||error instanceof Error&&['GENERATION_SQL_COMMIT_UNKNOWN','GENERATION_SQL_COMMITTED_RELEASE_FAILED'].includes(error.message);
   if(uncertain)return freeze({status:'UNKNOWN_RETRYABLE',reason:'COMMIT_OR_ACKNOWLEDGEMENT_UNCERTAIN_USE_READ_ONLY_RECOVERY',planActivated:false,factsWritten:false});
   return freeze({status:error instanceof AdmissionFailure?error.status:'BLOCKED',reason:error instanceof AdmissionFailure?error.message:'EXACT_PLAN_TRANSACTION_UNAVAILABLE',planActivated:false,factsWritten:false});
  }
 }
 return Object.freeze({record:(operation:string,proposalRaw:string)=>run(operation,proposalRaw,false),open:(operation:string)=>run(operation,null,false),recover:(operation:string)=>run(operation,null,true)});
}
