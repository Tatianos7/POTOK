/** Offline evidence only: provenance-recoverable subset of frozen19, not the full 10-row queue. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const base='docs/premium/retained-sources/';
const load=(p:string)=>readFileSync(new URL('../../'+base+p,import.meta.url),'utf8');
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const invalid=():never=>{throw Error('PILOT_RETAINED_RECOVERY_DRIFT');};
const wanted=new Map([
  ['SR28:01174',{kind:'SR28',record:'01174'}],
  ['SR28:01287',{kind:'SR28',record:'01287'}],
  ['SR28:20124',{kind:'SR28',record:'20124'}]
]);
export function recoverFrozen19RetainedReferencesV1() {
  const freeze=JSON.parse(load('pilot19-admission-20261105/pilot-input-freeze-content-v4-20261106.json'));
  const batch=JSON.parse(load('pilot-19-source-quantity-20261105/batch-review-v1.json'));
  const lentils=JSON.parse(load('nonfish-lentil-20261105/review-bindings-v1.json'));
  if(freeze.contract!=='potok-pilot-input-freeze-v1'||freeze.recipes?.length!==19||
    batch.contract!=='potok-pilot-19-source-quantity-review-v1'||batch.rows?.length!==88||
    batch.candidateBytesSha256!==freeze.candidateBytesSha256||
    lentils.candidateBytesSha256!==freeze.candidateBytesSha256||
    freeze.sourceApproved!==false||batch.sourceApproved!==false||lentils.sourceApproved!==false)invalid();
  const recipeIds=new Set<string>(freeze.recipes.map((r:{recipeId:string})=>r.recipeId));
  const exact=[...wanted].flatMap(([sourceRecord,ref])=>batch.rows.filter((r:any)=>
    recipeIds.has(r.recipeId)&&r.sourceCandidate?.kind===ref.kind&&String(r.sourceCandidate?.record)===ref.record
  ).map((r:any)=>({sourceRecord,recipeId:r.recipeId,rowId:r.ingredientRowId,
    originalRowSha256:r.sourceAuthoringRowSha256,identityStatus:'NOT_VERIFIED',sourceApproved:false as const})));
  if(exact.length!==4||new Set(exact.map(r=>r.recipeId+':'+r.rowId)).size!==4)invalid();
  const recipeOnly:( {sourceRecord:string;recipeId:string;recipeSha256:string;rowId:null;identityStatus:'NOT_VERIFIED';sourceApproved:false} )[]=lentils.rows.map((r:{recipeId:string;recipeSha256:string})=>({
    sourceRecord:'FDC_SR_LEGACY:172420:DRY_RAW:100G',recipeId:r.recipeId,
    recipeSha256:r.recipeSha256,rowId:null,identityStatus:'NOT_VERIFIED' as const,
    sourceApproved:false as const
  }));
  if(recipeOnly.length!==2||recipeOnly.some((r:any)=>!recipeIds.has(r.recipeId)))invalid();
  const sourceBindings={batchReviewSha256:digest(load('pilot-19-source-quantity-20261105/batch-review-v1.json')),
    lentilReviewSha256:digest(load('nonfish-lentil-20261105/review-bindings-v1.json'))};
  return {contract:'potok-frozen19-retained-partial-provenance-v1',usage:'OFFLINE_PARTIAL_EVIDENCE_NOT_COMPLETE_QUEUE',
    recipeCount:19,expectedUnresolvedIngredientRows:10,exactRowReferences:exact,
    recipeOnlyReferences:recipeOnly,sourceBindings,completeTenRowMapping:false,
    noClaimsForUnmappedRows:true,readyForServerSubmission:false,canApply:false,mayActivate:false};
}
