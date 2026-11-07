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
  const expansion=JSON.parse(load('source-gaps-expansion-20261105/expansion-bindings-v1.json'));
  if(freeze.contract!=='potok-pilot-input-freeze-v1'||freeze.recipes?.length!==19||
    batch.contract!=='potok-pilot-19-source-quantity-review-v1'||batch.rows?.length!==88||
    batch.candidateBytesSha256!==freeze.candidateBytesSha256||
    lentils.candidateBytesSha256!==freeze.candidateBytesSha256||
    expansion.candidateBytesSha256!==freeze.candidateBytesSha256||
    expansion.sourceApproved!==false||
    freeze.sourceApproved!==false||batch.sourceApproved!==false||lentils.sourceApproved!==false)invalid();
  const recipeIds=new Set<string>(freeze.recipes.map((r:{recipeId:string})=>r.recipeId));
  const exact=[...wanted].flatMap(([sourceRecord,ref])=>batch.rows.filter((r:any)=>
    recipeIds.has(r.recipeId)&&r.sourceCandidate?.kind===ref.kind&&String(r.sourceCandidate?.record)===ref.record
  ).map((r:any)=>({sourceRecord,recipeId:r.recipeId,rowId:r.ingredientRowId,
    originalRowSha256:r.sourceAuthoringRowSha256,identityStatus:'NOT_VERIFIED',sourceApproved:false as const})));
  if(exact.length!==4||new Set(exact.map(r=>r.recipeId+':'+r.rowId)).size!==4)invalid();
  const edamameRows=expansion.rows.filter((r:{recipeId:string})=>r.recipeId==='lemon_shelled_edamame');
  if(edamameRows.length!==1 || !recipeIds.has('lemon_shelled_edamame'))invalid();
  const edamame=edamameRows[0].ingredientRows.filter((r:{ingredientRowId:string})=>r.ingredientRowId==='lemon_shelled_edamame_ing_01');
  if(edamame.length!==1||!/^[a-f0-9]{64}$/.test(edamame[0].sha256))invalid();
  exact.push({sourceRecord:'FDC_SR_LEGACY:168411:PREPARED:100G',recipeId:'lemon_shelled_edamame',
    rowId:edamame[0].ingredientRowId,originalRowSha256:edamame[0].sha256,
    identityStatus:'NOT_VERIFIED',sourceApproved:false});
  // The selected-breakfast contract maps milk to the second apple and third
  // pumpkin ingredient. Their original row digests survive in expansion bindings.
  for(const [recipeId,rowId] of [
    ['oatmeal_apple_cinnamon','oatmeal_apple_cinnamon_ing_02'],
    ['oatmeal_pumpkin','oatmeal_pumpkin_ing_03']
  ] as const) {
    const matches=expansion.rows.filter((r:{recipeId:string})=>r.recipeId===recipeId);
    if(matches.length!==1 || !recipeIds.has(recipeId))invalid();
    const rows=matches[0].ingredientRows.filter((r:{ingredientRowId:string})=>r.ingredientRowId===rowId);
    if(rows.length!==1||!/^[a-f0-9]{64}$/.test(rows[0].sha256))invalid();
    exact.push({sourceRecord:'SR28:01174',recipeId,rowId,
      originalRowSha256:rows[0].sha256,identityStatus:'NOT_VERIFIED',sourceApproved:false});
  }
  if(exact.length!==7 || new Set(exact.map(x=>x.recipeId+':'+x.rowId)).size!==7)invalid();
  const recipeOnly:( {sourceRecord:string;recipeId:string;recipeSha256:string;rowId:null;identityStatus:'NOT_VERIFIED';sourceApproved:false} )[]=lentils.rows.map((r:{recipeId:string;recipeSha256:string})=>({
    sourceRecord:'FDC_SR_LEGACY:172420:DRY_RAW:100G',recipeId:r.recipeId,
    recipeSha256:r.recipeSha256,rowId:null,identityStatus:'NOT_VERIFIED' as const,
    sourceApproved:false as const
  }));
  if(recipeOnly.length!==2||recipeOnly.some((r:any)=>!recipeIds.has(r.recipeId)))invalid();
  // Contractual model requires the 'whole_brown_lentils' ingredient at these
  // positions, but the retained review binds only whole-recipe digests.
  // These are conditional position references, NOT independently pinned row hashes.
  const lentilModelPositionRefs=recipeOnly.map(r=>({
    sourceRecord:r.sourceRecord,recipeId:r.recipeId,
    rowId:r.recipeId+'_ing_'+(r.recipeId==='brown_lentils_rice_carrot'?'01':'02'),
    recipeSha256:r.recipeSha256,originalRowSha256:null,
    evidenceBasis:'MODEL_CONTRACT_POSITION_WITH_PINNED_RECIPE_DIGEST_ONLY' as const,
    requiresOriginalRowRecheck:true as const,identityStatus:'NOT_VERIFIED' as const,
    sourceApproved:false as const
  }));
  if(lentilModelPositionRefs.length!==2 || new Set(lentilModelPositionRefs.map(x=>x.rowId)).size!==2)invalid();
  // Whole-wheat pasta also occurs in the lentil recipe's pinned model contract.
  // No original ingredient SHA was retained at this boundary: keep conditional.
  const pastaLentilRecipe=recipeOnly.find(r=>r.recipeId==='whole_wheat_pasta_lentils_tomato');
  if(pastaLentilRecipe===undefined)throw new Error('PILOT_RETAINED_RECOVERY_DRIFT');
  const pastaModelPositionRef={
    sourceRecord:'SR28:20124',recipeId:pastaLentilRecipe.recipeId,
    rowId:'whole_wheat_pasta_lentils_tomato_ing_01',
    recipeSha256:pastaLentilRecipe.recipeSha256,originalRowSha256:null,
    evidenceBasis:'MODEL_CONTRACT_POSITION_WITH_PINNED_RECIPE_DIGEST_ONLY' as const,
    requiresOriginalRowRecheck:true as const,
    identityStatus:'NOT_VERIFIED' as const,sourceApproved:false as const
  };
  const conditionalPositionRefs=[...lentilModelPositionRefs,pastaModelPositionRef];
  if(new Set([...exact,...conditionalPositionRefs].map(r=>r.recipeId+':'+r.rowId)).size!==10)invalid();
  const sourceBindings={batchReviewSha256:digest(load('pilot-19-source-quantity-20261105/batch-review-v1.json')),
    lentilReviewSha256:digest(load('nonfish-lentil-20261105/review-bindings-v1.json')),
    expansionReviewSha256:digest(load('source-gaps-expansion-20261105/expansion-bindings-v1.json'))};
  return {contract:'potok-frozen19-retained-partial-provenance-v1',usage:'OFFLINE_PARTIAL_EVIDENCE_NOT_COMPLETE_QUEUE',
    recipeCount:19,expectedUnresolvedIngredientRows:10,exactRowReferences:exact,
    recipeOnlyReferences:recipeOnly,lentilModelPositionRefs,pastaModelPositionRef,conditionalPositionRefs,sourceBindings,
    allTenSourcePositionsLocated:true,retainedRowDigestsAvailable:exact.length,
    positionsRequiringOriginalRowRecheck:conditionalPositionRefs.length,completeTenRowMapping:false,
    noClaimsForUnmappedRows:true,readyForServerSubmission:false,canApply:false,mayActivate:false};
}
