/** Offline source precheck queue for frozen19. NEVER a writer, reviewer or issuer. */
import { recoverFrozen19RetainedReferencesV1 } from './pilot-frozen19-retained-recovery-v1';

const pendingEvidenceBySource = Object.freeze({
  'SR28:01174':['PRODUCT_IDENTITY','MILK_FAT_2_PERCENT','NONFORTIFIED','EDIBLE_BASIS_AND_NUMERIC_APPLICABILITY'],
  'SR28:01287':['PRODUCT_IDENTITY','PLAIN_UNSWEETENED_GREEK','FAT_2_PERCENT','EDIBLE_BASIS_AND_NUMERIC_APPLICABILITY'],
  'SR28:20124':['PRODUCT_IDENTITY','COMMON_WHEAT_NOT_SPELT','DRY_UNCOOKED','EDIBLE_BASIS_AND_NUMERIC_APPLICABILITY'],
  'FDC_SR_LEGACY:168411:PREPARED:100G':['PRODUCT_IDENTITY','SHELLED_EDAMAME_NOT_MATURE_SOY','FROZEN_PREPARED_STATE','EDIBLE_BASIS_AND_NUMERIC_APPLICABILITY'],
  'FDC_SR_LEGACY:172420:DRY_RAW:100G':['PRODUCT_IDENTITY','BROWN_COLOR_NOT_PROVEN_BY_LEGACY_SOURCE','WHOLE_DRY_RAW_STATE','EDIBLE_BASIS_AND_NUMERIC_APPLICABILITY'],
} as const);

export function buildFrozen19SourcePrecheckQueueV1(){
  const r=recoverFrozen19RetainedReferencesV1();
  if(!r.allTenSourcePositionsLocated||r.retainedRowDigestsAvailable!==7||
    r.positionsRequiringOriginalRowRecheck!==3||r.completeTenRowMapping!==false)throw Error('INVALID_FROZEN19_PRECHECK_INPUT');
  const items=[...r.exactRowReferences.map(x=>({...x,originalRowRecheckRequired:false as const})),
    ...r.conditionalPositionRefs.map(x=>({...x,originalRowRecheckRequired:true as const}))
  ].map(x=>{
    const evidence=pendingEvidenceBySource[x.sourceRecord as keyof typeof pendingEvidenceBySource];
    if(!evidence)throw Error('INVALID_FROZEN19_PRECHECK_SOURCE');
    return {sourceRecord:x.sourceRecord,recipeId:x.recipeId,rowId:x.rowId,
      originalRowSha256:x.originalRowSha256,originalRowRecheckRequired:x.originalRowRecheckRequired,
      candidateFoodId:null,sourceApplicabilityApproved:false,identityApproved:false,
      requiredChecks:[...evidence,...(x.originalRowRecheckRequired?['ORIGINAL_ROW_SHA256']:[])],
      reviewStatus:'BLOCKED_UNTIL_INDEPENDENT_EVIDENCE' as const,
      sourceApproved:false as const,canApply:false as const};
  }).sort((a,b)=>a.recipeId.localeCompare(b.recipeId)||a.rowId.localeCompare(b.rowId));
  if(items.length!==10||new Set(items.map(x=>x.recipeId+'#'+x.rowId)).size!==10||
    items.filter(x=>x.originalRowRecheckRequired).length!==3)throw Error('INVALID_FROZEN19_PRECHECK_ROWS');
  const groups=Object.keys(pendingEvidenceBySource).map(sourceRecord=>({
    sourceRecord,count:items.filter(x=>x.sourceRecord===sourceRecord).length,
    approved:0,selectedFoodId:null
  }));
  if(groups.some(g=>g.count===0)||groups.reduce((n,g)=>n+g.count,0)!==10)throw Error('INVALID_FROZEN19_PRECHECK_FAMILIES');
  return {contract:'potok-frozen19-source-precheck-queue-v1',usage:'OFFLINE_REVIEW_ONLY_NOT_AUTHORITY',
    expectedRows:10,rowsWithOriginalDigest:7,rowsPendingOriginalDigest:3,
    groups,items,approvedBindings:0,catalogWrites:0,sourceApprovals:0,
    readyForServerSubmission:false,canApply:false,mayActivate:false};
}
