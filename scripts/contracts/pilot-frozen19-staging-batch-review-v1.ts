/**
 * Offline, read-only review of a bounded Staging observation. Never selects
 * food identity, writes data or creates runtime admission evidence.
 */
import {buildFrozen19SourcePrecheckQueueV1} from './pilot-frozen19-source-precheck-v1';
import {screenFrozen19StagingCandidateV1} from './pilot-frozen19-staging-candidate-screen-v1';

const expectedProject='ozidryfvhkcbtpnulakq';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type FoodObservation=Parameters<typeof screenFrozen19StagingCandidateV1>[1];
export type Frozen19StagingObservationV1={
  projectId:string;capturedAt:string;
  candidates:{sourceRecord:string;food:FoodObservation}[];
};
function invalid():never{throw Error('INVALID_FROZEN19_STAGING_BATCH');}
export function reviewFrozen19StagingSnapshotV1(snapshot:Frozen19StagingObservationV1,nowIso:string){
  if(!snapshot||typeof snapshot!=='object'||snapshot.projectId!==expectedProject||
    !Array.isArray(snapshot.candidates)||snapshot.candidates.length>200||
    typeof snapshot.capturedAt!=='string'||typeof nowIso!=='string')invalid();
  const time=Date.parse(snapshot.capturedAt),now=Date.parse(nowIso);
  if(!Number.isFinite(time)||!Number.isFinite(now)||!/^\d{4}-\d{2}-\d{2}T/.test(snapshot.capturedAt)||
    time>now||now-time>24*60*60*1000)invalid();
  const queue=buildFrozen19SourcePrecheckQueueV1();
  const sourceKeys=new Set(queue.groups.map(x=>x.sourceRecord));
  const seen=new Set<string>();
  const observations=snapshot.candidates.map(({sourceRecord,food})=>{
    if(!sourceKeys.has(sourceRecord)||!food||!uuid.test(food.id))invalid();
    const key=sourceRecord+':'+food.id;
    if(seen.has(key))invalid();seen.add(key);
    return screenFrozen19StagingCandidateV1(sourceRecord,food);
  });
  const families=queue.groups.map(g=>{
    const rows=observations.filter(x=>x.sourceRecord===g.sourceRecord);
    return {sourceRecord:g.sourceRecord,expectedOccurrences:g.count,
      observedCandidateCount:rows.length,
      candidatesWithStructuralBlockers:rows.filter(x=>x.missing.some(m=>![
        'SOURCE_APPLICABILITY_INDEPENDENT_REVIEW_REQUIRED',
        'VISIBLE_TO_REAL_CALLER_NOT_CONFIRMED'
      ].includes(m))).length,
      independentlyApprovedCandidates:0,selectedFoodId:null,
      disposition:'UNRESOLVED_SOURCE_PRECHECK' as const};
  });
  return {contract:'potok-frozen19-staging-batch-observation-v1',
    projectId:expectedProject,capturedAt:snapshot.capturedAt,
    expectedOccurrences:10,originalRowHashesStillNeeded:3,
    candidateObservations:observations.length,families,
    observations,authoritativeSourceApproval:false,
    approvedBindings:0,catalogWrites:0,readyForServerSubmission:false,canApply:false,mayActivate:false};
}
