/** Private, offline per-occurrence queue. Never selects an identity or issues any review request. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { assertRawJsonWithoutDuplicateKeysV1 } from '../../src/utils/adaptiveNutritionWireV1';

export const unresolvedPilotFamilyKeysV1 = Object.freeze([
  'FDC_SR_LEGACY:168411:PREPARED:100G',
  'FDC_SR_LEGACY:172420:DRY_RAW:100G',
  'SR28:01174','SR28:01287','SR28:20124',
] as const);
const keySet = new Set<string>(unresolvedPilotFamilyKeysV1);
const digest = (s:string) => createHash('sha256').update(s).digest('hex');
const invalid = ():never => { throw Error('PILOT_UNRESOLVED_OCCURRENCE_QUEUE_INVALID'); };
type Occurrence = {recipeId:string;rowId:string;quantityG:string|null;quantityDecision:string;optional:boolean};
type Group = {sourceRecord:string;componentKind:string;occurrences:number;occurrenceRefs:Occurrence[];
  candidates:{disposition:string;selected:boolean;sourceApplicabilityApproved:boolean}[];selectedCanonicalFoodId:null};
type Packet = {contract:string;usage:string;observation:{projectId:string;capturedAt:string};
  summary:{recipes:number;foodRows:number;foodRowsWithoutFamilyCandidates:number;approvedBindings:number;catalogWrites:number;sourceApprovals:number};
  groups:Group[];canApply:false;sourceApproved:false;readyForServerSubmission:false;mayActivate:false;
  proposedFoodCreates:unknown[];proposedFoodUpdates:unknown[];sourceApprovalRequests:unknown[]};
export function buildPilotUnresolvedOccurrenceQueueV1(privateReviewRaw:string) {
  if (Buffer.byteLength(privateReviewRaw)>15_000_000) invalid();
  assertRawJsonWithoutDuplicateKeysV1(privateReviewRaw);
  const p = JSON.parse(privateReviewRaw) as Packet;
  if (!p || p.contract!=='potok-pilot-family-identity-review-v2' || p.usage!=='PRIVATE_REVIEW_QUEUE_NOT_CATALOG_PATCH_OR_AUTHORITY'
      || p.observation?.projectId!=='ozidryfvhkcbtpnulakq'
      || !Number.isFinite(Date.parse(p.observation.capturedAt))
      || p.summary?.recipes!==19 || p.summary.foodRows!==69 || p.summary.foodRowsWithoutFamilyCandidates!==10
      || p.summary.approvedBindings!==0 || p.summary.catalogWrites!==0 || p.summary.sourceApprovals!==0
      || p.canApply!==false || p.sourceApproved!==false || p.readyForServerSubmission!==false || p.mayActivate!==false
      || !Array.isArray(p.groups) || !Array.isArray(p.proposedFoodCreates) || p.proposedFoodCreates.length
      || !Array.isArray(p.proposedFoodUpdates) || p.proposedFoodUpdates.length
      || !Array.isArray(p.sourceApprovalRequests) || p.sourceApprovalRequests.length) invalid();
  const selected = p.groups.filter(g=>keySet.has(g.sourceRecord));
  if (selected.length!==unresolvedPilotFamilyKeysV1.length ||
      new Set(selected.map(g=>g.sourceRecord)).size!==selected.length) invalid();
  const occurrences: {sourceRecord:string;recipeId:string;rowId:string;quantityG:string|null;quantityDecision:string;optional:boolean;
    resolution:'INDEPENDENT_SOURCE_AND_IDENTITY_PRECHECK_REQUIRED';selectedCanonicalFoodId:null;canApply:false}[] = [];
  for (const g of selected) {
    if (g.componentKind!=='FOOD' || !Number.isSafeInteger(g.occurrences) || g.occurrences<1
      || !Array.isArray(g.occurrenceRefs) || g.occurrenceRefs.length!==g.occurrences
      || !Array.isArray(g.candidates) || g.candidates.some(c=>c.disposition==='CANDIDATE_FOR_REVIEW'||c.selected!==false||c.sourceApplicabilityApproved!==false)
      || g.selectedCanonicalFoodId!==null) invalid();
    for (const o of g.occurrenceRefs) {
      if (typeof o.recipeId!=='string'||!o.recipeId||typeof o.rowId!=='string'||!o.rowId
        || !(o.quantityG===null||(typeof o.quantityG==='string'&&/^\\d+(?:\\.\\d+)?$/.test(o.quantityG)))
        || typeof o.quantityDecision!=='string'||!o.quantityDecision||typeof o.optional!=='boolean') invalid();
      occurrences.push({sourceRecord:g.sourceRecord,recipeId:o.recipeId,rowId:o.rowId,
        quantityG:o.quantityG,quantityDecision:o.quantityDecision,optional:o.optional,
        resolution:'INDEPENDENT_SOURCE_AND_IDENTITY_PRECHECK_REQUIRED',
        selectedCanonicalFoodId:null,canApply:false});
    }
  }
  if (occurrences.length!==10 || new Set(occurrences.map(o=>o.recipeId+'\\0'+o.rowId)).size!==10) invalid();
  occurrences.sort((a,b)=>a.recipeId.localeCompare(b.recipeId)||a.rowId.localeCompare(b.rowId));
  return {contract:'potok-pilot-unresolved-occurrence-queue-v1',usage:'LOCAL_PRIVATE_REVIEW_ONLY',
    projectId:'ozidryfvhkcbtpnulakq',capturedAt:p.observation.capturedAt,
    inputSha256:digest(privateReviewRaw),recipesInPilot:19,foodRowsInPilot:69,
    unresolvedRows:10,unresolvedFamilies:5,occurrences,
    catalogWrites:0,sourceApprovals:0,readyForServerSubmission:false,canApply:false,mayActivate:false };
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  if (process.argv.length!==3) throw Error('Usage: node --import tsx scripts/contracts/pilot-unresolved-occurrence-queue-v1.ts PRIVATE_REVIEW.json');
  process.stdout.write(JSON.stringify(buildPilotUnresolvedOccurrenceQueueV1(readFileSync(process.argv[2],'utf8')),null,2)+'\n');
}
