/**
 * V2 parallel catalogue review backlog. Offline-only evidence tasks, not a
 * product selector, authoring rewrite or runtime publication decision.
 */
import {buildPilotParallelDraftV2} from './pilot-parallel-catalog-draft-v2';
import {buildFrozen19SourcePrecheckQueueV1} from './pilot-frozen19-source-precheck-v1';
const invalid=():never=>{throw Error('INVALID_PILOT_V2_REVIEW_BACKLOG');};
export function buildPilotV2ReviewBacklog(){
 const draft=buildPilotParallelDraftV2(),precheck=buildFrozen19SourcePrecheckQueueV1();
 if(draft.recipeCount!==19||draft.unrecoveredFullRecipes!==19||precheck.expectedRows!==10||
    precheck.approvedBindings!==0||draft.sourceApprovals!==0||draft.canApply!==false)invalid();
 const tasks=precheck.items.map(row=>{
  const parent=draft.recipes.find(x=>x.recipeId===row.recipeId);
  if(parent===undefined)throw new Error('INVALID_PILOT_V2_REVIEW_BACKLOG');
  if(!parent.knownBlockedIngredients.some(x=>x.rowId===row.rowId&&
     x.sourceRecord===row.sourceRecord&&x.originalRowSha256===row.originalRowSha256))invalid();
  return {taskId:row.recipeId+'#'+row.rowId,recipeId:row.recipeId,rowId:row.rowId,
   sourceRecord:row.sourceRecord,priorRecipeSha256:parent.priorRecipeSha256,
   originalRowSha256:row.originalRowSha256,
   evidenceRequired:[...row.requiredChecks,'SOURCE_REVISION_AND_DIGEST',
     'CARBS_EXCLUDE_FIBER_PER_100G','INDEPENDENT_PRODUCT_IDENTITY_REVIEW'],
   reviewStage:row.originalRowRecheckRequired?'ORIGINAL_ROW_RECHECK_PENDING' as const:
    'PRODUCT_AND_SOURCE_REVIEW_PENDING' as const,
   selectedFoodId:null,weightG:null,macroValues:null,
   independentlyReviewed:false,approved:false,canApply:false};
 });
 const unique=new Set(tasks.map(x=>x.taskId));
 if(unique.size!==10||tasks.length!==10)invalid();
 const families=precheck.groups.map(f=>({
  sourceRecord:f.sourceRecord,
  rowReviewTasks:tasks.filter(t=>t.sourceRecord===f.sourceRecord).length,
  identityVerified:0,sourceVerified:0,readyForPublication:false
 }));
 if(families.reduce((s,f)=>s+f.rowReviewTasks,0)!==10)invalid();
 const recipeIntake=draft.recipes.map(recipe=>({
  recipeId:recipe.recipeId,priorRecipeSha256:recipe.priorRecipeSha256,
  fullOriginalIngredientListVerified:false,declaredServingsVerified:false,
  yieldAndCookingVerified:false,allergenAndDietaryEvidenceVerified:false,
  ingredientIdentityVerified:false,nutritionVerified:false,
  openKnownSourceTasks:tasks.filter(t=>t.recipeId===recipe.recipeId).length,
  admissionStatus:'NOT_REVIEWED' as const
 }));
 return {contract:'potok-parallel-pilot-review-backlog-v2',
  usage:'OFFLINE_REVIEW_TASKS_ONLY_NOT_ADMISSION',
  parentFreezeSha256:draft.parentFreezeSha256,
  recipeCount:recipeIntake.length,knownSourceTasks:tasks.length,
  originalRowRecheckNeeded:tasks.filter(t=>t.reviewStage==='ORIGINAL_ROW_RECHECK_PENDING').length,
  otherFullIngredientListsNotYetVerified:recipeIntake.length,
  families,recipeIntake,tasks,
  approvedBindings:0,sourceApprovals:0,catalogWrites:0,
  readyForServerSubmission:false,runtimePublishable:false,canApply:false,mayActivate:false};
}
