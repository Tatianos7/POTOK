/**
 * Parallel catalogue V2 draft inventory, exclusively from immutable retained
 * recipe digests and the fail-closed ten-occurrence queue. No invented recipe
 * content, servings, yields, macros, food IDs or runtime publication.
 */
import {readFileSync} from 'node:fs';
import {pilotDigestV1} from './pilot-admission-readiness-v1';
import {buildFrozen19SourcePrecheckQueueV1} from './pilot-frozen19-source-precheck-v1';
const freezePath='docs/premium/retained-sources/pilot19-admission-20261105/pilot-input-freeze-content-v4-20261106.json';
const read=()=>readFileSync(new URL('../../'+freezePath,import.meta.url),'utf8');
const hash=/^[a-f0-9]{64}$/;
const invalid=():never=>{throw Error('INVALID_PILOT_PARALLEL_DRAFT_V2');};
type RecipePin={recipeId:string;authoringRecipeSha256:string;modelSha256:string;componentRows:number};
export function buildPilotParallelDraftV2(){
 const freezeRaw=read();
 const freeze=JSON.parse(freezeRaw) as {contract:string;candidateBytesSha256:string;inputSetSha256:string;
  recipes:RecipePin[];sourceApproved:boolean;runtimePublishable:boolean;canApply:boolean;mayActivate:boolean};
 if(freeze.contract!=='potok-pilot-input-freeze-v1'||freeze.recipes.length!==19||
   freeze.sourceApproved!==false||freeze.runtimePublishable!==false||freeze.canApply!==false||freeze.mayActivate!==false||
   !hash.test(freeze.candidateBytesSha256)||!hash.test(freeze.inputSetSha256))invalid();
 const queue=buildFrozen19SourcePrecheckQueueV1();
 if(queue.expectedRows!==10||queue.rowsWithOriginalDigest!==7||queue.rowsPendingOriginalDigest!==3||
    queue.approvedBindings!==0||queue.canApply!==false)invalid();
 const ids=new Set<string>();
 const recipes=freeze.recipes.map(r=>{
   if(!/^[a-z][a-z0-9_]{1,127}$/.test(r.recipeId)||ids.has(r.recipeId)||
      !hash.test(r.authoringRecipeSha256)||!hash.test(r.modelSha256)||
      !Number.isSafeInteger(r.componentRows)||r.componentRows<1||r.componentRows>100)invalid();
   ids.add(r.recipeId);
   const open=queue.items.filter(x=>x.recipeId===r.recipeId).map(x=>({
     rowId:x.rowId,sourceRecord:x.sourceRecord,originalRowSha256:x.originalRowSha256,
     originalRowRecheckRequired:x.originalRowRecheckRequired,
     canonicalFoodId:null,sourceApproval:null,status:'REQUIRES_INDEPENDENT_REVIEW' as const
   }));
   if(open.length>r.componentRows)invalid();
   // The full ingredient payload was not retained. Unknown rows must not
   // be represented as blank products with fabricated identities or amounts.
   return {recipeId:r.recipeId,priorRecipeSha256:r.authoringRecipeSha256,priorModelSha256:r.modelSha256,
     expectedComponentRows:r.componentRows,knownBlockedIngredients:open,
     remainingIngredientDetails:'REQUIRE_REVIEWED_INPUT_CATALOG' as const,
     servings:null,declaredYieldG:null,ingredients:null,nutrition:null,
     recipeStatus:'INCOMPLETE_DRAFT_NOT_PUBLISHABLE' as const};
 });
 if(queue.items.some(x=>!ids.has(x.recipeId))||
    recipes.reduce((sum,r)=>sum+r.knownBlockedIngredients.length,0)!==10)invalid();
 return {contract:'potok-parallel-pilot-catalog-draft-v2',
   usage:'OFFLINE_DRAFT_INDEX_NOT_RECIPE_DATA_OR_RUNTIME_AUTHORITY',
   parentFreezePath:freezePath,parentFreezeSha256:pilotDigestV1(freezeRaw),
   originalCandidateSha256:freeze.candidateBytesSha256,originalInputSetSha256:freeze.inputSetSha256,
   recipeCount:19,knownUnresolvedOccurrences:10,originalRowDigestsAvailable:7,
   originalRowRecheckRequired:3,unrecoveredFullRecipes:19,
   recipes,allowAutoWrite:false,approvedBindings:0,sourceApprovals:0,catalogWrites:0,
   readyForServerSubmission:false,runtimePublishable:false,sourceApproved:false,
   canApply:false,mayActivate:false};
}
