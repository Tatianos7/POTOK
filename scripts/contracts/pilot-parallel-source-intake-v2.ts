/** Candidate evidence intake for parallel pilot V2. Strict structure is NOT source approval. */
import {buildPilotV2ReviewBacklog} from './pilot-parallel-review-backlog-v2';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {createHash} from 'node:crypto';

const invalid=():never=>{throw Error('INVALID_PILOT_V2_SOURCE_INTAKE');};
const hex=/^[0-9a-f]{64}$/;
const num=/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;
const keys=(o:Record<string,unknown>,names:readonly string[])=>
 Object.keys(o).length===names.length&&names.every(k=>Object.prototype.hasOwnProperty.call(o,k));
const obj=(x:unknown):Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:invalid();
const text=(x:unknown)=>typeof x==='string'&&x.length>0&&x.length<=256?x:invalid();
const macro=(x:unknown)=>typeof x==='string'&&num.test(x)&&Number.isFinite(Number(x))&&Number(x)<=1000?x:invalid();
const exact=['contract','taskId','recipeSha256','sourceRecord','sourceDocumentId','sourceRevision','sourceDigest',
 'productDescription','foodState','edibleBasis','calories','protein','fat','carbs','fiber','carbsExcludeFiber','originalRowSha256'] as const;
export function inspectPilotV2SourceCandidateRaw(raw:string){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>20000)invalid();
 assertRawJsonWithoutDuplicateKeysV1(raw);
 const v=obj(JSON.parse(raw));if(!keys(v,exact)||v.contract!=='potok-parallel-pilot-source-candidate-v2')invalid();
 const taskId=text(v.taskId),backlog=buildPilotV2ReviewBacklog();
 const task=backlog.tasks.find(t=>t.taskId===taskId);
 if(task===undefined)throw new Error('INVALID_PILOT_V2_SOURCE_INTAKE');
 if(v.recipeSha256!==task.priorRecipeSha256||v.sourceRecord!==task.sourceRecord)invalid();
 const docId=text(v.sourceDocumentId),revision=text(v.sourceRevision),description=text(v.productDescription);
 const state=text(v.foodState),basis=text(v.edibleBasis);
 if(!hex.test(String(v.sourceDigest))||v.carbsExcludeFiber!==true)invalid();
 if(v.originalRowSha256!==null&&(!hex.test(String(v.originalRowSha256))))invalid();
 // Retained hashes cannot be replaced by a different candidate.
 if(task.originalRowSha256!==null&&v.originalRowSha256!==task.originalRowSha256)invalid();
 const values=[v.calories,v.protein,v.fat,v.carbs,v.fiber].map(macro);
 const reasons:string[]=['INDEPENDENT_SOURCE_AUTHENTICITY_UNVERIFIED','RECIPE_TO_FOOD_IDENTITY_UNVERIFIED',
  'NUTRITION_APPLICABILITY_UNVERIFIED','REVIEWER_ATTESTATION_MISSING'];
 if(task.originalRowSha256===null)reasons.push('ORIGINAL_AUTHORING_ROW_NOT_REVERIFIED');
 if(v.originalRowSha256===null)reasons.push('ORIGINAL_ROW_HASH_MISSING');
 const combined=Number(values[1])+Number(values[2])+Number(values[3])+Number(values[4]);
 if(combined>100.01)reasons.push('PER_100G_MASS_BALANCE_REVIEW');
 if(Number(values[0])>900)reasons.push('ENERGY_PER_100G_PLAUSIBILITY_REVIEW');
 // Family variant identity is never established by a prose label.
 if(task.sourceRecord==='FDC_SR_LEGACY:172420:DRY_RAW:100G')reasons.push('BROWN_LENTIL_VARIETY_NOT_ESTABLISHED');
 if(task.sourceRecord==='SR28:20124')reasons.push('COMMON_WHEAT_AND_DRY_BASIS_NOT_ESTABLISHED');
 return {contract:'potok-parallel-pilot-source-intake-result-v2',taskId,sourceRecord:task.sourceRecord,
  candidateDigest:createHash('sha256').update(raw).digest('hex'),
  sourceDocumentId:docId,sourceRevision:revision,sourceDigest:v.sourceDigest,
  productDescription:description,foodState:state,edibleBasis:basis,
  macroValues:values,reviewReasons:reasons,
  sourceApproved:false as const,identityApproved:false as const,canApply:false as const,
  readyForServerSubmission:false as const,runtimePublishable:false as const};
}
